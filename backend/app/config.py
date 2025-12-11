"""
إعدادات التطبيق
===============
جميع إعدادات نظام نظرة
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os


class Settings(BaseSettings):
    """
    إعدادات النظام
    ===============
    يمكن تجاوز القيم عبر متغيرات البيئة أو ملف .env
    """
    
    # ==================
    # إعدادات التطبيق
    # ==================
    APP_NAME: str = "نظام نظرة"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "منصة الكشف الاستباقي عن الأسلحة بالذكاء الاصطناعي"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # ==================
    # إعدادات قاعدة البيانات
    # ==================
    # SQLite للتطوير - يمكن استبدالها بـ PostgreSQL
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/nazra.db"
    # PostgreSQL للإنتاج:
    # DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/nazra"
    
    # ==================
    # إعدادات Redis
    # ==================
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = False  # تفعيل عند الحاجة
    
    # ==================
    # إعدادات CORS
    # ==================
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # ==================
    # إعدادات الأمان
    # ==================
    SECRET_KEY: str = "nazra-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # يوم واحد
    
    # ==================
    # إعدادات الكشف
    # ==================
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.5  # خفض الحد للاختبار
    MAX_DETECTION_TIME: float = 2.0  # ثانية
    DETECTION_FRAME_SKIP: int = 2  # تخطي إطارات للأداء
    
    # ==================
    # إعدادات تحسين الأداء (Pareto 80/20)
    # ==================
    MOTION_DETECTION_ENABLED: bool = True      # تفعيل كشف الحركة قبل AI
    MOTION_THRESHOLD: float = 0.02             # حد الحركة (2% تغيير)
    MODEL_WARMUP_ENABLED: bool = True          # تسخين النموذج عند البدء
    BATCH_GPU_TRANSFER: bool = True            # نقل دفعي GPU→CPU
    TURBOJPEG_ENABLED: bool = True             # استخدام TurboJPEG (3x أسرع)
    CACHE_CLEANUP_INTERVAL: int = 60           # تنظيف الكاش (ثانية)
    MAX_CONCURRENT_STREAMS: int = 8            # الحد الأقصى للبث المتزامن
    ADAPTIVE_FRAME_SKIP: bool = True           # تخطي تكيفي للإطارات
    
    # ==================
    # إعدادات YOLO
    # ==================
    YOLO_MODEL_PATH: str = "/app/models/best.pt"  # نموذج Absher المدرب
    YOLO_DEVICE: str = "auto"  # auto, cpu, cuda, mps
    
    # ==================
    # إعدادات التخزين
    # ==================
    UPLOAD_DIR: str = "./uploads"
    ALERTS_DIR: str = "./alerts"
    SNAPSHOTS_DIR: str = "./snapshots"
    VIDEO_CLIPS_DIR: str = "./video_clips"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50 MB
    
    # ==================
    # إعدادات البث
    # ==================
    STREAM_QUALITY: str = "medium"  # low, medium, high
    STREAM_FPS: int = 15
    STREAM_WIDTH: int = 640
    STREAM_HEIGHT: int = 480
    
    # ==================
    # إعدادات جودة JPEG
    # ==================
    JPEG_QUALITY_STREAM: int = 70      # جودة البث المباشر (توازن سرعة/جودة)
    JPEG_QUALITY_SNAPSHOT: int = 85    # جودة اللقطات
    JPEG_QUALITY_DETECTION: int = 80   # جودة صور الكشف
    
    # ==================
    # إعدادات الإشعارات
    # ==================
    NOTIFICATION_ENABLED: bool = True
    NOTIFICATION_SOUND: bool = True
    EMAIL_ENABLED: bool = False
    SMS_ENABLED: bool = False
    
    # ==================
    # إعدادات التسجيل
    # ==================
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/nazra.log"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# دالة للحصول على مسار مجلد
def get_data_dir() -> str:
    """الحصول على مسار مجلد البيانات"""
    data_dir = "./data"
    os.makedirs(data_dir, exist_ok=True)
    return data_dir


def get_alerts_dir() -> str:
    """الحصول على مسار مجلد التنبيهات"""
    os.makedirs(settings.ALERTS_DIR, exist_ok=True)
    return settings.ALERTS_DIR


def get_snapshots_dir() -> str:
    """الحصول على مسار مجلد الصور"""
    os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
    return settings.SNAPSHOTS_DIR


def get_video_clips_dir() -> str:
    """الحصول على مسار مجلد مقاطع الفيديو"""
    os.makedirs(settings.VIDEO_CLIPS_DIR, exist_ok=True)
    return settings.VIDEO_CLIPS_DIR

# إنشاء نسخة من الإعدادات
settings = Settings()
