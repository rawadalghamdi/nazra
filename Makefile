# ==========================================
# نظام نظرة - Makefile للأوامر السريعة
# ==========================================

.PHONY: help dev prod gpu stop restart status logs build clean backup restore

# المتغيرات
DOCKER_COMPOSE = docker compose
SCRIPTS_DIR = ./scripts

# الألوان
CYAN = \033[0;36m
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m

# المساعدة
help:
	@echo "$(CYAN)╔══════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║     🔍 نظام نظرة - أوامر Make المتاحة                    ║$(NC)"
	@echo "$(CYAN)╚══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)التشغيل:$(NC)"
	@echo "  make dev        - تشغيل في وضع التطوير"
	@echo "  make prod       - تشغيل في وضع الإنتاج"
	@echo "  make gpu        - تشغيل مع دعم GPU"
	@echo "  make full       - تشغيل كامل مع المراقبة"
	@echo ""
	@echo "$(GREEN)الإدارة:$(NC)"
	@echo "  make stop       - إيقاف جميع الخدمات"
	@echo "  make restart    - إعادة التشغيل"
	@echo "  make status     - عرض حالة الخدمات"
	@echo "  make logs       - عرض السجلات"
	@echo ""
	@echo "$(GREEN)البناء والتنظيف:$(NC)"
	@echo "  make build      - بناء صور Docker"
	@echo "  make clean      - تنظيف النظام"
	@echo ""
	@echo "$(GREEN)النسخ الاحتياطي:$(NC)"
	@echo "  make backup     - إنشاء نسخة احتياطية"
	@echo "  make restore    - استعادة من نسخة احتياطية"

# التشغيل في وضع التطوير
dev:
	@$(DOCKER_COMPOSE) up -d redis backend frontend
	@echo "$(GREEN)✓ تم التشغيل في وضع التطوير$(NC)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8000"

# التشغيل في وضع الإنتاج
prod:
	@$(DOCKER_COMPOSE) --profile production up -d
	@echo "$(GREEN)✓ تم التشغيل في وضع الإنتاج$(NC)"
	@echo "  الموقع: http://localhost"

# التشغيل مع GPU
gpu:
	@$(DOCKER_COMPOSE) --profile gpu up -d redis backend-gpu frontend
	@echo "$(GREEN)✓ تم التشغيل مع دعم GPU$(NC)"

# التشغيل الكامل
full:
	@$(DOCKER_COMPOSE) --profile production --profile monitoring up -d
	@echo "$(GREEN)✓ تم التشغيل الكامل$(NC)"

# الإيقاف
stop:
	@$(DOCKER_COMPOSE) --profile production --profile monitoring --profile gpu down
	@echo "$(GREEN)✓ تم إيقاف جميع الخدمات$(NC)"

# إعادة التشغيل
restart: stop dev

# الحالة
status:
	@$(DOCKER_COMPOSE) ps

# السجلات
logs:
	@$(DOCKER_COMPOSE) logs -f --tail=100

logs-backend:
	@$(DOCKER_COMPOSE) logs -f --tail=100 backend

logs-frontend:
	@$(DOCKER_COMPOSE) logs -f --tail=100 frontend

# البناء
build:
	@$(DOCKER_COMPOSE) build --no-cache
	@echo "$(GREEN)✓ تم بناء الصور$(NC)"

build-backend:
	@$(DOCKER_COMPOSE) build --no-cache backend
	@echo "$(GREEN)✓ تم بناء Backend$(NC)"

build-frontend:
	@$(DOCKER_COMPOSE) build --no-cache frontend
	@echo "$(GREEN)✓ تم بناء Frontend$(NC)"

# التنظيف
clean:
	@echo "$(YELLOW)⚠ هذا سيحذف جميع الحاويات والـ volumes!$(NC)"
	@read -p "هل أنت متأكد؟ (y/N) " confirm && [ "$$confirm" = "y" ] && \
		$(DOCKER_COMPOSE) --profile production --profile monitoring --profile gpu down -v --remove-orphans && \
		docker system prune -f && \
		echo "$(GREEN)✓ تم التنظيف$(NC)" || \
		echo "تم الإلغاء"

# النسخ الاحتياطي
backup:
	@chmod +x $(SCRIPTS_DIR)/backup.sh
	@$(SCRIPTS_DIR)/backup.sh

# الاستعادة
restore:
	@chmod +x $(SCRIPTS_DIR)/restore.sh
	@echo "استخدم: make restore FILE=path/to/backup.tar.gz"
ifdef FILE
	@$(SCRIPTS_DIR)/restore.sh $(FILE)
endif

# إعداد البيئة
setup:
	@chmod +x $(SCRIPTS_DIR)/*.sh
	@cp -n .env.example .env 2>/dev/null || true
	@mkdir -p backend/data backend/models backend/uploads backend/alerts
	@mkdir -p nginx/conf.d nginx/ssl
	@mkdir -p monitoring/grafana/dashboards
	@echo "$(GREEN)✓ تم إعداد البيئة$(NC)"

# اختبار الصحة
health:
	@echo "فحص صحة الخدمات..."
	@curl -s http://localhost:8000/api/health || echo "Backend غير متاح"
	@curl -s http://localhost:3000 > /dev/null && echo "Frontend متاح" || echo "Frontend غير متاح"
