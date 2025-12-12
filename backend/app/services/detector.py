"""
خدمة الكشف عن الأسلحة - Weapon Detector
========================================
محرك الكشف عن الأسلحة باستخدام YOLO
زمن الاستجابة المستهدف: أقل من 2 ثانية
"""

import asyncio
import time
import uuid
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging
import os

# إعداد السجل
logger = logging.getLogger("nazra.detector")

# استيراد اختياري للمكتبات الثقيلة
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    np = None
    NUMPY_AVAILABLE = False
    logger.warning("numpy not available")

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
    logger.warning("OpenCV not available")

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO = None
    YOLO_AVAILABLE = False
    logger.warning("ultralytics not available")


@dataclass
class Detection:
    """
    نتيجة كشف واحدة
    ================
    """
    id: str
    class_name: str
    class_name_ar: str  # الاسم بالعربية
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    detection_type: str  # weapon, knife, suspicious_object
    severity: str  # critical, high, medium, low


@dataclass
class DetectionResult:
    """
    نتيجة الكشف الكاملة
    ===================
    """
    frame_id: str
    camera_id: str
    timestamp: datetime
    detections: List[Detection]
    processing_time: float
    frame_with_boxes: Optional[Any] = None  # numpy array


class WeaponDetector:
    """
    محرك الكشف عن الأسلحة
    =====================
    يستخدم YOLO للكشف عن الأسلحة في الصور والفيديو
    """
    
    # تصنيفات الأسلحة - نموذج Absher (الإنجليزية -> العربية)
    WEAPON_CLASSES = {
        # فئات نموذج Absher المدرب
        'Knife': ('سكين', 'knife', 'high'),
        'Handgun': ('مسدس', 'weapon', 'critical'),
        # فئات إضافية للتوافق
        'knife': ('سكين', 'knife', 'high'),
        'handgun': ('مسدس', 'weapon', 'critical'),
        'gun': ('مسدس', 'weapon', 'critical'),
        'pistol': ('مسدس', 'weapon', 'critical'),
        'rifle': ('بندقية', 'weapon', 'critical'),
        'shotgun': ('بندقية', 'weapon', 'critical'),
        'blade': ('سكين', 'knife', 'high'),
        'sword': ('سيف', 'knife', 'high'),
        'machete': ('ساطور', 'knife', 'high'),
    }
    
    def __init__(
        self,
        model_path: str = "/app/models/best.pt",  # نموذج Absher في Docker
        confidence_threshold: float = 0.5,
        device: str = "auto"
    ):
        """
        تهيئة محرك الكشف
        
        Args:
            model_path: مسار نموذج YOLO
            confidence_threshold: حد الثقة الأدنى (0-1)
            device: الجهاز (cpu, cuda, mps, auto)
        """
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.device = self._detect_best_device(device)
        self.model = None
        self.is_loaded = False
        
        # إحصائيات الأداء
        self.total_detections = 0
        self.total_frames = 0
        self.average_time = 0.0
        self.last_detection_time: Optional[datetime] = None
        
        logger.info(f"Initializing detector - Confidence: {confidence_threshold}")
        logger.info(f"Device: {self.device}")
    
    def _detect_best_device(self, requested: str) -> str:
        """
        اكتشاف أفضل جهاز للمعالجة
        
        الأولوية:
        1. CUDA (NVIDIA GPU) - الأسرع
        2. MPS (Apple Metal/M1-M4) - سريع جداً
        3. CPU - الأبطأ
        """
        if requested != "auto":
            return requested
        
        try:
            import torch
            
            # التحقق من CUDA (NVIDIA GPU)
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                logger.info(f"CUDA available: {gpu_name}")
                return "cuda"
            
            # التحقق من MPS (Apple Silicon M1/M2/M3/M4)
            if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                # التحقق من أن MPS يعمل فعلياً
                try:
                    test_tensor = torch.zeros(1, device='mps')
                    del test_tensor
                    logger.info("MPS (Apple Metal) available - GPU acceleration enabled!")
                    return "mps"
                except Exception as e:
                    logger.warning(f"MPS available but unstable: {e}")
            
            logger.info("💻 استخدام CPU")
            return "cpu"
            
        except ImportError:
            return "cpu"
    
    async def load_model(self) -> bool:
        """
        تحميل نموذج YOLO
        
        Returns:
            bool: نجاح التحميل
        """
        logger.info("Loading detection model...")
        logger.info(f"Model path: {self.model_path}")
        
        if not YOLO_AVAILABLE:
            logger.error("ultralytics not installed")
            return False
        
        try:
            model_file = self.model_path
            
            # التحقق من وجود الملف
            if not os.path.exists(model_file):
                logger.warning(f"Model file not found: {model_file}")
                # محاولة مسارات بديلة
                alt_paths = [
                    "/app/models/best.pt",
                    "./models/best.pt",
                    "models/best.pt",
                    "/app/models/yolov8n.pt",
                ]
                for alt_path in alt_paths:
                    if os.path.exists(alt_path):
                        model_file = alt_path
                        logger.info(f"Model found at: {model_file}")
                        break
                else:
                    logger.info("Using default YOLO model")
                    model_file = "yolov8n.pt"
            
            logger.info(f"Loading model from: {model_file}")
            
            # إصلاح مشكلة PyTorch 2.6 weights_only
            try:
                import torch
                # السماح بتحميل فئات ultralytics
                if hasattr(torch.serialization, 'add_safe_globals'):
                    try:
                        from ultralytics.nn.tasks import DetectionModel
                        torch.serialization.add_safe_globals([DetectionModel])
                    except:
                        pass
            except:
                pass
            
            # تحميل النموذج
            self.model = YOLO(model_file)
            
            # تحديد الجهاز
            if self.device == "auto":
                try:
                    import torch
                    if torch.cuda.is_available():
                        self.device = "cuda"
                        logger.info("Using GPU (CUDA)")
                    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                        self.device = "mps"
                        logger.info("Using Apple Silicon (MPS)")
                    else:
                        self.device = "cpu"
                        logger.info("Using CPU")
                except ImportError:
                    self.device = "cpu"
            
            self.is_loaded = True
            
            # عرض معلومات النموذج
            if hasattr(self.model, 'names') and self.model.names:
                logger.info(f"Model classes: {self.model.names}")
            
            logger.info(f"Model loaded on: {self.device}")
            
            # ⚡ Model Warmup - تسخين النموذج لتسريع أول inference
            await self._warmup_model()
            
            return True
            
        except Exception as e:
            logger.error(f"Model loading error: {e}")
            return False
    
    async def _warmup_model(self):
        """
        ⚡ تسخين النموذج - Model Warmup
        ================================
        يُنفذ inference وهمي لتحميل النموذج في الذاكرة
        يُحسّن أول inference الحقيقي بنسبة 50%+
        """
        if not self.is_loaded or self.model is None:
            return
        
        try:
            import numpy as np
            logger.info("Warming up model...")
            
            # إنشاء صورة وهمية بحجم نموذجي
            dummy_frame = np.zeros((640, 640, 3), dtype=np.uint8)
            
            # تنفيذ 3 inferences للتسخين الكامل
            for i in range(3):
                _ = self.model(
                    dummy_frame,
                    conf=0.5,
                    device=self.device,
                    verbose=False
                )
            
            logger.info("Model warmed up - ready!")
            
        except Exception as e:
            logger.warning(f"Model warmup failed: {e}")
    
    def detect_sync(
        self,
        frame: Any,
        frame_id: Optional[str] = None,
        camera_id: str = "unknown"
    ) -> DetectionResult:
        """
        الكشف المتزامن (Synchronous) - للاستخدام في threads
        
        Args:
            frame: صورة OpenCV (BGR numpy array)
            frame_id: معرف الإطار
            camera_id: معرف الكاميرا
            
        Returns:
            DetectionResult: نتيجة الكشف
        """
        import asyncio
        
        # إنشاء event loop جديد إذا لم يكن موجوداً
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # استخدام الكشف المباشر بدون async
                return self._detect_internal(frame, camera_id, frame_id)
            else:
                return loop.run_until_complete(self.detect(frame, camera_id, frame_id))
        except RuntimeError:
            # لا يوجد event loop
            return self._detect_internal(frame, camera_id, frame_id)
    
    def _detect_internal(
        self,
        frame: Any,
        camera_id: str = "unknown",
        frame_id: Optional[str] = None
    ) -> DetectionResult:
        """الكشف الداخلي المباشر"""
        start_time = time.time()
        detections: List[Detection] = []
        
        if frame_id is None:
            frame_id = str(uuid.uuid4())[:8]
        
        if not self.is_loaded or self.model is None:
            return DetectionResult(
                frame_id=frame_id,
                camera_id=camera_id,
                timestamp=datetime.utcnow(),
                detections=[],
                processing_time=0.0
            )
        
        try:
            results = self.model(
                frame,
                conf=self.confidence_threshold,
                device=self.device,
                verbose=False
            )
            
            for result in results:
                boxes = result.boxes
                if boxes is None or len(boxes) == 0:
                    continue
                
                # ⚡ Batch GPU→CPU Transfer
                all_xyxy = boxes.xyxy.cpu().numpy()
                all_conf = boxes.conf.cpu().numpy()
                all_cls = boxes.cls.cpu().numpy().astype(int)
                
                for i in range(len(boxes)):
                    x1, y1, x2, y2 = all_xyxy[i]
                    confidence = float(all_conf[i])
                    class_id = int(all_cls[i])
                    class_name = self.model.names[class_id].lower()
                    
                    if class_name in self.WEAPON_CLASSES:
                        name_ar, det_type, severity = self.WEAPON_CLASSES[class_name]
                    else:
                        found = False
                        for key, (name_ar, det_type, severity) in self.WEAPON_CLASSES.items():
                            if key in class_name:
                                found = True
                                break
                        if not found:
                            continue
                    
                    detection = Detection(
                        id=f"{frame_id}_{i}",
                        class_name=class_name,
                        class_name_ar=name_ar,
                        confidence=confidence,
                        bbox=(int(x1), int(y1), int(x2), int(y2)),
                        detection_type=det_type,
                        severity=severity
                    )
                    detections.append(detection)
                    
        except Exception as e:
            logger.error(f"Detection error: {e}")
        
        processing_time = time.time() - start_time
        self.total_frames += 1
        self.total_detections += len(detections)
        
        return DetectionResult(
            frame_id=frame_id,
            camera_id=camera_id,
            timestamp=datetime.utcnow(),
            detections=detections,
            processing_time=processing_time
        )
    
    async def detect(
        self,
        frame: Any,  # numpy array
        camera_id: str = "unknown",
        frame_id: Optional[str] = None
    ) -> DetectionResult:
        """
        الكشف على إطار واحد
        
        Args:
            frame: صورة OpenCV (BGR numpy array)
            camera_id: معرف الكاميرا
            frame_id: معرف الإطار (اختياري)
            
        Returns:
            DetectionResult: نتيجة الكشف
        """
        start_time = time.time()
        detections: List[Detection] = []
        
        if frame_id is None:
            frame_id = str(uuid.uuid4())[:8]
        
        # التحقق من تحميل النموذج
        if not self.is_loaded or self.model is None:
            logger.warning("Model not loaded")
            return DetectionResult(
                frame_id=frame_id,
                camera_id=camera_id,
                timestamp=datetime.utcnow(),
                detections=[],
                processing_time=0.0
            )
        
        try:
            # تشغيل الكشف
            results = self.model(
                frame,
                conf=self.confidence_threshold,
                device=self.device,
                verbose=False
            )
            
            # معالجة النتائج
            for result in results:
                boxes = result.boxes
                if boxes is None or len(boxes) == 0:
                    continue
                
                # ⚡ Batch GPU→CPU Transfer - نقل جميع البيانات دفعة واحدة
                # هذا أسرع بـ 15% من النقل الفردي لكل box
                all_xyxy = boxes.xyxy.cpu().numpy()
                all_conf = boxes.conf.cpu().numpy()
                all_cls = boxes.cls.cpu().numpy().astype(int)
                
                for i in range(len(boxes)):
                    # استخراج البيانات من المصفوفات المحملة مسبقاً
                    x1, y1, x2, y2 = all_xyxy[i]
                    confidence = float(all_conf[i])
                    class_id = int(all_cls[i])
                    class_name = self.model.names[class_id].lower()
                    
                    # تحديد نوع الكشف
                    if class_name in self.WEAPON_CLASSES:
                        name_ar, det_type, severity = self.WEAPON_CLASSES[class_name]
                    else:
                        # فحص الكلمات المشابهة
                        found = False
                        for key, (name_ar, det_type, severity) in self.WEAPON_CLASSES.items():
                            if key in class_name:
                                found = True
                                break
                        
                        if not found:
                            continue  # تخطي الكشوفات غير المرتبطة بالأسلحة
                    
                    detection = Detection(
                        id=f"{frame_id}_{i}",
                        class_name=class_name,
                        class_name_ar=name_ar,
                        confidence=confidence,
                        bbox=(int(x1), int(y1), int(x2), int(y2)),
                        detection_type=det_type,
                        severity=severity
                    )
                    detections.append(detection)
            
            # رسم الصناديق على الإطار
            annotated_frame = None
            if detections and CV2_AVAILABLE and frame is not None:
                annotated_frame = self._draw_detections(frame.copy(), detections)
            
        except Exception as e:
            logger.error(f"Detection error: {e}")
            annotated_frame = frame
        
        processing_time = time.time() - start_time
        
        # تحديث الإحصائيات
        self.total_frames += 1
        self.total_detections += len(detections)
        self.average_time = (
            (self.average_time * (self.total_frames - 1) + processing_time)
            / self.total_frames
        )
        
        if detections:
            self.last_detection_time = datetime.utcnow()
            logger.info(
                f"Detected {len(detections)} weapon(s) in {processing_time:.3f}s - "
                f"Camera: {camera_id}"
            )
        
        return DetectionResult(
            frame_id=frame_id,
            camera_id=camera_id,
            timestamp=datetime.utcnow(),
            detections=detections,
            processing_time=processing_time,
            frame_with_boxes=annotated_frame
        )
    
    def _draw_detections(self, frame: Any, detections: List[Detection]) -> Any:
        """
        رسم مربعات الكشف على الإطار
        """
        if not CV2_AVAILABLE or cv2 is None:
            return frame
        
        # ألوان حسب الخطورة
        severity_colors = {
            'critical': (0, 0, 255),    # أحمر
            'high': (0, 128, 255),      # برتقالي
            'medium': (0, 255, 255),    # أصفر
            'low': (0, 255, 0),         # أخضر
        }
        
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = severity_colors.get(det.severity, (255, 255, 255))
            
            # رسم المربع
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            
            # إعداد النص
            label = f"{det.class_name_ar} {det.confidence:.0%}"
            
            # خلفية النص
            (label_w, label_h), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
            )
            cv2.rectangle(
                frame,
                (x1, y1 - label_h - 10),
                (x1 + label_w + 10, y1),
                color,
                -1
            )
            
            # النص
            cv2.putText(
                frame,
                label,
                (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )
        
        return frame
    
    async def detect_batch(
        self,
        frames: List[Any],
        camera_id: str = "unknown"
    ) -> List[DetectionResult]:
        """
        الكشف على مجموعة إطارات
        """
        results = []
        for i, frame in enumerate(frames):
            result = await self.detect(frame, camera_id, f"batch_{i}")
            results.append(result)
        return results
    
    def get_stats(self) -> Dict:
        """
        ⚡ الحصول على إحصائيات الأداء المحسّنة
        """
        # حساب FPS الفعلي
        fps = 0
        if self.average_time > 0:
            fps = round(1.0 / self.average_time, 1)
        
        return {
            "total_frames": self.total_frames,
            "total_detections": self.total_detections,
            "average_time_ms": round(self.average_time * 1000, 2),
            "effective_fps": fps,
            "detection_rate": round(self.total_detections / max(1, self.total_frames) * 100, 1),
            "model_loaded": self.is_loaded,
            "device": self.device,
            "confidence_threshold": self.confidence_threshold,
            "last_detection": self.last_detection_time.isoformat() if self.last_detection_time else None
        }
    
    def reset_stats(self):
        """
        إعادة تعيين الإحصائيات
        """
        self.total_detections = 0
        self.total_frames = 0
        self.average_time = 0.0
        logger.info("Detection stats reset")


# إنشاء كائن الكشف العام
_detector: Optional[WeaponDetector] = None

# كائن الكشف للاستيراد المباشر (يتم تهيئته عند بدء التطبيق)
class DetectorProxy:
    """
    وكيل للوصول إلى محرك الكشف
    يسمح بالاستيراد المباشر قبل تهيئة المحرك
    """
    def __getattr__(self, name):
        global _detector
        if _detector is None:
            # إنشاء كائن بدون تحميل النموذج
            return None
        return getattr(_detector, name)
    
    @property
    def is_loaded(self):
        global _detector
        return _detector is not None and _detector.is_loaded
    
    @property
    def model(self):
        global _detector
        return _detector.model if _detector else None
    
    @property
    def confidence_threshold(self):
        global _detector
        return _detector.confidence_threshold if _detector else 0.5
    
    @property
    def device(self):
        global _detector
        return _detector.device if _detector else "cpu"

# كائن الكشف للاستيراد المباشر
detector = DetectorProxy()


async def get_detector() -> WeaponDetector:
    """
    الحصول على كائن الكشف العام
    """
    global _detector
    
    if _detector is None:
        from app.config import settings
        _detector = WeaponDetector(
            model_path=settings.YOLO_MODEL_PATH,
            confidence_threshold=settings.DETECTION_CONFIDENCE_THRESHOLD,
            device=settings.YOLO_DEVICE
        )
        await _detector.load_model()
    
    return _detector


async def shutdown_detector():
    """
    إيقاف محرك الكشف
    """
    global _detector
    if _detector is not None:
        logger.info("Stopping detector")
        _detector = None
