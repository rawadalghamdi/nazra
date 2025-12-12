"""
إعداد قاعدة البيانات
===================
SQLite للتطوير - قابل للتبديل لـ PostgreSQL
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
import logging

from app.config import settings

# إعداد السجل
logger = logging.getLogger("nazra.database")

# إنشاء Base للنماذج
Base = declarative_base()

# إنشاء المحرك غير المتزامن
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,
)

# إنشاء Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_db() -> None:
    """
    تهيئة قاعدة البيانات وإنشاء الجداول
    """
    from app.models import alert, camera, user  # استيراد النماذج
    
    logger.info("Initializing database...")
    
    async with engine.begin() as conn:
        # إنشاء جميع الجداول
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Database initialized successfully")


async def close_db() -> None:
    """
    إغلاق اتصالات قاعدة البيانات
    """
    logger.info("Closing database connections...")
    await engine.dispose()
    logger.info("Database connections closed")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    الحصول على جلسة قاعدة البيانات
    يستخدم كـ dependency في FastAPI
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            await session.close()


# للاختبار: إضافة بيانات تجريبية
async def seed_demo_data() -> None:
    """
    إضافة بيانات تجريبية لقاعدة البيانات
    """
    from app.models.camera import Camera
    from app.models.alert import Alert, AlertStatus, WeaponType
    from datetime import datetime, timedelta
    import uuid
    
    async with AsyncSessionLocal() as session:
        # التحقق من وجود بيانات
        from sqlalchemy import select, func
        result = await session.execute(select(func.count(Camera.id)))
        count = result.scalar()
        
        if count > 0:
            logger.info("Demo data already exists")
            return
        
        logger.info("Adding demo data...")
        
        # إضافة كاميرات تجريبية
        cameras = [
            Camera(
                id=str(uuid.uuid4()),
                name="كاميرا المدخل الرئيسي",
                location="البوابة الرئيسية",
                rtsp_url="rtsp://demo:demo@192.168.1.100:554/stream1",
                status="online",
                detection_enabled=True,
            ),
            Camera(
                id=str(uuid.uuid4()),
                name="كاميرا الردهة",
                location="الردهة الرئيسية - الطابق الأرضي",
                rtsp_url="rtsp://demo:demo@192.168.1.101:554/stream1",
                status="online",
                detection_enabled=True,
            ),
            Camera(
                id=str(uuid.uuid4()),
                name="كاميرا موقف السيارات",
                location="موقف السيارات - المنطقة A",
                rtsp_url="rtsp://demo:demo@192.168.1.102:554/stream1",
                status="offline",
                detection_enabled=False,
            ),
        ]
        
        for camera in cameras:
            session.add(camera)
        
        await session.commit()
        
        # إضافة تنبيهات تجريبية
        alerts = [
            Alert(
                id=str(uuid.uuid4()),
                camera_id=cameras[0].id,
                camera_name=cameras[0].name,
                location=cameras[0].location,
                weapon_type=WeaponType.PISTOL,
                confidence=0.92,
                image_snapshot="/alerts/snapshot_001.jpg",
                bounding_box={"x": 120, "y": 80, "width": 50, "height": 30},
                status=AlertStatus.NEW,
                timestamp=datetime.utcnow() - timedelta(minutes=5),
            ),
            Alert(
                id=str(uuid.uuid4()),
                camera_id=cameras[1].id,
                camera_name=cameras[1].name,
                location=cameras[1].location,
                weapon_type=WeaponType.KNIFE,
                confidence=0.85,
                image_snapshot="/alerts/snapshot_002.jpg",
                bounding_box={"x": 200, "y": 150, "width": 40, "height": 60},
                status=AlertStatus.UNDER_REVIEW,
                timestamp=datetime.utcnow() - timedelta(hours=1),
            ),
        ]
        
        for alert in alerts:
            session.add(alert)
        
        await session.commit()
        
        logger.info("Demo data added successfully")
