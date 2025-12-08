<div dir="rtl" align="right">

# 📚 مرجع API

التوثيق الكامل لواجهة برمجة التطبيقات (API) لنظام نظرة.

---

## 📑 المحتويات

- [معلومات عامة](#معلومات-عامة)
- [المصادقة](#المصادقة)
- [الكاميرات](#الكاميرات)
- [التنبيهات](#التنبيهات)
- [WebSocket](#websocket)
- [أكواد الأخطاء](#أكواد-الأخطاء)

---

## 🌐 معلومات عامة

### Base URL
```
http://localhost:8000/api/v1
```

### الإنتاج
```
https://your-domain.com/api/v1
```

### Content-Type
```
Content-Type: application/json
Accept: application/json
```

### الترميز
- جميع الاستجابات بترميز UTF-8
- التواريخ بصيغة ISO 8601 (مثال: `2024-01-15T10:30:00Z`)

---

## 🔐 المصادقة

### الحصول على Token

```http
POST /api/v1/auth/login
```

**الطلب:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**الاستجابة:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### استخدام Token
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 📷 الكاميرات

### جلب جميع الكاميرات

```http
GET /api/v1/cameras
```

**الاستجابة:**
```json
[
  {
    "id": "cam-001",
    "name": "كاميرا المدخل الرئيسي",
    "location": "البوابة الرئيسية",
    "rtsp_url": "rtsp://admin:***@192.168.1.100:554/stream1",
    "onvif_host": "192.168.1.100",
    "onvif_port": 80,
    "status": "online",
    "is_recording": false,
    "detection_enabled": true,
    "sensitivity": 0.7,
    "last_seen": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### جلب كاميرا محددة

```http
GET /api/v1/cameras/{camera_id}
```

**المعاملات:**
| المعامل | النوع | مطلوب | الوصف |
|---------|-------|-------|-------|
| `camera_id` | string | ✅ | معرف الكاميرا |

**الاستجابة:** نفس بنية الكاميرا أعلاه

**أخطاء:**
| الكود | الرسالة |
|-------|---------|
| 404 | الكاميرا غير موجودة |

---

### إضافة كاميرا جديدة

```http
POST /api/v1/cameras
```

**الطلب:**
```json
{
  "name": "كاميرا المدخل الرئيسي",
  "location": "البوابة الرئيسية",
  "rtsp_url": "rtsp://admin:password@192.168.1.100:554/stream1",
  "onvif_host": "192.168.1.100",
  "onvif_port": 80,
  "onvif_user": "admin",
  "onvif_password": "password",
  "detection_enabled": true,
  "sensitivity": 0.7
}
```

**حقول الطلب:**
| الحقل | النوع | مطلوب | الوصف |
|-------|-------|-------|-------|
| `name` | string | ✅ | اسم الكاميرا (1-100 حرف) |
| `location` | string | ✅ | موقع الكاميرا (حتى 200 حرف) |
| `rtsp_url` | string | ❌ | رابط RTSP |
| `onvif_host` | string | ❌ | عنوان ONVIF |
| `onvif_port` | integer | ❌ | منفذ ONVIF (1-65535، الافتراضي 80) |
| `onvif_user` | string | ❌ | مستخدم ONVIF |
| `onvif_password` | string | ❌ | كلمة مرور ONVIF |
| `detection_enabled` | boolean | ❌ | تفعيل الكشف (الافتراضي true) |
| `sensitivity` | float | ❌ | حساسية الكشف (0-1، الافتراضي 0.7) |

**الاستجابة:** `201 Created` مع بيانات الكاميرا

**أخطاء:**
| الكود | الرسالة |
|-------|---------|
| 400 | بيانات غير صالحة |
| 500 | حدث خطأ أثناء إضافة الكاميرا |

---

### تحديث كاميرا

```http
PUT /api/v1/cameras/{camera_id}
```

**الطلب:** (جميع الحقول اختيارية)
```json
{
  "name": "كاميرا المدخل - محدث",
  "sensitivity": 0.8
}
```

**الاستجابة:** بيانات الكاميرا المُحدثة

**أخطاء:**
| الكود | الرسالة |
|-------|---------|
| 404 | الكاميرا غير موجودة |
| 400 | بيانات غير صالحة |

---

### حذف كاميرا

```http
DELETE /api/v1/cameras/{camera_id}
```

**الاستجابة:** `204 No Content`

**أخطاء:**
| الكود | الرسالة |
|-------|---------|
| 404 | الكاميرا غير موجودة |

> ⚠️ **تحذير**: حذف الكاميرا سيحذف جميع التنبيهات المرتبطة بها.

---

### اختبار اتصال الكاميرا

```http
POST /api/v1/cameras/{camera_id}/test
```

**الاستجابة:**
```json
{
  "success": true,
  "latency_ms": 45.2,
  "message": "الاتصال ناجح",
  "details": {
    "resolution": "1920x1080",
    "fps": 25,
    "codec": "H.264"
  }
}
```

**في حالة الفشل:**
```json
{
  "success": false,
  "latency_ms": null,
  "message": "فشل الاتصال: Connection refused",
  "details": null
}
```

---

### حالة الكاميرا

```http
GET /api/v1/cameras/{camera_id}/status
```

**الاستجابة:**
```json
{
  "camera_id": "cam-001",
  "status": "online",
  "is_recording": false,
  "last_frame_time": "2024-01-15T10:30:00Z",
  "fps": 24.5,
  "latency_ms": 32,
  "detection_active": true,
  "alerts_today": 5
}
```

**حالات الكاميرا:**
| الحالة | الوصف |
|--------|-------|
| `online` | متصلة وتعمل |
| `offline` | غير متصلة |
| `error` | خطأ في الاتصال |
| `maintenance` | في وضع الصيانة |

---

## 🚨 التنبيهات

### جلب التنبيهات

```http
GET /api/v1/alerts
```

**معاملات الاستعلام:**
| المعامل | النوع | الافتراضي | الوصف |
|---------|-------|----------|-------|
| `status` | string | - | تصفية حسب الحالة |
| `camera_id` | string | - | تصفية حسب الكاميرا |
| `weapon_type` | string | - | تصفية حسب نوع السلاح |
| `date_from` | string | - | من تاريخ (ISO format) |
| `date_to` | string | - | إلى تاريخ (ISO format) |
| `page` | integer | 1 | رقم الصفحة |
| `limit` | integer | 20 | عدد العناصر (1-100) |

**مثال:**
```http
GET /api/v1/alerts?status=جديد&page=1&limit=10
```

**الاستجابة:**
```json
{
  "alerts": [
    {
      "id": "alert-001",
      "camera_id": "cam-001",
      "camera_name": "كاميرا المدخل الرئيسي",
      "location": "البوابة الرئيسية",
      "weapon_type": "مسدس",
      "confidence": 0.92,
      "image_snapshot": "/api/v1/alerts/alert-001/image",
      "bounding_box": {
        "x": 120,
        "y": 80,
        "width": 50,
        "height": 30
      },
      "status": "جديد",
      "severity": "حرج",
      "timestamp": "2024-01-15T10:30:00Z",
      "reviewed_by": null,
      "reviewed_at": null,
      "notes": null,
      "video_clip": "/api/v1/alerts/alert-001/video"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10,
  "pages": 15
}
```

---

### جلب تنبيه محدد

```http
GET /api/v1/alerts/{alert_id}
```

**الاستجابة:** نفس بنية التنبيه أعلاه

**أخطاء:**
| الكود | الرسالة |
|-------|---------|
| 404 | التنبيه غير موجود |

---

### إحصائيات التنبيهات

```http
GET /api/v1/alerts/stats
```

**الاستجابة:**
```json
{
  "total_today": 25,
  "pending": 10,
  "confirmed": 8,
  "false_alarms": 5,
  "under_review": 2
}
```

**شرح الحقول:**
| الحقل | الوصف |
|-------|-------|
| `total_today` | إجمالي تنبيهات اليوم |
| `pending` | التنبيهات الجديدة (بانتظار المراجعة) |
| `confirmed` | التنبيهات المؤكدة |
| `false_alarms` | الإنذارات الكاذبة |
| `under_review` | قيد المراجعة حالياً |

---

### مراجعة تنبيه

```http
PUT /api/v1/alerts/{alert_id}/review
```

**الطلب:**
```json
{
  "status": "مؤكد",
  "notes": "تم التأكد من وجود سلاح ناري",
  "reviewed_by": "أحمد محمد"
}
```

**حقول الطلب:**
| الحقل | النوع | مطلوب | الوصف |
|-------|-------|-------|-------|
| `status` | string | ✅ | الحالة الجديدة |
| `notes` | string | ❌ | ملاحظات المراجعة |
| `reviewed_by` | string | ✅ | اسم المراجع |

**القيم الممكنة للحالة:**
- `قيد المراجعة`
- `مؤكد`
- `إنذار كاذب`

**الاستجابة:** التنبيه المُحدث

---

### جلب صورة التنبيه

```http
GET /api/v1/alerts/{alert_id}/image
```

**الاستجابة:** ملف صورة (JPEG/PNG)

**Headers:**
```
Content-Type: image/jpeg
Content-Disposition: inline; filename="alert-001.jpg"
```

---

### جلب فيديو التنبيه

```http
GET /api/v1/alerts/{alert_id}/video
```

**الاستجابة:** ملف فيديو (MP4)

**Headers:**
```
Content-Type: video/mp4
Content-Disposition: inline; filename="alert-001.mp4"
```

---

## 🔌 WebSocket

### التنبيهات المباشرة

```
ws://localhost:8000/ws/alerts
```

**الاتصال:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/alerts');

ws.onopen = () => {
  console.log('متصل بالتنبيهات المباشرة');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('تنبيه جديد:', data);
};
```

**رسائل الخادم:**

**تنبيه جديد:**
```json
{
  "type": "alert",
  "data": {
    "id": "alert-001",
    "camera_id": "cam-001",
    "camera_name": "كاميرا المدخل",
    "weapon_type": "مسدس",
    "confidence": 0.92,
    "timestamp": "2024-01-15T10:30:00Z",
    "image_url": "/api/v1/alerts/alert-001/image"
  }
}
```

**تحديث حالة النظام:**
```json
{
  "type": "status",
  "data": {
    "cameras_online": 5,
    "alerts_today": 12,
    "system_status": "متصل"
  }
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### بث الفيديو المعالج

```
ws://localhost:8000/ws/stream/{camera_id}
```

**الاتصال:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/stream/cam-001');

ws.onmessage = (event) => {
  // event.data يحتوي على إطار الفيديو بصيغة base64
  const data = JSON.parse(event.data);
  
  if (data.type === 'frame') {
    const img = document.getElementById('stream');
    img.src = 'data:image/jpeg;base64,' + data.frame;
  }
};
```

**رسائل الخادم:**

**إطار فيديو:**
```json
{
  "type": "frame",
  "camera_id": "cam-001",
  "frame": "base64_encoded_jpeg...",
  "timestamp": "2024-01-15T10:30:00.123Z",
  "detections": [
    {
      "type": "مسدس",
      "confidence": 0.85,
      "bbox": [120, 80, 170, 110]
    }
  ]
}
```

**خطأ:**
```json
{
  "type": "error",
  "message": "فشل الاتصال بالكاميرا",
  "code": "CAMERA_CONNECTION_ERROR"
}
```

---

## ⚠️ أكواد الأخطاء

### HTTP Status Codes

| الكود | الاسم | الوصف |
|-------|-------|-------|
| 200 | OK | نجاح |
| 201 | Created | تم الإنشاء بنجاح |
| 204 | No Content | نجاح بدون محتوى |
| 400 | Bad Request | طلب غير صالح |
| 401 | Unauthorized | غير مصرح |
| 403 | Forbidden | محظور |
| 404 | Not Found | غير موجود |
| 422 | Unprocessable Entity | بيانات غير قابلة للمعالجة |
| 500 | Internal Server Error | خطأ في الخادم |

### بنية رسالة الخطأ

```json
{
  "detail": "الكاميرا غير موجودة",
  "code": "CAMERA_NOT_FOUND",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### أكواد الأخطاء المخصصة

| الكود | الوصف |
|-------|-------|
| `CAMERA_NOT_FOUND` | الكاميرا غير موجودة |
| `CAMERA_CONNECTION_ERROR` | فشل الاتصال بالكاميرا |
| `ALERT_NOT_FOUND` | التنبيه غير موجود |
| `INVALID_RTSP_URL` | رابط RTSP غير صالح |
| `DETECTION_ERROR` | خطأ في عملية الكشف |
| `DATABASE_ERROR` | خطأ في قاعدة البيانات |

---

## 📝 أمثلة بلغات مختلفة

### Python
```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# جلب الكاميرات
response = requests.get(f"{BASE_URL}/cameras")
cameras = response.json()

# إضافة كاميرا
new_camera = {
    "name": "كاميرا جديدة",
    "location": "المدخل",
    "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/stream"
}
response = requests.post(f"{BASE_URL}/cameras", json=new_camera)
```

### JavaScript/TypeScript
```typescript
const BASE_URL = 'http://localhost:8000/api/v1';

// جلب الكاميرات
const cameras = await fetch(`${BASE_URL}/cameras`).then(r => r.json());

// إضافة كاميرا
const newCamera = await fetch(`${BASE_URL}/cameras`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'كاميرا جديدة',
    location: 'المدخل',
    rtsp_url: 'rtsp://admin:pass@192.168.1.100:554/stream'
  })
}).then(r => r.json());
```

### cURL
```bash
# جلب الكاميرات
curl -X GET "http://localhost:8000/api/v1/cameras"

# إضافة كاميرا
curl -X POST "http://localhost:8000/api/v1/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "كاميرا جديدة",
    "location": "المدخل",
    "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/stream"
  }'
```

---

## 🔗 روابط مفيدة

- **Swagger UI**: http://localhost:8000/api/v1/docs
- **ReDoc**: http://localhost:8000/api/v1/redoc
- **OpenAPI JSON**: http://localhost:8000/api/v1/openapi.json

---

<p align="center">
  <a href="../README.md">🏠 الصفحة الرئيسية</a> •
  <a href="camera-setup.md">📷 دليل الكاميرات</a> •
  <a href="troubleshooting.md">🔧 استكشاف الأخطاء</a>
</p>

</div>
