"""
روتر الحوادث - Incidents Router
================================
GET /api/v1/incidents - جلب الحوادث مع التصفية
GET /api/v1/incidents/by-camera - جلب الحوادث مجمعة حسب الكاميرا
GET /api/v1/incidents/{incident_id} - جلب حادثة محددة مع التنبيهات
PUT /api/v1/incidents/{incident_id}/review - مراجعة حادثة
PUT /api/v1/incidents/{incident_id}/close - إغلاق حادثة
GET /api/v1/incidents/stats - إحصائيات الحوادث
DELETE /api/v1/incidents/{incident_id} - حذف حادثة
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, distinct
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from app.database import get_db
from app.models.incident import Incident, IncidentStatus
from app.models.alert import Alert, AlertStatus
from app.schemas.incident import (
    IncidentCreate,
    IncidentUpdate,
    IncidentReview,
    IncidentResponse,
    IncidentWithAlerts,
    IncidentStats,
    IncidentListResponse,
    CameraIncidentsSummary,
    IncidentsByCamera,
)
from app.schemas.alert import AlertResponse

# إعداد السجل
logger = logging.getLogger("نظرة.الحوادث")

router = APIRouter(prefix="/incidents", tags=["الحوادث"])

# =====================================
# إعدادات الحوادث
# =====================================
INCIDENT_TIMEOUT_MINUTES = 5  # الوقت بعد آخر كشف لإغلاق الحادثة تلقائياً


@router.get("", response_model=IncidentListResponse)
async def get_incidents(
    status: Optional[str] = Query(None, description="حالة الحادثة"),
    camera_id: Optional[str] = Query(None, description="معرف الكاميرا"),
    weapon_type: Optional[str] = Query(None, description="نوع السلاح"),
    date_from: Optional[str] = Query(None, description="من تاريخ (ISO format)"),
    date_to: Optional[str] = Query(None, description="إلى تاريخ (ISO format)"),
    page: int = Query(1, ge=1, description="رقم الصفحة"),
    limit: int = Query(20, ge=1, le=100, description="عدد العناصر في الصفحة"),
    db: AsyncSession = Depends(get_db)
):
    """
    جلب جميع الحوادث مع التصفية والترتيب والتقسيم إلى صفحات
    """
    logger.info(f"📋 جلب الحوادث - الصفحة {page}")
    
    try:
        # إغلاق الحوادث القديمة تلقائياً
        await _auto_close_stale_incidents(db)
        
        # بناء الاستعلام
        query = select(Incident)
        filters = []
        
        # تطبيق الفلاتر
        if status:
            filters.append(Incident.status == status)
        if camera_id:
            filters.append(Incident.camera_id == camera_id)
        if weapon_type:
            filters.append(Incident.primary_weapon_type == weapon_type)
        if date_from:
            try:
                from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                filters.append(Incident.started_at >= from_date)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="صيغة التاريخ غير صحيحة (date_from)"
                )
        if date_to:
            try:
                to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                filters.append(Incident.started_at <= to_date)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="صيغة التاريخ غير صحيحة (date_to)"
                )
        
        if filters:
            query = query.where(and_(*filters))
        
        # ترتيب حسب الوقت (الأحدث أولاً)، الحوادث النشطة أولاً
        query = query.order_by(
            (Incident.status == IncidentStatus.ACTIVE.value).desc(),
            Incident.started_at.desc()
        )
        
        # حساب العدد الكلي
        count_query = select(func.count(Incident.id))
        if filters:
            count_query = count_query.where(and_(*filters))
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # حساب عدد الصفحات
        pages = (total + limit - 1) // limit if total > 0 else 1
        
        # تطبيق التقسيم إلى صفحات
        query = query.offset((page - 1) * limit).limit(limit)
        
        # تنفيذ الاستعلام
        result = await db.execute(query)
        incidents = result.scalars().all()
        
        logger.info(f"✅ تم جلب {len(incidents)} حادثة من أصل {total}")
        
        return IncidentListResponse(
            incidents=[IncidentResponse.model_validate(inc) for inc in incidents],
            total=total,
            page=page,
            limit=limit,
            pages=pages
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ في جلب الحوادث: {e}")
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ أثناء جلب الحوادث"
        )


@router.get("/by-camera", response_model=IncidentsByCamera)
async def get_incidents_by_camera(
    active_only: bool = Query(False, description="عرض الحوادث النشطة فقط"),
    db: AsyncSession = Depends(get_db)
):
    """
    جلب الحوادث مجمعة حسب الكاميرا
    
    هذا هو العرض الرئيسي المحسّن - يعرض الحوادث مجمعة بالكاميرا
    """
    logger.info("📹 جلب الحوادث حسب الكاميرا")
    
    try:
        # إغلاق الحوادث القديمة
        await _auto_close_stale_incidents(db)
        
        # جلب جميع الحوادث مع التجميع
        query = select(Incident).order_by(Incident.started_at.desc())
        
        if active_only:
            query = query.where(Incident.status == IncidentStatus.ACTIVE.value)
        
        result = await db.execute(query)
        all_incidents = result.scalars().all()
        
        # تجميع حسب الكاميرا
        cameras_map = {}
        total_alerts = 0
        total_active = 0
        
        for incident in all_incidents:
            camera_id = incident.camera_id
            
            if camera_id not in cameras_map:
                cameras_map[camera_id] = {
                    "camera_id": camera_id,
                    "camera_name": incident.camera_name,
                    "location": incident.location,
                    "active_incidents": 0,
                    "total_incidents": 0,
                    "total_alerts": 0,
                    "last_incident_at": None,
                    "incidents": []
                }
            
            cam = cameras_map[camera_id]
            cam["total_incidents"] += 1
            cam["total_alerts"] += incident.alert_count
            total_alerts += incident.alert_count
            
            if incident.status == IncidentStatus.ACTIVE.value:
                cam["active_incidents"] += 1
                total_active += 1
            
            if cam["last_incident_at"] is None or incident.started_at > cam["last_incident_at"]:
                cam["last_incident_at"] = incident.started_at
            
            cam["incidents"].append(IncidentResponse.model_validate(incident))
        
        # ترتيب الكاميرات: الأكثر حوادث نشطة أولاً
        sorted_cameras = sorted(
            cameras_map.values(),
            key=lambda x: (x["active_incidents"], x["total_incidents"]),
            reverse=True
        )
        
        logger.info(f"✅ تم جلب {len(sorted_cameras)} كاميرا مع حوادث")
        
        return IncidentsByCamera(
            cameras=[CameraIncidentsSummary(**cam) for cam in sorted_cameras],
            total_cameras=len(sorted_cameras),
            total_active_incidents=total_active,
            total_alerts=total_alerts
        )
        
    except Exception as e:
        logger.error(f"❌ خطأ في جلب الحوادث حسب الكاميرا: {e}")
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ أثناء جلب الحوادث"
        )


@router.get("/stats", response_model=IncidentStats)
async def get_incidents_stats(db: AsyncSession = Depends(get_db)):
    """
    جلب إحصائيات الحوادث
    """
    logger.info("📊 جلب إحصائيات الحوادث")
    
    try:
        # بداية اليوم
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # إجمالي الحوادث النشطة
        active_query = select(func.count(Incident.id)).where(
            Incident.status == IncidentStatus.ACTIVE.value
        )
        active_result = await db.execute(active_query)
        total_active = active_result.scalar() or 0
        
        # إجمالي حوادث اليوم
        today_query = select(func.count(Incident.id)).where(
            Incident.started_at >= today_start
        )
        today_result = await db.execute(today_query)
        total_today = today_result.scalar() or 0
        
        # الحوادث التي تمت مراجعتها
        reviewed_query = select(func.count(Incident.id)).where(
            Incident.status == IncidentStatus.REVIEWED.value
        )
        reviewed_result = await db.execute(reviewed_query)
        total_reviewed = reviewed_result.scalar() or 0
        
        # الحوادث المؤكدة
        confirmed_query = select(func.count(Incident.id)).where(
            Incident.status == IncidentStatus.CONFIRMED.value
        )
        confirmed_result = await db.execute(confirmed_query)
        total_confirmed = confirmed_result.scalar() or 0
        
        # الإنذارات الكاذبة
        false_alarm_query = select(func.count(Incident.id)).where(
            Incident.status == IncidentStatus.FALSE_ALARM.value
        )
        false_alarm_result = await db.execute(false_alarm_query)
        total_false_alarms = false_alarm_result.scalar() or 0
        
        # عدد الكاميرات مع حوادث نشطة
        cameras_query = select(func.count(distinct(Incident.camera_id))).where(
            Incident.status == IncidentStatus.ACTIVE.value
        )
        cameras_result = await db.execute(cameras_query)
        cameras_with_incidents = cameras_result.scalar() or 0
        
        logger.info(f"✅ الإحصائيات: نشطة={total_active}, اليوم={total_today}")
        
        return IncidentStats(
            total_active=total_active,
            total_today=total_today,
            total_reviewed=total_reviewed,
            total_confirmed=total_confirmed,
            total_false_alarms=total_false_alarms,
            cameras_with_incidents=cameras_with_incidents
        )
        
    except Exception as e:
        logger.error(f"❌ خطأ في جلب الإحصائيات: {e}")
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ أثناء جلب الإحصائيات"
        )


@router.get("/{incident_id}", response_model=IncidentWithAlerts)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب حادثة محددة مع جميع التنبيهات المرتبطة
    """
    logger.info(f"🔍 جلب الحادثة: {incident_id}")
    
    # جلب الحادثة مع التنبيهات
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.alerts))
        .where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    
    if not incident:
        logger.warning(f"⚠️ الحادثة غير موجودة: {incident_id}")
        raise HTTPException(
            status_code=404,
            detail="الحادثة غير موجودة"
        )
    
    # ترتيب التنبيهات حسب الوقت
    alerts_sorted = sorted(incident.alerts, key=lambda a: a.timestamp, reverse=True)
    
    return IncidentWithAlerts(
        **IncidentResponse.model_validate(incident).model_dump(),
        alerts=[AlertResponse.model_validate(a) for a in alerts_sorted]
    )


@router.put("/{incident_id}/review", response_model=IncidentResponse)
async def review_incident(
    incident_id: str,
    review_data: IncidentReview,
    db: AsyncSession = Depends(get_db)
):
    """
    مراجعة حادثة وتحديث حالتها
    """
    logger.info(f"📝 مراجعة الحادثة: {incident_id}")
    
    # جلب الحادثة
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(
            status_code=404,
            detail="الحادثة غير موجودة"
        )
    
    try:
        # تحديث الحادثة
        incident.status = review_data.status
        incident.reviewed_by = review_data.reviewed_by
        incident.reviewed_at = datetime.utcnow()
        
        if review_data.notes:
            incident.notes = review_data.notes
        
        # إغلاق الحادثة إذا تمت مراجعتها
        if incident.ended_at is None:
            incident.ended_at = datetime.utcnow()
        
        # تحديث حالة جميع التنبيهات المرتبطة
        alert_status_map = {
            IncidentStatus.CONFIRMED.value: AlertStatus.CONFIRMED.value,
            IncidentStatus.FALSE_ALARM.value: AlertStatus.FALSE_ALARM.value,
            IncidentStatus.REVIEWED.value: AlertStatus.UNDER_REVIEW.value,
        }
        new_alert_status = alert_status_map.get(review_data.status)
        
        if new_alert_status:
            await db.execute(
                Alert.__table__.update()
                .where(Alert.incident_id == incident_id)
                .values(
                    status=new_alert_status,
                    reviewed_by=review_data.reviewed_by,
                    reviewed_at=datetime.utcnow()
                )
            )
        
        await db.commit()
        await db.refresh(incident)
        
        logger.info(f"✅ تم مراجعة الحادثة: {incident_id} -> {review_data.status}")
        
        return IncidentResponse.model_validate(incident)
        
    except Exception as e:
        logger.error(f"❌ خطأ في مراجعة الحادثة: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ أثناء مراجعة الحادثة"
        )


@router.put("/{incident_id}/close", response_model=IncidentResponse)
async def close_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """
    إغلاق حادثة يدوياً
    """
    logger.info(f"🔒 إغلاق الحادثة: {incident_id}")
    
    # جلب الحادثة
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(
            status_code=404,
            detail="الحادثة غير موجودة"
        )
    
    try:
        incident.status = IncidentStatus.CLOSED.value
        incident.ended_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(incident)
        
        logger.info(f"✅ تم إغلاق الحادثة: {incident_id}")
        
        return IncidentResponse.model_validate(incident)
        
    except Exception as e:
        logger.error(f"❌ خطأ في إغلاق الحادثة: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ أثناء إغلاق الحادثة"
        )


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """
    حذف حادثة وجميع التنبيهات المرتبطة
    """
    logger.info(f"🗑️ حذف الحادثة: {incident_id}")
    
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id)
    )
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(
            status_code=404,
            detail="الحادثة غير موجودة"
        )
    
    try:
        await db.delete(incident)
        await db.commit()
        logger.info(f"✅ تم حذف الحادثة: {incident_id}")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
        
    except Exception as e:
        logger.error(f"❌ خطأ في حذف الحادثة: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="حدث خطأ أثناء حذف الحادثة"
        )


# =====================================
# دوال مساعدة
# =====================================

async def _auto_close_stale_incidents(db: AsyncSession):
    """
    إغلاق الحوادث التي لم يتم الكشف فيها لفترة طويلة
    """
    try:
        timeout_threshold = datetime.utcnow() - timedelta(minutes=INCIDENT_TIMEOUT_MINUTES)
        
        # جلب الحوادث النشطة القديمة
        result = await db.execute(
            select(Incident).where(
                and_(
                    Incident.status == IncidentStatus.ACTIVE.value,
                    Incident.last_detection_at < timeout_threshold
                )
            )
        )
        stale_incidents = result.scalars().all()
        
        for incident in stale_incidents:
            incident.status = IncidentStatus.CLOSED.value
            incident.ended_at = datetime.utcnow()
            logger.info(f"⏰ إغلاق تلقائي للحادثة: {incident.id}")
        
        if stale_incidents:
            await db.commit()
            
    except Exception as e:
        logger.warning(f"خطأ في إغلاق الحوادث القديمة: {e}")


async def get_or_create_incident(
    db: AsyncSession,
    camera_id: str,
    camera_name: str,
    location: str,
    weapon_type: str,
    severity: str
) -> Incident:
    """
    جلب حادثة نشطة موجودة أو إنشاء واحدة جديدة
    
    الحادثة الجديدة تُنشأ إذا:
    - لا توجد حادثة نشطة لنفس الكاميرا ونوع السلاح
    - أو مر أكثر من INCIDENT_TIMEOUT_MINUTES منذ آخر كشف
    """
    # البحث عن حادثة نشطة موجودة
    timeout_threshold = datetime.utcnow() - timedelta(minutes=INCIDENT_TIMEOUT_MINUTES)
    
    result = await db.execute(
        select(Incident).where(
            and_(
                Incident.camera_id == camera_id,
                Incident.primary_weapon_type == weapon_type,
                Incident.status == IncidentStatus.ACTIVE.value,
                Incident.last_detection_at >= timeout_threshold
            )
        )
    )
    existing_incident = result.scalar_one_or_none()
    
    if existing_incident:
        logger.debug(f"🔄 استخدام حادثة موجودة: {existing_incident.id}")
        return existing_incident
    
    # إنشاء حادثة جديدة
    new_incident = Incident(
        camera_id=camera_id,
        camera_name=camera_name,
        location=location,
        primary_weapon_type=weapon_type,
        severity=severity,
        status=IncidentStatus.ACTIVE.value,
    )
    db.add(new_incident)
    await db.flush()  # للحصول على ID
    
    logger.info(f"🆕 إنشاء حادثة جديدة: {new_incident.id} للكاميرا {camera_name}")
    
    return new_incident

