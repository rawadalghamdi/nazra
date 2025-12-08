"""
عميل RTSP - RTSP Client
========================
للاتصال بكاميرات RTSP والحصول على الإطارات
"""

import asyncio
from typing import Optional, Any, Tuple, Callable, AsyncGenerator
from datetime import datetime
from dataclasses import dataclass
import logging
import re

from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.RTSP")

# استيراد اختياري
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
    logger.warning("⚠️ OpenCV غير متوفر - لن يعمل عميل RTSP")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    np = None
    NUMPY_AVAILABLE = False


@dataclass
class RTSPConnectionInfo:
    """
    معلومات اتصال RTSP
    """
    url: str
    host: str = ""
    port: int = 554
    username: Optional[str] = None
    password: Optional[str] = None
    path: str = ""
    is_connected: bool = False
    width: int = 0
    height: int = 0
    fps: float = 0.0
    codec: str = ""
    latency_ms: float = 0.0
    error: Optional[str] = None
    
    @classmethod
    def parse_url(cls, url: str) -> "RTSPConnectionInfo":
        """
        تحليل رابط RTSP
        """
        info = cls(url=url)
        
        # تعبير منتظم لتحليل RTSP URL
        pattern = r'^rtsp://(?:([^:]+):([^@]+)@)?([^:/]+)(?::(\d+))?(/.*)?$'
        match = re.match(pattern, url)
        
        if match:
            info.username = match.group(1)
            info.password = match.group(2)
            info.host = match.group(3) or ""
            info.port = int(match.group(4)) if match.group(4) else 554
            info.path = match.group(5) or ""
        
        return info


class RTSPClient:
    """
    عميل RTSP
    ==========
    للاتصال بكاميرات RTSP والحصول على الإطارات
    """
    
    def __init__(
        self,
        url: str,
        reconnect_delay: float = 5.0,
        max_reconnect_attempts: int = 5,
        buffer_size: int = 1
    ):
        """
        تهيئة العميل
        
        Args:
            url: رابط RTSP
            reconnect_delay: التأخير بين محاولات إعادة الاتصال (ثانية)
            max_reconnect_attempts: الحد الأقصى لمحاولات إعادة الاتصال
            buffer_size: حجم المخزن المؤقت
        """
        self.url = url
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        self.buffer_size = buffer_size
        
        self.info = RTSPConnectionInfo.parse_url(url)
        self._capture: Any = None
        self._running = False
        self._reconnect_count = 0
        self._last_frame: Optional[Any] = None
        self._last_frame_time: Optional[datetime] = None
        
        logger.info(f"🎥 تهيئة عميل RTSP: {self.info.host}")
    
    async def connect(self) -> bool:
        """
        الاتصال بخادم RTSP
        """
        if not CV2_AVAILABLE:
            self.info.error = "OpenCV غير متوفر"
            logger.error("❌ OpenCV غير متوفر")
            return False
        
        logger.info(f"🔗 جاري الاتصال بـ: {self.info.host}")
        
        try:
            # إعدادات OpenCV لـ RTSP
            self._capture = cv2.VideoCapture(self.url)
            
            # تعيين خيارات الأداء
            self._capture.set(cv2.CAP_PROP_BUFFERSIZE, self.buffer_size)
            
            # التحقق من الاتصال
            if not self._capture.isOpened():
                self.info.error = "فشل فتح الاتصال"
                logger.error(f"❌ فشل الاتصال بـ: {self.url}")
                return False
            
            # قراءة معلومات الفيديو
            self.info.width = int(self._capture.get(cv2.CAP_PROP_FRAME_WIDTH))
            self.info.height = int(self._capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
            self.info.fps = self._capture.get(cv2.CAP_PROP_FPS) or 15
            
            # محاولة الحصول على الـ codec
            fourcc = int(self._capture.get(cv2.CAP_PROP_FOURCC))
            self.info.codec = "".join([chr((fourcc >> 8 * i) & 0xFF) for i in range(4)])
            
            self.info.is_connected = True
            self.info.error = None
            self._reconnect_count = 0
            
            logger.info(
                f"✅ تم الاتصال بـ: {self.info.host} "
                f"({self.info.width}x{self.info.height} @ {self.info.fps}fps)"
            )
            
            return True
            
        except Exception as e:
            self.info.error = str(e)
            self.info.is_connected = False
            logger.error(f"❌ خطأ في الاتصال: {e}")
            return False
    
    async def disconnect(self):
        """
        قطع الاتصال
        """
        self._running = False
        
        if self._capture is not None:
            try:
                self._capture.release()
            except Exception as e:
                logger.warning(f"⚠️ خطأ في قطع الاتصال: {e}")
        
        self._capture = None
        self.info.is_connected = False
        
        logger.info(f"🔌 تم قطع الاتصال بـ: {self.info.host}")
    
    async def read_frame(self) -> Optional[Any]:
        """
        قراءة إطار واحد
        
        Returns:
            numpy array أو None
        """
        if not self.info.is_connected or self._capture is None:
            return self._last_frame
        
        try:
            start_time = datetime.utcnow()
            ret, frame = self._capture.read()
            
            if ret and frame is not None:
                self._last_frame = frame
                self._last_frame_time = datetime.utcnow()
                
                # حساب زمن الاستجابة
                self.info.latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return frame
            else:
                # فشل القراءة
                logger.warning(f"⚠️ فشل قراءة الإطار من: {self.info.host}")
                self.info.is_connected = False
                return self._last_frame
                
        except Exception as e:
            logger.error(f"❌ خطأ في قراءة الإطار: {e}")
            self.info.is_connected = False
            return self._last_frame
    
    async def get_snapshot(self) -> Optional[bytes]:
        """
        الحصول على لقطة كـ JPEG bytes
        """
        frame = await self.read_frame()
        
        if frame is None:
            return None
        
        try:
            # ترميز كـ JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return buffer.tobytes()
        except Exception as e:
            logger.error(f"❌ خطأ في ترميز الصورة: {e}")
            return None
    
    async def stream_frames(
        self,
        fps: Optional[float] = None,
        on_frame: Optional[Callable] = None
    ) -> AsyncGenerator[Any, None]:
        """
        بث الإطارات بشكل مستمر
        
        Args:
            fps: معدل الإطارات المطلوب (None = استخدام الافتراضي)
            on_frame: دالة callback لكل إطار
            
        Yields:
            numpy array
        """
        if not self.info.is_connected:
            success = await self.connect()
            if not success:
                return
        
        target_fps = fps or self.info.fps or 15
        frame_delay = 1.0 / target_fps
        
        self._running = True
        
        while self._running:
            frame = await self.read_frame()
            
            if frame is not None:
                if on_frame:
                    try:
                        await on_frame(frame)
                    except Exception as e:
                        logger.error(f"❌ خطأ في callback: {e}")
                
                yield frame
            
            elif not self.info.is_connected:
                # محاولة إعادة الاتصال
                if self._reconnect_count < self.max_reconnect_attempts:
                    self._reconnect_count += 1
                    logger.info(
                        f"🔄 محاولة إعادة الاتصال "
                        f"{self._reconnect_count}/{self.max_reconnect_attempts}"
                    )
                    await asyncio.sleep(self.reconnect_delay)
                    await self.connect()
                else:
                    logger.error(f"❌ فشل إعادة الاتصال بـ: {self.info.host}")
                    break
            
            await asyncio.sleep(frame_delay)
    
    async def stream_mjpeg(self, fps: Optional[float] = None) -> AsyncGenerator[bytes, None]:
        """
        بث MJPEG
        
        Yields:
            bytes (MJPEG frame)
        """
        async for frame in self.stream_frames(fps):
            try:
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' +
                    buffer.tobytes() +
                    b'\r\n'
                )
            except Exception as e:
                logger.error(f"❌ خطأ في ترميز MJPEG: {e}")
    
    def stop(self):
        """
        إيقاف البث
        """
        self._running = False
    
    def get_info(self) -> dict:
        """
        جلب معلومات الاتصال
        """
        return {
            "url": self.url,
            "host": self.info.host,
            "port": self.info.port,
            "is_connected": self.info.is_connected,
            "width": self.info.width,
            "height": self.info.height,
            "fps": self.info.fps,
            "codec": self.info.codec,
            "latency_ms": self.info.latency_ms,
            "error": self.info.error,
            "last_frame_time": self._last_frame_time.isoformat() if self._last_frame_time else None
        }
    
    @staticmethod
    async def test_connection(url: str, timeout: float = 10.0) -> dict:
        """
        اختبار اتصال RTSP
        
        Args:
            url: رابط RTSP
            timeout: مهلة الاتصال بالثواني
            
        Returns:
            dict مع نتيجة الاختبار
        """
        if not CV2_AVAILABLE:
            return {
                "success": False,
                "message": "OpenCV غير متوفر",
                "error": "MISSING_DEPENDENCY"
            }
        
        client = RTSPClient(url)
        
        try:
            # محاولة الاتصال مع timeout
            success = await asyncio.wait_for(
                client.connect(),
                timeout=timeout
            )
            
            if success:
                # محاولة قراءة إطار
                frame = await client.read_frame()
                
                result = {
                    "success": frame is not None,
                    "message": "تم الاتصال بنجاح" if frame is not None else "فشل قراءة الإطار",
                    "info": client.get_info()
                }
            else:
                result = {
                    "success": False,
                    "message": client.info.error or "فشل الاتصال",
                    "error": "CONNECTION_FAILED"
                }
                
        except asyncio.TimeoutError:
            result = {
                "success": False,
                "message": "انتهت مهلة الاتصال",
                "error": "TIMEOUT"
            }
        except Exception as e:
            result = {
                "success": False,
                "message": str(e),
                "error": "EXCEPTION"
            }
        finally:
            await client.disconnect()
        
        return result


# دالة مساعدة لبناء رابط RTSP
def build_rtsp_url(
    host: str,
    port: int = 554,
    username: Optional[str] = None,
    password: Optional[str] = None,
    path: str = "/stream1"
) -> str:
    """
    بناء رابط RTSP
    
    Args:
        host: عنوان الخادم
        port: المنفذ
        username: اسم المستخدم (اختياري)
        password: كلمة المرور (اختياري)
        path: مسار البث
        
    Returns:
        رابط RTSP كامل
    """
    if username and password:
        auth = f"{username}:{password}@"
    else:
        auth = ""
    
    if port == 554:
        port_str = ""
    else:
        port_str = f":{port}"
    
    return f"rtsp://{auth}{host}{port_str}{path}"
