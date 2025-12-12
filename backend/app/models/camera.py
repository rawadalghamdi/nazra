"""
نموذج الكاميرا
==============
"""

from sqlalchemy import Column, String, Boolean, Float, Integer, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.database import Base


class CameraStatus(str, enum.Enum):
    """حالات الكاميرا"""
    ONLINE = "online"
    OFFLINE = "offline"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class Camera(Base):
    """
    نموذج الكاميرا
    ==============
    يمثل كاميرا مراقبة في النظام
    """
    __tablename__ = "cameras"
    
    # المعرف الفريد
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # معلومات أساسية
    name = Column(String(100), nullable=False, index=True, comment="اسم الكاميرا")
    location = Column(String(200), nullable=True, comment="موقع الكاميرا")
    description = Column(Text, nullable=True, comment="وصف الكاميرا")
    
    # اتصال RTSP
    rtsp_url = Column(String(500), nullable=True, comment="رابط RTSP")
    
    # اتصال ONVIF
    onvif_host = Column(String(100), nullable=True, comment="عنوان ONVIF")
    onvif_port = Column(Integer, default=80, comment="منفذ ONVIF")
    onvif_user = Column(String(100), nullable=True, comment="مستخدم ONVIF")
    onvif_password = Column(String(200), nullable=True, comment="كلمة مرور ONVIF")
    
    # الحالة
    status = Column(String(20), default=CameraStatus.OFFLINE.value, comment="حالة الكاميرا")
    is_recording = Column(Boolean, default=False, comment="هل يتم التسجيل؟")
    last_seen = Column(DateTime, nullable=True, comment="آخر ظهور")
    
    # إعدادات الكشف
    detection_enabled = Column(Boolean, default=True, comment="تفعيل الكشف")
    sensitivity = Column(Float, default=0.7, comment="حساسية الكشف (0-1)")
    
    # إعدادات البث
    stream_quality = Column(String(20), default="medium", comment="جودة البث")
    fps = Column(Integer, default=15, comment="عدد الإطارات")
    
    # الطوابع الزمنية
    created_at = Column(DateTime, default=datetime.utcnow, comment="تاريخ الإنشاء")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="تاريخ التحديث")
    
    # العلاقات
    alerts = relationship("Alert", back_populates="camera", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="camera", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Camera(id={self.id}, name={self.name}, status={self.status})>"
    
    def to_dict(self) -> dict:
        """تحويل النموذج لقاموس"""
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "description": self.description,
            "rtsp_url": self.rtsp_url,
            "onvif_host": self.onvif_host,
            "onvif_port": self.onvif_port,
            "onvif_user": self.onvif_user,
            "status": self.status,
            "is_recording": self.is_recording,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "detection_enabled": self.detection_enabled,
            "sensitivity": self.sensitivity,
            "stream_quality": self.stream_quality,
            "fps": self.fps,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @classmethod
    def get_status_emoji(cls, status: str) -> str:
        """الحصول على إيموجي الحالة"""
        status_emojis = {
            "online": "🟢",
            "offline": "🔴",
            "error": "🟠",
            "maintenance": "🔧",
        }
        return status_emojis.get(status, "⚪")
