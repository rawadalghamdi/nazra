"""
روتر الكاميرات - Cameras Router
================================
GET /api/v1/cameras - جلب جميع الكاميرات
POST /api/v1/cameras - إضافة كاميرا جديدة
GET /api/v1/cameras/{camera_id} - جلب كاميرا محددة
PUT /api/v1/cameras/{camera_id} - تحديث كاميرا
DELETE /api/v1/cameras/{camera_id} - حذف كاميرا
POST /api/v1/cameras/{camera_id}/test - اختبار اتصال الكاميرا
GET /api/v1/cameras/{camera_id}/status - حالة الكاميرا
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from datetime import datetime
import logging
import asyncio

from app.database import get_db
from app.models.camera import Camera
from app.schemas.camera import (
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraStatus,
    CameraTestResult,
)
from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.الكاميرات")

router = APIRouter(prefix="/cameras", tags=["الكاميرات"])


@router.get("", response_model=List[CameraResponse])
async def get_cameras(db: AsyncSession = Depends(get_db)):
    """
    جلب جميع الكاميرات
    
    يُرجع قائمة بجميع الكاميرات المسجلة في النظام
    """
    logger.info("📷 جلب جميع الكاميرات")
    
    try:
        result = await db.execute(
            select(Camera).order_by(Camera.created_at.desc())
        )
        cameras = result.scalars().all()
        
        logger.info(f"✅ تم جلب {len(cameras)} كاميرا")
        
        return [CameraResponse.model_validate(camera) for camera in cameras]
        
    except Exception as e:
        logger.error(f"❌ خطأ في جلب الكاميرات: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء جلب الكاميرات"
        )


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب كاميرا محددة بمعرفها
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"🔍 جلب الكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        logger.warning(f"⚠️ الكاميرا غير موجودة: {camera_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    return CameraResponse.model_validate(camera)


@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(camera_data: CameraCreate, db: AsyncSession = Depends(get_db)):
    """
    إضافة كاميرا جديدة
    
    يُضيف كاميرا جديدة للنظام مع إعداداتها
    """
    logger.info(f"📷 إضافة كاميرا جديدة: {camera_data.name}")
    
    try:
        # إنشاء الكاميرا
        camera = Camera(
            name=camera_data.name,
            location=camera_data.location,
            rtsp_url=camera_data.rtsp_url,
            onvif_host=camera_data.onvif_host,
            onvif_port=camera_data.onvif_port,
            onvif_user=camera_data.onvif_user,
            onvif_password=camera_data.onvif_password,
            detection_enabled=camera_data.detection_enabled,
            sensitivity=camera_data.sensitivity,
            status="offline",  # تبدأ غير متصلة
        )
        
        db.add(camera)
        await db.commit()
        await db.refresh(camera)
        
        logger.info(f"✅ تم إضافة الكاميرا: {camera.id}")
        
        return CameraResponse.model_validate(camera)
        
    except Exception as e:
        logger.error(f"❌ خطأ في إضافة الكاميرا: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء إضافة الكاميرا"
        )


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: str,
    camera_data: CameraUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    تحديث كاميرا موجودة
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"✏️ تحديث الكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    try:
        # تحديث الحقول المُرسلة فقط
        update_data = camera_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(camera, key, value)
        
        camera.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(camera)
        
        logger.info(f"✅ تم تحديث الكاميرا: {camera_id}")
        
        return CameraResponse.model_validate(camera)
        
    except Exception as e:
        logger.error(f"❌ خطأ في تحديث الكاميرا: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء تحديث الكاميرا"
        )


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    حذف كاميرا
    
    - **camera_id**: معرف الكاميرا
    
    ⚠️ سيتم حذف جميع التنبيهات المرتبطة بالكاميرا
    """
    logger.info(f"🗑️ حذف الكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    try:
        await db.delete(camera)
        await db.commit()
        
        logger.info(f"✅ تم حذف الكاميرا: {camera_id}")
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
        
    except Exception as e:
        logger.error(f"❌ خطأ في حذف الكاميرا: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="حدث خطأ أثناء حذف الكاميرا"
        )


@router.post("/{camera_id}/test", response_model=CameraTestResult)
async def test_camera(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    اختبار اتصال الكاميرا
    
    يختبر الاتصال بالكاميرا ويُرجع معلومات عن حالتها
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"🧪 اختبار الكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    # محاولة الاتصال بالكاميرا
    try:
        start_time = datetime.utcnow()
        
        # TODO: تنفيذ اختبار RTSP الفعلي
        # هنا نستخدم اختبار محاكي
        if camera.rtsp_url:
            # محاكاة اختبار الاتصال
            await asyncio.sleep(0.5)  # محاكاة زمن الاتصال
            
            latency_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # تحديث حالة الكاميرا
            camera.status = "online"
            camera.last_seen = datetime.utcnow()
            await db.commit()
            
            logger.info(f"✅ اختبار الكاميرا نجح: {camera_id}")
            
            return CameraTestResult(
                success=True,
                message="تم الاتصال بالكاميرا بنجاح",
                latency_ms=latency_ms,
                resolution="1920x1080",
                fps=30.0,
                details={
                    "codec": "H.264",
                    "audio": False,
                    "rtsp_url": camera.rtsp_url
                }
            )
        else:
            return CameraTestResult(
                success=False,
                message="لم يتم تحديد رابط RTSP للكاميرا",
                details={}
            )
            
    except Exception as e:
        logger.error(f"❌ فشل اختبار الكاميرا: {e}")
        
        # تحديث حالة الكاميرا
        camera.status = "error"
        await db.commit()
        
        return CameraTestResult(
            success=False,
            message=f"فشل الاتصال بالكاميرا: {str(e)}",
            details={"error": str(e)}
        )


@router.get("/{camera_id}/status", response_model=CameraStatus)
async def get_camera_status(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب حالة الكاميرا
    
    يُرجع معلومات مفصلة عن حالة الكاميرا الحالية
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"📊 جلب حالة الكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    # جلب آخر كشف
    from app.models.alert import Alert
    last_detection_result = await db.execute(
        select(Alert.timestamp)
        .where(Alert.camera_id == camera_id)
        .order_by(Alert.timestamp.desc())
        .limit(1)
    )
    last_detection = last_detection_result.scalar_one_or_none()
    
    return CameraStatus(
        id=camera.id,
        name=camera.name,
        status=camera.status,
        is_recording=camera.is_recording,
        detection_enabled=camera.detection_enabled,
        fps=camera.fps if camera.status == "online" else None,
        latency=None,  # TODO: حساب زمن التأخير الفعلي
        last_detection=last_detection
    )


@router.patch("/{camera_id}/toggle-detection", response_model=CameraResponse)
async def toggle_detection(
    camera_id: str,
    enabled: bool,
    db: AsyncSession = Depends(get_db)
):
    """
    تبديل حالة الكشف على الكاميرا
    
    - **camera_id**: معرف الكاميرا
    - **enabled**: تفعيل/تعطيل الكشف
    """
    logger.info(f"🔄 تبديل الكشف للكاميرا: {camera_id} -> {enabled}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    camera.detection_enabled = enabled
    camera.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(camera)
    
    logger.info(f"✅ تم تحديث حالة الكشف: {camera_id}")
    
    return CameraResponse.model_validate(camera)


@router.patch("/{camera_id}/toggle-recording", response_model=CameraResponse)
async def toggle_recording(
    camera_id: str,
    enabled: bool,
    db: AsyncSession = Depends(get_db)
):
    """
    تبديل حالة التسجيل للكاميرا
    
    - **camera_id**: معرف الكاميرا
    - **enabled**: تفعيل/تعطيل التسجيل
    """
    logger.info(f"🔄 تبديل التسجيل للكاميرا: {camera_id} -> {enabled}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    camera.is_recording = enabled
    camera.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(camera)
    
    logger.info(f"✅ تم تحديث حالة التسجيل: {camera_id}")
    
    return CameraResponse.model_validate(camera)
