"""
روتر البث - Stream Router
==========================
GET /api/v1/stream/{camera_id} - بث الفيديو المعالج
GET /api/v1/stream/{camera_id}/snapshot - لقطة حالية
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncGenerator, Dict, Optional, Tuple
from pathlib import Path
from datetime import datetime
import logging
import asyncio
import io
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import time
import uuid

from app.database import get_db, AsyncSessionLocal
from app.models.camera import Camera
from app.models.alert import Alert, AlertStatus, AlertSeverity, WeaponType
from app.models.incident import Incident, IncidentStatus
from app.services.detector import detector
from app.config import settings
from app.services.notification import NotificationService

# إعداد السجل
logger = logging.getLogger("nazra.stream")

# =====================================
# Alert System for Simulation
# =====================================
# Rate limiting: last alert time per camera_id
_simulation_alert_cooldown: Dict[str, float] = {}
_simulation_alert_count: Dict[str, int] = {}  # Track alert count per camera
SIMULATION_ALERT_INTERVAL = 60.0  # Minimum 60 seconds between alerts for same camera
MAX_ALERTS_PER_CAMERA = 5  # Maximum alerts per camera before requiring manual reset

# Notification service instance
_notification_service: Optional[NotificationService] = None

def get_notification_service() -> NotificationService:
    """Get or create notification service singleton"""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service


# Map English class names to Arabic weapon types
CLASS_NAME_TO_WEAPON_TYPE = {
    'knife': WeaponType.KNIFE.value,
    'Knife': WeaponType.KNIFE.value,
    'handgun': WeaponType.PISTOL.value,
    'Handgun': WeaponType.PISTOL.value,
    'pistol': WeaponType.PISTOL.value,
    'Pistol': WeaponType.PISTOL.value,
    'rifle': WeaponType.RIFLE.value,
    'Rifle': WeaponType.RIFLE.value,
    'gun': WeaponType.PISTOL.value,
    'Gun': WeaponType.PISTOL.value,
}


async def ensure_simulation_camera_exists(camera_id: str, camera_name: str, location: str) -> bool:
    """
    Ensure a simulation camera record exists in the database (for FK constraint)
    """
    from sqlalchemy import select
    
    # Sanitize camera_id for DB
    db_camera_id = camera_id.replace(":", "_")
    
    try:
        async with AsyncSessionLocal() as db:
            # Check if camera exists
            result = await db.execute(
                select(Camera).where(Camera.id == db_camera_id)
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                # Create simulation camera
                sim_camera = Camera(
                    id=db_camera_id,
                    name=camera_name,
                    location=location,
                    rtsp_url=f"simulation://{camera_id}",
                    status="online",
                    detection_enabled=True,
                )
                db.add(sim_camera)
                await db.commit()
                logger.info(f"📹 Created simulation camera in DB: {db_camera_id}")
            
            return True
    except Exception as e:
        logger.warning(f"Could not ensure simulation camera exists: {e}")
        return False


async def get_or_create_incident(
    db: AsyncSession,
    camera_id: str,
    camera_name: str,
    location: str,
    weapon_type: str,
    severity: str
) -> Tuple[Incident, bool]:
    """
    جلب حادثة نشطة موجودة أو إنشاء واحدة جديدة
    
    Returns: (incident, is_new)
    """
    from datetime import timedelta
    
    INCIDENT_TIMEOUT_MINUTES = 5  # 5 minutes timeout
    timeout_threshold = datetime.utcnow() - timedelta(minutes=INCIDENT_TIMEOUT_MINUTES)
    
    # البحث عن حادثة نشطة موجودة
    result = await db.execute(
        select(Incident).where(
            Incident.camera_id == camera_id,
            Incident.primary_weapon_type == weapon_type,
            Incident.status == IncidentStatus.ACTIVE.value,
            Incident.last_detection_at >= timeout_threshold
        )
    )
    existing_incident = result.scalar_one_or_none()
    
    if existing_incident:
        return existing_incident, False
    
    # إنشاء حادثة جديدة
    new_incident = Incident(
        camera_id=camera_id,
        camera_name=camera_name,
        location=location,
        primary_weapon_type=weapon_type,
        severity=severity,
        status=IncidentStatus.ACTIVE.value,
    )
    db.add(new_incident)
    await db.flush()  # للحصول على ID
    
    return new_incident, True


async def create_simulation_alert(
    camera_id: str,
    camera_name: str,
    location: str,
    detection: dict,
    frame: np.ndarray,
) -> Optional[str]:
    """
    🚨 Create an alert from simulation detection with Incident grouping
    
    - Groups alerts into incidents (same camera + weapon type + time window)
    - Only broadcasts WebSocket notification for NEW incidents
    - Reduces spam significantly while maintaining all data
    
    Returns alert_id if created, None if skipped
    """
    global _simulation_alert_cooldown, _simulation_alert_count
    
    current_time = time.time()
    
    # Check if max alerts reached for this camera (per session)
    alert_count = _simulation_alert_count.get(camera_id, 0)
    if alert_count >= MAX_ALERTS_PER_CAMERA:
        if alert_count == MAX_ALERTS_PER_CAMERA:
            logger.info(f"⏸️ Max alerts ({MAX_ALERTS_PER_CAMERA}) reached for {camera_id}")
            _simulation_alert_count[camera_id] = alert_count + 1
        return None
    
    # Check cooldown between alerts (reduced from 60s to 10s since we group into incidents)
    last_alert_time = _simulation_alert_cooldown.get(camera_id, 0)
    if current_time - last_alert_time < 10.0:  # 10 seconds between individual alerts
        return None
    
    _simulation_alert_cooldown[camera_id] = current_time
    _simulation_alert_count[camera_id] = alert_count + 1
    
    try:
        # Ensure simulation camera exists in DB
        await ensure_simulation_camera_exists(camera_id, camera_name, location)
        
        # Extract detection info
        class_name = detection.get('class_name', 'unknown')
        confidence = detection.get('confidence', 0.0)
        bbox = detection.get('bbox', (0, 0, 0, 0))
        
        # Map to Arabic weapon type
        weapon_type = CLASS_NAME_TO_WEAPON_TYPE.get(class_name, WeaponType.OTHER.value)
        severity = Alert.get_severity_from_weapon(weapon_type)
        
        # Generate alert ID
        alert_id = str(uuid.uuid4())
        sanitized_camera_id = camera_id.replace(":", "_")
        
        # Save snapshot
        snapshot_dir = Path(settings.ALERTS_DIR if hasattr(settings, 'ALERTS_DIR') else 'alerts')
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        snapshot_filename = f"alert_{alert_id}.jpg"
        snapshot_path = snapshot_dir / snapshot_filename
        
        # Draw detection on snapshot
        frame_copy = frame.copy()
        x1, y1, x2, y2 = bbox
        cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 0, 255), 3)
        cv2.putText(frame_copy, f"{class_name}: {confidence:.0%}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        cv2.imwrite(str(snapshot_path), frame_copy)
        
        # Create alert and incident in database
        async with AsyncSessionLocal() as db:
            # Get or create incident
            incident, is_new_incident = await get_or_create_incident(
                db=db,
                camera_id=sanitized_camera_id,
                camera_name=camera_name,
                location=location,
                weapon_type=weapon_type,
                severity=severity
            )
            
            # Create alert linked to incident
            alert = Alert(
                id=alert_id,
                incident_id=incident.id,
                camera_id=sanitized_camera_id,
                camera_name=camera_name,
                location=location,
                weapon_type=weapon_type,
                confidence=confidence,
                severity=severity,
                image_snapshot=str(snapshot_path),
                bounding_box={
                    'x': int(x1),
                    'y': int(y1),
                    'width': int(x2 - x1),
                    'height': int(y2 - y1)
                },
                status=AlertStatus.NEW.value,
            )
            db.add(alert)
            
            # Update incident statistics
            incident.alert_count += 1
            incident.detection_count += 1
            incident.last_detection_at = datetime.utcnow()
            
            # Update max confidence and best snapshot
            if confidence > incident.max_confidence:
                incident.max_confidence = confidence
                incident.best_snapshot = str(snapshot_path)
            
            # Update average confidence
            if incident.avg_confidence == 0:
                incident.avg_confidence = confidence
            else:
                incident.avg_confidence = (
                    (incident.avg_confidence * (incident.detection_count - 1) + confidence) 
                    / incident.detection_count
                )
            
            await db.commit()
            
            incident_id = incident.id
            incident_alert_count = incident.alert_count
            
            if is_new_incident:
                logger.info(f"🆕 New incident created: {incident_id} for {camera_name}")
            
            logger.info(f"🚨 Alert {alert_id} added to incident {incident_id} (count: {incident_alert_count})")
        
        # Send WebSocket notification ONLY for new incidents or significant updates
        # This drastically reduces spam!
        should_broadcast = is_new_incident or (incident_alert_count % 10 == 0)  # Every 10 alerts
        
        if should_broadcast:
            try:
                from app.routers.websocket import manager
                await manager.broadcast_alert({
                    "type": "incident_update" if not is_new_incident else "new_incident",
                    "incident_id": incident_id,
                    "alert_id": alert_id,
                    "camera_id": camera_id,
                    "camera_name": camera_name,
                    "location": location,
                    "weapon_type": weapon_type,
                    "class_name": class_name,
                    "confidence": confidence,
                    "severity": severity,
                    "alert_count": incident_alert_count,
                    "is_new_incident": is_new_incident,
                    "image_snapshot": f"/alerts/{snapshot_filename}",
                    "bbox": {
                        "x1": int(x1),
                        "y1": int(y1),
                        "x2": int(x2),
                        "y2": int(y2)
                    },
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.info(f"📡 {'New incident' if is_new_incident else 'Incident update'} broadcast: {incident_id}")
            except Exception as ws_err:
                logger.warning(f"WebSocket broadcast failed: {ws_err}")
        
        # Send security notification ONLY for new incidents
        if is_new_incident:
            try:
                notification_service = get_notification_service()
                await notification_service.send_alert_notification(
                    alert_id=alert_id,
                    camera_name=camera_name,
                    weapon_type=weapon_type,
                    location=location,
                    confidence=confidence,
                    image_url=f"/alerts/{snapshot_filename}"
                )
                logger.info(f"🔔 Security notification sent for new incident")
            except Exception as notif_err:
                logger.warning(f"Notification failed: {notif_err}")
        
        return alert_id
        
    except Exception as e:
        logger.error(f"❌ Failed to create simulation alert: {e}")
        import traceback
        traceback.print_exc()
        return None

# ⚡ TurboJPEG للترميز السريع (3x أسرع من OpenCV)
try:
    from turbojpeg import TurboJPEG
    _turbo_jpeg = TurboJPEG()
    TURBOJPEG_AVAILABLE = True
    logger.info("TurboJPEG available - 3x faster encoding")
except ImportError:
    _turbo_jpeg = None
    TURBOJPEG_AVAILABLE = False

def fast_encode_jpeg(frame: np.ndarray, quality: int = 70) -> bytes:
    """
    ⚡ ترميز JPEG سريع
    يستخدم TurboJPEG إذا متوفر (3x أسرع)
    """
    if TURBOJPEG_AVAILABLE and _turbo_jpeg:
        return _turbo_jpeg.encode(frame, quality=quality)
    else:
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        _, buffer = cv2.imencode('.jpg', frame, encode_param)
        return buffer.tobytes()

router = APIRouter(prefix="/stream", tags=["البث"])

# تخزين اتصالات الكاميرات النشطة
active_captures: Dict[str, cv2.VideoCapture] = {}
capture_locks: Dict[str, asyncio.Lock] = {}
# ⚡ ThreadPoolExecutor محسّن بناءً على الإعدادات
executor = ThreadPoolExecutor(max_workers=settings.MAX_CONCURRENT_STREAMS)

# ⚡ Motion Detection Cache - لتخطي الإطارات الثابتة
_motion_cache: Dict[str, np.ndarray] = {}  # camera_id -> previous_gray_frame
_frame_cache: Dict[str, Tuple[bytes, float]] = {}  # camera_id -> (encoded_frame, timestamp)
_last_cleanup: float = 0.0  # وقت آخر تنظيف
FRAME_CACHE_TTL = 0.1  # 100ms cache
CACHE_CLEANUP_INTERVAL = 60.0  # تنظيف الكاش كل 60 ثانية

def cleanup_stale_caches():
    """
    🧹 تنظيف الكاش القديم - يمنع تسرب الذاكرة
    يُنفذ كل 60 ثانية
    """
    global _motion_cache, _frame_cache, _last_cleanup
    current_time = time.time()
    
    if current_time - _last_cleanup < CACHE_CLEANUP_INTERVAL:
        return
    
    _last_cleanup = current_time
    
    # تنظيف frame cache القديم
    stale_cameras = [
        cam_id for cam_id, (_, timestamp) in _frame_cache.items()
        if current_time - timestamp > 30.0  # 30 ثانية
    ]
    for cam_id in stale_cameras:
        _frame_cache.pop(cam_id, None)
        _motion_cache.pop(cam_id, None)
    
    if stale_cameras:
        logger.debug(f"Cleaned {len(stale_cameras)} cameras from cache")

def detect_motion(camera_id: str, frame: np.ndarray, threshold: float = 0.02) -> bool:
    """
    🎯 Motion Detection - اكتشاف الحركة
    ====================================
    يُستخدم لتخطي الكشف AI على الإطارات الثابتة
    يوفر ~70% من معالجة AI على المشاهد الهادئة
    
    Returns:
        True إذا كان هناك حركة كافية
    """
    global _motion_cache
    
    # تحويل لـ grayscale وتصغير
    small = cv2.resize(frame, (160, 120))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # مقارنة مع الإطار السابق
    if camera_id not in _motion_cache:
        _motion_cache[camera_id] = gray
        return True  # أول إطار - دائماً معالجة
    
    prev_gray = _motion_cache[camera_id]
    
    # حساب الفرق
    diff = cv2.absdiff(prev_gray, gray)
    _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
    
    # نسبة البكسلات المتغيرة
    change_ratio = np.sum(thresh > 0) / thresh.size
    
    # تحديث الكاش
    _motion_cache[camera_id] = gray
    
    return change_ratio > threshold

# ألوان مربعات الكشف
DETECTION_COLORS = {
    'Knife': (0, 165, 255),      # برتقالي
    'Handgun': (0, 0, 255),      # أحمر
    'weapon': (0, 0, 255),       # أحمر
    'knife': (0, 165, 255),      # برتقالي
}


def draw_detections_on_frame(frame: np.ndarray, detections: list) -> np.ndarray:
    """
    رسم مربعات الكشف على الإطار
    """
    for det in detections:
        x1, y1, x2, y2 = det['bbox']
        class_name = det['class_name']
        confidence = det['confidence']
        
        # اختيار اللون
        color = DETECTION_COLORS.get(class_name, (0, 0, 255))
        
        # رسم المربع
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
        
        # إعداد النص
        label = f"{class_name}: {confidence:.0%}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        thickness = 2
        
        # حساب حجم النص
        (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        
        # رسم خلفية النص
        cv2.rectangle(frame, (x1, y1 - text_height - 10), (x1 + text_width + 10, y1), color, -1)
        
        # رسم النص
        cv2.putText(frame, label, (x1 + 5, y1 - 5), font, font_scale, (255, 255, 255), thickness)
        
        # رسم زوايا مميزة
        corner_len = 20
        cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color, 4)
        cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color, 4)
        cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color, 4)
        cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color, 4)
        cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color, 4)
        cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color, 4)
        cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color, 4)
        cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color, 4)
    
    return frame


def process_frame_with_detection(cap: cv2.VideoCapture, detect: bool = True, last_detections: list = None, camera_id: str = "unknown") -> Tuple[Optional[bytes], list]:
    """
    قراءة إطار من الكاميرا وتشغيل الكشف عليه
    
    ⚡ محسّن مع:
    - Motion Detection لتخطي المشاهد الثابتة
    - Frame Cache للمشتركين المتعددين
    """
    detections = last_detections or []
    try:
        # تخطي الإطارات القديمة في البوفر للحصول على أحدث إطار
        # تخطي ديناميكي: حد أقصى 5 إطارات لتجنب الهدر
        buffer_size = int(cap.get(cv2.CAP_PROP_BUFFERSIZE)) or 5
        for _ in range(min(buffer_size, 5)):
            cap.grab()
        
        ret, frame = cap.read()
        if not ret or frame is None:
            return None, detections
        
        # تصغير الإطار لتحسين الأداء
        height, width = frame.shape[:2]
        max_width = 640
        if width > max_width:
            scale = max_width / width
            frame = cv2.resize(frame, None, fx=scale, fy=scale)
        
        # ⚡ Motion Detection - تخطي AI إذا لم تكن هناك حركة
        has_motion = True
        if detect:
            has_motion = detect_motion(camera_id, frame, threshold=0.02)
            if not has_motion and last_detections:
                # لا حركة + يوجد كشوفات سابقة = استخدم السابقة
                detect = False
        
        # تشغيل الكشف إذا كان مفعلاً وهناك حركة
        if detect and has_motion and detector.is_loaded:
            try:
                # مسح الكشوفات القديمة عند الكشف الجديد
                detections = []
                results = detector.model(
                    frame,
                    conf=detector.confidence_threshold,
                    device=detector.device,
                    verbose=False
                )
                
                for result in results:
                    boxes = result.boxes
                    if boxes is None or len(boxes) == 0:
                        continue
                    
                    # ⚡ Batch GPU→CPU Transfer - أسرع 15%
                    all_xyxy = boxes.xyxy.cpu().numpy()
                    all_conf = boxes.conf.cpu().numpy()
                    all_cls = boxes.cls.cpu().numpy().astype(int)
                    
                    for i in range(len(boxes)):
                        x1, y1, x2, y2 = all_xyxy[i]
                        confidence = float(all_conf[i])
                        class_id = int(all_cls[i])
                        class_name = detector.model.names[class_id]
                        
                        detections.append({
                            'class_name': class_name,
                            'confidence': confidence,
                            'bbox': (int(x1), int(y1), int(x2), int(y2))
                        })
                    
            except Exception as e:
                logger.error(f"Detection error: {e}")
        
        # رسم المربعات على الإطار (من الكشف الحالي أو السابق)
        if detections:
            frame = draw_detections_on_frame(frame, detections)
        
        # ⚡ تنظيف الكاش دورياً (لمنع تسرب الذاكرة)
        cleanup_stale_caches()
        
        # ⚡ تحويل إلى JPEG - استخدام TurboJPEG إذا متوفر
        return fast_encode_jpeg(frame, settings.JPEG_QUALITY_STREAM), detections
        
    except Exception as e:
        logger.error(f"Frame processing error: {e}")
        return None, []


async def generate_video_frames_with_detection(
    camera_id: str, 
    rtsp_url: str,
    detection_enabled: bool = True
) -> AsyncGenerator[bytes, None]:
    """
    مولد إطارات الفيديو من RTSP مع الكشف عن الأسلحة
    
    يُرجع إطارات MJPEG للبث مع مربعات الكشف
    """
    cap = None
    frame_count = 0
    detection_interval = 5  # تشغيل الكشف كل 5 إطارات للسرعة
    last_detections = []
    
    try:
        logger.info(f"Opening stream: {rtsp_url}")
        
        # إعدادات RTSP لتقليل التأخير
        import os
        os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtsp_transport;udp|fflags;nobuffer|flags;low_delay|framedrop;1'
        
        # فتح اتصال OpenCV مع إعدادات محسنة للسرعة
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # أقل buffer ممكن
        cap.set(cv2.CAP_PROP_FPS, 15)  # 15 FPS
        
        if not cap.isOpened():
            logger.error(f"Failed to open stream: {rtsp_url}")
            return
        
        logger.info(f"Connected to camera: {camera_id} - Detection: {'ON' if detection_enabled else 'OFF'}")
        
        max_consecutive_failures = 10
        consecutive_failures = 0
        
        loop = asyncio.get_event_loop()
        
        while consecutive_failures < max_consecutive_failures:
            try:
                # تحديد ما إذا كان يجب تشغيل الكشف في هذا الإطار
                should_detect = detection_enabled and (frame_count % detection_interval == 0)
                
                # معالجة الإطار مع camera_id للـ motion detection
                frame_bytes, detections = await loop.run_in_executor(
                    executor, 
                    process_frame_with_detection, 
                    cap, 
                    should_detect,
                    last_detections,
                    camera_id
                )
                
                if frame_bytes is None:
                    consecutive_failures += 1
                    await asyncio.sleep(0.05)
                    continue
                
                consecutive_failures = 0
                frame_count += 1
                
                # تحديث آخر الكشوفات
                if detections:
                    last_detections = detections
                    if should_detect:
                        logger.info(f"Detected {len(detections)} threat(s) in camera: {camera_id}")
                
                # إرسال الإطار
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + 
                    frame_bytes + 
                    b'\r\n'
                )
                
                # ⚡ Dynamic FPS Control - تحكم ديناميكي بناءً على وقت المعالجة
                # هدف: 15 FPS = 66ms per frame
                target_interval = 0.066
                # إذا كان الكشف مفعل، زد الفاصل قليلاً للاستقرار
                if should_detect and detections:
                    target_interval = 0.08  # ~12 FPS عند الكشف النشط
                await asyncio.sleep(target_interval)
                
            except asyncio.CancelledError:
                logger.info(f"Stream stopped for camera: {camera_id}")
                break
            except Exception as e:
                logger.error(f"Stream error: {e}")
                consecutive_failures += 1
                await asyncio.sleep(0.05)
        
        if consecutive_failures >= max_consecutive_failures:
            logger.warning(f"Repeated failures for camera: {camera_id}")
            
    except Exception as e:
        logger.error(f"General stream error: {e}")
    finally:
        if cap is not None:
            cap.release()
            logger.info(f"Camera connection closed: {camera_id}")


@router.get("/{camera_id}")
async def stream_video(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    بث الفيديو المعالج من الكاميرا
    
    يُرسل بث MJPEG للفيديو مع مربعات الكشف
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"Starting stream for camera: {camera_id}")
    
    # التحقق من وجود الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رابط RTSP غير محدد للكاميرا"
        )
    
    # إرجاع بث الفيديو مع الكشف
    return StreamingResponse(
        generate_video_frames_with_detection(
            camera_id, 
            camera.rtsp_url,
            detection_enabled=camera.detection_enabled
        ),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.get("/{camera_id}/snapshot")
async def get_snapshot(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب لقطة حالية من الكاميرا
    
    يُرجع صورة JPEG للقطة الحالية
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"Getting snapshot from camera: {camera_id}")
    
    # التحقق من وجود الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رابط RTSP غير محدد للكاميرا"
        )
    
    # جلب لقطة من RTSP
    try:
        loop = asyncio.get_event_loop()
        
        def capture_snapshot():
            cap = cv2.VideoCapture(camera.rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if not cap.isOpened():
                return None
            
            ret, frame = cap.read()
            cap.release()
            
            if not ret or frame is None:
                return None
            
            # ⚡ استخدام TurboJPEG للسرعة
            return fast_encode_jpeg(frame, settings.JPEG_QUALITY_SNAPSHOT)
        
        image_bytes = await loop.run_in_executor(executor, capture_snapshot)
        
        if image_bytes is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="فشل في جلب اللقطة من الكاميرا"
            )
        
        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={
                "Content-Disposition": f"inline; filename=snapshot_{camera_id}.jpg",
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"Snapshot error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"خطأ في جلب اللقطة: {str(e)}"
        )


@router.get("/{camera_id}/snapshot-http")
async def get_snapshot_http(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب لقطة من كاميرا HTTP (IP Webcam) عبر HTTP مباشرة
    
    هذا endpoint يجلب الصورة من رابط HTTP (/shot.jpg)
    بدلاً من محاولة فتح بث RTSP/MJPEG
    
    مفيد للتغلب على مشكلة Docker networking
    """
    import httpx
    
    logger.info(f"Getting HTTP snapshot from camera: {camera_id}")
    
    # جلب معلومات الكاميرا
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    if not camera.rtsp_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رابط الكاميرا غير محدد"
        )
    
    # بناء رابط الـ snapshot
    rtsp_url = camera.rtsp_url
    snapshot_url = None
    
    # محاولة تحويل الرابط إلى snapshot URL
    if "8080" in rtsp_url or "8081" in rtsp_url:  # IP Webcam
        # استبدال /video أو /videofeed بـ /shot.jpg
        base_url = rtsp_url.replace("/video", "").replace("/videofeed", "").rstrip("/")
        snapshot_url = f"{base_url}/shot.jpg"
        
        # إذا كان الرابط يشير إلى IP محلي، حاول استخدام host.docker.internal
        import re
        local_ip_match = re.search(r'http://192\.168\.\d+\.\d+', snapshot_url)
        if local_ip_match:
            # جرّب host.docker.internal أولاً
            docker_url = snapshot_url.replace(local_ip_match.group(), "http://host.docker.internal")
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    test_response = await client.head(docker_url)
                    if test_response.status_code == 200:
                        snapshot_url = docker_url
                        logger.info(f"Using host.docker.internal: {snapshot_url}")
            except:
                logger.info("host.docker.internal failed, trying original IP")
    
    if not snapshot_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="لا يمكن تحديد رابط الـ snapshot لهذا النوع من الكاميرات"
        )
    
    # جلب الصورة
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(snapshot_url)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"فشل جلب الصورة: HTTP {response.status_code}"
                )
            
            return Response(
                content=response.content,
                media_type="image/jpeg",
                headers={
                    "Content-Disposition": f"inline; filename=snapshot_{camera_id}.jpg",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="انتهى وقت الانتظار أثناء جلب الصورة"
        )
    except Exception as e:
        logger.error(f"HTTP snapshot error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"خطأ: {str(e)}"
        )


# =====================================
# Simulation Camera - كاميرا المحاكاة
# =====================================

import os
from pathlib import Path
from urllib.parse import quote

# مجلد فيديوهات المحاكاة
SIMULATION_VIDEOS_DIR = Path(__file__).parent.parent.parent / "test_videos"
DEFAULT_SIMULATION_VIDEO = "pistol_video_simulation.mp4"


def _resolve_simulation_video(video: Optional[str]) -> Path:
    """
    Resolve and validate a simulation video filename inside SIMULATION_VIDEOS_DIR.
    Prevents path traversal; only allows existing .mp4 files in the directory.
    """
    filename = (video or DEFAULT_SIMULATION_VIDEO).strip()

    # Prevent traversal / nested paths
    if not filename or Path(filename).name != filename or any(sep in filename for sep in ("/", "\\")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="اسم الفيديو غير صالح"
        )

    if not filename.lower().endswith(".mp4"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="نوع الفيديو غير مدعوم (المطلوب .mp4)"
        )

    video_path = (SIMULATION_VIDEOS_DIR / filename).resolve()
    try:
        video_path.relative_to(SIMULATION_VIDEOS_DIR.resolve())
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="اسم الفيديو غير صالح"
        )

    if not video_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ملف الفيديو غير موجود: {filename}"
        )

    return video_path


async def generate_simulation_frames(
    detection_enabled: bool = True,
    loop_video: bool = True,
    video_path: Optional[Path] = None,
    camera_id: str = "simulation",
) -> AsyncGenerator[bytes, None]:
    """
    مولد إطارات الفيديو من ملف محلي للمحاكاة
    
    يُرجع إطارات MJPEG للبث مع مربعات الكشف
    الفيديو يتكرر تلقائياً (loop)
    """
    cap = None
    frame_count = 0
    detection_interval = 5  # تشغيل الكشف كل 5 إطارات
    last_detections = []
    try:
        resolved_path = _resolve_simulation_video(video_path.name if video_path else None)
        video_path_str = str(resolved_path)
        
        if not os.path.exists(video_path_str):
            logger.error(f"Video file not found: {video_path_str}")
            return

        logger.info(f"Starting simulation from: {video_path_str} (camera_id={camera_id})")
        
        cap = cv2.VideoCapture(video_path_str)
        
        if not cap.isOpened():
            logger.error(f"Failed to open video file: {video_path}")
            return
        
        # الحصول على معلومات الفيديو
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Video opened: {video_fps} FPS, {total_frames} frames")
        
        loop = asyncio.get_event_loop()
        frame_interval = 1.0 / min(video_fps, 15)  # حد أقصى 15 FPS
        
        while True:
            try:
                ret, frame = cap.read()
                
                # إذا انتهى الفيديو، أعد التشغيل
                if not ret or frame is None:
                    if loop_video:
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        # 🔄 مسح الكشوفات السابقة عند إعادة التشغيل
                        last_detections = []
                        # مسح motion cache لهذه الكاميرا
                        _motion_cache.pop(camera_id, None)
                        logger.info("Restarting video loop - cleared detections")
                        continue
                    else:
                        break
                
                # تصغير الإطار لتحسين الأداء
                height, width = frame.shape[:2]
                max_width = 640
                if width > max_width:
                    scale = max_width / width
                    frame = cv2.resize(frame, None, fx=scale, fy=scale)
                
                # تشغيل الكشف
                should_detect = detection_enabled and (frame_count % detection_interval == 0)
                
                if should_detect and detector.is_loaded:
                    try:
                        detections = []
                        results = detector.model(
                            frame,
                            conf=detector.confidence_threshold,
                            device=detector.device,
                            verbose=False
                        )
                        
                        for result in results:
                            boxes = result.boxes
                            if boxes is None or len(boxes) == 0:
                                continue
                            
                            all_xyxy = boxes.xyxy.cpu().numpy()
                            all_conf = boxes.conf.cpu().numpy()
                            all_cls = boxes.cls.cpu().numpy().astype(int)
                            
                            for i in range(len(boxes)):
                                x1, y1, x2, y2 = all_xyxy[i]
                                confidence = float(all_conf[i])
                                class_id = int(all_cls[i])
                                class_name = detector.model.names[class_id]
                                
                                detections.append({
                                    'class_name': class_name,
                                    'confidence': confidence,
                                    'bbox': (int(x1), int(y1), int(x2), int(y2))
                                })
                        
                        if detections:
                            last_detections = detections
                            logger.info(f"[Simulation] Detected {len(detections)} threat(s)")
                            
                            # 🚨 Create alert for each detection
                            for det in detections:
                                # Determine camera name and location from camera_id
                                if "knife" in camera_id.lower():
                                    sim_camera_name = "🔪 محاكاة سكين"
                                    sim_location = "فيديو تجريبي - سكين"
                                else:
                                    sim_camera_name = "🎬 كاميرا المحاكاة"
                                    sim_location = "فيديو تجريبي"
                                
                                # Create alert (async, non-blocking with rate limit)
                                asyncio.create_task(
                                    create_simulation_alert(
                                        camera_id=camera_id,
                                        camera_name=sim_camera_name,
                                        location=sim_location,
                                        detection=det,
                                        frame=frame.copy()
                                    )
                                )
                            
                    except Exception as e:
                        logger.error(f"Detection error: {e}")
                
                # رسم المربعات
                if last_detections:
                    frame = draw_detections_on_frame(frame, last_detections)
                
                # إضافة علامة المحاكاة
                cv2.putText(
                    frame, 
                    "SIMULATION", 
                    (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    1, 
                    (0, 255, 255), 
                    2
                )
                
                # تحويل إلى JPEG
                frame_bytes = fast_encode_jpeg(frame, settings.JPEG_QUALITY_STREAM)
                
                frame_count += 1
                
                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n\r\n' + 
                    frame_bytes + 
                    b'\r\n'
                )
                
                await asyncio.sleep(frame_interval)
                
            except asyncio.CancelledError:
                logger.info("Simulation stopped")
                break
            except Exception as e:
                logger.error(f"Simulation error: {e}")
                await asyncio.sleep(0.1)
                
    except Exception as e:
        logger.error(f"General simulation error: {e}")
    finally:
        if cap is not None:
            cap.release()
            logger.info("Video file closed")


@router.get("/simulation/stream")
async def stream_simulation(detect: bool = True, video: Optional[str] = None):
    """
    🎬 بث فيديو محاكاة للاختبار
    
    يستخدم ملف فيديو محلي كمصدر للبث مع تطبيق الكشف عن الأسلحة
    الفيديو يتكرر تلقائياً
    
    - **detect**: تفعيل/تعطيل الكشف (افتراضياً: مفعّل)
    - **video**: اسم ملف mp4 داخل backend/test_videos (افتراضياً: فيديو المحاكاة الأساسي)
    """
    video_path = _resolve_simulation_video(video)
    camera_id = f"simulation:{video_path.name}"
    logger.info(
        f"Starting simulation stream - Detection: {'ON' if detect else 'OFF'} - Video: {video_path.name}"
    )
    
    return StreamingResponse(
        generate_simulation_frames(detection_enabled=detect, video_path=video_path, camera_id=camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.get("/simulation/videos")
async def list_simulation_videos():
    """
    قائمة فيديوهات المحاكاة المتوفرة داخل backend/test_videos
    """
    if not SIMULATION_VIDEOS_DIR.exists():
        return {"available": False, "videos": []}

    videos = []
    for p in sorted(SIMULATION_VIDEOS_DIR.glob("*.mp4")):
        videos.append(
            {
                "filename": p.name,
                "is_default": p.name == DEFAULT_SIMULATION_VIDEO,
                "stream_url": f"/api/v1/stream/simulation/stream?video={quote(p.name)}",
            }
        )

    return {"available": len(videos) > 0, "videos": videos}


@router.get("/simulation/info")
async def get_simulation_info(video: Optional[str] = None):
    """
    معلومات عن فيديو المحاكاة
    """
    try:
        video_path = _resolve_simulation_video(video)
    except HTTPException as e:
        return {"available": False, "message": e.detail}

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return {
            "available": False,
            "message": "فشل فتح ملف الفيديو"
        }
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    cap.release()
    
    return {
        "available": True,
        "filename": video_path.name,
        "resolution": f"{width}x{height}",
        "fps": fps,
        "duration_seconds": round(duration, 2),
        "total_frames": total_frames,
        "stream_url": f"/api/v1/stream/simulation/stream?video={quote(video_path.name)}"
    }


@router.get("/{camera_id}/info")
async def get_stream_info(camera_id: str, db: AsyncSession = Depends(get_db)):
    """
    جلب معلومات البث
    
    يُرجع معلومات عن إعدادات البث للكاميرا
    
    - **camera_id**: معرف الكاميرا
    """
    logger.info(f"Getting stream info for camera: {camera_id}")
    
    result = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    camera = result.scalar_one_or_none()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="الكاميرا غير موجودة"
        )
    
    return {
        "camera_id": camera.id,
        "camera_name": camera.name,
        "status": camera.status,
        "rtsp_url": camera.rtsp_url if camera.rtsp_url else None,
        "stream_quality": camera.stream_quality,
        "fps": camera.fps,
        "resolution": f"{settings.STREAM_WIDTH}x{settings.STREAM_HEIGHT}",
        "detection_enabled": camera.detection_enabled,
        "is_recording": camera.is_recording
    }


@router.get("/simulation/alerts/status")
async def get_simulation_alerts_status():
    """
    حالة تنبيهات المحاكاة لكل كاميرا
    """
    global _simulation_alert_cooldown, _simulation_alert_count
    
    status = {}
    for camera_id, count in _simulation_alert_count.items():
        last_alert = _simulation_alert_cooldown.get(camera_id, 0)
        time_since_last = time.time() - last_alert if last_alert > 0 else None
        
        status[camera_id] = {
            "alert_count": min(count, MAX_ALERTS_PER_CAMERA),
            "max_alerts": MAX_ALERTS_PER_CAMERA,
            "is_paused": count >= MAX_ALERTS_PER_CAMERA,
            "cooldown_seconds": SIMULATION_ALERT_INTERVAL,
            "time_since_last_alert": round(time_since_last, 1) if time_since_last else None,
            "can_alert": count < MAX_ALERTS_PER_CAMERA and (time_since_last is None or time_since_last >= SIMULATION_ALERT_INTERVAL)
        }
    
    return {
        "cameras": status,
        "settings": {
            "alert_interval_seconds": SIMULATION_ALERT_INTERVAL,
            "max_alerts_per_camera": MAX_ALERTS_PER_CAMERA
        }
    }


@router.post("/simulation/alerts/reset")
async def reset_simulation_alerts(camera_id: Optional[str] = None):
    """
    إعادة تعيين عداد تنبيهات المحاكاة
    
    - إذا تم تحديد camera_id: إعادة تعيين لكاميرا محددة
    - إذا لم يتم تحديد camera_id: إعادة تعيين لجميع الكاميرات
    """
    global _simulation_alert_cooldown, _simulation_alert_count
    
    if camera_id:
        # Reset specific camera
        if camera_id in _simulation_alert_count:
            old_count = _simulation_alert_count[camera_id]
            _simulation_alert_count[camera_id] = 0
            _simulation_alert_cooldown[camera_id] = 0
            logger.info(f"🔄 Reset alerts for {camera_id}: {old_count} → 0")
            return {"message": f"تم إعادة تعيين تنبيهات {camera_id}", "reset_count": old_count}
        else:
            return {"message": f"لا توجد تنبيهات لـ {camera_id}", "reset_count": 0}
    else:
        # Reset all cameras
        total_reset = sum(_simulation_alert_count.values())
        _simulation_alert_count.clear()
        _simulation_alert_cooldown.clear()
        logger.info(f"🔄 Reset ALL simulation alerts: {total_reset} total")
        return {"message": "تم إعادة تعيين جميع تنبيهات المحاكاة", "reset_count": total_reset}
