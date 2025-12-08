"""
نظام نظرة - Backend API
========================
منصة الكشف الاستباقي عن الأسلحة بالذكاء الاصطناعي

نقطة الدخول الرئيسية للتطبيق
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
import os
from datetime import datetime

from app.config import settings, get_data_dir, get_alerts_dir, get_snapshots_dir
from app.database import init_db, close_db, seed_demo_data
from app.routers.alerts import router as alerts_router
from app.routers.cameras import router as cameras_router
from app.routers.stream import router as stream_router
from app.routers.websocket import router as websocket_router

# إعداد التسجيل
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format=settings.LOG_FORMAT,
    handlers=[
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger("نظرة")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    إدارة دورة حياة التطبيق
    ======================
    """
    # ===============================
    # عند بدء التشغيل
    # ===============================
    logger.info("=" * 50)
    logger.info("🚀 بدء تشغيل نظام نظرة...")
    logger.info(f"📅 التاريخ: {datetime.utcnow().isoformat()}")
    logger.info(f"🔧 وضع التطوير: {settings.DEBUG}")
    logger.info("=" * 50)
    
    # إنشاء المجلدات المطلوبة
    os.makedirs(get_data_dir(), exist_ok=True)
    os.makedirs(get_alerts_dir(), exist_ok=True)
    os.makedirs(get_snapshots_dir(), exist_ok=True)
    logger.info("📁 تم إنشاء المجلدات المطلوبة")
    
    # تهيئة قاعدة البيانات
    await init_db()
    logger.info("✅ تم تهيئة قاعدة البيانات")
    
    # إضافة بيانات تجريبية (في وضع التطوير)
    if settings.DEBUG:
        await seed_demo_data()
    
    # تحميل نموذج الكشف (اختياري)
    try:
        from app.services.detector import get_detector
        detector = await get_detector()
        if detector.is_loaded:
            logger.info("🎯 تم تحميل نموذج الكشف")
        else:
            logger.warning("⚠️ نموذج الكشف غير متوفر")
    except Exception as e:
        logger.warning(f"⚠️ تعذر تحميل نموذج الكشف: {e}")
    
    logger.info("=" * 50)
    logger.info("✅ نظام نظرة جاهز للعمل!")
    logger.info(f"📖 التوثيق: http://localhost:8000{settings.API_V1_PREFIX}/docs")
    logger.info("=" * 50)
    
    yield
    
    # ===============================
    # عند الإغلاق
    # ===============================
    logger.info("=" * 50)
    logger.info("👋 جاري إيقاف نظام نظرة...")
    
    # إيقاف محرك الكشف
    try:
        from app.services.detector import shutdown_detector
        await shutdown_detector()
    except Exception:
        pass
    
    # إيقاف مدير الكاميرات
    try:
        from app.services.camera_manager import shutdown_camera_manager
        await shutdown_camera_manager()
    except Exception:
        pass
    
    # إغلاق قاعدة البيانات
    await close_db()
    
    logger.info("✅ تم إيقاف نظام نظرة بنجاح")
    logger.info("=" * 50)


# ===============================
# إنشاء التطبيق
# ===============================
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)


# ===============================
# إعداد CORS
# ===============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)


# ===============================
# معالجة الأخطاء
# ===============================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    معالج الأخطاء العام
    """
    logger.error(f"❌ خطأ غير متوقع: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "حدث خطأ غير متوقع",
            "error": str(exc) if settings.DEBUG else None
        }
    )


# ===============================
# تضمين الروترات
# ===============================
# روترات API v1
app.include_router(
    cameras_router,
    prefix=settings.API_V1_PREFIX,
    tags=["الكاميرات"]
)

app.include_router(
    alerts_router,
    prefix=settings.API_V1_PREFIX,
    tags=["التنبيهات"]
)

app.include_router(
    stream_router,
    prefix=settings.API_V1_PREFIX,
    tags=["البث"]
)

# WebSocket
app.include_router(
    websocket_router,
    prefix="/ws",
    tags=["WebSocket"]
)


# ===============================
# نقاط النهاية الأساسية
# ===============================
@app.get("/")
async def root():
    """
    الصفحة الرئيسية
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": settings.APP_DESCRIPTION,
        "docs": f"{settings.API_V1_PREFIX}/docs",
        "health": "/api/health",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/health")
async def health_check():
    """
    فحص حالة الخادم
    """
    return {
        "status": "healthy",
        "service": "nazra-api",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "debug": settings.DEBUG
    }


@app.get(f"{settings.API_V1_PREFIX}/info")
async def api_info():
    """
    معلومات API
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "api_version": "v1",
        "endpoints": {
            "cameras": f"{settings.API_V1_PREFIX}/cameras",
            "alerts": f"{settings.API_V1_PREFIX}/alerts",
            "stream": f"{settings.API_V1_PREFIX}/stream",
            "websocket": "/ws"
        },
        "features": {
            "weapon_detection": True,
            "real_time_alerts": True,
            "video_streaming": True,
            "camera_management": True
        }
    }


# ===============================
# تشغيل التطبيق
# ===============================
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=1,
        log_level="info"
    )

