"""
روتر لوحة التحكم
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from app.services.database import get_db
from app.models.database import Alert, Camera, CameraStatus, AlertSeverity, AlertStatus
from app.models.schemas import DashboardStats, AlertResponse
from typing import List

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """جلب إحصائيات لوحة التحكم"""
    
    # عدد الكاميرات
    total_cameras_result = await db.execute(select(func.count(Camera.id)))
    total_cameras = total_cameras_result.scalar() or 0
    
    # الكاميرات المتصلة
    online_cameras_result = await db.execute(
        select(func.count(Camera.id)).where(Camera.status == CameraStatus.ONLINE)
    )
    online_cameras = online_cameras_result.scalar() or 0
    
    # عدد التنبيهات الكلي
    total_alerts_result = await db.execute(select(func.count(Alert.id)))
    total_alerts = total_alerts_result.scalar() or 0
    
    # التنبيهات الحرجة الجديدة
    critical_alerts_result = await db.execute(
        select(func.count(Alert.id)).where(
            Alert.severity == AlertSeverity.CRITICAL,
            Alert.status == AlertStatus.NEW
        )
    )
    critical_alerts = critical_alerts_result.scalar() or 0
    
    # تنبيهات اليوم
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    alerts_today_result = await db.execute(
        select(func.count(Alert.id)).where(Alert.timestamp >= today_start)
    )
    alerts_today = alerts_today_result.scalar() or 0
    
    return DashboardStats(
        total_cameras=total_cameras,
        online_cameras=online_cameras,
        total_alerts=total_alerts,
        critical_alerts=critical_alerts,
        alerts_today=alerts_today,
        average_response_time=1.8,  # سيتم حسابه لاحقاً
        detection_accuracy=0.967  # سيتم حسابه لاحقاً
    )

@router.get("/recent-alerts")
async def get_recent_alerts(
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """جلب آخر التنبيهات"""
    result = await db.execute(
        select(Alert)
        .join(Camera)
        .order_by(Alert.timestamp.desc())
        .limit(limit)
    )
    alerts = result.scalars().all()
    
    # إضافة اسم الكاميرا
    response = []
    for alert in alerts:
        alert_dict = {
            "id": alert.id,
            "camera_id": alert.camera_id,
            "camera_name": alert.camera.name if alert.camera else "غير معروف",
            "timestamp": alert.timestamp.isoformat(),
            "detection_type": alert.detection_type.value,
            "severity": alert.severity.value,
            "status": alert.status.value,
            "confidence": alert.confidence
        }
        response.append(alert_dict)
    
    return response
