#!/bin/bash
# =====================================================
# نظام نظرة - تشغيل التطوير المحلي (Backend + Frontend)
# =====================================================

echo "🔍 نظام نظرة - بيئة التطوير المحلية"
echo "======================================"
echo ""

cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)

# الألوان
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# إعداد متغيرات البيئة
export YOLO_DEVICE="auto"
export YOLO_MODEL_PATH="$PROJECT_DIR/backend/models/best.pt"
export DATABASE_URL="sqlite+aiosqlite:///$PROJECT_DIR/data/nazra.db"

# إنشاء المجلدات
mkdir -p data alerts snapshots uploads logs

# ==========================================
# فحص المتطلبات
# ==========================================

echo -e "${BLUE}[1/4]${NC} فحص المتطلبات..."

# فحص Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[✗]${NC} Python3 غير مثبت!"
    exit 1
fi
echo -e "${GREEN}  ✓${NC} Python3 موجود"

# فحص Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[✗]${NC} Node.js غير مثبت!"
    echo "   brew install node"
    exit 1
fi
echo -e "${GREEN}  ✓${NC} Node.js موجود"

# فحص npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[✗]${NC} npm غير مثبت!"
    exit 1
fi
echo -e "${GREEN}  ✓${NC} npm موجود"

# ==========================================
# فحص Redis (اختياري)
# ==========================================

echo ""
echo -e "${BLUE}[2/4]${NC} فحص Redis..."

if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null 2>&1; then
        echo -e "${GREEN}  ✓${NC} Redis يعمل"
        export REDIS_ENABLED="true"
        export REDIS_URL="redis://localhost:6379/0"
    else
        echo -e "${YELLOW}  ⚠${NC} Redis غير قيد التشغيل (اختياري)"
        export REDIS_ENABLED="false"
    fi
else
    echo -e "${YELLOW}  ⚠${NC} Redis غير مثبت (اختياري)"
    export REDIS_ENABLED="false"
fi

# ==========================================
# تثبيت المتطلبات
# ==========================================

echo ""
echo -e "${BLUE}[3/4]${NC} التحقق من متطلبات Python..."
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
    aiofiles \
    2>/dev/null
echo -e "${GREEN}  ✓${NC} متطلبات Python جاهزة"

# فحص متطلبات Frontend
echo ""
echo -e "${BLUE}[4/4]${NC} التحقق من متطلبات Frontend..."
if [ ! -d "frontend/node_modules" ]; then
    echo "   جاري تثبيت node_modules..."
    cd frontend && npm install && cd ..
fi
echo -e "${GREEN}  ✓${NC} متطلبات Frontend جاهزة"

# ==========================================
# معلومات النظام
# ==========================================

echo ""
echo "📊 معلومات النظام:"
python3 -c "
import torch
print(f'   PyTorch: {torch.__version__}')
if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('   🍎 MPS (Metal): متاح ✅')
elif torch.cuda.is_available():
    print(f'   🎮 CUDA: متاح ✅')
else:
    print('   CPU: سيتم استخدام المعالج')
"

# ==========================================
# تشغيل الخدمات
# ==========================================

echo ""
echo "======================================"
echo -e "${GREEN}🚀 تشغيل الخدمات...${NC}"
echo ""
echo -e "   ${BLUE}Backend:${NC}  http://localhost:8000"
echo -e "   ${BLUE}API Docs:${NC} http://localhost:8000/docs"
echo -e "   ${BLUE}Frontend:${NC} http://localhost:5173"
echo ""
echo -e "${YELLOW}   اضغط Ctrl+C للإيقاف${NC}"
echo "======================================"
echo ""

# تشغيل Backend في الخلفية
cd "$PROJECT_DIR/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# الانتظار قليلاً
sleep 2

# تشغيل Frontend
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# دالة التنظيف عند الإيقاف
cleanup() {
    echo ""
    echo -e "${YELLOW}إيقاف الخدمات...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✓ تم إيقاف جميع الخدمات${NC}"
    exit 0
}

# التقاط Ctrl+C
trap cleanup SIGINT SIGTERM

# الانتظار
wait
