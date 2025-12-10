#!/usr/bin/env python3
"""
اختبار سرعة الكشف على Mac M4 مع MPS
====================================
"""

import time
import sys

print("🍎 اختبار YOLO على Mac M4 مع Metal Performance Shaders")
print("=" * 60)

# التحقق من PyTorch و MPS
try:
    import torch
    print(f"✅ PyTorch: {torch.__version__}")
    
    # التحقق من MPS
    if torch.backends.mps.is_available():
        print("✅ MPS (Metal) متاح!")
        device = "mps"
    else:
        print("⚠️ MPS غير متاح، استخدام CPU")
        device = "cpu"
        
except ImportError:
    print("❌ PyTorch غير مثبت")
    print("   قم بتشغيل: pip install torch torchvision")
    sys.exit(1)

# التحقق من ultralytics
try:
    from ultralytics import YOLO
    print("✅ Ultralytics YOLO متاح")
except ImportError:
    print("❌ ultralytics غير مثبت")
    print("   قم بتشغيل: pip install ultralytics")
    sys.exit(1)

# تحميل النموذج
model_path = "./backend/models/best.pt"
print(f"\n📥 تحميل النموذج: {model_path}")

try:
    model = YOLO(model_path)
    print(f"✅ تم تحميل النموذج")
    print(f"   فئات: {model.names}")
except Exception as e:
    print(f"❌ خطأ في تحميل النموذج: {e}")
    sys.exit(1)

# اختبار على صورة
import cv2
import numpy as np

# إنشاء صورة اختبار
test_image = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)

print(f"\n🧪 اختبار الكشف على صورة 1920x1080...")
print(f"   الجهاز: {device}")

# تسخين
print("   تسخين النموذج...")
_ = model(test_image, device=device, verbose=False)

# اختبار السرعة
num_tests = 20
times = []

print(f"   تشغيل {num_tests} اختبار...")
for i in range(num_tests):
    start = time.time()
    results = model(test_image, device=device, verbose=False)
    elapsed = time.time() - start
    times.append(elapsed)
    print(f"   [{i+1}/{num_tests}] {elapsed*1000:.1f}ms", end="\r")

print()

# النتائج
avg_time = sum(times) / len(times)
min_time = min(times)
max_time = max(times)
fps = 1.0 / avg_time

print("\n" + "=" * 60)
print("📊 النتائج:")
print(f"   متوسط الوقت: {avg_time*1000:.1f} ms")
print(f"   أقل وقت: {min_time*1000:.1f} ms")
print(f"   أعلى وقت: {max_time*1000:.1f} ms")
print(f"   FPS: {fps:.1f}")
print("=" * 60)

if fps >= 30:
    print("🎉 ممتاز! يمكن معالجة 30 FPS في الوقت الحقيقي!")
elif fps >= 15:
    print("✅ جيد! يمكن معالجة 15 FPS")
elif fps >= 6:
    print("⚠️ متوسط - استخدم frame skipping للحصول على 30 FPS")
else:
    print("❌ بطيء - يُنصح باستخدام frame skipping كبير")

# اقتراحات
print("\n💡 الإعدادات المقترحة:")
if fps >= 30:
    skip = 1
elif fps >= 15:
    skip = 2
elif fps >= 10:
    skip = 3
elif fps >= 6:
    skip = 5
else:
    skip = 10

target_detection_fps = 30 / skip
print(f"   skip_frames: {skip}")
print(f"   detection_fps: ~{target_detection_fps:.0f}")
print(f"   display_fps: 30")
