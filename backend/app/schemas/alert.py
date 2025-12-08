"""
مخططات التنبيهات - Pydantic Schemas
===================================
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


class BoundingBox(BaseModel):
    """إحداثيات مربع الكشف"""
    x: float = Field(..., description="إحداثية X")
    y: float = Field(..., description="إحداثية Y")
    width: float = Field(..., description="العرض")
    height: float = Field(..., description="الارتفاع")


class AlertBase(BaseModel):
    """
    مخطط التنبيه الأساسي
    ====================
    """
    camera_id: str = Field(..., description="معرف الكاميرا")
    camera_name: str = Field(..., description="اسم الكاميرا")
    location: str = Field(..., description="موقع الكشف")
    weapon_type: Literal['مسدس', 'سكين', 'بندقية', 'أخرى'] = Field(..., description="نوع السلاح")
    confidence: float = Field(..., ge=0, le=1, description="نسبة الثقة (0-1)")
    image_snapshot: Optional[str] = Field(None, description="مسار صورة اللقطة")
    bounding_box: Optional[BoundingBox] = Field(None, description="إحداثيات مربع الكشف")


class AlertCreate(AlertBase):
    """
    مخطط إنشاء تنبيه جديد
    =====================
    """
    video_clip: Optional[str] = Field(None, description="مسار مقطع الفيديو")
    
    class Config:
        json_schema_extra = {
            "example": {
                "camera_id": "cam-001",
                "camera_name": "كاميرا المدخل الرئيسي",
                "location": "البوابة الرئيسية",
                "weapon_type": "مسدس",
                "confidence": 0.92,
                "image_snapshot": "/alerts/snapshot_001.jpg",
                "bounding_box": {"x": 120, "y": 80, "width": 50, "height": 30}
            }
        }


class AlertUpdate(BaseModel):
    """
    مخطط تحديث التنبيه
    ==================
    """
    status: Optional[Literal['جديد', 'قيد المراجعة', 'مؤكد', 'إنذار كاذب']] = Field(None, description="حالة التنبيه")
    notes: Optional[str] = Field(None, description="ملاحظات")


class AlertReview(BaseModel):
    """
    مخطط مراجعة التنبيه
    ===================
    """
    status: Literal['قيد المراجعة', 'مؤكد', 'إنذار كاذب'] = Field(..., description="حالة التنبيه الجديدة")
    notes: Optional[str] = Field(None, description="ملاحظات المراجعة")
    reviewed_by: str = Field(..., description="اسم المراجع")
    
    class Config:
        json_schema_extra = {
            "example": {
                "status": "مؤكد",
                "notes": "تم التأكد من وجود سلاح",
                "reviewed_by": "أحمد محمد"
            }
        }


class AlertResponse(AlertBase):
    """
    مخطط استجابة التنبيه
    ====================
    """
    id: str = Field(..., description="معرف التنبيه")
    status: Literal['جديد', 'قيد المراجعة', 'مؤكد', 'إنذار كاذب'] = Field(..., description="حالة التنبيه")
    severity: Optional[str] = Field(None, description="مستوى الخطورة")
    timestamp: datetime = Field(..., description="وقت الكشف")
    reviewed_by: Optional[str] = Field(None, description="تمت المراجعة بواسطة")
    reviewed_at: Optional[datetime] = Field(None, description="تاريخ المراجعة")
    notes: Optional[str] = Field(None, description="ملاحظات")
    video_clip: Optional[str] = Field(None, description="مسار مقطع الفيديو")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "alert-001",
                "camera_id": "cam-001",
                "camera_name": "كاميرا المدخل الرئيسي",
                "location": "البوابة الرئيسية",
                "weapon_type": "مسدس",
                "confidence": 0.92,
                "image_snapshot": "/alerts/snapshot_001.jpg",
                "bounding_box": {"x": 120, "y": 80, "width": 50, "height": 30},
                "status": "جديد",
                "severity": "حرج",
                "timestamp": "2024-01-15T10:30:00Z",
                "reviewed_by": None,
                "reviewed_at": None,
                "notes": None,
                "video_clip": None
            }
        }


class AlertStats(BaseModel):
    """
    مخطط إحصائيات التنبيهات
    =======================
    """
    total_today: int = Field(..., description="إجمالي تنبيهات اليوم")
    pending: int = Field(..., description="التنبيهات المعلقة")
    confirmed: int = Field(..., description="التنبيهات المؤكدة")
    false_alarms: int = Field(..., description="الإنذارات الكاذبة")
    under_review: int = Field(0, description="قيد المراجعة")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_today": 15,
                "pending": 3,
                "confirmed": 8,
                "false_alarms": 4,
                "under_review": 0
            }
        }


class AlertListResponse(BaseModel):
    """
    مخطط قائمة التنبيهات مع التصفح
    ==============================
    """
    alerts: List[AlertResponse] = Field(..., description="قائمة التنبيهات")
    total: int = Field(..., description="إجمالي عدد التنبيهات")
    page: int = Field(..., description="الصفحة الحالية")
    limit: int = Field(..., description="عدد العناصر في الصفحة")
    pages: int = Field(..., description="إجمالي عدد الصفحات")
    
    class Config:
        json_schema_extra = {
            "example": {
                "alerts": [],
                "total": 100,
                "page": 1,
                "limit": 20,
                "pages": 5
            }
        }
