"""
نموذج التنبيه
=============
"""

from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class WeaponType(str, enum.Enum):
    """أنواع الأسلحة المكتشفة"""
    PISTOL = "مسدس"
    KNIFE = "سكين"
    RIFLE = "بندقية"
    OTHER = "أخرى"


class AlertStatus(str, enum.Enum):
    """حالات التنبيه"""
    NEW = "جديد"
    UNDER_REVIEW = "قيد المراجعة"
    CONFIRMED = "مؤكد"
    FALSE_ALARM = "إنذار كاذب"


class AlertSeverity(str, enum.Enum):
    """مستويات الخطورة"""
    CRITICAL = "حرج"
    HIGH = "عالي"
    MEDIUM = "متوسط"
    LOW = "منخفض"


class Alert(Base):
    """
    نموذج التنبيه
    =============
    يمثل تنبيه كشف سلاح في النظام
    """
    __tablename__ = "alerts"
    
    # المعرف الفريد
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # الحادثة المرتبطة (يمكن أن يكون None للتنبيهات القديمة)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # معلومات الكاميرا
    camera_id = Column(String(36), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True)
    camera_name = Column(String(100), nullable=False, comment="اسم الكاميرا")
    location = Column(String(200), nullable=True, comment="موقع الكشف")
    
    # معلومات الكشف
    weapon_type = Column(String(50), nullable=False, comment="نوع السلاح المكتشف")
    confidence = Column(Float, nullable=False, comment="نسبة الثقة (0-1)")
    severity = Column(String(20), default=AlertSeverity.HIGH.value, comment="مستوى الخطورة")
    
    # الصور والفيديو
    image_snapshot = Column(String(500), nullable=True, comment="مسار صورة اللقطة")
    video_clip = Column(String(500), nullable=True, comment="مسار مقطع الفيديو")
    
    # إحداثيات الكشف
    bounding_box = Column(JSON, nullable=True, comment="إحداثيات مربع الكشف")
    
    # حالة التنبيه
    status = Column(String(30), default=AlertStatus.NEW.value, index=True, comment="حالة التنبيه")
    
    # المراجعة
    reviewed_by = Column(String(100), nullable=True, comment="تمت المراجعة بواسطة")
    reviewed_at = Column(DateTime, nullable=True, comment="تاريخ المراجعة")
    notes = Column(Text, nullable=True, comment="ملاحظات المراجعة")
    
    # الطوابع الزمنية
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, comment="وقت الكشف")
    created_at = Column(DateTime, default=datetime.utcnow, comment="تاريخ الإنشاء")
    
    # العلاقات
    camera = relationship("Camera", back_populates="alerts")
    incident = relationship("Incident", back_populates="alerts")
    
    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, weapon_type={self.weapon_type}, status={self.status})>"
    
    def to_dict(self) -> dict:
        """تحويل النموذج لقاموس"""
        return {
            "id": self.id,
            "incident_id": self.incident_id,
            "camera_id": self.camera_id,
            "camera_name": self.camera_name,
            "location": self.location,
            "weapon_type": self.weapon_type,
            "confidence": self.confidence,
            "severity": self.severity,
            "image_snapshot": self.image_snapshot,
            "video_clip": self.video_clip,
            "bounding_box": self.bounding_box,
            "status": self.status,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "notes": self.notes,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    @classmethod
    def get_severity_from_weapon(cls, weapon_type: str) -> str:
        """تحديد مستوى الخطورة بناءً على نوع السلاح"""
        severity_map = {
            WeaponType.PISTOL.value: AlertSeverity.CRITICAL.value,
            WeaponType.RIFLE.value: AlertSeverity.CRITICAL.value,
            WeaponType.KNIFE.value: AlertSeverity.HIGH.value,
            WeaponType.OTHER.value: AlertSeverity.MEDIUM.value,
        }
        return severity_map.get(weapon_type, AlertSeverity.HIGH.value)
    
    @classmethod
    def get_status_emoji(cls, status: str) -> str:
        """الحصول على إيموجي الحالة"""
        status_emojis = {
            AlertStatus.NEW.value: "🔴",
            AlertStatus.UNDER_REVIEW.value: "🟡",
            AlertStatus.CONFIRMED.value: "🟠",
            AlertStatus.FALSE_ALARM.value: "🟢",
        }
        return status_emojis.get(status, "⚪")
    
    @classmethod
    def get_weapon_emoji(cls, weapon_type: str) -> str:
        """الحصول على إيموجي نوع السلاح"""
        weapon_emojis = {
            WeaponType.PISTOL.value: "🔫",
            WeaponType.KNIFE.value: "🔪",
            WeaponType.RIFLE.value: "🎯",
            WeaponType.OTHER.value: "⚠️",
        }
        return weapon_emojis.get(weapon_type, "❓")
