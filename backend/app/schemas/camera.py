"""
مخططات الكاميرات - Pydantic Schemas
===================================
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class CameraBase(BaseModel):
    """
    مخطط الكاميرا الأساسي
    =====================
    """
    name: str = Field(..., min_length=1, max_length=100, description="اسم الكاميرا")
    location: str = Field(..., max_length=200, description="موقع الكاميرا")
    rtsp_url: Optional[str] = Field(None, description="رابط RTSP")
    onvif_host: Optional[str] = Field(None, description="عنوان ONVIF")
    onvif_port: int = Field(80, ge=1, le=65535, description="منفذ ONVIF")
    onvif_user: Optional[str] = Field(None, description="مستخدم ONVIF")
    onvif_password: Optional[str] = Field(None, description="كلمة مرور ONVIF")


class CameraCreate(CameraBase):
    """
    مخطط إنشاء كاميرا جديدة
    =======================
    """
    detection_enabled: bool = Field(True, description="تفعيل الكشف")
    sensitivity: float = Field(0.7, ge=0, le=1, description="حساسية الكشف")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "كاميرا المدخل الرئيسي",
                "location": "البوابة الرئيسية",
                "rtsp_url": "rtsp://admin:password@192.168.1.100:554/stream1",
                "onvif_host": "192.168.1.100",
                "onvif_port": 80,
                "onvif_user": "admin",
                "onvif_password": "password",
                "detection_enabled": True,
                "sensitivity": 0.7
            }
        }


class CameraUpdate(BaseModel):
    """
    مخطط تحديث الكاميرا
    ===================
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="اسم الكاميرا")
    location: Optional[str] = Field(None, max_length=200, description="موقع الكاميرا")
    rtsp_url: Optional[str] = Field(None, description="رابط RTSP")
    onvif_host: Optional[str] = Field(None, description="عنوان ONVIF")
    onvif_port: Optional[int] = Field(None, ge=1, le=65535, description="منفذ ONVIF")
    onvif_user: Optional[str] = Field(None, description="مستخدم ONVIF")
    onvif_password: Optional[str] = Field(None, description="كلمة مرور ONVIF")
    detection_enabled: Optional[bool] = Field(None, description="تفعيل الكشف")
    sensitivity: Optional[float] = Field(None, ge=0, le=1, description="حساسية الكشف")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "كاميرا المدخل الرئيسي - محدث",
                "sensitivity": 0.8
            }
        }


class CameraResponse(CameraBase):
    """
    مخطط استجابة الكاميرا
    =====================
    """
    id: str = Field(..., description="معرف الكاميرا")
    status: Literal['online', 'offline', 'error', 'maintenance'] = Field(..., description="حالة الكاميرا")
    is_recording: bool = Field(..., description="هل يتم التسجيل؟")
    detection_enabled: bool = Field(..., description="هل الكشف مفعل؟")
    sensitivity: float = Field(..., description="حساسية الكشف")
    last_seen: Optional[datetime] = Field(None, description="آخر ظهور")
    created_at: datetime = Field(..., description="تاريخ الإنشاء")
    updated_at: datetime = Field(..., description="تاريخ التحديث")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "cam-001",
                "name": "كاميرا المدخل الرئيسي",
                "location": "البوابة الرئيسية",
                "rtsp_url": "rtsp://admin:password@192.168.1.100:554/stream1",
                "onvif_host": "192.168.1.100",
                "onvif_port": 80,
                "onvif_user": "admin",
                "onvif_password": None,
                "status": "online",
                "is_recording": False,
                "detection_enabled": True,
                "sensitivity": 0.7,
                "last_seen": "2024-01-15T10:30:00Z",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-15T10:30:00Z"
            }
        }


class CameraStatus(BaseModel):
    """
    مخطط حالة الكاميرا
    ==================
    """
    id: str = Field(..., description="معرف الكاميرا")
    name: str = Field(..., description="اسم الكاميرا")
    status: Literal['online', 'offline', 'error', 'maintenance'] = Field(..., description="حالة الكاميرا")
    is_recording: bool = Field(..., description="هل يتم التسجيل؟")
    detection_enabled: bool = Field(..., description="هل الكشف مفعل؟")
    fps: Optional[float] = Field(None, description="معدل الإطارات الحالي")
    latency: Optional[float] = Field(None, description="زمن التأخير بالمللي ثانية")
    last_detection: Optional[datetime] = Field(None, description="آخر كشف")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "cam-001",
                "name": "كاميرا المدخل الرئيسي",
                "status": "online",
                "is_recording": False,
                "detection_enabled": True,
                "fps": 15.0,
                "latency": 120.5,
                "last_detection": "2024-01-15T10:25:00Z"
            }
        }


class CameraTestResult(BaseModel):
    """
    مخطط نتيجة اختبار الكاميرا
    ==========================
    """
    success: bool = Field(..., description="هل نجح الاختبار؟")
    message: str = Field(..., description="رسالة النتيجة")
    details: Optional[dict] = Field(None, description="تفاصيل إضافية")
    latency_ms: Optional[float] = Field(None, description="زمن الاستجابة بالمللي ثانية")
    resolution: Optional[str] = Field(None, description="دقة الفيديو")
    fps: Optional[float] = Field(None, description="معدل الإطارات")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "تم الاتصال بالكاميرا بنجاح",
                "details": {"codec": "H.264", "audio": False},
                "latency_ms": 85.5,
                "resolution": "1920x1080",
                "fps": 30.0
            }
        }
