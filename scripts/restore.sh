#!/bin/bash
# ==========================================
# نظام نظرة - سكربت الاستعادة من النسخ الاحتياطي
# ==========================================

set -e

# الألوان
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# المتغيرات
BACKUP_DIR="./backups"
RESTORE_DIR="./restore_temp"

# فحص المعاملات
if [ -z "$1" ]; then
    echo -e "${RED}[✗]${NC} يجب تحديد ملف النسخة الاحتياطية"
    echo "الاستخدام: ./restore.sh <backup_file.tar.gz>"
    echo ""
    echo "النسخ المتاحة:"
    ls -la "${BACKUP_DIR}"/*.tar.gz 2>/dev/null || echo "لا توجد نسخ احتياطية"
    exit 1
fi

BACKUP_FILE="$1"

# التحقق من وجود الملف
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}[✗]${NC} الملف غير موجود: $BACKUP_FILE"
    exit 1
fi

echo -e "${YELLOW}[⚠]${NC} هذا سيستبدل البيانات الحالية!"
read -p "هل أنت متأكد من الاستمرار؟ (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}[INFO]${NC} تم الإلغاء"
    exit 0
fi

echo -e "${BLUE}[INFO]${NC} بدء الاستعادة من: $BACKUP_FILE"

# إنشاء مجلد مؤقت
mkdir -p "${RESTORE_DIR}"

# فك الضغط
echo -e "${BLUE}[INFO]${NC} فك ضغط الأرشيف..."
tar -xzf "$BACKUP_FILE" -C "${RESTORE_DIR}"

# استعادة قاعدة البيانات
if ls "${RESTORE_DIR}"/*_database.db 1> /dev/null 2>&1; then
    echo -e "${BLUE}[INFO]${NC} استعادة قاعدة البيانات..."
    mkdir -p "./data"
    cp "${RESTORE_DIR}"/*_database.db "./data/nazra.db"
fi

# استعادة التنبيهات
if ls "${RESTORE_DIR}"/*_alerts.tar.gz 1> /dev/null 2>&1; then
    echo -e "${BLUE}[INFO]${NC} استعادة التنبيهات..."
    tar -xzf "${RESTORE_DIR}"/*_alerts.tar.gz -C "./"
fi

# استعادة اللقطات
if ls "${RESTORE_DIR}"/*_snapshots.tar.gz 1> /dev/null 2>&1; then
    echo -e "${BLUE}[INFO]${NC} استعادة اللقطات..."
    tar -xzf "${RESTORE_DIR}"/*_snapshots.tar.gz -C "./"
fi

# تنظيف
rm -rf "${RESTORE_DIR}"

echo -e "${GREEN}[✓]${NC} تمت الاستعادة بنجاح!"
echo -e "${YELLOW}[⚠]${NC} قد تحتاج لإعادة تشغيل الخدمات: ./scripts/start.sh restart"
