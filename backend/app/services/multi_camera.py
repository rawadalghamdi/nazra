"""
نظام إدارة الكاميرات المتعددة - Multi-Camera Management System
================================================================

Best Practices:
1. Thread per camera for reading (I/O bound)
2. Shared GPU workers for detection (compute bound)
3. Priority queue for frame processing
4. Smart frame skipping per camera
5. Batch processing when possible
6. WebSocket broadcasting for alerts

Architecture:
- CameraReader: قراءة الإطارات (thread per camera)
- FrameQueue: طابور الإطارات مع الأولوية
- DetectionPool: مجموعة من workers للكشف
- AlertBroadcaster: إرسال التنبيهات
"""

import asyncio
import time
import threading
import queue
from typing import Dict, Optional, List, Callable, Awaitable, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import cv2
import numpy as np
from datetime import datetime
import logging

logger = logging.getLogger("نظرة.الكاميرات")


class CameraStatus(Enum):
    """حالات الكاميرا"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    STREAMING = "streaming"
    ERROR = "error"
    PAUSED = "paused"


class FramePriority(Enum):
    """أولوية الإطارات"""
    HIGH = 1      # كاميرا ذات أهمية عالية أو تنبيه سابق
    NORMAL = 2    # معالجة عادية
    LOW = 3       # كاميرا في الخلفية


@dataclass
class CameraConfig:
    """إعدادات الكاميرا"""
    camera_id: str
    name: str
    rtsp_url: str
    
    # Processing settings
    target_fps: int = 30
    detection_fps: int = 6       # كشف 6 مرات في الثانية
    skip_frames: int = 5         # تخطي 5 إطارات بين كل كشف
    
    # Quality
    detection_scale: float = 0.5  # تصغير للكشف الأسرع
    
    # Priority
    priority: FramePriority = FramePriority.NORMAL
    
    # Zone of Interest (optional)
    roi: Optional[Tuple[int, int, int, int]] = None  # x1, y1, x2, y2
    
    # Alert settings
    alert_on_detection: bool = True
    min_alert_interval: float = 5.0  # ثواني بين التنبيهات


@dataclass
class FramePacket:
    """حزمة إطار للمعالجة"""
    camera_id: str
    frame: np.ndarray
    timestamp: float
    frame_number: int
    priority: FramePriority
    config: CameraConfig
    
    def __lt__(self, other):
        """للمقارنة في priority queue"""
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        return self.timestamp < other.timestamp


@dataclass
class DetectionResult:
    """نتيجة الكشف"""
    camera_id: str
    frame_number: int
    timestamp: float
    detections: List[Dict]
    processing_time: float
    annotated_frame: Optional[np.ndarray] = None


@dataclass
class CameraState:
    """حالة الكاميرا"""
    config: CameraConfig
    status: CameraStatus = CameraStatus.DISCONNECTED
    
    # Statistics
    frames_read: int = 0
    frames_processed: int = 0
    detections_count: int = 0
    
    # Timing
    last_frame_time: float = 0.0
    last_detection_time: float = 0.0
    last_alert_time: float = 0.0
    
    # FPS tracking
    fps_read: float = 0.0
    fps_processed: float = 0.0
    
    # Current detections
    current_detections: List[Dict] = field(default_factory=list)
    
    # Last frame for display
    last_frame: Optional[np.ndarray] = None


class CameraReader(threading.Thread):
    """
    قارئ الكاميرا - Thread مستقل لكل كاميرا
    
    يقرأ الإطارات باستمرار ويضيفها للطابور
    """
    
    def __init__(
        self,
        config: CameraConfig,
        frame_queue: queue.PriorityQueue,
        state: CameraState,
        stop_event: threading.Event
    ):
        super().__init__(daemon=True, name=f"CameraReader-{config.camera_id}")
        self.config = config
        self.frame_queue = frame_queue
        self.state = state
        self.stop_event = stop_event
        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_count = 0
        
    def run(self):
        """حلقة القراءة الرئيسية"""
        logger.info(f"📹 بدء قراءة الكاميرا: {self.config.name}")
        
        self.state.status = CameraStatus.CONNECTING
        
        # الاتصال بالكاميرا
        self.cap = cv2.VideoCapture(self.config.rtsp_url)
        
        if not self.cap.isOpened():
            logger.error(f"❌ فشل الاتصال بالكاميرا: {self.config.name}")
            self.state.status = CameraStatus.ERROR
            return
        
        # الحصول على معلومات الفيديو
        actual_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
        width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        logger.info(f"✅ متصل: {self.config.name} ({width}x{height} @ {actual_fps} FPS)")
        self.state.status = CameraStatus.STREAMING
        
        frame_interval = 1.0 / self.config.target_fps
        fps_counter = deque(maxlen=30)
        
        while not self.stop_event.is_set():
            start_time = time.time()
            
            try:
                ret, frame = self.cap.read()
                
                if not ret or frame is None:
                    logger.warning(f"⚠️ فشل قراءة إطار من: {self.config.name}")
                    time.sleep(0.1)
                    continue
                
                self.frame_count += 1
                self.state.frames_read += 1
                self.state.last_frame = frame
                self.state.last_frame_time = time.time()
                
                # حساب FPS
                fps_counter.append(time.time())
                if len(fps_counter) >= 2:
                    self.state.fps_read = len(fps_counter) / (fps_counter[-1] - fps_counter[0])
                
                # إضافة للطابور فقط كل N إطارات (للكشف)
                if self.frame_count % self.config.skip_frames == 0:
                    # التحقق من امتلاء الطابور
                    if self.frame_queue.qsize() < 100:  # حد أقصى
                        packet = FramePacket(
                            camera_id=self.config.camera_id,
                            frame=frame.copy(),
                            timestamp=time.time(),
                            frame_number=self.frame_count,
                            priority=self.config.priority,
                            config=self.config
                        )
                        self.frame_queue.put((packet.priority.value, packet))
                
                # الحفاظ على معدل القراءة
                elapsed = time.time() - start_time
                sleep_time = frame_interval - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
            except Exception as e:
                logger.error(f"❌ خطأ في قراءة الكاميرا {self.config.name}: {e}")
                time.sleep(0.5)
        
        # إغلاق
        if self.cap:
            self.cap.release()
        self.state.status = CameraStatus.DISCONNECTED
        logger.info(f"⏹️ توقف قراءة الكاميرا: {self.config.name}")


class MultiCameraProcessor:
    """
    معالج الكاميرات المتعددة
    
    Features:
    - إدارة كاميرات متعددة
    - طابور أولوية للإطارات
    - معالجة متوازية على GPU
    - توزيع الحمل الذكي
    """
    
    def __init__(
        self,
        detector,  # WeaponDetector instance
        max_cameras: int = 8,
        detection_workers: int = 2,
        max_queue_size: int = 100
    ):
        self.detector = detector
        self.max_cameras = max_cameras
        self.detection_workers = detection_workers
        
        # State
        self.cameras: Dict[str, CameraState] = {}
        self.readers: Dict[str, CameraReader] = {}
        self.stop_events: Dict[str, threading.Event] = {}
        
        # Shared frame queue with priority
        self.frame_queue: queue.PriorityQueue = queue.PriorityQueue(maxsize=max_queue_size)
        
        # Detection results queue
        self.results_queue: asyncio.Queue = asyncio.Queue()
        
        # Worker pool for detection
        self.detection_pool = ThreadPoolExecutor(
            max_workers=detection_workers,
            thread_name_prefix="detector"
        )
        
        # Control
        self.is_running = False
        self._processing_task: Optional[asyncio.Task] = None
        
        # Callbacks
        self.on_detection: Optional[Callable[[str, DetectionResult], Awaitable[None]]] = None
        self.on_alert: Optional[Callable[[str, Dict], Awaitable[None]]] = None
        self.on_frame: Optional[Callable[[str, np.ndarray, List[Dict]], Awaitable[None]]] = None
        
        # Statistics
        self.total_frames_processed = 0
        self.total_detections = 0
        self.start_time = time.time()
        
        logger.info(f"🎬 تهيئة معالج الكاميرات المتعددة")
        logger.info(f"   - أقصى كاميرات: {max_cameras}")
        logger.info(f"   - workers للكشف: {detection_workers}")

    async def add_camera(self, config: CameraConfig) -> bool:
        """إضافة كاميرا جديدة"""
        if config.camera_id in self.cameras:
            logger.warning(f"⚠️ الكاميرا موجودة: {config.camera_id}")
            return False
        
        if len(self.cameras) >= self.max_cameras:
            logger.error(f"❌ تم الوصول للحد الأقصى من الكاميرات: {self.max_cameras}")
            return False
        
        # إنشاء الحالة
        state = CameraState(config=config)
        self.cameras[config.camera_id] = state
        
        # إنشاء stop event
        stop_event = threading.Event()
        self.stop_events[config.camera_id] = stop_event
        
        # إنشاء وتشغيل القارئ
        reader = CameraReader(config, self.frame_queue, state, stop_event)
        self.readers[config.camera_id] = reader
        reader.start()
        
        logger.info(f"✅ تمت إضافة الكاميرا: {config.name}")
        return True

    async def remove_camera(self, camera_id: str) -> bool:
        """إزالة كاميرا"""
        if camera_id not in self.cameras:
            return False
        
        # إيقاف القارئ
        if camera_id in self.stop_events:
            self.stop_events[camera_id].set()
        
        if camera_id in self.readers:
            self.readers[camera_id].join(timeout=2.0)
            del self.readers[camera_id]
        
        # تنظيف
        if camera_id in self.stop_events:
            del self.stop_events[camera_id]
        if camera_id in self.cameras:
            del self.cameras[camera_id]
        
        logger.info(f"🗑️ تمت إزالة الكاميرا: {camera_id}")
        return True

    async def start(self):
        """بدء المعالجة"""
        if self.is_running:
            return
        
        self.is_running = True
        self.start_time = time.time()
        
        # بدء مهمة المعالجة
        self._processing_task = asyncio.create_task(self._processing_loop())
        
        logger.info("🚀 بدء معالجة الكاميرات")

    async def stop(self):
        """إيقاف المعالجة"""
        self.is_running = False
        
        # إيقاف جميع القراء
        for event in self.stop_events.values():
            event.set()
        
        for reader in self.readers.values():
            reader.join(timeout=2.0)
        
        # إيقاف مهمة المعالجة
        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass
        
        # إيقاف pool
        self.detection_pool.shutdown(wait=False)
        
        logger.info("⏹️ توقف معالج الكاميرات")

    async def _processing_loop(self):
        """حلقة المعالجة الرئيسية"""
        logger.info("🔄 بدء حلقة المعالجة")
        
        while self.is_running:
            try:
                # محاولة الحصول على إطار من الطابور
                try:
                    priority, packet = self.frame_queue.get(timeout=0.1)
                except queue.Empty:
                    await asyncio.sleep(0.01)
                    continue
                
                # معالجة الإطار
                result = await self._process_frame(packet)
                
                if result:
                    self.total_frames_processed += 1
                    
                    # تحديث الحالة
                    camera_state = self.cameras.get(packet.camera_id)
                    if camera_state:
                        camera_state.frames_processed += 1
                        camera_state.last_detection_time = time.time()
                        camera_state.current_detections = result.detections
                        
                        if result.detections:
                            camera_state.detections_count += len(result.detections)
                            self.total_detections += len(result.detections)
                    
                    # استدعاء callbacks
                    if result.detections:
                        if self.on_detection:
                            await self.on_detection(packet.camera_id, result)
                        
                        # التحقق من التنبيه
                        await self._check_alert(packet.camera_id, result)
                    
                    if self.on_frame and result.annotated_frame is not None:
                        await self.on_frame(
                            packet.camera_id,
                            result.annotated_frame,
                            result.detections
                        )
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ خطأ في المعالجة: {e}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(0.1)

    async def _process_frame(self, packet: FramePacket) -> Optional[DetectionResult]:
        """معالجة إطار واحد"""
        start_time = time.time()
        
        frame = packet.frame
        config = packet.config
        
        # تصغير الصورة للكشف
        if config.detection_scale != 1.0:
            detect_frame = cv2.resize(
                frame,
                None,
                fx=config.detection_scale,
                fy=config.detection_scale,
                interpolation=cv2.INTER_LINEAR
            )
        else:
            detect_frame = frame
        
        # تطبيق ROI إذا موجود
        if config.roi:
            x1, y1, x2, y2 = config.roi
            detect_frame = detect_frame[y1:y2, x1:x2]
        
        # تشغيل الكشف
        try:
            result = await asyncio.get_event_loop().run_in_executor(
                self.detection_pool,
                lambda: self.detector.detect_sync(
                    detect_frame,
                    f"{packet.camera_id}_{packet.frame_number}"
                )
            )
        except Exception as e:
            logger.error(f"❌ خطأ في الكشف: {e}")
            return None
        
        # تحويل الإحداثيات إذا تم التصغير أو ROI
        detections = []
        for det in result.detections:
            det_dict = {
                'id': det.id,
                'class_name': det.class_name,
                'class_name_ar': det.class_name_ar,
                'confidence': det.confidence,
                'severity': det.severity,
                'detection_type': det.detection_type,
            }
            
            # تحويل bbox
            bbox = det.bbox
            if isinstance(bbox, tuple):
                x1, y1, x2, y2 = bbox
            else:
                x1, y1 = bbox['x1'], bbox['y1']
                x2, y2 = bbox['x2'], bbox['y2']
            
            # تعديل للـ scale
            if config.detection_scale != 1.0:
                scale = 1.0 / config.detection_scale
                x1, y1, x2, y2 = int(x1*scale), int(y1*scale), int(x2*scale), int(y2*scale)
            
            # تعديل للـ ROI
            if config.roi:
                roi_x1, roi_y1, _, _ = config.roi
                x1 += roi_x1
                y1 += roi_y1
                x2 += roi_x1
                y2 += roi_y1
            
            det_dict['bbox'] = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2}
            detections.append(det_dict)
        
        # رسم على الإطار الأصلي
        annotated_frame = self._draw_detections(frame.copy(), detections)
        
        processing_time = time.time() - start_time
        
        return DetectionResult(
            camera_id=packet.camera_id,
            frame_number=packet.frame_number,
            timestamp=packet.timestamp,
            detections=detections,
            processing_time=processing_time,
            annotated_frame=annotated_frame
        )

    async def _check_alert(self, camera_id: str, result: DetectionResult):
        """التحقق من إرسال تنبيه"""
        camera_state = self.cameras.get(camera_id)
        if not camera_state:
            return
        
        config = camera_state.config
        if not config.alert_on_detection:
            return
        
        # التحقق من الفاصل الزمني
        current_time = time.time()
        if current_time - camera_state.last_alert_time < config.min_alert_interval:
            return
        
        # إرسال التنبيه
        for det in result.detections:
            if det.get('severity') == 'critical':
                camera_state.last_alert_time = current_time
                
                if self.on_alert:
                    alert = {
                        'camera_id': camera_id,
                        'camera_name': config.name,
                        'detection': det,
                        'timestamp': datetime.utcnow().isoformat(),
                        'frame_number': result.frame_number
                    }
                    await self.on_alert(camera_id, alert)
                    logger.warning(f"🚨 تنبيه من {config.name}: {det['class_name_ar']}")

    def _draw_detections(self, frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
        """رسم الكشوفات على الإطار"""
        for det in detections:
            bbox = det['bbox']
            x1, y1, x2, y2 = bbox['x1'], bbox['y1'], bbox['x2'], bbox['y2']
            
            # اللون حسب الخطورة
            severity = det.get('severity', 'low')
            colors = {
                'critical': (0, 0, 255),   # أحمر
                'high': (0, 128, 255),     # برتقالي
                'medium': (0, 255, 255),   # أصفر
                'low': (0, 255, 0)         # أخضر
            }
            color = colors.get(severity, (255, 255, 255))
            
            # رسم المربع
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            
            # النص
            confidence = det.get('confidence', 0) * 100
            label = f"{det.get('class_name_ar', 'unknown')}: {confidence:.0f}%"
            
            # خلفية للنص
            (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame, (x1, y1-text_h-10), (x1+text_w+10, y1), color, -1)
            cv2.putText(frame, label, (x1+5, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)
        
        return frame

    def get_stats(self) -> Dict:
        """إحصائيات شاملة"""
        uptime = time.time() - self.start_time
        
        cameras_stats = {}
        for cam_id, state in self.cameras.items():
            cameras_stats[cam_id] = {
                'name': state.config.name,
                'status': state.status.value,
                'fps_read': round(state.fps_read, 1),
                'frames_read': state.frames_read,
                'frames_processed': state.frames_processed,
                'detections_count': state.detections_count,
                'current_detections': len(state.current_detections),
            }
        
        return {
            'uptime_seconds': round(uptime, 1),
            'total_cameras': len(self.cameras),
            'active_cameras': sum(1 for s in self.cameras.values() if s.status == CameraStatus.STREAMING),
            'total_frames_processed': self.total_frames_processed,
            'total_detections': self.total_detections,
            'queue_size': self.frame_queue.qsize(),
            'avg_fps': round(self.total_frames_processed / uptime, 1) if uptime > 0 else 0,
            'cameras': cameras_stats
        }

    def get_camera_frame(self, camera_id: str) -> Optional[Tuple[np.ndarray, List[Dict]]]:
        """الحصول على آخر إطار مع الكشوفات"""
        state = self.cameras.get(camera_id)
        if not state or state.last_frame is None:
            return None
        
        return state.last_frame, state.current_detections


# ===========================================
# مثال على الاستخدام
# ===========================================
"""
from app.services.detector import WeaponDetector

async def main():
    # تهيئة الكاشف
    detector = WeaponDetector()
    await detector.load_model()
    
    # تهيئة معالج الكاميرات
    processor = MultiCameraProcessor(
        detector=detector,
        max_cameras=4,
        detection_workers=2
    )
    
    # Callbacks
    async def on_alert(camera_id, alert):
        print(f"🚨 تنبيه: {alert}")
        # إرسال عبر WebSocket
        # await websocket_manager.broadcast(alert)
    
    processor.on_alert = on_alert
    
    # إضافة كاميرات
    await processor.add_camera(CameraConfig(
        camera_id="cam_1",
        name="المدخل الرئيسي",
        rtsp_url="rtsp://192.168.1.100:554/stream",
        priority=FramePriority.HIGH,
        detection_fps=10  # كشف أعلى للمدخل
    ))
    
    await processor.add_camera(CameraConfig(
        camera_id="cam_2",
        name="موقف السيارات",
        rtsp_url="rtsp://192.168.1.101:554/stream",
        priority=FramePriority.NORMAL,
        detection_fps=6
    ))
    
    # بدء المعالجة
    await processor.start()
    
    # تشغيل لمدة معينة
    await asyncio.sleep(60)
    
    # إحصائيات
    print(processor.get_stats())
    
    # إيقاف
    await processor.stop()

if __name__ == "__main__":
    asyncio.run(main())
"""
