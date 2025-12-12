"""
روتر التنبيهات - Alerts Router
==============================
GET /api/v1/alerts - جلب التنبيهات مع التصفية
GET /api/v1/alerts/{alert_id} - جلب تنبيه محدد
PUT /api/v1/alerts/{alert_id}/review - مراجعة تنبيه
GET /api/v1/alerts/stats - إحصائيات التنبيهات
GET /api/v1/alerts/{alert_id}/image - جلب صورة التنبيه
GET /api/v1/alerts/{alert_id}/video - جلب فيديو التنبيه
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from starlette import status as http_status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional, List
from datetime import datetime, timedelta
import logging
import os

from app.database import get_db
from app.models.alert import Alert, AlertStatus, WeaponType
from app.schemas.alert import (
    AlertCreate,
    AlertUpdate,
    AlertReview,
    AlertResponse,
    AlertStats,
    AlertListResponse,
)
from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.التنبيهات")

router = APIRouter(prefix="/alerts", tags=["التنبيهات"])


@router.get("", response_model=AlertListResponse)
async def get_alerts(
    status: Optional[str] = Query(None, description="حالة التنبيه"),
    camera_id: Optional[str] = Query(None, description="معرف الكاميرا"),
    weapon_type: Optional[str] = Query(None, description="نوع السلاح"),
    date_from: Optional[str] = Query(None, description="من تاريخ (ISO format)"),
    date_to: Optional[str] = Query(None, description="إلى تاريخ (ISO format)"),
    page: int = Query(1, ge=1, description="رقم الصفحة"),
    limit: int = Query(20, ge=1, le=100, description="عدد العناصر في الصفحة"),
    db: AsyncSession = Depends(get_db)
):
    """
    جلب جميع التنبيهات مع التصفية والترتيب والتقسيم إلى صفحات
    
    - **status**: تصفية حسب الحالة (جديد، قيد المراجعة، مؤكد، إنذار كاذب)
    - **camera_id**: تصفية حسب الكاميرا
    - **weapon_type**: تصفية حسب نوع السلاح
    - **date_from**: تصفية من تاريخ معين
    - **date_to**: تصفية إلى تاريخ معين
    - **page**: رقم الصفحة
    - **limit**: عدد العناصر في الصفحة
    """
    logger.info(f"📋 جلب التنبيهات - الصفحة {page}")
    
    try:
        # بناء الاستعلام
        query = select(Alert)
        filters = []
        
        # تطبيق الفلاتر
        if status:
            filters.append(Alert.status == status)
        if camera_id:
            filters.append(Alert.camera_id == camera_id)
        if weapon_type:
            filters.append(Alert.weapon_type == weapon_type)
        if date_from:
            try:
                from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                filters.append(Alert.timestamp >= from_date)
            except ValueError:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="صيغة التاريخ غير صحيحة (date_from)"
                )
        if date_to:
            try:
                to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                filters.append(Alert.timestamp <= to_date)
            except ValueError:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail="صيغة التاريخ غير صحيحة (date_to)"
                )
        
        if filters:
            query = query.where(and_(*filters))
        
        # ترتيب حسب الوقت (الأحدث أولاً)
        query = query.order_by(Alert.timestamp.desc())
        
        # حساب العدد الكلي
        count_query = select(func.count(Alert.id))
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
        alerts = result.scalars().all()
        
        logger.info(f"✅ تم جلب {len(alerts)} تنبيه من أصل {total}")
        
        return AlertListResponse(
            alerts=[AlertResponse.model_validate(alert) for alert in alerts],
            total=total,
            page=page,
            limit=limit,
            pages=pages
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ في جلب التنبيهات: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء جلب التنبيهات"
        )


@router.get("/stats", response_model=AlertStats)
async def get_alerts_stats(db: AsyncSession = Depends(get_db)):
    """
    جلب إحصائيات التنبيهات
    
    يُرجع:
    - إجمالي تنبيهات اليوم
    - التنبيهات المعلقة (الجديدة)
    - التنبيهات المؤكدة
    - الإنذارات الكاذبة
    - التنبيهات قيد المراجعة
    """
    logger.info("📊 جلب إحصائيات التنبيهات")
    
    try:
        # بداية اليوم
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # إجمالي تنبيهات اليوم
        total_today_query = select(func.count(Alert.id)).where(
            Alert.timestamp >= today_start
        )
        total_today_result = await db.execute(total_today_query)
        total_today = total_today_result.scalar() or 0
        
        # التنبيهات المعلقة (الجديدة)
        pending_query = select(func.count(Alert.id)).where(
            Alert.status == AlertStatus.NEW.value
        )
        pending_result = await db.execute(pending_query)
        pending = pending_result.scalar() or 0
        
        # التنبيهات المؤكدة
        confirmed_query = select(func.count(Alert.id)).where(
            Alert.status == AlertStatus.CONFIRMED.value
        )
        confirmed_result = await db.execute(confirmed_query)
        confirmed = confirmed_result.scalar() or 0
        
        # الإنذارات الكاذبة
        false_alarms_query = select(func.count(Alert.id)).where(
            Alert.status == AlertStatus.FALSE_ALARM.value
        )
        false_alarms_result = await db.execute(false_alarms_query)
        false_alarms = false_alarms_result.scalar() or 0
        
        # قيد المراجعة
        under_review_query = select(func.count(Alert.id)).where(
            Alert.status == AlertStatus.UNDER_REVIEW.value
        )
        under_review_result = await db.execute(under_review_query)
        under_review = under_review_result.scalar() or 0
        
        logger.info(f"✅ الإحصائيات: اليوم={total_today}, معلق={pending}, مؤكد={confirmed}")
        
        return AlertStats(
            total_today=total_today,
            pending=pending,
            confirmed=confirmed,
            false_alarms=false_alarms,
            under_review=under_review
        )
        
    except Exception as e:
        logger.error(f"❌ خطأ في جلب الإحصائيات: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء جلب الإحصائيات"
        )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب تنبيه محدد بمعرفه
    
    - **alert_id**: معرف التنبيه
    """
    logger.info(f"🔍 جلب التنبيه: {alert_id}")
    
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        logger.warning(f"⚠️ التنبيه غير موجود: {alert_id}")
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    return AlertResponse.model_validate(alert)


@router.post("", response_model=AlertResponse, status_code=http_status.HTTP_201_CREATED)
async def create_alert(alert_data: AlertCreate, db: AsyncSession = Depends(get_db)):
    """
    إنشاء تنبيه جديد
    
    يُستخدم داخلياً من خدمة الكشف
    """
    logger.info(f"🆕 إنشاء تنبيه جديد - الكاميرا: {alert_data.camera_id}")
    
    try:
        # إنشاء التنبيه
        alert = Alert(
            camera_id=alert_data.camera_id,
            camera_name=alert_data.camera_name,
            location=alert_data.location,
            weapon_type=alert_data.weapon_type,
            confidence=alert_data.confidence,
            image_snapshot=alert_data.image_snapshot,
            video_clip=alert_data.video_clip if hasattr(alert_data, 'video_clip') else None,
            bounding_box=alert_data.bounding_box.model_dump() if alert_data.bounding_box else None,
            status=AlertStatus.NEW.value,
            severity=Alert.get_severity_from_weapon(alert_data.weapon_type),
        )
        
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        
        logger.info(f"✅ تم إنشاء التنبيه: {alert.id}")
        
        return AlertResponse.model_validate(alert)
        
    except Exception as e:
        logger.error(f"❌ خطأ في إنشاء التنبيه: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء إنشاء التنبيه"
        )


@router.put("/{alert_id}/review", response_model=AlertResponse)
async def review_alert(
    alert_id: str,
    review_data: AlertReview,
    db: AsyncSession = Depends(get_db)
):
    """
    مراجعة تنبيه وتحديث حالته
    
    - **alert_id**: معرف التنبيه
    - **status**: الحالة الجديدة (قيد المراجعة، مؤكد، إنذار كاذب)
    - **notes**: ملاحظات المراجعة
    - **reviewed_by**: اسم المراجع
    """
    logger.info(f"📝 مراجعة التنبيه: {alert_id}")
    
    # جلب التنبيه
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        logger.warning(f"⚠️ التنبيه غير موجود: {alert_id}")
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    try:
        # تحديث التنبيه
        alert.status = review_data.status
        alert.reviewed_by = review_data.reviewed_by
        alert.reviewed_at = datetime.utcnow()
        
        if review_data.notes:
            alert.notes = review_data.notes
        
        await db.commit()
        await db.refresh(alert)
        
        logger.info(f"✅ تم مراجعة التنبيه: {alert_id} -> {review_data.status}")
        
        return AlertResponse.model_validate(alert)
        
    except Exception as e:
        logger.error(f"❌ خطأ في مراجعة التنبيه: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء مراجعة التنبيه"
        )


@router.patch("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    تأكيد التنبيه كتهديد حقيقي
    
    - **alert_id**: معرف التنبيه
    - **notes**: ملاحظات اختيارية
    """
    logger.info(f"✅ تأكيد التنبيه: {alert_id}")
    
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    try:
        alert.status = AlertStatus.CONFIRMED.value
        alert.reviewed_at = datetime.utcnow()
        alert.reviewed_by = "مشرف النظام"
        if notes:
            alert.notes = notes
        
        await db.commit()
        await db.refresh(alert)
        
        logger.info(f"✅ تم تأكيد التنبيه: {alert_id}")
        return AlertResponse.model_validate(alert)
        
    except Exception as e:
        logger.error(f"❌ خطأ في تأكيد التنبيه: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء تأكيد التنبيه"
        )


@router.patch("/{alert_id}/false-positive", response_model=AlertResponse)
async def mark_false_positive(
    alert_id: str,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    تصنيف التنبيه كإنذار كاذب
    
    - **alert_id**: معرف التنبيه
    - **notes**: ملاحظات اختيارية
    """
    logger.info(f"❌ تصنيف التنبيه كإنذار كاذب: {alert_id}")
    
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    try:
        alert.status = AlertStatus.FALSE_ALARM.value
        alert.reviewed_at = datetime.utcnow()
        alert.reviewed_by = "مشرف النظام"
        if notes:
            alert.notes = notes
        
        await db.commit()
        await db.refresh(alert)
        
        logger.info(f"✅ تم تصنيف التنبيه كإنذار كاذب: {alert_id}")
        return AlertResponse.model_validate(alert)
        
    except Exception as e:
        logger.error(f"❌ خطأ في تصنيف التنبيه: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء تصنيف التنبيه"
        )


@router.delete("/{alert_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    """
    حذف تنبيه
    
    - **alert_id**: معرف التنبيه
    """
    logger.info(f"🗑️ حذف التنبيه: {alert_id}")
    
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    try:
        await db.delete(alert)
        await db.commit()
        logger.info(f"✅ تم حذف التنبيه: {alert_id}")
        return Response(status_code=http_status.HTTP_204_NO_CONTENT)
        
    except Exception as e:
        logger.error(f"❌ خطأ في حذف التنبيه: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء حذف التنبيه"
        )


@router.get("/{alert_id}/image")
async def get_alert_image(alert_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب صورة التنبيه
    
    - **alert_id**: معرف التنبيه
    """
    logger.info(f"🖼️ جلب صورة التنبيه: {alert_id}")
    
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    if not alert.image_snapshot:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="لا توجد صورة لهذا التنبيه"
        )
    
    # التحقق من وجود الملف
    image_path = os.path.join(settings.ALERTS_DIR, alert.image_snapshot.lstrip('/'))
    
    if not os.path.exists(image_path):
        # إرجاع صورة افتراضية أو خطأ
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="ملف الصورة غير موجود"
        )
    
    return FileResponse(
        path=image_path,
        media_type="image/jpeg",
        filename=f"alert_{alert_id}.jpg"
    )


@router.get("/{alert_id}/video")
async def get_alert_video(alert_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب مقطع فيديو التنبيه
    
    - **alert_id**: معرف التنبيه
    """
    logger.info(f"🎬 جلب فيديو التنبيه: {alert_id}")
    
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    if not alert.video_clip:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="لا يوجد فيديو لهذا التنبيه"
        )
    
    # التحقق من وجود الملف
    video_path = os.path.join(settings.VIDEO_CLIPS_DIR, alert.video_clip.lstrip('/'))
    
    if not os.path.exists(video_path):
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="ملف الفيديو غير موجود"
        )
    
    return FileResponse(
        path=video_path,
        media_type="video/mp4",
        filename=f"alert_{alert_id}.mp4"
    )

    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="التنبيه غير موجود"
        )
    
    alert.status = AlertStatus.FALSE_POSITIVE
    if notes:
        alert.notes = notes
    
    await db.commit()
    await db.refresh(alert)
    return alert
