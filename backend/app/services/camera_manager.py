"""
مدير الكاميرات - Camera Manager
================================
إدارة اتصالات الكاميرات والبث
"""

import asyncio
from typing import Dict, Optional, List, Any, Callable
from datetime import datetime
from dataclasses import dataclass, field
import logging
import uuid

from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.الكاميرات")

# استيراد اختياري
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False


@dataclass
class CameraConnection:
    """
    اتصال كاميرا واحدة
    """
    camera_id: str
    name: str
    rtsp_url: str
    status: str = "offline"  # online, offline, error, connecting
    capture: Any = None  # cv2.VideoCapture
    last_frame: Any = None  # numpy array
    last_frame_time: Optional[datetime] = None
    fps: float = 0.0
    resolution: Optional[tuple] = None
    error_message: Optional[str] = None
    detection_enabled: bool = True
    is_recording: bool = False
    reconnect_attempts: int = 0
    max_reconnect_attempts: int = 5
    
    def is_connected(self) -> bool:
        return self.status == "online" and self.capture is not None


class CameraManager:
    """
    مدير الكاميرات
    ==============
    يدير اتصالات جميع الكاميرات والبث
    """
    
    def __init__(self):
        self.cameras: Dict[str, CameraConnection] = {}
        self.running = False
        self._tasks: Dict[str, asyncio.Task] = {}
        self._frame_callbacks: List[Callable] = []
        self._detection_callback: Optional[Callable] = None
        
        logger.info("📷 تم تهيئة مدير الكاميرات")
    
    async def add_camera(
        self,
        camera_id: str,
        name: str,
        rtsp_url: str,
        detection_enabled: bool = True
    ) -> CameraConnection:
        """
        إضافة كاميرا جديدة
        """
        logger.info(f"➕ إضافة كاميرا: {name} ({camera_id})")
        
        connection = CameraConnection(
            camera_id=camera_id,
            name=name,
            rtsp_url=rtsp_url,
            detection_enabled=detection_enabled
        )
        
        self.cameras[camera_id] = connection
        
        return connection
    
    async def remove_camera(self, camera_id: str) -> bool:
        """
        إزالة كاميرا
        """
        if camera_id not in self.cameras:
            return False
        
        logger.info(f"➖ إزالة كاميرا: {camera_id}")
        
        # إيقاف المهمة إن وجدت
        if camera_id in self._tasks:
            self._tasks[camera_id].cancel()
            del self._tasks[camera_id]
        
        # قطع الاتصال
        await self.disconnect_camera(camera_id)
        
        # إزالة من القائمة
        del self.cameras[camera_id]
        
        return True
    
    async def connect_camera(self, camera_id: str) -> bool:
        """
        الاتصال بكاميرا
        """
        if camera_id not in self.cameras:
            logger.error(f"❌ الكاميرا غير موجودة: {camera_id}")
            return False
        
        camera = self.cameras[camera_id]
        camera.status = "connecting"
        
        logger.info(f"🔗 جاري الاتصال بـ: {camera.name}")
        
        if not CV2_AVAILABLE:
            logger.error("❌ OpenCV غير متوفر")
            camera.status = "error"
            camera.error_message = "OpenCV غير متوفر"
            return False
        
        try:
            # فتح الاتصال
            cap = cv2.VideoCapture(camera.rtsp_url)
            
            if not cap.isOpened():
                camera.status = "error"
                camera.error_message = "فشل فتح الاتصال"
                logger.error(f"❌ فشل الاتصال بـ: {camera.name}")
                return False
            
            # قراءة معلومات الفيديو
            camera.fps = cap.get(cv2.CAP_PROP_FPS) or 15
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            camera.resolution = (width, height)
            
            camera.capture = cap
            camera.status = "online"
            camera.error_message = None
            camera.reconnect_attempts = 0
            
            logger.info(f"✅ تم الاتصال بـ: {camera.name} ({width}x{height} @ {camera.fps}fps)")
            
            return True
            
        except Exception as e:
            camera.status = "error"
            camera.error_message = str(e)
            logger.error(f"❌ خطأ في الاتصال بـ {camera.name}: {e}")
            return False
    
    async def disconnect_camera(self, camera_id: str) -> bool:
        """
        قطع الاتصال بكاميرا
        """
        if camera_id not in self.cameras:
            return False
        
        camera = self.cameras[camera_id]
        
        if camera.capture is not None:
            try:
                camera.capture.release()
            except Exception as e:
                logger.warning(f"⚠️ خطأ في قطع الاتصال: {e}")
        
        camera.capture = None
        camera.status = "offline"
        camera.last_frame = None
        
        logger.info(f"🔌 تم قطع الاتصال بـ: {camera.name}")
        
        return True
    
    async def get_frame(self, camera_id: str) -> Optional[Any]:
        """
        جلب إطار من كاميرا
        """
        if camera_id not in self.cameras:
            return None
        
        camera = self.cameras[camera_id]
        
        if not camera.is_connected():
            return camera.last_frame
        
        try:
            ret, frame = camera.capture.read()
            
            if ret and frame is not None:
                camera.last_frame = frame
                camera.last_frame_time = datetime.utcnow()
                return frame
            else:
                # فشل القراءة - محاولة إعادة الاتصال
                camera.status = "error"
                return camera.last_frame
                
        except Exception as e:
            logger.error(f"❌ خطأ في قراءة الإطار: {e}")
            camera.status = "error"
            return camera.last_frame
    
    async def start_streaming(self, camera_id: str) -> bool:
        """
        بدء البث من كاميرا
        """
        if camera_id not in self.cameras:
            return False
        
        if camera_id in self._tasks:
            logger.warning(f"⚠️ البث يعمل بالفعل: {camera_id}")
            return True
        
        # الاتصال إن لم يكن متصلاً
        camera = self.cameras[camera_id]
        if not camera.is_connected():
            success = await self.connect_camera(camera_id)
            if not success:
                return False
        
        # بدء مهمة البث
        task = asyncio.create_task(self._stream_loop(camera_id))
        self._tasks[camera_id] = task
        
        logger.info(f"▶️ بدء البث من: {camera.name}")
        
        return True
    
    async def stop_streaming(self, camera_id: str) -> bool:
        """
        إيقاف البث من كاميرا
        """
        if camera_id not in self._tasks:
            return False
        
        self._tasks[camera_id].cancel()
        
        try:
            await self._tasks[camera_id]
        except asyncio.CancelledError:
            pass
        
        del self._tasks[camera_id]
        
        camera = self.cameras.get(camera_id)
        if camera:
            logger.info(f"⏹️ تم إيقاف البث من: {camera.name}")
        
        return True
    
    async def _stream_loop(self, camera_id: str):
        """
        حلقة البث الرئيسية
        """
        camera = self.cameras.get(camera_id)
        if not camera:
            return
        
        frame_delay = 1.0 / max(camera.fps, 1)
        
        while True:
            try:
                if not camera.is_connected():
                    # محاولة إعادة الاتصال
                    if camera.reconnect_attempts < camera.max_reconnect_attempts:
                        camera.reconnect_attempts += 1
                        logger.info(f"🔄 محاولة إعادة الاتصال {camera.reconnect_attempts}/{camera.max_reconnect_attempts}")
                        await asyncio.sleep(2)
                        await self.connect_camera(camera_id)
                    else:
                        logger.error(f"❌ فشل إعادة الاتصال بـ: {camera.name}")
                        break
                    continue
                
                # قراءة الإطار
                frame = await self.get_frame(camera_id)
                
                if frame is not None:
                    # إرسال للكشف إن كان مفعلاً
                    if camera.detection_enabled and self._detection_callback:
                        await self._detection_callback(camera_id, frame)
                    
                    # إرسال لجميع المستمعين
                    for callback in self._frame_callbacks:
                        try:
                            await callback(camera_id, frame)
                        except Exception as e:
                            logger.error(f"❌ خطأ في callback: {e}")
                
                await asyncio.sleep(frame_delay)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ خطأ في حلقة البث: {e}")
                await asyncio.sleep(1)
    
    def on_frame(self, callback: Callable):
        """
        تسجيل مستمع للإطارات
        """
        self._frame_callbacks.append(callback)
    
    def on_detection(self, callback: Callable):
        """
        تسجيل مستمع للكشف
        """
        self._detection_callback = callback
    
    async def test_connection(self, rtsp_url: str) -> Dict:
        """
        اختبار اتصال RTSP
        """
        if not CV2_AVAILABLE:
            return {
                "success": False,
                "message": "OpenCV غير متوفر"
            }
        
        try:
            start_time = datetime.utcnow()
            cap = cv2.VideoCapture(rtsp_url)
            
            if not cap.isOpened():
                return {
                    "success": False,
                    "message": "فشل فتح الاتصال"
                }
            
            # قراءة إطار واحد
            ret, frame = cap.read()
            
            if not ret:
                cap.release()
                return {
                    "success": False,
                    "message": "فشل قراءة الإطار"
                }
            
            # جمع المعلومات
            latency = (datetime.utcnow() - start_time).total_seconds() * 1000
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            cap.release()
            
            return {
                "success": True,
                "message": "تم الاتصال بنجاح",
                "latency_ms": latency,
                "fps": fps,
                "resolution": f"{width}x{height}",
                "details": {
                    "width": width,
                    "height": height
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"خطأ: {str(e)}"
            }
    
    def get_camera_status(self, camera_id: str) -> Optional[Dict]:
        """
        جلب حالة كاميرا
        """
        if camera_id not in self.cameras:
            return None
        
        camera = self.cameras[camera_id]
        
        return {
            "camera_id": camera.camera_id,
            "name": camera.name,
            "status": camera.status,
            "is_streaming": camera_id in self._tasks,
            "fps": camera.fps,
            "resolution": f"{camera.resolution[0]}x{camera.resolution[1]}" if camera.resolution else None,
            "last_frame_time": camera.last_frame_time.isoformat() if camera.last_frame_time else None,
            "detection_enabled": camera.detection_enabled,
            "is_recording": camera.is_recording,
            "error_message": camera.error_message
        }
    
    def get_all_cameras_status(self) -> List[Dict]:
        """
        جلب حالة جميع الكاميرات
        """
        return [self.get_camera_status(cid) for cid in self.cameras]
    
    async def start_all(self):
        """
        بدء البث من جميع الكاميرات
        """
        self.running = True
        
        for camera_id in self.cameras:
            await self.start_streaming(camera_id)
        
        logger.info(f"▶️ تم بدء البث من {len(self.cameras)} كاميرا")
    
    async def stop_all(self):
        """
        إيقاف جميع عمليات البث
        """
        self.running = False
        
        for camera_id in list(self._tasks.keys()):
            await self.stop_streaming(camera_id)
        
        for camera_id in self.cameras:
            await self.disconnect_camera(camera_id)
        
        logger.info("⏹️ تم إيقاف جميع عمليات البث")


# إنشاء مدير الكاميرات العام
_camera_manager: Optional[CameraManager] = None


def get_camera_manager() -> CameraManager:
    """
    الحصول على مدير الكاميرات العام
    """
    global _camera_manager
    
    if _camera_manager is None:
        _camera_manager = CameraManager()
    
    return _camera_manager


async def shutdown_camera_manager():
    """
    إيقاف مدير الكاميرات
    """
    global _camera_manager
    
    if _camera_manager is not None:
        await _camera_manager.stop_all()
        _camera_manager = None
        logger.info("🛑 تم إيقاف مدير الكاميرات")
