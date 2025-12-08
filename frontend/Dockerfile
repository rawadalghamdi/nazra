# ==========================================
# نظام نظرة - Frontend Dockerfile
# منصة الكشف الاستباقي عن الأسلحة بالذكاء الاصطناعي
# ==========================================
# Multi-stage build للحصول على أصغر حجم ممكن
# ==========================================

# ------------------------------------------
# المرحلة 1: التبعيات
# ------------------------------------------
FROM node:20-alpine AS deps

# تفعيل corepack لـ pnpm/yarn
RUN corepack enable

WORKDIR /app

# نسخ ملفات الحزم فقط للاستفادة من التخزين المؤقت
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# تثبيت التبعيات
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
  else npm install; \
  fi

# ------------------------------------------
# المرحلة 2: البناء
# ------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# نسخ التبعيات من المرحلة السابقة
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# متغيرات البيئة للبناء
ARG VITE_API_URL=http://localhost:8000/api
ARG VITE_WS_URL=ws://localhost:8000/ws
ARG NODE_ENV=production

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV NODE_ENV=$NODE_ENV

# بناء التطبيق
RUN npm run build

# ------------------------------------------
# المرحلة 3: الإنتاج
# ------------------------------------------
FROM nginx:1.25-alpine AS production

# معلومات الصورة
LABEL maintainer="Nazra Team"
LABEL description="Nazra Frontend - Weapon Detection Platform"
LABEL version="1.0.0"

# تثبيت الأدوات المساعدة
RUN apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# إعداد المنطقة الزمنية
ENV TZ=Asia/Riyadh

# حذف الإعدادات الافتراضية
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# نسخ الملفات المبنية
COPY --from=builder /app/dist /usr/share/nginx/html

# نسخ إعدادات nginx المخصصة
COPY nginx.conf /etc/nginx/conf.d/default.conf

# إنشاء مستخدم غير root
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx-app nginx-app && \
    chown -R nginx-app:nginx-app /var/cache/nginx /var/log/nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    # إنشاء المجلدات اللازمة
    mkdir -p /var/run/nginx && \
    chown -R nginx-app:nginx-app /var/run/nginx

# إعداد الصلاحيات لملف nginx.pid
RUN touch /var/run/nginx.pid && \
    chown nginx-app:nginx-app /var/run/nginx.pid

# فتح المنفذ
EXPOSE 80

# فحص الصحة
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80 || exit 1

# تشغيل nginx
CMD ["nginx", "-g", "daemon off;"]
