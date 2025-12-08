"""
روتر البث - Stream Router
==========================
GET /api/v1/stream/{camera_id} - بث الفيديو المعالج
GET /api/v1/stream/{camera_id}/snapshot - لقطة حالية
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncGenerator
from datetime import datetime
import logging
import asyncio
import io

from app.database import get_db
from app.models.camera import Camera
from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.البث")

router = APIRouter(prefix="/stream", tags=["البث"])

# محاكاة مولد الفيديو (يجب استبداله بالتنفيذ الفعلي)
async def generate_video_frames(camera_id: str) -> AsyncGenerator[bytes, None]:
    """
    مولد إطارات الفيديو
    
    يُرجع إطارات MJPEG للبث
    """
    # TODO: تنفيذ البث الفعلي من RTSP
    # هذا محاكاة للتوضيح
    
    # صورة بيضاء بسيطة للمحاكاة (1x1 pixel JPEG)
    placeholder_frame = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFF,
        0xD9
    ])
    
    frame_count = 0
    max_frames = 1000  # حد أقصى للإطارات
    
    while frame_count < max_frames:
        try:
            # إرسال إطار
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + 
                placeholder_frame + 
                b'\r\n'
            )
            
            frame_count += 1
            
            # التحكم في معدل الإطارات
            await asyncio.sleep(1.0 / settings.STREAM_FPS)
            
        except asyncio.CancelledError:
            logger.info(f"🛑 تم إيقاف البث للكاميرا: {camera_id}")
            break
        except Exception as e:
            logger.error(f"❌ خطأ في البث: {e}")
            break


@router.get("/{camera_id}")
async def stream_video(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    بث الفيديو المعالج من الكاميرا
    
    يُرسل بث MJPEG للفيديو مع مربعات الكشف
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"🎥 بدء البث للكاميرا: {camera_id}")
    
    # التحقق من وجود الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if camera.status != "online":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="الكاميرا غير متصلة"
        )
    
    # إرجاع بث الفيديو
    return StreamingResponse(
        generate_video_frames(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive"
        }
    )


@router.get("/{camera_id}/snapshot")
async def get_snapshot(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب لقطة حالية من الكاميرا
    
    يُرجع صورة JPEG للقطة الحالية
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"📸 جلب لقطة من الكاميرا: {camera_id}")
    
    # التحقق من وجود الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    # TODO: تنفيذ جلب اللقطة الفعلية من RTSP
    # هنا نستخدم صورة محاكية
    
    # صورة محاكية (1x1 pixel JPEG أبيض)
    placeholder_image = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFF,
        0xD9
    ])
    
    return Response(
        content=placeholder_image,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f"inline; filename=snapshot_{camera_id}.jpg",
            "Cache-Control": "no-cache"
        }
    )


@router.get("/{camera_id}/info")
async def get_stream_info(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب معلومات البث
    
    يُرجع معلومات عن إعدادات البث للكاميرا
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"ℹ️ جلب معلومات البث للكاميرا: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    return {
        "camera_id": camera.id,
        "camera_name": camera.name,
        "status": camera.status,
        "rtsp_url": camera.rtsp_url if camera.rtsp_url else None,
        "stream_quality": camera.stream_quality,
        "fps": camera.fps,
        "resolution": f"{settings.STREAM_WIDTH}x{settings.STREAM_HEIGHT}",
        "detection_enabled": camera.detection_enabled,
        "is_recording": camera.is_recording
    }
