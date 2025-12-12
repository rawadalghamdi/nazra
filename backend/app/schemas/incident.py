"""
مخططات الحوادث - Pydantic Schemas
=================================
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

from app.schemas.alert import AlertResponse


class IncidentBase(BaseModel):
    """
    مخطط الحادثة الأساسي
    ====================
    """
    camera_id: str = Field(..., description="معرف الكاميرا")
    camera_name: str = Field(..., description="اسم الكاميرا")
    location: Optional[str] = Field(None, description="موقع الكاميرا")
    primary_weapon_type: Literal['مسدس', 'سكين', 'بندقية', 'أخرى'] = Field(..., description="نوع السلاح الرئيسي")


class IncidentCreate(IncidentBase):
    """
    مخطط إنشاء حادثة جديدة
    ======================
    """
    severity: Optional[str] = Field(None, description="مستوى الخطورة")
    
    class Config:
        json_schema_extra = {
            "example": {
                "camera_id": "cam-001",
                "camera_name": "كاميرا المدخل الرئيسي",
                "location": "البوابة الرئيسية",
                "primary_weapon_type": "مسدس",
                "severity": "حرج"
            }
        }


class IncidentUpdate(BaseModel):
    """
    مخطط تحديث الحادثة
    ==================
    """
    status: Optional[Literal['نشطة', 'مغلقة', 'تمت المراجعة', 'مؤكدة', 'إنذار كاذب']] = Field(None, description="حالة الحادثة")
    notes: Optional[str] = Field(None, description="ملاحظات")


class IncidentReview(BaseModel):
    """
    مخطط مراجعة الحادثة
    ===================
    """
    status: Literal['تمت المراجعة', 'مؤكدة', 'إنذار كاذب'] = Field(..., description="حالة الحادثة الجديدة")
    notes: Optional[str] = Field(None, description="ملاحظات المراجعة")
    reviewed_by: str = Field(..., description="اسم المراجع")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "مؤكدة",
                "notes": "تم التأكد من وجود تهديد حقيقي",
                "reviewed_by": "أحمد محمد"
            }
        }


class IncidentResponse(IncidentBase):
    """
    مخطط استجابة الحادثة
    ====================
    """
    id: str = Field(..., description="معرف الحادثة")
    status: Literal['نشطة', 'مغلقة', 'تمت المراجعة', 'مؤكدة', 'إنذار كاذب'] = Field(..., description="حالة الحادثة")
    severity: Optional[str] = Field(None, description="مستوى الخطورة")
    
    # إحصائيات
    alert_count: int = Field(0, description="عدد التنبيهات")
    detection_count: int = Field(0, description="عدد الكشوفات")
    max_confidence: float = Field(0.0, description="أعلى نسبة ثقة")
    avg_confidence: float = Field(0.0, description="متوسط نسبة الثقة")
    
    # الصور
    best_snapshot: Optional[str] = Field(None, description="أفضل لقطة")
    thumbnail: Optional[str] = Field(None, description="صورة مصغرة")
    
    # الفترة الزمنية
    started_at: datetime = Field(..., description="وقت بدء الحادثة")
    last_detection_at: Optional[datetime] = Field(None, description="وقت آخر كشف")
    ended_at: Optional[datetime] = Field(None, description="وقت انتهاء الحادثة")
    
    # المراجعة
    reviewed_by: Optional[str] = Field(None, description="تمت المراجعة بواسطة")
    reviewed_at: Optional[datetime] = Field(None, description="تاريخ المراجعة")
    notes: Optional[str] = Field(None, description="ملاحظات")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "inc-001",
                "camera_id": "cam-001",
                "camera_name": "كاميرا المدخل الرئيسي",
                "location": "البوابة الرئيسية",
                "primary_weapon_type": "مسدس",
                "status": "نشطة",
                "severity": "حرج",
                "alert_count": 15,
                "detection_count": 45,
                "max_confidence": 0.95,
                "avg_confidence": 0.82,
                "best_snapshot": "/alerts/snapshot_001.jpg",
                "thumbnail": "/alerts/thumb_001.jpg",
                "started_at": "2024-01-15T10:30:00Z",
                "last_detection_at": "2024-01-15T10:35:00Z",
                "ended_at": None,
                "reviewed_by": None,
                "reviewed_at": None,
                "notes": None
            }
        }


class IncidentWithAlerts(IncidentResponse):
    """
    مخطط الحادثة مع التنبيهات
    =========================
    """
    alerts: List[AlertResponse] = Field(default_factory=list, description="قائمة التنبيهات")
    
    class Config:
        from_attributes = True


class IncidentStats(BaseModel):
    """
    مخطط إحصائيات الحوادث
    =====================
    """
    total_active: int = Field(..., description="إجمالي الحوادث النشطة")
    total_today: int = Field(..., description="إجمالي حوادث اليوم")
    total_reviewed: int = Field(..., description="الحوادث التي تمت مراجعتها")
    total_confirmed: int = Field(..., description="الحوادث المؤكدة")
    total_false_alarms: int = Field(..., description="الإنذارات الكاذبة")
    cameras_with_incidents: int = Field(..., description="عدد الكاميرات مع حوادث")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_active": 3,
                "total_today": 10,
                "total_reviewed": 5,
                "total_confirmed": 2,
                "total_false_alarms": 3,
                "cameras_with_incidents": 2
            }
        }


class IncidentListResponse(BaseModel):
    """
    مخطط قائمة الحوادث مع التصفح
    ============================
    """
    incidents: List[IncidentResponse] = Field(..., description="قائمة الحوادث")
    total: int = Field(..., description="إجمالي عدد الحوادث")
    page: int = Field(..., description="الصفحة الحالية")
    limit: int = Field(..., description="عدد العناصر في الصفحة")
    pages: int = Field(..., description="إجمالي عدد الصفحات")
    
    class Config:
        json_schema_extra = {
            "example": {
                "incidents": [],
                "total": 50,
                "page": 1,
                "limit": 20,
                "pages": 3
            }
        }


class CameraIncidentsSummary(BaseModel):
    """
    ملخص الحوادث لكل كاميرا
    =======================
    """
    camera_id: str = Field(..., description="معرف الكاميرا")
    camera_name: str = Field(..., description="اسم الكاميرا")
    location: Optional[str] = Field(None, description="موقع الكاميرا")
    active_incidents: int = Field(0, description="عدد الحوادث النشطة")
    total_incidents: int = Field(0, description="إجمالي الحوادث")
    total_alerts: int = Field(0, description="إجمالي التنبيهات")
    last_incident_at: Optional[datetime] = Field(None, description="وقت آخر حادثة")
    incidents: List[IncidentResponse] = Field(default_factory=list, description="قائمة الحوادث")
    
    class Config:
        from_attributes = True


class IncidentsByCamera(BaseModel):
    """
    الحوادث مجمعة حسب الكاميرا
    ==========================
    """
    cameras: List[CameraIncidentsSummary] = Field(..., description="ملخص لكل كاميرا")
    total_cameras: int = Field(..., description="عدد الكاميرات")
    total_active_incidents: int = Field(..., description="إجمالي الحوادث النشطة")
    total_alerts: int = Field(..., description="إجمالي التنبيهات")
    
    class Config:
        json_schema_extra = {
            "example": {
                "cameras": [],
                "total_cameras": 5,
                "total_active_incidents": 3,
                "total_alerts": 150
            }
        }

