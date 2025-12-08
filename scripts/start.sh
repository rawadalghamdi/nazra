#!/bin/bash
# ==========================================
# نظام نظرة - سكربت بدء التشغيل
# منصة الكشف الاستباقي عن الأسلحة بالذكاء الاصطناعي
# ==========================================

set -e

# ==========================================
# الألوان للطباعة
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==========================================
# الدوال المساعدة
# ==========================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║     🔍 نظام نظرة - منصة الكشف الاستباقي عن الأسلحة     ║"
    echo "║                                                          ║"
    echo "║        Nazra - Proactive Weapon Detection Platform       ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ==========================================
# فحص المتطلبات
# ==========================================

check_requirements() {
    log_info "فحص المتطلبات..."
    
    # فحص Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker غير مثبت!"
        echo "يرجى تثبيت Docker من: https://docs.docker.com/get-docker/"
        exit 1
    fi
    log_success "Docker مثبت"
    
    # فحص Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose غير مثبت!"
        exit 1
    fi
    log_success "Docker Compose مثبت"
    
    # فحص تشغيل Docker
    if ! docker info &> /dev/null; then
        log_error "Docker غير قيد التشغيل!"
        echo "يرجى تشغيل Docker Desktop أو خدمة Docker"
        exit 1
    fi
    log_success "Docker قيد التشغيل"
}

# فحص دعم GPU
check_gpu() {
    log_info "فحص دعم GPU..."
    
    if command -v nvidia-smi &> /dev/null; then
        if nvidia-smi &> /dev/null; then
            log_success "NVIDIA GPU متاح"
            GPU_AVAILABLE=true
            
            # عرض معلومات GPU
            echo -e "${PURPLE}"
            nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
            echo -e "${NC}"
        else
            log_warning "NVIDIA driver غير متاح"
            GPU_AVAILABLE=false
        fi
    else
        log_warning "nvidia-smi غير موجود - لن يتم استخدام GPU"
        GPU_AVAILABLE=false
    fi
}

# ==========================================
# إعداد المجلدات والملفات
# ==========================================

setup_directories() {
    log_info "إنشاء المجلدات اللازمة..."
    
    # المجلدات الرئيسية
    mkdir -p backend/data
    mkdir -p backend/models
    mkdir -p backend/uploads
    mkdir -p backend/alerts
    mkdir -p backend/snapshots
    mkdir -p backend/logs
    
    # مجلدات Nginx
    mkdir -p nginx/conf.d
    mkdir -p nginx/ssl
    
    # مجلدات المراقبة
    mkdir -p monitoring/grafana/dashboards
    
    log_success "تم إنشاء المجلدات"
}

setup_env_file() {
    if [ ! -f .env ]; then
        log_info "إنشاء ملف .env..."
        
        cat > .env << EOF
# ==========================================
# نظام نظرة - متغيرات البيئة
# ==========================================

# الأمان - يجب تغييرها في الإنتاج!
SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "nazra-secret-key-change-me")
JWT_SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "jwt-secret-key-change-me")

# الكشف
DETECTION_THRESHOLD=0.7
NMS_THRESHOLD=0.4

# التشغيل
DEBUG=false
LOG_LEVEL=INFO
MAX_WORKERS=4

# المراقبة
GRAFANA_PASSWORD=admin

# CORS
CORS_ORIGINS=*
EOF
        log_success "تم إنشاء ملف .env"
    else
        log_info "ملف .env موجود مسبقاً"
    fi
}

# ==========================================
# دوال التشغيل
# ==========================================

# التشغيل في وضع التطوير
start_dev() {
    log_info "بدء التشغيل في وضع التطوير..."
    
    docker compose up -d redis backend frontend
    
    log_success "تم تشغيل النظام في وضع التطوير"
    echo ""
    echo -e "${GREEN}الروابط:${NC}"
    echo -e "  - Frontend:  ${CYAN}http://localhost:3000${NC}"
    echo -e "  - Backend:   ${CYAN}http://localhost:8000${NC}"
    echo -e "  - API Docs:  ${CYAN}http://localhost:8000/docs${NC}"
}

# التشغيل في وضع الإنتاج
start_prod() {
    log_info "بدء التشغيل في وضع الإنتاج..."
    
    docker compose --profile production up -d
    
    log_success "تم تشغيل النظام في وضع الإنتاج"
    echo ""
    echo -e "${GREEN}الروابط:${NC}"
    echo -e "  - الموقع:   ${CYAN}http://localhost${NC}"
    echo -e "  - API:      ${CYAN}http://localhost/api${NC}"
}

# التشغيل مع GPU
start_gpu() {
    if [ "$GPU_AVAILABLE" != "true" ]; then
        log_error "GPU غير متاح!"
        exit 1
    fi
    
    log_info "بدء التشغيل مع دعم GPU..."
    
    docker compose --profile gpu up -d redis backend-gpu frontend
    
    log_success "تم تشغيل النظام مع دعم GPU"
    echo ""
    echo -e "${GREEN}الروابط:${NC}"
    echo -e "  - Frontend:  ${CYAN}http://localhost:3000${NC}"
    echo -e "  - Backend:   ${CYAN}http://localhost:8000${NC}"
}

# التشغيل الكامل مع المراقبة
start_full() {
    log_info "بدء التشغيل الكامل مع المراقبة..."
    
    docker compose --profile production --profile monitoring up -d
    
    log_success "تم تشغيل النظام الكامل"
    echo ""
    echo -e "${GREEN}الروابط:${NC}"
    echo -e "  - الموقع:     ${CYAN}http://localhost${NC}"
    echo -e "  - Prometheus: ${CYAN}http://localhost:9090${NC}"
    echo -e "  - Grafana:    ${CYAN}http://localhost:3001${NC}"
}

# إيقاف النظام
stop_all() {
    log_info "إيقاف جميع الخدمات..."
    
    docker compose --profile production --profile monitoring --profile gpu down
    
    log_success "تم إيقاف جميع الخدمات"
}

# إعادة التشغيل
restart_all() {
    log_info "إعادة تشغيل الخدمات..."
    
    stop_all
    sleep 2
    start_dev
}

# عرض حالة الخدمات
show_status() {
    log_info "حالة الخدمات:"
    echo ""
    docker compose ps
}

# عرض السجلات
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker compose logs -f --tail=100
    else
        docker compose logs -f --tail=100 "$service"
    fi
}

# بناء الصور
build_images() {
    log_info "بناء صور Docker..."
    
    docker compose build --no-cache
    
    log_success "تم بناء الصور"
}

# تنظيف النظام
cleanup() {
    log_warning "تنظيف النظام..."
    
    read -p "هل أنت متأكد؟ سيتم حذف جميع الحاويات والـ volumes! (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose --profile production --profile monitoring --profile gpu down -v --remove-orphans
        docker system prune -f
        log_success "تم التنظيف"
    else
        log_info "تم الإلغاء"
    fi
}

# ==========================================
# عرض المساعدة
# ==========================================

show_help() {
    echo -e "${CYAN}الاستخدام:${NC}"
    echo "  ./start.sh [أمر]"
    echo ""
    echo -e "${CYAN}الأوامر المتاحة:${NC}"
    echo "  dev         - تشغيل في وضع التطوير"
    echo "  prod        - تشغيل في وضع الإنتاج (مع Nginx)"
    echo "  gpu         - تشغيل مع دعم NVIDIA GPU"
    echo "  full        - تشغيل كامل مع المراقبة"
    echo "  stop        - إيقاف جميع الخدمات"
    echo "  restart     - إعادة تشغيل الخدمات"
    echo "  status      - عرض حالة الخدمات"
    echo "  logs [خدمة] - عرض السجلات"
    echo "  build       - بناء صور Docker"
    echo "  cleanup     - تنظيف النظام"
    echo "  help        - عرض هذه المساعدة"
    echo ""
    echo -e "${CYAN}أمثلة:${NC}"
    echo "  ./start.sh dev          # تشغيل التطوير"
    echo "  ./start.sh logs backend # سجلات Backend"
    echo "  ./start.sh gpu          # تشغيل مع GPU"
}

# ==========================================
# البرنامج الرئيسي
# ==========================================

main() {
    print_banner
    
    # الانتقال لمجلد المشروع
    cd "$(dirname "$0")/.." || exit 1
    
    # فحص المتطلبات
    check_requirements
    check_gpu
    setup_directories
    setup_env_file
    
    echo ""
    
    # تنفيذ الأمر
    case "${1:-dev}" in
        dev)
            start_dev
            ;;
        prod|production)
            start_prod
            ;;
        gpu)
            start_gpu
            ;;
        full)
            start_full
            ;;
        stop)
            stop_all
            ;;
        restart)
            restart_all
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        build)
            build_images
            ;;
        cleanup|clean)
            cleanup
            ;;
        help|-h|--help)
            show_help
            ;;
        *)
            log_error "أمر غير معروف: $1"
            show_help
            exit 1
            ;;
    esac
}

# تشغيل البرنامج
main "$@"
