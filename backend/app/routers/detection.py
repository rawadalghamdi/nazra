"""
روتر الكشف - Detection Router
==============================
POST /api/v1/detection/test - اختبار الكشف على صورة
GET /api/v1/detection/status - حالة نموذج الكشف
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import Response, JSONResponse
from typing import Optional, List
from datetime import datetime
import logging
import io
import base64
import os

# إعداد السجل
logger = logging.getLogger("نظرة.الكشف")

router = APIRouter(prefix="/detection", tags=["الكشف"])


@router.get("/status")
async def get_detection_status():
    """
    الحصول على حالة نموذج الكشف
    
    يُرجع معلومات عن حالة النموذج والإحصائيات
    """
    try:
        from app.services.detector import get_detector
        detector = await get_detector()
        
        stats = detector.get_stats()
        
        return {
            "success": True,
            "model_loaded": detector.is_loaded,
            "model_path": detector.model_path,
            "device": detector.device,
            "confidence_threshold": detector.confidence_threshold,
            "statistics": stats,
            "supported_classes": list(detector.WEAPON_CLASSES.keys()),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ خطأ في جلب حالة الكشف: {e}")
        return {
            "success": False,
            "model_loaded": False,
            "error": str(e)
        }


@router.post("/test")
async def test_detection(
    file: UploadFile = File(..., description="صورة للاختبار (JPEG/PNG)")
):
    """
    اختبار الكشف على صورة
    
    يقوم بتحليل الصورة والكشف عن الأسلحة
    
    - **file**: ملف الصورة (JPEG أو PNG)
    
    Returns:
        نتيجة الكشف مع الصورة المعالجة
    """
    logger.info(f"🔍 اختبار الكشف على صورة: {file.filename}")
    
    # التحقق من نوع الملف
    allowed_types = ["image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"نوع الملف غير مدعوم. الأنواع المدعومة: {', '.join(allowed_types)}"
        )
    
    try:
        # قراءة الصورة
        contents = await file.read()
        
        # استيراد المكتبات
        import numpy as np
        import cv2
        
        # تحويل إلى صورة OpenCV
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="فشل في قراءة الصورة"
            )
        
        # الحصول على المكتشف
        from app.services.detector import get_detector
        detector = await get_detector()
        
        if not detector.is_loaded:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="نموذج الكشف غير محمل"
            )
        
        # تشغيل الكشف
        result = await detector.detect(
            frame=frame,
            camera_id="test",
            frame_id=f"test_{datetime.utcnow().timestamp()}"
        )
        
        # تحويل الصورة المعالجة إلى Base64
        annotated_image_base64 = None
        if result.frame_with_boxes is not None:
            _, buffer = cv2.imencode('.jpg', result.frame_with_boxes, [cv2.IMWRITE_JPEG_QUALITY, 90])
            annotated_image_base64 = base64.b64encode(buffer).decode('utf-8')
        else:
            # إذا لم يكن هناك كشف، أرجع الصورة الأصلية
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            annotated_image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # بناء الاستجابة
        detections_list = []
        for det in result.detections:
            detections_list.append({
                "id": det.id,
                "class_name": det.class_name,
                "class_name_ar": det.class_name_ar,
                "confidence": round(det.confidence * 100, 1),
                "confidence_raw": det.confidence,
                "bbox": {
                    "x1": det.bbox[0],
                    "y1": det.bbox[1],
                    "x2": det.bbox[2],
                    "y2": det.bbox[3],
                    "width": det.bbox[2] - det.bbox[0],
                    "height": det.bbox[3] - det.bbox[1]
                },
                "detection_type": det.detection_type,
                "severity": det.severity,
                "severity_ar": {
                    "critical": "حرج",
                    "high": "عالي",
                    "medium": "متوسط",
                    "low": "منخفض"
                }.get(det.severity, det.severity)
            })
        
        response = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "processing_time_ms": round(result.processing_time * 1000, 2),
            "image_info": {
                "filename": file.filename,
                "width": frame.shape[1],
                "height": frame.shape[0],
                "channels": frame.shape[2] if len(frame.shape) > 2 else 1
            },
            "detection_summary": {
                "total_detections": len(result.detections),
                "weapons_found": len([d for d in result.detections if d.detection_type == "weapon"]),
                "knives_found": len([d for d in result.detections if d.detection_type == "knife"]),
                "has_critical": any(d.severity == "critical" for d in result.detections),
                "has_high": any(d.severity == "high" for d in result.detections)
            },
            "detections": detections_list,
            "annotated_image": annotated_image_base64
        }
        
        # تسجيل النتيجة
        if detections_list:
            logger.info(
                f"🎯 تم كشف {len(detections_list)} سلاح في الصورة - "
                f"الوقت: {result.processing_time*1000:.0f}ms"
            )
        else:
            logger.info(f"✅ لا توجد أسلحة في الصورة - الوقت: {result.processing_time*1000:.0f}ms")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ في اختبار الكشف: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"خطأ في معالجة الصورة: {str(e)}"
        )


@router.post("/test/image")
async def test_detection_return_image(
    file: UploadFile = File(..., description="صورة للاختبار")
):
    """
    اختبار الكشف وإرجاع الصورة المعالجة مباشرة
    
    - **file**: ملف الصورة
    
    Returns:
        الصورة مع مربعات الكشف (JPEG)
    """
    logger.info(f"🔍 اختبار الكشف (صورة): {file.filename}")
    
    try:
        import numpy as np
        import cv2
        
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="فشل في قراءة الصورة"
            )
        
        from app.services.detector import get_detector
        detector = await get_detector()
        
        result = await detector.detect(frame=frame, camera_id="test")
        
        # استخدم الصورة المعالجة أو الأصلية
        output_frame = result.frame_with_boxes if result.frame_with_boxes is not None else frame
        
        # تحويل إلى JPEG
        _, buffer = cv2.imencode('.jpg', output_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        
        return Response(
            content=buffer.tobytes(),
            media_type="image/jpeg",
            headers={
                "X-Detections-Count": str(len(result.detections)),
                "X-Processing-Time-Ms": str(round(result.processing_time * 1000, 2)),
                "Content-Disposition": f"inline; filename=detection_result.jpg"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/from-snapshot")
async def detect_from_snapshot(
    camera_id: str,
    snapshot_url: Optional[str] = None
):
    """
    الكشف من صورة snapshot للكاميرا
    يستخدم هذا من الفرونتند لإرسال طلبات الكشف
    
    - **camera_id**: معرف الكاميرا
    - **snapshot_url**: رابط الـ snapshot (اختياري - يتم جلبه من قاعدة البيانات إذا لم يُحدد)
    
    Returns:
        نتائج الكشف مع الإحداثيات
    """
    import httpx
    import numpy as np
    import cv2
    
    logger.info(f"🔍 طلب كشف من snapshot للكاميرا: {camera_id}")
    
    try:
        # جلب رابط الكاميرا
        if not snapshot_url:
            from app.services.database import get_database_service
            db = await get_database_service()
            camera = db.get_camera(camera_id)
            if not camera:
                raise HTTPException(status_code=404, detail="الكاميرا غير موجودة")
            
            # محاولة بناء رابط snapshot
            rtsp_url = camera.rtsp_url
            if "8080" in rtsp_url:  # IP Webcam
                base_url = rtsp_url.replace("/video", "").replace("/videofeed", "")
                snapshot_url = f"{base_url}/shot.jpg"
            else:
                raise HTTPException(status_code=400, detail="لا يمكن تحديد رابط الـ snapshot")
        
        # جلب الصورة من الرابط
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(snapshot_url)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400, 
                    detail=f"فشل جلب الصورة: HTTP {response.status_code}"
                )
            
            image_data = response.content
        
        # تحويل إلى صورة OpenCV
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="فشل في قراءة الصورة")
        
        # تشغيل الكشف
        from app.services.detector import get_detector
        detector = await get_detector()
        result = await detector.detect(frame=frame, camera_id=camera_id)
        
        # تحويل النتائج
        detections = []
        for det in result.detections:
            detections.append({
                "class_name": det.class_name,
                "class_name_ar": det.class_name_ar,
                "confidence": det.confidence,
                "bbox": {
                    "x1": det.bbox[0],
                    "y1": det.bbox[1],
                    "x2": det.bbox[2],
                    "y2": det.bbox[3]
                },
                "detection_type": det.detection_type,
                "severity": det.severity
            })
        
        logger.info(f"✅ نتيجة الكشف: {len(detections)} كائن مكتشف")
        
        return {
            "success": True,
            "camera_id": camera_id,
            "detections": detections,
            "processing_time_ms": round(result.processing_time * 1000, 2),
            "frame_size": {"width": frame.shape[1], "height": frame.shape[0]},
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ في الكشف من snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/from-base64")
async def detect_from_base64(
    data: dict
):
    """
    الكشف من صورة Base64 (يُستخدم عندما يلتقط الفرونتند الإطار مباشرة)
    
    - **data.camera_id**: معرف الكاميرا
    - **data.image**: الصورة بصيغة Base64 (بدون البادئة data:image/...)
    
    Returns:
        نتائج الكشف مع الإحداثيات
    """
    import numpy as np
    import cv2
    
    camera_id = data.get("camera_id", "unknown")
    image_base64 = data.get("image", "")
    
    logger.info(f"🔍 طلب كشف من Base64 للكاميرا: {camera_id}")
    
    try:
        if not image_base64:
            raise HTTPException(status_code=400, detail="الصورة مطلوبة")
        
        # إزالة البادئة إن وجدت
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        
        # تحويل من Base64
        image_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="فشل في قراءة الصورة")
        
        # تشغيل الكشف
        from app.services.detector import get_detector
        detector = await get_detector()
        result = await detector.detect(frame=frame, camera_id=camera_id)
        
        # تحويل النتائج
        detections = []
        for det in result.detections:
            detections.append({
                "class_name": det.class_name,
                "class_name_ar": det.class_name_ar,
                "confidence": det.confidence,
                "bbox": {
                    "x1": det.bbox[0],
                    "y1": det.bbox[1],
                    "x2": det.bbox[2],
                    "y2": det.bbox[3]
                },
                "detection_type": det.detection_type,
                "severity": det.severity
            })
        
        logger.info(f"✅ نتيجة الكشف: {len(detections)} كائن مكتشف")
        
        return {
            "success": True,
            "camera_id": camera_id,
            "detections": detections,
            "processing_time_ms": round(result.processing_time * 1000, 2),
            "frame_size": {"width": frame.shape[1], "height": frame.shape[0]},
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ في الكشف من Base64: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/classes")
async def get_detection_classes():
    """
    الحصول على قائمة الفئات المدعومة
    """
    try:
        from app.services.detector import get_detector
        detector = await get_detector()
        
        classes = []
        for key, (name_ar, det_type, severity) in detector.WEAPON_CLASSES.items():
            classes.append({
                "class_name": key,
                "class_name_ar": name_ar,
                "detection_type": det_type,
                "severity": severity
            })
        
        return {
            "success": True,
            "total_classes": len(classes),
            "classes": classes
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/test/video")
async def test_video_detection(
    file: UploadFile = File(..., description="فيديو للاختبار (MP4, MOV, AVI)"),
    skip_frames: int = 5
):
    """
    اختبار الكشف على فيديو
    
    يقوم بتحليل الفيديو والكشف عن الأسلحة في كل N إطار
    
    - **file**: ملف الفيديو
    - **skip_frames**: عدد الإطارات للتخطي (افتراضي: 5)
    
    Returns:
        قائمة الكشوفات مع الإطارات المصورة
    """
    import tempfile
    import numpy as np
    import cv2
    import time
    
    logger.info(f"🎬 اختبار الكشف على فيديو: {file.filename}")
    
    # التحقق من نوع الملف
    allowed_types = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/avi", "application/octet-stream"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"نوع الملف غير مدعوم. الأنواع المدعومة: MP4, MOV, AVI"
        )
    
    try:
        # حفظ الفيديو مؤقتاً
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name
        
        # فتح الفيديو
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            os.unlink(tmp_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="فشل في فتح الفيديو"
            )
        
        # معلومات الفيديو
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        
        # الحصول على المكتشف
        from app.services.detector import get_detector
        detector = await get_detector()
        
        if not detector.is_loaded:
            cap.release()
            os.unlink(tmp_path)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="نموذج الكشف غير محمل"
            )
        
        # تحليل الفيديو
        all_detections = []
        frame_num = 0
        frames_processed = 0
        start_time = time.time()
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_num += 1
            
            # معالجة كل N إطار
            if frame_num % skip_frames == 0:
                result = await detector.detect(
                    frame=frame,
                    camera_id="video_test",
                    frame_id=f"frame_{frame_num}"
                )
                frames_processed += 1
                
                if result.detections:
                    # تحويل الإطار المعالج إلى Base64
                    _, buffer = cv2.imencode('.jpg', result.frame_with_boxes, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    for det in result.detections:
                        all_detections.append({
                            "frame_number": frame_num,
                            "timestamp_sec": frame_num / fps if fps > 0 else 0,
                            "class_name": det.class_name,
                            "class_name_ar": det.class_name_ar,
                            "confidence": round(det.confidence * 100, 1),
                            "severity": det.severity,
                            "bbox": {
                                "x1": det.bbox[0],
                                "y1": det.bbox[1],
                                "x2": det.bbox[2],
                                "y2": det.bbox[3]
                            },
                            "frame_image": frame_base64
                        })
        
        cap.release()
        os.unlink(tmp_path)
        
        total_time = time.time() - start_time
        
        response = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "video_info": {
                "filename": file.filename,
                "width": width,
                "height": height,
                "fps": round(fps, 1),
                "total_frames": frame_count,
                "duration_sec": round(duration, 2),
                "frames_analyzed": frames_processed,
                "skip_frames": skip_frames
            },
            "processing": {
                "total_time_sec": round(total_time, 2),
                "avg_fps": round(frames_processed / total_time, 1) if total_time > 0 else 0
            },
            "detection_summary": {
                "total_detections": len(all_detections),
                "unique_frames_with_detections": len(set(d["frame_number"] for d in all_detections)),
                "by_class": {}
            },
            "detections": all_detections[:20]  # أول 20 كشف فقط لتقليل حجم الاستجابة
        }
        
        # إحصائيات حسب الفئة
        for det in all_detections:
            cls = det["class_name"]
            if cls not in response["detection_summary"]["by_class"]:
                response["detection_summary"]["by_class"][cls] = 0
            response["detection_summary"]["by_class"][cls] += 1
        
        logger.info(
            f"🎬 انتهى تحليل الفيديو: {len(all_detections)} كشف في {frames_processed} إطار - "
            f"الوقت: {total_time:.1f}s"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ خطأ في تحليل الفيديو: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"خطأ في معالجة الفيديو: {str(e)}"
        )
