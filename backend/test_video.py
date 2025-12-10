#!/usr/bin/env python3
"""
اختبار الكشف على فيديو
Video Detection Test Script
"""

import cv2
import time
from pathlib import Path
from ultralytics import YOLO

# تحميل النموذج
MODEL_PATH = Path(__file__).parent / "models" / "best.pt"
VIDEO_PATH = Path(__file__).parent / "test_videos" / "sample_weapon.mp4"

print("🚀 جاري تحميل نموذج YOLO...")
model = YOLO(str(MODEL_PATH))
print(f"✅ تم التحميل! الفئات: {model.names}")

# فتح الفيديو
cap = cv2.VideoCapture(str(VIDEO_PATH))
if not cap.isOpened():
    print(f"❌ لا يمكن فتح الفيديو: {VIDEO_PATH}")
    exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"📹 الفيديو: {fps:.1f} FPS, {frame_count} إطار")

# إنشاء مجلد للنتائج
output_dir = Path(__file__).parent / "test_output"
output_dir.mkdir(exist_ok=True)

frame_num = 0
detections_count = 0
start_time = time.time()

print("\n🔍 جاري تحليل الفيديو...")
print("-" * 50)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    frame_num += 1
    
    # كشف كل 5 إطارات
    if frame_num % 5 == 0:
        results = model(frame, conf=0.5, verbose=False)
        
        for result in results:
            if result.boxes and len(result.boxes) > 0:
                for box in result.boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = model.names[cls]
                    
                    detections_count += 1
                    print(f"⚠️  إطار {frame_num}: {class_name} ({conf*100:.1f}%)")
                    
                    # حفظ الإطار مع الكشف
                    annotated = result.plot()
                    output_path = output_dir / f"detection_{frame_num}_{class_name}.jpg"
                    cv2.imwrite(str(output_path), annotated)

cap.release()

elapsed = time.time() - start_time
print("-" * 50)
print(f"\n📊 النتائج:")
print(f"   • الإطارات المعالجة: {frame_num}")
print(f"   • عدد الكشوفات: {detections_count}")
print(f"   • الوقت: {elapsed:.2f} ثانية")
print(f"   • السرعة: {frame_num/elapsed:.1f} FPS")

if detections_count > 0:
    print(f"\n📁 تم حفظ صور الكشف في: {output_dir}")
else:
    print("\n✅ لم يتم اكتشاف أسلحة في هذا الفيديو")
    print("   جرب استخدام فيديو يحتوي على أسلحة للاختبار")
