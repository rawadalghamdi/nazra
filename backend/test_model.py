#!/usr/bin/env python3
"""
اختبار نموذج YOLO - Absher Model
================================
سكريبت لاختبار نموذج الكشف عن الأسلحة
"""

import os
import sys

def test_model():
    """اختبار تحميل وتشغيل النموذج"""
    
    print("=" * 50)
    print("🔍 اختبار نموذج الكشف عن الأسلحة")
    print("=" * 50)
    
    # 1. التحقق من وجود ملف النموذج
    model_path = "./models/best.pt"
    
    if not os.path.exists(model_path):
        print(f"❌ النموذج غير موجود في: {model_path}")
        print("\n📥 يرجى تحميل best.pt من Google Drive ووضعه في مجلد models/")
        print(f"   المسار الكامل: {os.path.abspath(model_path)}")
        return False
    
    print(f"✅ تم العثور على النموذج: {model_path}")
    print(f"   حجم الملف: {os.path.getsize(model_path) / (1024*1024):.2f} MB")
    
    # 2. محاولة تحميل النموذج
    print("\n📦 جاري تحميل النموذج...")
    
    try:
        from ultralytics import YOLO
        model = YOLO(model_path)
        print("✅ تم تحميل النموذج بنجاح!")
    except ImportError:
        print("❌ مكتبة ultralytics غير مثبتة")
        print("   قم بتثبيتها: pip install ultralytics")
        return False
    except Exception as e:
        print(f"❌ خطأ في تحميل النموذج: {e}")
        return False
    
    # 3. عرض معلومات النموذج
    print("\n📊 معلومات النموذج:")
    print(f"   - نوع المهمة: {model.task}")
    
    # عرض الفئات المتاحة
    if hasattr(model, 'names') and model.names:
        print(f"   - عدد الفئات: {len(model.names)}")
        print("   - الفئات:")
        for idx, name in model.names.items():
            print(f"      {idx}: {name}")
    
    # 4. اختبار على صورة وهمية
    print("\n🧪 اختبار الكشف على صورة اختبارية...")
    
    try:
        import numpy as np
        
        # إنشاء صورة اختبارية (فارغة)
        test_image = np.zeros((640, 640, 3), dtype=np.uint8)
        
        # تشغيل الكشف
        results = model.predict(test_image, verbose=False, conf=0.25)
        
        print("✅ النموذج يعمل بشكل صحيح!")
        print(f"   - عدد الكشوفات: {len(results[0].boxes) if results else 0}")
        
    except Exception as e:
        print(f"⚠️ تحذير في اختبار الكشف: {e}")
    
    # 5. اختبار على صورة حقيقية (إن وجدت)
    test_images = [
        "./test_image.jpg",
        "./test_image.png",
        "./snapshots/test.jpg",
    ]
    
    for img_path in test_images:
        if os.path.exists(img_path):
            print(f"\n🖼️ اختبار على صورة: {img_path}")
            try:
                results = model.predict(img_path, verbose=False, conf=0.25)
                boxes = results[0].boxes
                print(f"   - عدد الكشوفات: {len(boxes)}")
                
                for box in boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    name = model.names[cls]
                    print(f"      • {name}: {conf*100:.1f}%")
                    
            except Exception as e:
                print(f"   ❌ خطأ: {e}")
    
    print("\n" + "=" * 50)
    print("✅ اكتمل الاختبار بنجاح!")
    print("=" * 50)
    
    return True


def test_with_image(image_path: str):
    """اختبار النموذج على صورة محددة"""
    
    model_path = "./models/best.pt"
    
    if not os.path.exists(model_path):
        print(f"❌ النموذج غير موجود")
        return
    
    if not os.path.exists(image_path):
        print(f"❌ الصورة غير موجودة: {image_path}")
        return
    
    from ultralytics import YOLO
    model = YOLO(model_path)
    
    print(f"\n🔍 تحليل الصورة: {image_path}")
    
    results = model.predict(image_path, conf=0.25, save=True, project="./test_results")
    
    boxes = results[0].boxes
    print(f"\n📊 النتائج:")
    print(f"   عدد الكشوفات: {len(boxes)}")
    
    if len(boxes) > 0:
        for box in boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            name = model.names[cls]
            bbox = box.xyxy[0].tolist()
            print(f"   • {name}: {conf*100:.1f}% - الموقع: {bbox}")
    else:
        print("   لم يتم اكتشاف أي أسلحة")
    
    print(f"\n💾 تم حفظ النتائج في: ./test_results/")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # اختبار على صورة محددة
        test_with_image(sys.argv[1])
    else:
        # اختبار عام
        test_model()
