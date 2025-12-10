"""
روتر البث - Stream Router
==========================
GET /api/v1/stream/{camera_id} - بث الفيديو المعالج
GET /api/v1/stream/{camera_id}/snapshot - لقطة حالية
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncGenerator, Dict, Optional, Tuple
from datetime import datetime
import logging
import asyncio
import io
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import time
import uuid

from app.database import get_db
from app.models.camera import Camera
from app.services.detector import detector
from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.البث")

router = APIRouter(prefix="/stream", tags=["البث"])

# تخزين اتصالات الكاميرات النشطة
active_captures: Dict[str, cv2.VideoCapture] = {}
capture_locks: Dict[str, asyncio.Lock] = {}
executor = ThreadPoolExecutor(max_workers=8)

# ألوان مربعات الكشف
DETECTION_COLORS = {
    'Knife': (0, 165, 255),      # برتقالي
    'Handgun': (0, 0, 255),      # أحمر
    'weapon': (0, 0, 255),       # أحمر
    'knife': (0, 165, 255),      # برتقالي
}


def draw_detections_on_frame(frame: np.ndarray, detections: list) -> np.ndarray:
    """
    رسم مربعات الكشف على الإطار
    """
    for det in detections:
        x1, y1, x2, y2 = det['bbox']
        class_name = det['class_name']
        confidence = det['confidence']
        
        # اختيار اللون
        color = DETECTION_COLORS.get(class_name, (0, 0, 255))
        
        # رسم المربع
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
        
        # إعداد النص
        label = f"{class_name}: {confidence:.0%}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        thickness = 2
        
        # حساب حجم النص
        (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        
        # رسم خلفية النص
        cv2.rectangle(frame, (x1, y1 - text_height - 10), (x1 + text_width + 10, y1), color, -1)
        
        # رسم النص
        cv2.putText(frame, label, (x1 + 5, y1 - 5), font, font_scale, (255, 255, 255), thickness)
        
        # رسم زوايا مميزة
        corner_len = 20
        cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, 4)
        cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, 4)
        cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, 4)
        cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, 4)
        cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, 4)
        cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, 4)
        cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, 4)
        cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, 4)
    
    return frame


def process_frame_with_detection(cap: cv2.VideoCapture, detect: bool = True, last_detections: list = None) -> Tuple[Optional[bytes], list]:
    """
    قراءة إطار من الكاميرا وتشغيل الكشف عليه
    """
    detections = last_detections or []
    try:
        # تخطي الإطارات القديمة في البوفر للحصول على أحدث إطار
        for _ in range(3):
            cap.grab()
        
        ret, frame = cap.read()
        if not ret or frame is None:
            return None, detections
        
        # تصغير الإطار لتحسين الأداء
        height, width = frame.shape[:2]
        max_width = 640
        if width > max_width:
            scale = max_width / width
            frame = cv2.resize(frame, None, fx=scale, fy=scale)
        
        # تشغيل الكشف إذا كان مفعلاً
        if detect and detector.is_loaded:
            try:
                # مسح الكشوفات القديمة عند الكشف الجديد
                detections = []
                results = detector.model(
                    frame,
                    conf=detector.confidence_threshold,
                    device=detector.device,
                    verbose=False
                )
                
                for result in results:
                    boxes = result.boxes
                    if boxes is None:
                        continue
                    
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        class_name = detector.model.names[class_id]
                        
                        detections.append({
                            'class_name': class_name,
                            'confidence': confidence,
                            'bbox': (int(x1), int(y1), int(x2), int(y2))
                        })
                    
            except Exception as e:
                logger.error(f"❌ خطأ في الكشف: {e}")
        
        # رسم المربعات على الإطار (من الكشف الحالي أو السابق)
        if detections:
            frame = draw_detections_on_frame(frame, detections)
        
        # تحويل إلى JPEG - جودة منخفضة للسرعة
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 50]
        _, buffer = cv2.imencode('.jpg', frame, encode_param)
        return buffer.tobytes(), detections
        
    except Exception as e:
        logger.error(f"❌ خطأ في معالجة الإطار: {e}")
        return None, []


async def generate_video_frames_with_detection(
    camera_id: str, 
    rtsp_url: str,
    detection_enabled: bool = True
) -> AsyncGenerator[bytes, None]:
    """
    مولد إطارات الفيديو من RTSP مع الكشف عن الأسلحة
    
    يُرجع إطارات MJPEG للبث مع مربعات الكشف
    """
    cap = None
    frame_count = 0
    detection_interval = 10  # تشغيل الكشف كل 10 إطارات للسرعة
    last_detections = []
    
    try:
        logger.info(f"🎥 فتح اتصال: {rtsp_url}")
        
        # فتح اتصال OpenCV مع إعدادات محسنة
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FPS, 5)  # تقليل FPS
        
        if not cap.isOpened():
            logger.error(f"❌ فشل فتح الاتصال: {rtsp_url}")
            return
        
        logger.info(f"✅ تم الاتصال بالكاميرا: {camera_id} - الكشف: {'مفعّل' if detection_enabled else 'معطّل'}")
        
        max_consecutive_failures = 10
        consecutive_failures = 0
        
        loop = asyncio.get_event_loop()
        
        while consecutive_failures < max_consecutive_failures:
            try:
                # تحديد ما إذا كان يجب تشغيل الكشف في هذا الإطار
                should_detect = detection_enabled and (frame_count % detection_interval == 0)
                
                # معالجة الإطار
                frame_bytes, detections = await loop.run_in_executor(
                    executor, 
                    process_frame_with_detection, 
                    cap, 
                    should_detect,
                    last_detections
                )
                
                if frame_bytes is None:
                    consecutive_failures += 1
                    await asyncio.sleep(0.05)
                    continue
                
                consecutive_failures = 0
                frame_count += 1
                
                # تحديث آخر الكشوفات
                if detections:
                    last_detections = detections
                    if should_detect:
                        logger.info(f"🚨 تم الكشف عن {len(detections)} تهديد(ات) في الكاميرا: {camera_id}")
                
                # إرسال الإطار
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + 
                    frame_bytes + 
                    b'\r\n'
                )
                
                # التحكم في معدل الإطارات - 5 FPS
                await asyncio.sleep(0.2)
                
            except asyncio.CancelledError:
                logger.info(f"🛑 تم إيقاف البث للكاميرا: {camera_id}")
                break
            except Exception as e:
                logger.error(f"❌ خطأ في البث: {e}")
                consecutive_failures += 1
                await asyncio.sleep(0.05)
        
        if consecutive_failures >= max_consecutive_failures:
            logger.warning(f"⚠️ فشل متكرر للكاميرا: {camera_id}")
            
    except Exception as e:
        logger.error(f"❌ خطأ عام في البث: {e}")
    finally:
        if cap is not None:
            cap.release()
            logger.info(f"🔌 تم إغلاق اتصال الكاميرا: {camera_id}")


@router.get("/{camera_id}")
async def stream_video(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    بث الفيديو المعالج من الكاميرا
    
    يُرسل بث MJPEG للفيديو مع مربعات الكشف
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"🎥 بدء البث للكاميرا: {camera_id}")
    
    # التحقق من وجود الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رابط RTSP غير محدد للكاميرا"
        )
    
    # إرجاع بث الفيديو مع الكشف
    return StreamingResponse(
        generate_video_frames_with_detection(
            camera_id, 
            camera.rtsp_url,
            detection_enabled=camera.detection_enabled
        ),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.get("/{camera_id}/snapshot")
async def get_snapshot(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب لقطة حالية من الكاميرا
    
    يُرجع صورة JPEG للقطة الحالية
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"📸 جلب لقطة من الكاميرا: {camera_id}")
    
    # التحقق من وجود الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رابط RTSP غير محدد للكاميرا"
        )
    
    # جلب لقطة من RTSP
    try:
        loop = asyncio.get_event_loop()
        
        def capture_snapshot():
            cap = cv2.VideoCapture(camera.rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if not cap.isOpened():
                return None
            
            ret, frame = cap.read()
            cap.release()
            
            if not ret or frame is None:
                return None
            
            _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            return buffer.tobytes()
        
        image_bytes = await loop.run_in_executor(executor, capture_snapshot)
        
        if image_bytes is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="فشل في جلب اللقطة من الكاميرا"
            )
        
        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={
                "Content-Disposition": f"inline; filename=snapshot_{camera_id}.jpg",
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ خطأ في جلب اللقطة: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"خطأ في جلب اللقطة: {str(e)}"
        )


@router.get("/{camera_id}/snapshot-http")
async def get_snapshot_http(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب لقطة من كاميرا HTTP (IP Webcam) عبر HTTP مباشرة
    
    هذا endpoint يجلب الصورة من رابط HTTP (/shot.jpg)
    بدلاً من محاولة فتح بث RTSP/MJPEG
    
    مفيد للتغلب على مشكلة Docker networking
    """
    import httpx
    
    logger.info(f"📸 جلب لقطة HTTP من الكاميرا: {camera_id}")
    
    # جلب معلومات الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رابط الكاميرا غير محدد"
        )
    
    # بناء رابط الـ snapshot
    rtsp_url = camera.rtsp_url
    snapshot_url = None
    
    # محاولة تحويل الرابط إلى snapshot URL
    if "8080" in rtsp_url or "8081" in rtsp_url:  # IP Webcam
        # استبدال /video أو /videofeed بـ /shot.jpg
        base_url = rtsp_url.replace("/video", "").replace("/videofeed", "").rstrip("/")
        snapshot_url = f"{base_url}/shot.jpg"
        
        # إذا كان الرابط يشير إلى IP محلي، حاول استخدام host.docker.internal
        import re
        local_ip_match = re.search(r'http://192\.168\.\d+\.\d+', snapshot_url)
        if local_ip_match:
            # جرّب host.docker.internal أولاً
            docker_url = snapshot_url.replace(local_ip_match.group(), "http://host.docker.internal")
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    test_response = await client.head(docker_url)
                    if test_response.status_code == 200:
                        snapshot_url = docker_url
                        logger.info(f"✅ استخدام host.docker.internal: {snapshot_url}")
            except:
                logger.info(f"⚠️ فشل host.docker.internal، جاري المحاولة مع IP الأصلي")
    
    if not snapshot_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="لا يمكن تحديد رابط الـ snapshot لهذا النوع من الكاميرات"
        )
    
    # جلب الصورة
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(snapshot_url)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"فشل جلب الصورة: HTTP {response.status_code}"
                )
            
            return Response(
                content=response.content,
                media_type="image/jpeg",
                headers={
                    "Content-Disposition": f"inline; filename=snapshot_{camera_id}.jpg",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="انتهى وقت الانتظار أثناء جلب الصورة"
        )
    except Exception as e:
        logger.error(f"❌ خطأ في جلب snapshot HTTP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"خطأ: {str(e)}"
        )


@router.get("/{camera_id}/info")
async def get_stream_info(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب معلومات البث
    
    يُرجع معلومات عن إعدادات البث للكاميرا
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"ℹ️ جلب معلومات البث للكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    return {
        "camera_id": camera.id,
        "camera_name": camera.name,
        "status": camera.status,
        "rtsp_url": camera.rtsp_url if camera.rtsp_url else None,
        "stream_quality": camera.stream_quality,
        "fps": camera.fps,
        "resolution": f"{settings.STREAM_WIDTH}x{settings.STREAM_HEIGHT}",
        "detection_enabled": camera.detection_enabled,
        "is_recording": camera.is_recording
    }
