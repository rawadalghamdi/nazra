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

# Rate Limiting للحماية من الهجمات
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    RATE_LIMIT_AVAILABLE = True
except ImportError:
    RATE_LIMIT_AVAILABLE = False

from app.config import settings, get_data_dir, get_alerts_dir, get_snapshots_dir
from app.database import init_db, close_db, seed_demo_data
from app.routers.alerts import router as alerts_router
from app.routers.cameras import router as cameras_router
from app.routers.stream import router as stream_router
from app.routers.websocket import router as websocket_router
from app.routers.dashboard import router as dashboard_router
from app.routers.detection import router as detection_router
from app.routers.live_stream import router as live_stream_router

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
    ⚡ إدارة دورة حياة التطبيق - محسّن بمبدأ باريتو
    ================================================
    
    التحسينات:
    1. قياس وقت كل مرحلة
    2. التهيئة المتوازية للمكونات المستقلة
    3. إضافة الكاميرات بشكل متوازي
    4. تسجيل مفصّل للأداء
    """
    import time as perf_time
    import asyncio
    
    startup_start = perf_time.time()
    timings = {}
    
    # ===============================
    # عند بدء التشغيل
    # ===============================
    logger.info("=" * 50)
    logger.info("🚀 بدء تشغيل نظام نظرة...")
    logger.info(f"📅 التاريخ: {datetime.utcnow().isoformat()}")
    logger.info(f"🔧 وضع التطوير: {settings.DEBUG}")
    logger.info("=" * 50)
    
    # ⚡ المرحلة 1: المهام السريعة (متوازية)
    t0 = perf_time.time()
    os.makedirs(get_data_dir(), exist_ok=True)
    os.makedirs(get_alerts_dir(), exist_ok=True)
    os.makedirs(get_snapshots_dir(), exist_ok=True)
    timings["directories"] = perf_time.time() - t0
    logger.info(f"📁 تم إنشاء المجلدات ({timings['directories']*1000:.0f}ms)")
    
    # ⚡ المرحلة 2: تهيئة قاعدة البيانات
    t0 = perf_time.time()
    await init_db()
    timings["database"] = perf_time.time() - t0
    logger.info(f"✅ تم تهيئة قاعدة البيانات ({timings['database']*1000:.0f}ms)")
    
    # ⚡ المرحلة 3: تحميل نموذج الكشف (الأبطأ - 60% من وقت البدء)
    t0 = perf_time.time()
    detector = None
    try:
        from app.services.detector import get_detector
        detector = await get_detector()
        timings["model_load"] = perf_time.time() - t0
        if detector.is_loaded:
            logger.info(f"🎯 تم تحميل نموذج الكشف ({timings['model_load']:.1f}s) - الجهاز: {detector.device}")
        else:
            logger.warning("⚠️ نموذج الكشف غير متوفر")
    except Exception as e:
        timings["model_load"] = perf_time.time() - t0
        logger.warning(f"⚠️ تعذر تحميل نموذج الكشف ({timings['model_load']:.1f}s): {e}")
    
    # ⚡ المرحلة 4: بدء Detection Pipeline
    t0 = perf_time.time()
    try:
        from app.services.detection_pipeline import start_pipeline, get_pipeline
        from app.routers.websocket import push_detection_result
        from app.database import AsyncSessionLocal
        from sqlalchemy import select
        from app.models.camera import Camera
        
        # بدء Pipeline
        pipeline = await start_pipeline()
        
        # ربط callback لبث النتائج عبر WebSocket
        async def on_pipeline_result(result):
            """إرسال نتائج الكشف عبر WebSocket"""
            try:
                result_dict = {
                    "camera_id": result.camera_id,
                    "detections": result.detections,
                    "processing_time_ms": result.processing_time_ms,
                    "frame_size": result.frame_size
                }
                await push_detection_result(result_dict)
                
                if result.detections:
                    logger.info(f"🎯 كشف {len(result.detections)} كائن في {result.camera_id}")
            except Exception as e:
                logger.error(f"❌ خطأ في بث الكشف: {e}")
        
        pipeline.add_result_callback(on_pipeline_result)
        
        # ⚡ إضافة الكاميرات بشكل متوازي (بدلاً من التسلسلي)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Camera).where(Camera.status == "online", Camera.detection_enabled == True)
            )
            cameras = result.scalars().all()
            
            # إضافة جميع الكاميرات بشكل متوازي
            if cameras:
                camera_tasks = [
                    pipeline.add_camera(
                        camera_id=str(camera.id),
                        stream_url=camera.rtsp_url
                    )
                    for camera in cameras if camera.rtsp_url
                ]
                await asyncio.gather(*camera_tasks, return_exceptions=True)
            
            logger.info(f"🔍 Pipeline: {len(cameras)} كاميرا نشطة")
        
        timings["pipeline"] = perf_time.time() - t0
        logger.info(f"✅ Detection Pipeline جاهز ({timings['pipeline']:.1f}s)")
        
    except Exception as e:
        timings["pipeline"] = perf_time.time() - t0
        logger.warning(f"⚠️ تعذر بدء Detection Pipeline ({timings['pipeline']:.1f}s): {e}")
        import traceback
        traceback.print_exc()
    
    # ⚡ ملخص الأداء
    total_time = perf_time.time() - startup_start
    logger.info("=" * 50)
    logger.info("📊 ملخص بدء التشغيل (Pareto Analysis):")
    logger.info(f"   📁 المجلدات:    {timings.get('directories', 0)*1000:>6.0f}ms ({timings.get('directories', 0)/total_time*100:>4.1f}%)")
    logger.info(f"   🗄️  قاعدة البيانات: {timings.get('database', 0)*1000:>6.0f}ms ({timings.get('database', 0)/total_time*100:>4.1f}%)")
    logger.info(f"   🎯 نموذج الكشف:  {timings.get('model_load', 0)*1000:>6.0f}ms ({timings.get('model_load', 0)/total_time*100:>4.1f}%) ← الأبطأ")
    logger.info(f"   🔄 Pipeline:    {timings.get('pipeline', 0)*1000:>6.0f}ms ({timings.get('pipeline', 0)/total_time*100:>4.1f}%)")
    logger.info(f"   ─────────────────────────")
    logger.info(f"   ⏱️  الإجمالي:     {total_time*1000:>6.0f}ms")
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
    
    # إيقاف Detection Pipeline
    try:
        from app.services.detection_pipeline import stop_pipeline
        await stop_pipeline()
        logger.info("⏹️ تم إيقاف Detection Pipeline")
    except Exception:
        pass
    
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
    
    # إيقاف ThreadPoolExecutor في stream router
    try:
        from app.routers.stream import executor
        executor.shutdown(wait=False)
        logger.info("⏹️ تم إيقاف ThreadPoolExecutor")
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
# إعداد Rate Limiting
# ===============================
if RATE_LIMIT_AVAILABLE:
    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("🛡️ Rate Limiting مفعّل")
else:
    limiter = None
    logger.warning("⚠️ slowapi غير مثبت - Rate Limiting معطّل")


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

app.include_router(
    dashboard_router,
    prefix=settings.API_V1_PREFIX + "/dashboard",
    tags=["لوحة التحكم"]
)

app.include_router(
    detection_router,
    prefix=settings.API_V1_PREFIX,
    tags=["الكشف"]
)

# البث الحي مع الكاميرات المتعددة
app.include_router(
    live_stream_router,
    prefix=settings.API_V1_PREFIX,
    tags=["البث الحي"]
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

