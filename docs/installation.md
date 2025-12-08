<div dir="rtl" align="right">

# 🛠️ دليل التثبيت المفصل

دليل شامل لتثبيت وتكوين نظام نظرة على مختلف البيئات.

---

## 📑 المحتويات

- [المتطلبات](#المتطلبات)
- [التثبيت السريع مع Docker](#التثبيت-السريع-مع-docker)
- [التثبيت اليدوي](#التثبيت-اليدوي)
- [التثبيت على Ubuntu Server](#التثبيت-على-ubuntu-server)
- [التثبيت مع GPU](#التثبيت-مع-gpu)
- [إعداد بيئة الإنتاج](#إعداد-بيئة-الإنتاج)
- [التحقق من التثبيت](#التحقق-من-التثبيت)

---

## 📋 المتطلبات

### متطلبات الأجهزة

#### الحد الأدنى (تطوير/اختبار)
```
المعالج: Intel Core i5 / AMD Ryzen 5 (4 أنوية)
الذاكرة: 8 GB RAM
التخزين: 50 GB SSD
الشبكة: 100 Mbps
```

#### الموصى به (إنتاج)
```
المعالج: Intel Core i7/i9 / AMD Ryzen 7/9 (8+ أنوية)
الذاكرة: 16-32 GB RAM
التخزين: 200+ GB NVMe SSD
كرت شاشة: NVIDIA RTX 3060+ (8+ GB VRAM)
الشبكة: 1 Gbps
```

### متطلبات البرمجيات

| البرنامج | الإصدار المطلوب | ملاحظات |
|---------|----------------|---------|
| Docker | 20.10+ | مطلوب |
| Docker Compose | 2.0+ | مطلوب |
| Git | 2.30+ | مطلوب |
| Python | 3.11+ | للتطوير اليدوي |
| Node.js | 18+ | للتطوير اليدوي |
| NVIDIA Driver | 535+ | مع GPU فقط |
| CUDA | 12.0+ | مع GPU فقط |

---

## 🐳 التثبيت السريع مع Docker

### الخطوة 1: تثبيت Docker

#### macOS
```bash
# تحميل Docker Desktop من الموقع الرسمي
# https://www.docker.com/products/docker-desktop

# أو باستخدام Homebrew
brew install --cask docker
```

#### Ubuntu/Debian
```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت المتطلبات
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# إضافة مفتاح Docker GPG
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# إضافة مستودع Docker
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# تثبيت Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# إضافة المستخدم لمجموعة Docker
sudo usermod -aG docker $USER

# تفعيل Docker
sudo systemctl enable docker
sudo systemctl start docker

# إعادة تسجيل الدخول لتطبيق التغييرات
newgrp docker
```

#### Windows
```powershell
# تحميل Docker Desktop من الموقع الرسمي
# https://www.docker.com/products/docker-desktop

# تأكد من تفعيل WSL 2
wsl --install
```

### الخطوة 2: استنساخ المشروع

```bash
# استنساخ المشروع
git clone https://github.com/your-org/nazra.git
cd nazra

# أو تحميل الملف المضغوط
# wget https://github.com/your-org/nazra/archive/main.zip
# unzip main.zip && cd nazra-main
```

### الخطوة 3: إعداد ملف البيئة

```bash
# نسخ ملف البيئة النموذجي
cp .env.example .env

# تعديل الإعدادات
nano .env  # أو استخدم أي محرر آخر
```

**إعدادات .env الأساسية:**
```bash
# ========================================
# إعدادات نظام نظرة
# ========================================

# وضع التشغيل
DEBUG=false
LOG_LEVEL=INFO

# الأمان - مهم: غيّر هذه القيم في الإنتاج!
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key-change-this

# قاعدة البيانات
DATABASE_URL=sqlite+aiosqlite:///./data/nazra.db

# Redis (اختياري)
REDIS_URL=redis://redis:6379

# الكشف
DETECTION_THRESHOLD=0.7
NMS_THRESHOLD=0.4

# البث
STREAM_FPS=15
STREAM_QUALITY=medium
```

### الخطوة 4: بناء وتشغيل الحاويات

```bash
# بناء الصور
docker-compose build

# تشغيل جميع الخدمات
docker-compose up -d

# عرض السجلات
docker-compose logs -f

# التحقق من حالة الخدمات
docker-compose ps
```

### الخطوة 5: الوصول للنظام

```
واجهة المستخدم: http://localhost:3000
API: http://localhost:8000/api/v1
التوثيق: http://localhost:8000/api/v1/docs
```

---

## 🔧 التثبيت اليدوي

### Backend (Python)

#### الخطوة 1: تثبيت Python

```bash
# macOS
brew install python@3.11

# Ubuntu
sudo apt install python3.11 python3.11-venv python3.11-dev

# تحقق من الإصدار
python3.11 --version
```

#### الخطوة 2: إعداد البيئة الافتراضية

```bash
cd nazra/backend

# إنشاء البيئة الافتراضية
python3.11 -m venv .venv

# تفعيل البيئة
source .venv/bin/activate  # Linux/macOS
# أو
.venv\Scripts\activate     # Windows

# تحديث pip
pip install --upgrade pip
```

#### الخطوة 3: تثبيت المتطلبات

```bash
# تثبيت المتطلبات الأساسية
pip install -r requirements.txt

# للتطوير
pip install -r requirements-dev.txt  # إذا موجود
```

#### الخطوة 4: إعداد قاعدة البيانات

```bash
# إنشاء المجلدات المطلوبة
mkdir -p data models uploads alerts snapshots

# تشغيل الهجرات (إذا موجودة)
# alembic upgrade head
```

#### الخطوة 5: تشغيل الخادم

```bash
# وضع التطوير
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# وضع الإنتاج
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend (React/TypeScript)

#### الخطوة 1: تثبيت Node.js

```bash
# macOS
brew install node@18

# Ubuntu (باستخدام nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# تحقق من الإصدار
node --version
npm --version
```

#### الخطوة 2: تثبيت المتطلبات

```bash
cd nazra/frontend

# تثبيت المتطلبات
npm install

# أو باستخدام yarn
yarn install
```

#### الخطوة 3: إعداد متغيرات البيئة

```bash
# إنشاء ملف .env.local
cat > .env.local << EOF
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
EOF
```

#### الخطوة 4: تشغيل خادم التطوير

```bash
# وضع التطوير
npm run dev

# بناء للإنتاج
npm run build

# معاينة البناء
npm run preview
```

---

## 🖥️ التثبيت على Ubuntu Server

### سكريبت التثبيت الكامل

```bash
#!/bin/bash
# install-nazra.sh
# سكريبت تثبيت نظام نظرة على Ubuntu Server

set -e

echo "=========================================="
echo "🚀 بدء تثبيت نظام نظرة"
echo "=========================================="

# تحديث النظام
echo "📦 تحديث النظام..."
sudo apt update && sudo apt upgrade -y

# تثبيت المتطلبات الأساسية
echo "📦 تثبيت المتطلبات..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common

# تثبيت Docker
echo "🐳 تثبيت Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# تثبيت Docker Compose
echo "🐳 تثبيت Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# استنساخ المشروع
echo "📥 تحميل نظام نظرة..."
cd /opt
sudo git clone https://github.com/your-org/nazra.git
sudo chown -R $USER:$USER nazra
cd nazra

# إعداد ملف البيئة
echo "⚙️ إعداد ملف البيئة..."
cp .env.example .env

# توليد مفاتيح آمنة
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env
sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$JWT_SECRET/" .env

# بناء وتشغيل
echo "🏗️ بناء الحاويات..."
docker-compose build

echo "🚀 تشغيل الخدمات..."
docker-compose up -d

# إعداد الخدمة للتشغيل التلقائي
echo "⚙️ إعداد التشغيل التلقائي..."
sudo cat > /etc/systemd/system/nazra.service << EOF
[Unit]
Description=Nazra Weapon Detection System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/nazra
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable nazra

echo "=========================================="
echo "✅ تم تثبيت نظام نظرة بنجاح!"
echo "=========================================="
echo "واجهة المستخدم: http://$(hostname -I | awk '{print $1}'):3000"
echo "API: http://$(hostname -I | awk '{print $1}'):8000/api/v1"
echo "=========================================="
```

### تشغيل سكريبت التثبيت

```bash
# تحميل السكريبت
wget https://raw.githubusercontent.com/your-org/nazra/main/scripts/install.sh

# منح صلاحيات التنفيذ
chmod +x install.sh

# تشغيل التثبيت
./install.sh
```

---

## 🎮 التثبيت مع GPU

### متطلبات GPU

- كرت NVIDIA GTX 1060 أو أعلى
- VRAM: 6 GB كحد أدنى (8+ GB مُوصى)
- NVIDIA Driver 535+
- CUDA 12.0+

### الخطوة 1: تثبيت NVIDIA Driver

```bash
# Ubuntu
sudo apt install nvidia-driver-535

# إعادة التشغيل
sudo reboot

# التحقق
nvidia-smi
```

### الخطوة 2: تثبيت NVIDIA Container Toolkit

```bash
# إضافة المستودع
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# تثبيت
sudo apt update
sudo apt install -y nvidia-container-toolkit

# إعادة تشغيل Docker
sudo systemctl restart docker
```

### الخطوة 3: تشغيل مع GPU

```bash
# استخدام Profile الـ GPU
docker-compose --profile gpu up -d

# أو تشغيل الخدمة مع GPU يدوياً
docker run --gpus all nazra-backend
```

### الخطوة 4: التحقق من GPU

```bash
# داخل الحاوية
docker exec -it nazra-backend python -c "import torch; print(torch.cuda.is_available())"
# يجب أن تظهر: True
```

---

## 🏭 إعداد بيئة الإنتاج

### 1. إعداد HTTPS مع Nginx

```nginx
# /etc/nginx/sites-available/nazra
server {
    listen 80;
    server_name nazra.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nazra.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/nazra.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nazra.yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### 2. إعداد SSL مع Let's Encrypt

```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx

# الحصول على شهادة
sudo certbot --nginx -d nazra.yourdomain.com

# التجديد التلقائي
sudo crontab -e
# أضف السطر التالي:
0 0 1 * * certbot renew --quiet
```

### 3. إعداد Firewall

```bash
# UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# أو iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### 4. إعداد النسخ الاحتياطي

```bash
# إنشاء سكريبت النسخ الاحتياطي
cat > /opt/nazra/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/nazra"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# نسخ قاعدة البيانات
docker exec nazra-backend sqlite3 /app/data/nazra.db ".backup '/tmp/nazra_$DATE.db'"
docker cp nazra-backend:/tmp/nazra_$DATE.db $BACKUP_DIR/

# نسخ الملفات
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/nazra/backend/uploads
tar -czf $BACKUP_DIR/alerts_$DATE.tar.gz /opt/nazra/backend/alerts

# حذف النسخ القديمة (أكثر من 7 أيام)
find $BACKUP_DIR -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/nazra/backup.sh

# جدولة النسخ الاحتياطي اليومي
echo "0 2 * * * /opt/nazra/backup.sh" | sudo crontab -
```

---

## ✅ التحقق من التثبيت

### 1. فحص الخدمات

```bash
# التحقق من حالة الحاويات
docker-compose ps

# يجب أن تظهر جميع الخدمات بحالة "Up"
```

### 2. اختبار API

```bash
# اختبار نقطة النهاية الرئيسية
curl http://localhost:8000/api/v1/

# يجب أن تُرجع:
# {"message": "مرحباً بك في نظام نظرة"}
```

### 3. اختبار الواجهة

```bash
# افتح المتصفح على
http://localhost:3000

# يجب أن تظهر لوحة التحكم
```

### 4. اختبار WebSocket

```javascript
// في وحدة التحكم بالمتصفح
const ws = new WebSocket('ws://localhost:8000/ws/alerts');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### 5. اختبار الكشف

```bash
# إضافة كاميرا اختبارية
curl -X POST "http://localhost:8000/api/v1/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "كاميرا اختبار",
    "location": "اختبار",
    "rtsp_url": "rtsp://test:test@example.com/stream"
  }'
```

---

## ❓ الأسئلة الشائعة

### س: كم من الوقت يستغرق التثبيت؟
**ج:** حوالي 10-15 دقيقة مع Docker، و30-45 دقيقة للتثبيت اليدوي.

### س: هل يمكن التثبيت بدون Docker؟
**ج:** نعم، راجع قسم [التثبيت اليدوي](#التثبيت-اليدوي).

### س: هل GPU مطلوب؟
**ج:** لا، لكنه يُحسّن الأداء بشكل كبير (5-10x أسرع).

### س: كم كاميرا يمكن ربطها؟
**ج:** يعتمد على الموارد. مع الحد الأدنى: 2-4 كاميرات. مع الموصى به: 10-20 كاميرا.

---

<p align="center">
  <a href="../README.md">🏠 الصفحة الرئيسية</a> •
  <a href="camera-setup.md">📷 دليل الكاميرات</a> •
  <a href="troubleshooting.md">🔧 استكشاف الأخطاء</a>
</p>

</div>
