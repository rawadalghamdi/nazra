#!/bin/bash
# ==========================================
# نظام نظرة - سكربت النسخ الاحتياطي
# ==========================================

set -e

# الألوان
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# المتغيرات
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="nazra_backup_${TIMESTAMP}"

echo -e "${BLUE}[INFO]${NC} بدء النسخ الاحتياطي..."

# إنشاء مجلد النسخ الاحتياطية
mkdir -p "${BACKUP_DIR}"

# نسخ قاعدة البيانات
echo -e "${BLUE}[INFO]${NC} نسخ قاعدة البيانات..."
if [ -f "./data/nazra.db" ]; then
    cp "./data/nazra.db" "${BACKUP_DIR}/${BACKUP_NAME}_database.db"
fi

# نسخ التنبيهات
echo -e "${BLUE}[INFO]${NC} نسخ التنبيهات..."
if [ -d "./alerts" ]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_alerts.tar.gz" -C "." alerts/
fi

# نسخ اللقطات
echo -e "${BLUE}[INFO]${NC} نسخ اللقطات..."
if [ -d "./snapshots" ]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_snapshots.tar.gz" -C "." snapshots/
fi

# نسخ الإعدادات
echo -e "${BLUE}[INFO]${NC} نسخ الإعدادات..."
if [ -f ".env" ]; then
    cp ".env" "${BACKUP_DIR}/${BACKUP_NAME}_env.bak"
fi

# إنشاء ملف الأرشيف الكامل
echo -e "${BLUE}[INFO]${NC} إنشاء الأرشيف الكامل..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
    "${BACKUP_DIR}/${BACKUP_NAME}"_* 2>/dev/null || true

# حذف الملفات المؤقتة
rm -f "${BACKUP_DIR}/${BACKUP_NAME}"_database.db
rm -f "${BACKUP_DIR}/${BACKUP_NAME}"_alerts.tar.gz
rm -f "${BACKUP_DIR}/${BACKUP_NAME}"_snapshots.tar.gz
rm -f "${BACKUP_DIR}/${BACKUP_NAME}"_env.bak

# حذف النسخ القديمة (أكثر من 7 أيام)
find "${BACKUP_DIR}" -name "nazra_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo -e "${GREEN}[✓]${NC} تم النسخ الاحتياطي: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# عرض حجم الملف
ls -lh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
