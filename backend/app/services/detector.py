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
logger = logging.getLogger("نظرة.الكشف")

# استيراد اختياري للمكتبات الثقيلة
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    np = None
    NUMPY_AVAILABLE = False
    logger.warning("⚠️ مكتبة numpy غير متوفرة")

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
    logger.warning("⚠️ مكتبة OpenCV غير متوفرة")

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO = None
    YOLO_AVAILABLE = False
    logger.warning("⚠️ مكتبة ultralytics غير متوفرة")


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
    
    # تصنيفات الأسلحة (الإنجليزية -> العربية)
    WEAPON_CLASSES = {
        'gun': ('مسدس', 'weapon', 'critical'),
        'pistol': ('مسدس', 'weapon', 'critical'),
        'handgun': ('مسدس', 'weapon', 'critical'),
        'rifle': ('بندقية', 'weapon', 'critical'),
        'shotgun': ('بندقية', 'weapon', 'critical'),
        'knife': ('سكين', 'knife', 'high'),
        'blade': ('سكين', 'knife', 'high'),
        'sword': ('سيف', 'knife', 'high'),
        'machete': ('ساطور', 'knife', 'high'),
    }
    
    def __init__(
        self,
        model_path: str = "./models/yolo11_weapons.pt",
        confidence_threshold: float = 0.7,
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
        self.device = device
        self.model = None
        self.is_loaded = False
        
        # إحصائيات الأداء
        self.total_detections = 0
        self.total_frames = 0
        self.average_time = 0.0
        self.last_detection_time: Optional[datetime] = None
        
        logger.info(f"🎯 تهيئة محرك الكشف - حد الثقة: {confidence_threshold}")
    
    async def load_model(self) -> bool:
        """
        تحميل نموذج YOLO
        
        Returns:
            bool: نجاح التحميل
        """
        logger.info("📥 جاري تحميل نموذج الكشف...")
        
        if not YOLO_AVAILABLE:
            logger.error("❌ مكتبة ultralytics غير مثبتة")
            return False
        
        try:
            model_file = self.model_path
            
            # التحقق من وجود الملف
            if not os.path.exists(model_file):
                logger.warning(f"⚠️ ملف النموذج غير موجود: {model_file}")
                logger.info("📥 سيتم استخدام نموذج YOLO الافتراضي")
                model_file = "yolov8n.pt"  # نموذج افتراضي صغير
            
            # تحميل النموذج
            self.model = YOLO(model_file)
            
            # تحديد الجهاز
            if self.device == "auto":
                try:
                    import torch
                    if torch.cuda.is_available():
                        self.device = "cuda"
                        logger.info("🎮 استخدام GPU (CUDA)")
                    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                        self.device = "mps"
                        logger.info("🍎 استخدام Apple Silicon (MPS)")
                    else:
                        self.device = "cpu"
                        logger.info("💻 استخدام CPU")
                except ImportError:
                    self.device = "cpu"
            
            self.is_loaded = True
            logger.info(f"✅ تم تحميل النموذج على: {self.device}")
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في تحميل النموذج: {e}")
            return False
    
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
            logger.warning("⚠️ النموذج غير محمل")
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
                if boxes is None:
                    continue
                
                for i, box in enumerate(boxes):
                    # استخراج البيانات
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0])
                    class_id = int(box.cls[0])
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
            logger.error(f"❌ خطأ في الكشف: {e}")
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
                f"🎯 تم كشف {len(detections)} سلاح في {processing_time:.3f}ث - "
                f"الكاميرا: {camera_id}"
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
        الحصول على إحصائيات الأداء
        """
        return {
            "total_frames": self.total_frames,
            "total_detections": self.total_detections,
            "average_time_ms": self.average_time * 1000,
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
        logger.info("🔄 تم إعادة تعيين إحصائيات الكشف")


# إنشاء كائن الكشف العام
_detector: Optional[WeaponDetector] = None


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
        logger.info("🛑 إيقاف محرك الكشف")
        _detector = None
