"""
روتر البث المباشر المحسّن - Live Stream Router
==============================================
إدارة البث الحي للكاميرات المتعددة مع الكشف في الوقت الحقيقي
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, List, Optional, Set
from datetime import datetime
import asyncio
import json
import cv2
import base64
import logging
from dataclasses import dataclass, asdict

from app.services.multi_camera import (
    MultiCameraProcessor, 
    CameraConfig, 
    FramePriority,
    DetectionResult
)
from app.services.detector import WeaponDetector, get_detector

logger = logging.getLogger("نظرة.البث_الحي")

router = APIRouter(prefix="/live", tags=["البث الحي"])


# =====================================
# WebSocket Connection Manager
# =====================================

class ConnectionManager:
    """مدير اتصالات WebSocket"""
    
    def __init__(self):
        # camera_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> camera_id
        self.connection_cameras: Dict[WebSocket, str] = {}
        # subscribers for all cameras
        self.broadcast_subscribers: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, camera_id: Optional[str] = None):
        """اتصال جديد"""
        await websocket.accept()
        
        if camera_id:
            if camera_id not in self.active_connections:
                self.active_connections[camera_id] = set()
            self.active_connections[camera_id].add(websocket)
            self.connection_cameras[websocket] = camera_id
        else:
            self.broadcast_subscribers.add(websocket)
        
        logger.info(f"🔗 اتصال WebSocket جديد - كاميرا: {camera_id or 'all'}")
    
    def disconnect(self, websocket: WebSocket):
        """قطع الاتصال"""
        camera_id = self.connection_cameras.pop(websocket, None)
        if camera_id and camera_id in self.active_connections:
            self.active_connections[camera_id].discard(websocket)
        self.broadcast_subscribers.discard(websocket)
        logger.info(f"🔌 قطع اتصال WebSocket - كاميرا: {camera_id or 'all'}")
    
    async def send_to_camera(self, camera_id: str, message: dict):
        """إرسال لمشتركي كاميرا معينة"""
        connections = self.active_connections.get(camera_id, set())
        dead_connections = set()
        
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.add(ws)
        
        # تنظيف الاتصالات الميتة
        for ws in dead_connections:
            self.disconnect(ws)
    
    async def broadcast(self, message: dict):
        """إرسال للجميع"""
        dead_connections = set()
        
        for ws in self.broadcast_subscribers:
            try:
                await ws.send_json(message)
            except Exception:
                dead_connections.add(ws)
        
        for ws in dead_connections:
            self.disconnect(ws)
    
    async def broadcast_alert(self, alert: dict):
        """إرسال تنبيه للجميع"""
        message = {
            "type": "alert",
            "data": alert,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message)
        
        # أيضاً لمشتركي الكاميرا المحددة
        camera_id = alert.get("camera_id")
        if camera_id:
            await self.send_to_camera(camera_id, message)


# Manager عام
ws_manager = ConnectionManager()

# Multi-camera processor (سيتم تهيئته عند البدء)
camera_processor: Optional[MultiCameraProcessor] = None


# =====================================
# تهيئة المعالج
# =====================================

async def init_camera_processor():
    """تهيئة معالج الكاميرات"""
    global camera_processor
    
    if camera_processor is not None:
        return camera_processor
    
    # الحصول على الكاشف
    detector = await get_detector()
    
    # التأكد من تحميل النموذج
    if not detector.is_loaded:
        await detector.load_model()
    
    camera_processor = MultiCameraProcessor(
        detector=detector,
        max_cameras=8,
        detection_workers=2
    )
    
    # تعيين callbacks
    async def on_alert(camera_id: str, alert: dict):
        """عند اكتشاف سلاح"""
        await ws_manager.broadcast_alert(alert)
    
    async def on_detection(camera_id: str, result: DetectionResult):
        """عند أي كشف"""
        message = {
            "type": "detection",
            "camera_id": camera_id,
            "detections": result.detections,
            "processing_time_ms": result.processing_time * 1000,
            "timestamp": datetime.utcnow().isoformat()
        }
        await ws_manager.send_to_camera(camera_id, message)
    
    camera_processor.on_alert = on_alert
    camera_processor.on_detection = on_detection
    
    # بدء المعالجة
    await camera_processor.start()
    
    logger.info("✅ تم تهيئة معالج الكاميرات المتعددة")
    return camera_processor


# =====================================
# API Endpoints
# =====================================

@router.on_event("startup")
async def startup():
    """عند بدء التطبيق"""
    # لا نبدأ المعالج تلقائياً - سيبدأ عند الحاجة
    pass


@router.get("/status")
async def get_live_status():
    """حالة نظام البث الحي"""
    global camera_processor
    
    if camera_processor is None:
        return {
            "initialized": False,
            "message": "معالج الكاميرات غير مهيأ بعد"
        }
    
    stats = camera_processor.get_stats()
    return {
        "initialized": True,
        "stats": stats,
        "websocket_connections": {
            "camera_subscribers": {
                cam_id: len(conns) 
                for cam_id, conns in ws_manager.active_connections.items()
            },
            "broadcast_subscribers": len(ws_manager.broadcast_subscribers)
        }
    }


@router.post("/cameras")
async def add_camera(
    camera_id: str,
    name: str,
    rtsp_url: str,
    priority: str = "normal",
    detection_fps: int = 6,
    detection_scale: float = 0.5
):
    """
    إضافة كاميرا للبث الحي
    
    - **camera_id**: معرف فريد
    - **name**: اسم الكاميرا
    - **rtsp_url**: رابط RTSP
    - **priority**: الأولوية (high, normal, low)
    - **detection_fps**: معدل الكشف في الثانية
    - **detection_scale**: نسبة تصغير الصورة للكشف
    """
    global camera_processor
    
    # تهيئة المعالج إذا لم يكن مهيأً
    if camera_processor is None:
        await init_camera_processor()
    
    # تحويل الأولوية
    priority_map = {
        "high": FramePriority.HIGH,
        "normal": FramePriority.NORMAL,
        "low": FramePriority.LOW
    }
    frame_priority = priority_map.get(priority.lower(), FramePriority.NORMAL)
    
    # إعداد الكاميرا
    config = CameraConfig(
        camera_id=camera_id,
        name=name,
        rtsp_url=rtsp_url,
        priority=frame_priority,
        detection_fps=detection_fps,
        detection_scale=detection_scale,
        skip_frames=max(1, 30 // detection_fps)
    )
    
    success = await camera_processor.add_camera(config)
    
    if success:
        return {
            "success": True,
            "message": f"تمت إضافة الكاميرا: {name}",
            "camera_id": camera_id
        }
    else:
        raise HTTPException(status_code=400, detail="فشل إضافة الكاميرا")


@router.delete("/cameras/{camera_id}")
async def remove_camera(camera_id: str):
    """إزالة كاميرا من البث الحي"""
    global camera_processor
    
    if camera_processor is None:
        raise HTTPException(status_code=400, detail="المعالج غير مهيأ")
    
    success = await camera_processor.remove_camera(camera_id)
    
    if success:
        return {"success": True, "message": f"تمت إزالة الكاميرا: {camera_id}"}
    else:
        raise HTTPException(status_code=404, detail="الكاميرا غير موجودة")


@router.get("/cameras")
async def list_cameras():
    """قائمة الكاميرات النشطة"""
    global camera_processor
    
    if camera_processor is None:
        return {"cameras": []}
    
    stats = camera_processor.get_stats()
    return {"cameras": stats.get("cameras", {})}


@router.get("/cameras/{camera_id}/snapshot")
async def get_snapshot(camera_id: str):
    """الحصول على لقطة حالية من الكاميرا"""
    global camera_processor
    
    if camera_processor is None:
        raise HTTPException(status_code=400, detail="المعالج غير مهيأ")
    
    result = camera_processor.get_camera_frame(camera_id)
    
    if result is None:
        raise HTTPException(status_code=404, detail="الكاميرا غير موجودة أو لا يوجد إطار")
    
    frame, detections = result
    
    # تحويل لـ JPEG
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    
    return StreamingResponse(
        iter([buffer.tobytes()]),
        media_type="image/jpeg",
        headers={
            "X-Detections-Count": str(len(detections)),
            "X-Timestamp": datetime.utcnow().isoformat()
        }
    )


@router.get("/cameras/{camera_id}/stream")
async def stream_camera(camera_id: str, fps: int = 15):
    """
    بث MJPEG للكاميرا
    
    استخدم في <img src="/api/v1/live/cameras/{id}/stream">
    """
    global camera_processor
    
    if camera_processor is None:
        await init_camera_processor()
    
    async def generate():
        frame_interval = 1.0 / fps
        
        while True:
            try:
                result = camera_processor.get_camera_frame(camera_id)
                
                if result is not None:
                    frame, detections = result
                    
                    # رسم الكشوفات
                    annotated = camera_processor._draw_detections(frame.copy(), detections)
                    
                    # تحويل لـ JPEG
                    _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    
                    yield (
                        b'--frame\r\n'
                        b'Content-Type: image/jpeg\r\n\r\n' +
                        buffer.tobytes() +
                        b'\r\n'
                    )
                
                await asyncio.sleep(frame_interval)
                
            except Exception as e:
                logger.error(f"خطأ في البث: {e}")
                break
    
    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# =====================================
# WebSocket Endpoints
# =====================================

@router.websocket("/ws")
async def websocket_all_cameras(websocket: WebSocket):
    """
    WebSocket للاشتراك في جميع الكاميرات
    
    يستقبل:
    - تنبيهات من جميع الكاميرات
    - إحصائيات دورية
    """
    await ws_manager.connect(websocket)
    
    try:
        # إرسال حالة أولية
        if camera_processor:
            await websocket.send_json({
                "type": "init",
                "data": camera_processor.get_stats()
            })
        
        while True:
            # انتظار رسائل من العميل
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                message = json.loads(data)
                
                # معالجة الأوامر
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "get_stats":
                    if camera_processor:
                        await websocket.send_json({
                            "type": "stats",
                            "data": camera_processor.get_stats()
                        })
                        
            except asyncio.TimeoutError:
                # إرسال heartbeat
                await websocket.send_json({"type": "heartbeat"})
                
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"خطأ WebSocket: {e}")
        ws_manager.disconnect(websocket)


@router.websocket("/ws/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: str):
    """
    WebSocket لكاميرا محددة
    
    يستقبل:
    - إطارات مع الكشوفات (base64)
    - تنبيهات الكاميرا
    """
    await ws_manager.connect(websocket, camera_id)
    
    try:
        # إعدادات البث
        send_frames = False
        frame_interval = 1.0 / 10  # 10 FPS للـ WebSocket
        
        async def send_frames_loop():
            """حلقة إرسال الإطارات"""
            while send_frames:
                try:
                    if camera_processor:
                        result = camera_processor.get_camera_frame(camera_id)
                        if result:
                            frame, detections = result
                            
                            # تصغير للـ WebSocket
                            small = cv2.resize(frame, (640, 360))
                            
                            # رسم الكشوفات
                            annotated = camera_processor._draw_detections(small, detections)
                            
                            # تحويل لـ base64
                            _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 60])
                            b64 = base64.b64encode(buffer).decode('utf-8')
                            
                            await websocket.send_json({
                                "type": "frame",
                                "image": f"data:image/jpeg;base64,{b64}",
                                "detections": detections,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                    
                    await asyncio.sleep(frame_interval)
                except Exception as e:
                    logger.error(f"خطأ في إرسال الإطار: {e}")
                    break
        
        frame_task = None
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                message = json.loads(data)
                
                msg_type = message.get("type")
                
                if msg_type == "start_stream":
                    # بدء إرسال الإطارات
                    send_frames = True
                    if frame_task is None or frame_task.done():
                        frame_task = asyncio.create_task(send_frames_loop())
                    await websocket.send_json({"type": "stream_started"})
                    
                elif msg_type == "stop_stream":
                    # إيقاف إرسال الإطارات
                    send_frames = False
                    await websocket.send_json({"type": "stream_stopped"})
                    
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    
                elif msg_type == "get_snapshot":
                    # لقطة واحدة
                    if camera_processor:
                        result = camera_processor.get_camera_frame(camera_id)
                        if result:
                            frame, detections = result
                            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                            b64 = base64.b64encode(buffer).decode('utf-8')
                            await websocket.send_json({
                                "type": "snapshot",
                                "image": f"data:image/jpeg;base64,{b64}",
                                "detections": detections
                            })
                            
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
                
    except WebSocketDisconnect:
        send_frames = False
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"خطأ WebSocket: {e}")
        send_frames = False
        ws_manager.disconnect(websocket)


# =====================================
# اختبار مع فيديو محلي
# =====================================

@router.post("/test/video")
async def test_with_video(video_path: str, camera_id: str = "test_cam"):
    """
    اختبار مع ملف فيديو محلي
    
    - **video_path**: مسار ملف الفيديو
    - **camera_id**: معرف تجريبي
    """
    global camera_processor
    
    if camera_processor is None:
        await init_camera_processor()
    
    config = CameraConfig(
        camera_id=camera_id,
        name="كاميرا اختبار",
        rtsp_url=video_path,  # يقبل ملفات فيديو أيضاً
        priority=FramePriority.HIGH,
        detection_fps=10
    )
    
    success = await camera_processor.add_camera(config)
    
    return {
        "success": success,
        "camera_id": camera_id,
        "video_path": video_path
    }
