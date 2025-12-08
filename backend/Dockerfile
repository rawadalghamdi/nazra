# ==========================================
# نظام نظرة - Backend Dockerfile
# منصة الكشف الاستباقي عن الأسلحة بالذكاء الاصطناعي
# ==========================================
# هذا الملف للتشغيل بدون GPU
# استخدم Dockerfile.gpu للتشغيل مع NVIDIA GPU
# ==========================================

FROM python:3.11-slim AS base

# ==================
# معلومات الصورة
# ==================
LABEL maintainer="Nazra Team"
LABEL description="Nazra Backend - Weapon Detection API"
LABEL version="1.0.0"

# ==================
# إعداد متغيرات البيئة
# ==================
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONFAULTHANDLER=1
ENV DEBIAN_FRONTEND=noninteractive
ENV APP_HOME=/app
ENV PATH="${APP_HOME}/.venv/bin:$PATH"

# المنطقة الزمنية
ENV TZ=Asia/Riyadh

# ==================
# تثبيت التبعيات النظامية
# ==================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # أدوات البناء
    build-essential \
    # مكتبات OpenCV
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-good1.0-0 \
    # FFmpeg للفيديو
    ffmpeg \
    # أدوات الشبكة والنظام
    curl \
    wget \
    tzdata \
    # تنظيف
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ==================
# مرحلة التبعيات
# ==================
FROM base AS dependencies

WORKDIR ${APP_HOME}

# إنشاء بيئة افتراضية
RUN python -m venv .venv

# نسخ ملفات المتطلبات
COPY requirements.txt .

# تثبيت التبعيات
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# ==================
# مرحلة الإنتاج
# ==================
FROM base AS production

WORKDIR ${APP_HOME}

# نسخ البيئة الافتراضية
COPY --from=dependencies ${APP_HOME}/.venv ${APP_HOME}/.venv

# نسخ الكود المصدري
COPY . .

# ==================
# إنشاء المجلدات اللازمة
# ==================
RUN mkdir -p \
    ${APP_HOME}/data \
    ${APP_HOME}/models \
    ${APP_HOME}/uploads \
    ${APP_HOME}/alerts \
    ${APP_HOME}/snapshots \
    ${APP_HOME}/video_clips \
    ${APP_HOME}/logs \
    && chmod -R 755 ${APP_HOME}

# ==================
# إنشاء مستخدم غير root للأمان
# ==================
RUN groupadd --gid 1000 nazra && \
    useradd --uid 1000 --gid nazra --shell /bin/bash --create-home nazra && \
    chown -R nazra:nazra ${APP_HOME}

# التبديل للمستخدم الجديد
USER nazra

# ==================
# فتح المنفذ
# ==================
EXPOSE 8000

# ==================
# متغيرات البيئة للتشغيل
# ==================
ENV WORKERS=1
ENV HOST=0.0.0.0
ENV PORT=8000

# ==================
# فحص الصحة
# ==================
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# ==================
# أمر التشغيل
# ==================
CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST} --port ${PORT} --workers ${WORKERS} --loop uvloop --http httptools"]
