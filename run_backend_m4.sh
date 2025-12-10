#!/bin/bash
# =====================================================
# تشغيل نظام نظرة محلياً مع MPS على Mac M4
# =====================================================

echo "🍎 نظام نظرة - Mac M4 مع Metal Performance Shaders"
echo "=================================================="
echo ""

cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)

# إعداد متغيرات البيئة
export YOLO_DEVICE="auto"
export YOLO_MODEL_PATH="$PROJECT_DIR/backend/models/best.pt"
export DATABASE_URL="sqlite+aiosqlite:///$PROJECT_DIR/data/nazra.db"

# إنشاء المجلدات
mkdir -p data alerts snapshots uploads logs

# التحقق من Redis
echo "🔍 التحقق من Redis..."
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️ Redis غير مثبت"
    echo "   brew install redis"
    export REDIS_ENABLED="false"
else
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis يعمل"
        export REDIS_ENABLED="true"
        export REDIS_URL="redis://localhost:6379/0"
    else
        echo "⚠️ Redis غير يعمل، جاري التشغيل..."
        brew services start redis 2>/dev/null || redis-server --daemonize yes
        export REDIS_ENABLED="true"
        export REDIS_URL="redis://localhost:6379/0"
    fi
fi

# تثبيت المتطلبات
echo ""
echo "📦 التحقق من المتطلبات..."
pip3 install -q \
    fastapi \
    uvicorn[standard] \
    aiosqlite \
    sqlalchemy \
    pydantic-settings \
    python-multipart \
    ultralytics \
    opencv-python \
    torch \
    torchvision \
    redis \
    aiofiles \
    python-jose \
    passlib \
    bcrypt \
    2>/dev/null

echo "✅ المتطلبات جاهزة"

# عرض معلومات النظام
echo ""
echo "📊 معلومات النظام:"
python3 -c "
import torch
print(f'   PyTorch: {torch.__version__}')
if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('   🍎 MPS (Metal): متاح ✅')
else:
    print('   MPS: غير متاح')
if torch.cuda.is_available():
    print(f'   🎮 CUDA: متاح ✅')
else:
    print('   CUDA: غير متاح')
"

# تشغيل Backend
echo ""
echo "🚀 تشغيل Backend على http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "⚡ الأداء المتوقع: ~50 FPS مع MPS"
echo ""
echo "   اضغط Ctrl+C للإيقاف"
echo "=================================================="
echo ""

cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
