"""
خدمة الكشف عن الأسلحة باستخدام YOLO11
=====================================
زمن الاستجابة المستهدف: أقل من 2 ثانية
"""

import asyncio
import time
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import numpy as np
import cv2
from pathlib import Path

# سيتم استيرادها عند تثبيت الحزم
try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None

@dataclass
class Detection:
    """نتيجة كشف واحدة"""
    id: str
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    detection_type: str  # weapon, knife, suspicious_object

@dataclass
class DetectionResult:
    """نتيجة الكشف الكاملة"""
    frame_id: str
    timestamp: float
    detections: List[Detection]
    processing_time: float
    frame_with_boxes: Optional[np.ndarray] = None

class WeaponDetector:
    """محرك الكشف عن الأسلحة"""
    
    # تصنيفات الأسلحة
    WEAPON_CLASSES = {
        'gun': 'weapon',
        'pistol': 'weapon',
        'rifle': 'weapon',
        'handgun': 'weapon',
        'knife': 'knife',
        'blade': 'knife',
        'sword': 'knife',
        'suspicious': 'suspicious_object'
    }
    
    # مستويات الخطورة
    SEVERITY_MAP = {
        'weapon': 'critical',
        'knife': 'high',
        'suspicious_object': 'medium'
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
            confidence_threshold: حد الثقة الأدنى
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
    
    async def load_model(self) -> bool:
        """تحميل النموذج"""
        try:
            if YOLO is None:
                print("⚠️ مكتبة ultralytics غير مثبتة")
                return False
            
            model_file = Path(self.model_path)
            
            if not model_file.exists():
                print(f"⚠️ ملف النموذج غير موجود: {self.model_path}")
                print("📥 سيتم استخدام نموذج YOLO الافتراضي للتجربة")
                # استخدام نموذج عام للتجربة
                self.model = YOLO("yolo11n.pt")
            else:
                self.model = YOLO(self.model_path)
            
            # تحديد الجهاز
            if self.device == "auto":
                import torch
                if torch.cuda.is_available():
                    self.device = "cuda"
                elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                    self.device = "mps"
                else:
                    self.device = "cpu"
            
            print(f"✅ تم تحميل النموذج على: {self.device}")
            self.is_loaded = True
            return True
            
        except Exception as e:
            print(f"❌ خطأ في تحميل النموذج: {e}")
            return False
    
    async def detect(
        self,
        frame: np.ndarray,
        frame_id: str = "0"
    ) -> DetectionResult:
        """
        الكشف على إطار واحد
        
        Args:
            frame: صورة OpenCV (BGR)
            frame_id: معرف الإطار
            
        Returns:
            DetectionResult: نتيجة الكشف
        """
        start_time = time.time()
        detections = []
        
        if not self.is_loaded or self.model is None:
            return DetectionResult(
                frame_id=frame_id,
                timestamp=time.time(),
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
                    class_name = self.model.names[class_id]
                    
                    # تحديد نوع الكشف
                    detection_type = self._classify_detection(class_name)
                    
                    if detection_type:
                        detection = Detection(
                            id=f"{frame_id}_{i}",
                            class_name=class_name,
                            confidence=confidence,
                            bbox=(int(x1), int(y1), int(x2), int(y2)),
                            detection_type=detection_type
                        )
                        detections.append(detection)
            
            # رسم الصناديق على الإطار
            annotated_frame = self._draw_detections(frame.copy(), detections)
            
        except Exception as e:
            print(f"❌ خطأ في الكشف: {e}")
            annotated_frame = frame
        
        processing_time = time.time() - start_time
        
        # تحديث الإحصائيات
        self.total_frames += 1
        self.total_detections += len(detections)
        self.average_time = (
            (self.average_time * (self.total_frames - 1) + processing_time)
            / self.total_frames
        )
        
        return DetectionResult(
            frame_id=frame_id,
            timestamp=time.time(),
            detections=detections,
            processing_time=processing_time,
            frame_with_boxes=annotated_frame
        )
    
    def _classify_detection(self, class_name: str) -> Optional[str]:
        """تصنيف نوع الكشف"""
        class_lower = class_name.lower()
        
        for keyword, detection_type in self.WEAPON_CLASSES.items():
            if keyword in class_lower:
                return detection_type
        
        return None
    
    def _draw_detections(
        self,
        frame: np.ndarray,
        detections: List[Detection]
    ) -> np.ndarray:
        """رسم صناديق الكشف على الإطار"""
        
        colors = {
            'weapon': (0, 0, 255),      # أحمر
            'knife': (0, 165, 255),     # برتقالي
            'suspicious_object': (0, 255, 255)  # أصفر
        }
        
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = colors.get(det.detection_type, (255, 255, 255))
            
            # رسم الصندوق
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            
            # رسم النص
            label = f"{det.class_name}: {det.confidence:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            
            cv2.rectangle(
                frame,
                (x1, y1 - label_size[1] - 10),
                (x1 + label_size[0], y1),
                color,
                -1
            )
            cv2.putText(
                frame,
                label,
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (255, 255, 255),
                2
            )
        
        return frame
    
    def get_severity(self, detection_type: str) -> str:
        """الحصول على مستوى الخطورة"""
        return self.SEVERITY_MAP.get(detection_type, 'low')
    
    def get_stats(self) -> Dict:
        """الحصول على إحصائيات الأداء"""
        return {
            "total_frames": self.total_frames,
            "total_detections": self.total_detections,
            "average_processing_time": self.average_time,
            "is_loaded": self.is_loaded,
            "device": self.device
        }

# نسخة عامة للاستخدام
detector = WeaponDetector()
