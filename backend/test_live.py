#!/usr/bin/env python3
"""
اختبار الكشف مع كاميرا MacBook أو فيديو
========================================
"""

import cv2
import time
import sys
import os

# إضافة مسار المشروع
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_webcam():
    """اختبار مع كاميرا MacBook"""
    print("🎥 اختبار الكشف مع كاميرا MacBook")
    print("=" * 50)
    
    # تحميل النموذج
    try:
        from ultralytics import YOLO
        model = YOLO('./models/best.pt')
        print(f"✅ تم تحميل النموذج")
        print(f"   الفئات: {model.names}")
    except Exception as e:
        print(f"❌ خطأ في تحميل النموذج: {e}")
        return
    
    # فتح الكاميرا
    print("\n📹 جاري فتح الكاميرا...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ لم يتم العثور على كاميرا")
        print("   جرب تشغيل السكريبت من Terminal مباشرة")
        return
    
    # إعدادات الكاميرا
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    print("✅ الكاميرا جاهزة!")
    print("\n⌨️ الأوامر:")
    print("   - اضغط 'q' للخروج")
    print("   - اضغط 's' لحفظ لقطة")
    print("   - اضغط 'd' لتفعيل/إلغاء الكشف")
    print()
    
    detection_enabled = True
    frame_count = 0
    detection_count = 0
    fps_start = time.time()
    fps = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌ فشل قراءة الإطار")
            break
        
        frame_count += 1
        
        # حساب FPS
        if frame_count % 30 == 0:
            fps = 30 / (time.time() - fps_start)
            fps_start = time.time()
        
        # الكشف
        if detection_enabled and frame_count % 3 == 0:  # كل 3 إطارات
            results = model(frame, conf=0.5, device='mps', verbose=False)
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # رسم المربع
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        conf = float(box.conf[0])
                        cls = int(box.cls[0])
                        name = model.names[cls]
                        
                        # اللون حسب النوع
                        color = (0, 0, 255) if 'hand' in name.lower() else (0, 128, 255)
                        
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                        
                        # النص
                        label = f"{name}: {conf:.0%}"
                        (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
                        cv2.rectangle(frame, (x1, y1-h-10), (x1+w+10, y1), color, -1)
                        cv2.putText(frame, label, (x1+5, y1-5), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
                        
                        detection_count += 1
                        print(f"🚨 كشف: {name} - الثقة: {conf:.0%}")
        
        # إضافة معلومات
        info = f"FPS: {fps:.1f} | Detections: {detection_count} | Detection: {'ON' if detection_enabled else 'OFF'}"
        cv2.putText(frame, info, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # عرض
        cv2.imshow('Nazra Detection Test - Press Q to quit', frame)
        
        # الأوامر
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            filename = f"snapshot_{int(time.time())}.jpg"
            cv2.imwrite(filename, frame)
            print(f"📸 تم حفظ: {filename}")
        elif key == ord('d'):
            detection_enabled = not detection_enabled
            print(f"🔄 الكشف: {'مفعّل' if detection_enabled else 'معطّل'}")
    
    cap.release()
    cv2.destroyAllWindows()
    print(f"\n📊 الإحصائيات:")
    print(f"   - إجمالي الإطارات: {frame_count}")
    print(f"   - إجمالي الكشوفات: {detection_count}")


def test_video(video_path: str):
    """اختبار مع ملف فيديو"""
    print(f"🎬 اختبار الكشف مع فيديو: {video_path}")
    print("=" * 50)
    
    if not os.path.exists(video_path):
        print(f"❌ الملف غير موجود: {video_path}")
        return
    
    # تحميل النموذج
    try:
        from ultralytics import YOLO
        model = YOLO('./models/best.pt')
        print(f"✅ تم تحميل النموذج")
    except Exception as e:
        print(f"❌ خطأ: {e}")
        return
    
    # فتح الفيديو
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("❌ فشل فتح الفيديو")
        return
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"📹 الفيديو: {total_frames} إطار @ {fps} FPS")
    
    frame_count = 0
    detection_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        
        # الكشف كل 5 إطارات
        if frame_count % 5 == 0:
            results = model(frame, conf=0.5, device='mps', verbose=False)
            
            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        conf = float(box.conf[0])
                        cls = int(box.cls[0])
                        name = model.names[cls]
                        
                        color = (0, 0, 255) if 'hand' in name.lower() else (0, 128, 255)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                        
                        label = f"{name}: {conf:.0%}"
                        cv2.putText(frame, label, (x1, y1-10), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                        
                        detection_count += 1
                        print(f"🚨 Frame {frame_count}: {name} ({conf:.0%})")
        
        # Progress
        progress = f"Frame: {frame_count}/{total_frames}"
        cv2.putText(frame, progress, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)
        
        cv2.imshow('Video Detection - Press Q to quit', frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    print(f"\n📊 النتائج: {detection_count} كشف في {frame_count} إطار")


def test_image(image_path: str):
    """اختبار مع صورة"""
    print(f"🖼️ اختبار الكشف مع صورة: {image_path}")
    
    if not os.path.exists(image_path):
        print(f"❌ الملف غير موجود")
        return
    
    from ultralytics import YOLO
    model = YOLO('./models/best.pt')
    
    # قراءة الصورة
    img = cv2.imread(image_path)
    
    # الكشف
    results = model(img, conf=0.5, device='mps')
    
    # رسم النتائج
    annotated = results[0].plot()
    
    # حفظ النتيجة
    output_path = image_path.replace('.', '_detected.')
    cv2.imwrite(output_path, annotated)
    print(f"✅ تم حفظ النتيجة: {output_path}")
    
    # عرض
    cv2.imshow('Detection Result - Press any key', annotated)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("   🎯 نظام نظرة - اختبار الكشف")
    print("=" * 50 + "\n")
    
    print("اختر وضع الاختبار:")
    print("1. كاميرا MacBook (المدمجة)")
    print("2. ملف فيديو")
    print("3. صورة")
    print()
    
    choice = input("اختيارك (1/2/3): ").strip()
    
    if choice == "1":
        test_webcam()
    elif choice == "2":
        path = input("مسار الفيديو: ").strip()
        if path:
            test_video(path)
        else:
            print("لم يتم إدخال مسار")
    elif choice == "3":
        path = input("مسار الصورة: ").strip()
        if path:
            test_image(path)
        else:
            print("لم يتم إدخال مسار")
    else:
        print("اختيار غير صحيح")
