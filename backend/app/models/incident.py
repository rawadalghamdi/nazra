"""
نموذج الحادثة (Incident)
========================
يجمع التنبيهات المتعلقة من نفس الكاميرا خلال فترة زمنية
"""

from sqlalchemy import Column, String, Float, DateTime, Integer, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class IncidentStatus(str, enum.Enum):
    """حالات الحادثة"""
    ACTIVE = "نشطة"           # الحادثة مستمرة (يتم الكشف)
    CLOSED = "مغلقة"          # الحادثة انتهت (لم يعد هناك كشف)
    REVIEWED = "تمت المراجعة"  # تمت مراجعتها من المشرف
    CONFIRMED = "مؤكدة"       # تم تأكيد التهديد
    FALSE_ALARM = "إنذار كاذب" # إنذار كاذب


class Incident(Base):
    """
    نموذج الحادثة
    =============
    يجمع التنبيهات المتعلقة من نفس الكاميرا ونوع السلاح خلال فترة زمنية
    
    الحادثة تبدأ عند أول كشف وتنتهي بعد فترة من عدم الكشف
    """
    __tablename__ = "incidents"
    
    # المعرف الفريد
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # معلومات الكاميرا
    camera_id = Column(String(36), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_name = Column(String(100), nullable=False, comment="اسم الكاميرا")
    location = Column(String(200), nullable=True, comment="موقع الكاميرا")
    
    # معلومات الكشف الرئيسية
    primary_weapon_type = Column(String(50), nullable=False, comment="نوع السلاح الرئيسي")
    max_confidence = Column(Float, default=0.0, comment="أعلى نسبة ثقة")
    avg_confidence = Column(Float, default=0.0, comment="متوسط نسبة الثقة")
    severity = Column(String(20), comment="مستوى الخطورة")
    
    # إحصائيات
    alert_count = Column(Integer, default=0, comment="عدد التنبيهات في هذه الحادثة")
    detection_count = Column(Integer, default=0, comment="عدد الكشوفات الإجمالي")
    
    # أفضل لقطة (الأعلى ثقة)
    best_snapshot = Column(String(500), nullable=True, comment="أفضل صورة لقطة")
    thumbnail = Column(String(500), nullable=True, comment="صورة مصغرة")
    
    # الفترة الزمنية
    started_at = Column(DateTime, default=datetime.utcnow, index=True, comment="وقت بدء الحادثة")
    last_detection_at = Column(DateTime, default=datetime.utcnow, comment="وقت آخر كشف")
    ended_at = Column(DateTime, nullable=True, comment="وقت انتهاء الحادثة")
    
    # الحالة
    status = Column(String(30), default=IncidentStatus.ACTIVE.value, index=True, comment="حالة الحادثة")
    
    # المراجعة
    reviewed_by = Column(String(100), nullable=True, comment="تمت المراجعة بواسطة")
    reviewed_at = Column(DateTime, nullable=True, comment="تاريخ المراجعة")
    notes = Column(Text, nullable=True, comment="ملاحظات")
    
    # البيانات الإضافية
    extra_data = Column(JSON, nullable=True, comment="بيانات إضافية")
    
    # الطوابع الزمنية
    created_at = Column(DateTime, default=datetime.utcnow, comment="تاريخ الإنشاء")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="تاريخ التحديث")
    
    # العلاقات
    camera = relationship("Camera", back_populates="incidents")
    alerts = relationship("Alert", back_populates="incident", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Incident(id={self.id}, camera={self.camera_name}, alerts={self.alert_count})>"
    
    def to_dict(self) -> dict:
        """تحويل النموذج لقاموس"""
        return {
            "id": self.id,
            "camera_id": self.camera_id,
            "camera_name": self.camera_name,
            "location": self.location,
            "primary_weapon_type": self.primary_weapon_type,
            "max_confidence": self.max_confidence,
            "avg_confidence": self.avg_confidence,
            "severity": self.severity,
            "alert_count": self.alert_count,
            "detection_count": self.detection_count,
            "best_snapshot": self.best_snapshot,
            "thumbnail": self.thumbnail,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_detection_at": self.last_detection_at.isoformat() if self.last_detection_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "status": self.status,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def add_detection(self, confidence: float):
        """إضافة كشف جديد للحادثة"""
        self.detection_count += 1
        self.last_detection_at = datetime.utcnow()
        
        # تحديث الإحصائيات
        if confidence > self.max_confidence:
            self.max_confidence = confidence
        
        # حساب المتوسط المتحرك
        if self.avg_confidence == 0:
            self.avg_confidence = confidence
        else:
            self.avg_confidence = (self.avg_confidence * (self.detection_count - 1) + confidence) / self.detection_count
    
    def close(self):
        """إغلاق الحادثة"""
        self.status = IncidentStatus.CLOSED.value
        self.ended_at = datetime.utcnow()
    
    def is_active(self) -> bool:
        """هل الحادثة نشطة؟"""
        return self.status == IncidentStatus.ACTIVE.value
    
    @classmethod
    def get_status_emoji(cls, status: str) -> str:
        """الحصول على إيموجي الحالة"""
        status_emojis = {
            IncidentStatus.ACTIVE.value: "🔴",
            IncidentStatus.CLOSED.value: "⚪",
            IncidentStatus.REVIEWED.value: "🟡",
            IncidentStatus.CONFIRMED.value: "🟠",
            IncidentStatus.FALSE_ALARM.value: "🟢",
        }
        return status_emojis.get(status, "⚪")

