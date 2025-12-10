#!/bin/bash
# تشغيل Backend محلياً مع MPS على Mac M4
# =====================================

echo "🍎 تشغيل Backend محلياً مع MPS (Mac M4)"
echo "=========================================="

# التأكد من المجلد
cd "$(dirname "$0")"

# إعداد المتغيرات
export YOLO_DEVICE="mps"
export YOLO_MODEL_PATH="./backend/models/best.pt"
export DATABASE_URL="sqlite+aiosqlite:///./data/nazra.db"
export REDIS_URL="redis://localhost:6379/0"

# تثبيت المتطلبات إذا لزم الأمر
echo "📦 التحقق من المتطلبات..."
pip3 install -q fastapi uvicorn aiosqlite sqlalchemy pydantic-settings python-multipart ultralytics opencv-python torch torchvision redis 2>/dev/null

# إنشاء المجلدات
mkdir -p data alerts snapshots uploads logs

# تشغيل السيرفر
echo ""
echo "🚀 تشغيل السيرفر على http://localhost:8000"
echo "   الجهاز: MPS (Metal)"
echo "   Press Ctrl+C to stop"
echo ""

cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
