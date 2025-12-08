"""
خدمة معالجة الفيديو في الوقت الفعلي
===================================
"""

import asyncio
from typing import Dict, Optional, Callable, Awaitable
from dataclasses import dataclass
import time
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor

from app.services.detection import detector, DetectionResult

@dataclass
class CameraStream:
    """بيانات بث الكاميرا"""
    camera_id: str
    rtsp_url: str
    is_running: bool = False
    fps: float = 0.0
    last_frame_time: float = 0.0

class VideoProcessor:
    """معالج الفيديو"""
    
    def __init__(self, max_workers: int = 4):
        """
        تهيئة معالج الفيديو
        
        Args:
            max_workers: أقصى عدد من الخيوط المتوازية
        """
        self.streams: Dict[str, CameraStream] = {}
        self.captures: Dict[str, cv2.VideoCapture] = {}
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.is_running = False
        self._tasks: Dict[str, asyncio.Task] = {}
        
        # معاودات الاتصال
        self.on_detection: Optional[Callable[[str, DetectionResult], Awaitable[None]]] = None
        self.on_frame: Optional[Callable[[str, np.ndarray], Awaitable[None]]] = None
    
    async def start_stream(
        self,
        camera_id: str,
        rtsp_url: str,
        detection_enabled: bool = True,
        target_fps: int = 15
    ) -> bool:
        """
        بدء بث كاميرا
        
        Args:
            camera_id: معرف الكاميرا
            rtsp_url: رابط RTSP
            detection_enabled: تفعيل الكشف
            target_fps: معدل الإطارات المستهدف
            
        Returns:
            bool: نجاح العملية
        """
        if camera_id in self.streams and self.streams[camera_id].is_running:
            return True
        
        try:
            # فتح الاتصال
            cap = cv2.VideoCapture(rtsp_url)
            if not cap.isOpened():
                print(f"❌ فشل الاتصال بالكاميرا: {camera_id}")
                return False
            
            self.captures[camera_id] = cap
            self.streams[camera_id] = CameraStream(
                camera_id=camera_id,
                rtsp_url=rtsp_url,
                is_running=True
            )
            
            # بدء مهمة المعالجة
            task = asyncio.create_task(
                self._process_stream(camera_id, detection_enabled, target_fps)
            )
            self._tasks[camera_id] = task
            
            print(f"✅ تم بدء بث الكاميرا: {camera_id}")
            return True
            
        except Exception as e:
            print(f"❌ خطأ في بدء البث: {e}")
            return False
    
    async def stop_stream(self, camera_id: str) -> bool:
        """إيقاف بث كاميرا"""
        if camera_id not in self.streams:
            return False
        
        self.streams[camera_id].is_running = False
        
        # إلغاء المهمة
        if camera_id in self._tasks:
            self._tasks[camera_id].cancel()
            try:
                await self._tasks[camera_id]
            except asyncio.CancelledError:
                pass
            del self._tasks[camera_id]
        
        # إغلاق الاتصال
        if camera_id in self.captures:
            self.captures[camera_id].release()
            del self.captures[camera_id]
        
        del self.streams[camera_id]
        print(f"⏹️ تم إيقاف بث الكاميرا: {camera_id}")
        return True
    
    async def _process_stream(
        self,
        camera_id: str,
        detection_enabled: bool,
        target_fps: int
    ):
        """معالجة البث"""
        frame_interval = 1.0 / target_fps
        frame_count = 0
        
        while camera_id in self.streams and self.streams[camera_id].is_running:
            start_time = time.time()
            
            try:
                # قراءة الإطار
                cap = self.captures.get(camera_id)
                if cap is None:
                    break
                
                ret, frame = await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    cap.read
                )
                
                if not ret or frame is None:
                    await asyncio.sleep(0.1)
                    continue
                
                frame_count += 1
                
                # إرسال الإطار
                if self.on_frame:
                    await self.on_frame(camera_id, frame)
                
                # تشغيل الكشف
                if detection_enabled and frame_count % 3 == 0:  # كل 3 إطارات
                    result = await detector.detect(frame, str(frame_count))
                    
                    if result.detections and self.on_detection:
                        await self.on_detection(camera_id, result)
                
                # تحديث الإحصائيات
                processing_time = time.time() - start_time
                self.streams[camera_id].fps = 1.0 / processing_time if processing_time > 0 else 0
                self.streams[camera_id].last_frame_time = time.time()
                
                # الانتظار للحفاظ على معدل الإطارات
                sleep_time = frame_interval - processing_time
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"❌ خطأ في معالجة البث {camera_id}: {e}")
                await asyncio.sleep(1)
    
    def get_stream_status(self, camera_id: str) -> Optional[Dict]:
        """الحصول على حالة البث"""
        if camera_id not in self.streams:
            return None
        
        stream = self.streams[camera_id]
        return {
            "camera_id": stream.camera_id,
            "is_running": stream.is_running,
            "fps": stream.fps,
            "last_frame_time": stream.last_frame_time
        }
    
    def get_all_streams(self) -> Dict[str, Dict]:
        """الحصول على جميع البثوث"""
        return {
            camera_id: self.get_stream_status(camera_id)
            for camera_id in self.streams
        }
    
    async def stop_all(self):
        """إيقاف جميع البثوث"""
        camera_ids = list(self.streams.keys())
        for camera_id in camera_ids:
            await self.stop_stream(camera_id)
        
        self.executor.shutdown(wait=False)

# نسخة عامة للاستخدام
video_processor = VideoProcessor()
