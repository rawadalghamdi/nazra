"""
روتر WebSocket للبث المباشر
===========================
WS /ws/alerts - تنبيهات مباشرة
WS /ws/stream/{camera_id} - بث الفيديو المعالج

الميزات:
- إعادة الاتصال التلقائي عند الانقطاع
- Heartbeat للتحقق من الاتصال
- Queue للرسائل أثناء الانقطاع
- تنظيف الاتصالات عند الإغلاق
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Set, List, Optional, Any
from datetime import datetime
from collections import deque
import asyncio
import json
import logging
import time

# إعداد السجل
logger = logging.getLogger("nazra.websocket")

router = APIRouter(tags=["WebSocket"])

# ثوابت التكوين
HEARTBEAT_INTERVAL = 30  # ثانية
HEARTBEAT_TIMEOUT = 10  # ثانية
MAX_MESSAGE_QUEUE_SIZE = 100  # الحد الأقصى للرسائل في الانتظار
RECONNECT_GRACE_PERIOD = 60  # ثانية - فترة الانتظار لإعادة الاتصال


class ConnectionManager:
    """
    مدير اتصالات WebSocket
    ======================
    يدير جميع اتصالات WebSocket والاشتراكات
    مع دعم Heartbeat وإعادة الاتصال التلقائي
    """
    
    def __init__(self):
        # جميع الاتصالات النشطة
        self.active_connections: Set[WebSocket] = set()
        
        # اشتراكات التنبيهات
        self.alert_subscribers: Set[WebSocket] = set()
        
        # اشتراكات الكاميرات (camera_id -> set of websockets)
        self.camera_subscribers: Dict[str, Set[WebSocket]] = {}
        
        # معلومات الاتصالات
        self.connection_info: Dict[WebSocket, dict] = {}
        
        # طابور الرسائل للاتصالات المنقطعة (client_id -> deque of messages)
        self.message_queues: Dict[str, deque] = {}
        
        # معرفات العملاء (websocket -> client_id)
        self.client_ids: Dict[WebSocket, str] = {}
        
        # آخر نبضة قلب لكل اتصال
        self.last_heartbeat: Dict[WebSocket, float] = {}
        
        # حالة النظام
        self.system_status: Dict[str, Any] = {
            "cameras_online": 0,
            "alerts_today": 0,
            "system_status": "متصل"
        }
        
        # مهمة Heartbeat
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._status_task: Optional[asyncio.Task] = None
    
    async def start_background_tasks(self):
        """بدء المهام الخلفية"""
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        if self._status_task is None:
            self._status_task = asyncio.create_task(self._status_broadcast_loop())
    
    async def stop_background_tasks(self):
        """إيقاف المهام الخلفية"""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            self._heartbeat_task = None
        if self._status_task:
            self._status_task.cancel()
            self._status_task = None
    
    async def _heartbeat_loop(self):
        """حلقة Heartbeat للتحقق من الاتصالات"""
        while True:
            try:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                await self._check_connections()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
    
    async def _status_broadcast_loop(self):
        """بث حالة النظام بشكل دوري"""
        while True:
            try:
                await asyncio.sleep(30)  # كل 30 ثانية
                await self.broadcast_status(self.system_status)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Status broadcast error: {e}")
    
    async def _check_connections(self):
        """التحقق من صحة الاتصالات"""
        current_time = time.time()
        stale_connections = []
        
        for websocket in self.active_connections.copy():
            last_ping = self.last_heartbeat.get(websocket, current_time)
            if current_time - last_ping > HEARTBEAT_INTERVAL + HEARTBEAT_TIMEOUT:
                stale_connections.append(websocket)
            else:
                # إرسال ping
                try:
                    await websocket.send_json({
                        "type": "ping",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    stale_connections.append(websocket)
        
        # Clean up stale connections
        for conn in stale_connections:
            logger.warning("Stale connection, cleaning up...")
            self.disconnect(conn)
    
    async def connect(self, websocket: WebSocket, client_info: dict = None):
        """
        قبول اتصال WebSocket جديد
        """
        await websocket.accept()
        self.active_connections.add(websocket)
        self.last_heartbeat[websocket] = time.time()
        
        # تعيين معرف العميل
        client_id = client_info.get("client_id") if client_info else None
        if client_id:
            self.client_ids[websocket] = client_id
            # إرسال الرسائل المتراكمة
            await self._flush_message_queue(websocket, client_id)
        
        self.connection_info[websocket] = {
            **(client_info or {}),
            "connected_at": datetime.utcnow().isoformat()
        }
        
        # بدء المهام الخلفية إذا لم تكن قيد التشغيل
        await self.start_background_tasks()
        
        logger.info(f"New connection - Total: {len(self.active_connections)}")
    
    async def _flush_message_queue(self, websocket: WebSocket, client_id: str):
        """إرسال الرسائل المتراكمة للعميل"""
        if client_id in self.message_queues:
            queue = self.message_queues[client_id]
            while queue:
                message = queue.popleft()
                try:
                    await websocket.send_json(message)
                except Exception:
                    # إعادة الرسالة للطابور إذا فشل الإرسال
                    queue.appendleft(message)
                    break
            
            # حذف الطابور الفارغ
            if not queue:
                del self.message_queues[client_id]
    
    def _queue_message(self, client_id: str, message: dict):
        """إضافة رسالة لطابور الانتظار"""
        if client_id not in self.message_queues:
            self.message_queues[client_id] = deque(maxlen=MAX_MESSAGE_QUEUE_SIZE)
        self.message_queues[client_id].append(message)
    
    def disconnect(self, websocket: WebSocket):
        """
        إزالة اتصال WebSocket
        """
        self.active_connections.discard(websocket)
        self.alert_subscribers.discard(websocket)
        self.last_heartbeat.pop(websocket, None)
        
        # حفظ معرف العميل للرسائل المستقبلية
        client_id = self.client_ids.pop(websocket, None)
        
        # إزالة من جميع اشتراكات الكاميرات
        for camera_id in list(self.camera_subscribers.keys()):
            self.camera_subscribers[camera_id].discard(websocket)
            if not self.camera_subscribers[camera_id]:
                del self.camera_subscribers[camera_id]
        
        # إزالة معلومات الاتصال
        self.connection_info.pop(websocket, None)
        
        logger.info(f"Disconnected - Total: {len(self.active_connections)}")
    
    def update_heartbeat(self, websocket: WebSocket):
        """تحديث وقت آخر نبضة قلب"""
        self.last_heartbeat[websocket] = time.time()
    
    def subscribe_alerts(self, websocket: WebSocket):
        """
        الاشتراك في التنبيهات المباشرة
        """
        self.alert_subscribers.add(websocket)
        logger.info(f"Subscribed to alerts - Total: {len(self.alert_subscribers)}")
    
    def unsubscribe_alerts(self, websocket: WebSocket):
        """
        إلغاء الاشتراك من التنبيهات
        """
        self.alert_subscribers.discard(websocket)
        logger.info(f"Unsubscribed from alerts - Total: {len(self.alert_subscribers)}")
    
    def subscribe_camera(self, websocket: WebSocket, camera_id: str):
        """
        الاشتراك في بث كاميرا محددة
        """
        if camera_id not in self.camera_subscribers:
            self.camera_subscribers[camera_id] = set()
        self.camera_subscribers[camera_id].add(websocket)
        logger.info(f"Subscribed to camera {camera_id} - Total: {len(self.camera_subscribers[camera_id])}")
    
    def unsubscribe_camera(self, websocket: WebSocket, camera_id: str):
        """
        إلغاء الاشتراك من بث كاميرا
        """
        if camera_id in self.camera_subscribers:
            self.camera_subscribers[camera_id].discard(websocket)
            if not self.camera_subscribers[camera_id]:
                del self.camera_subscribers[camera_id]
            logger.info(f"Unsubscribed from camera {camera_id}")
    
    async def send_personal(self, websocket: WebSocket, message: dict):
        """
        إرسال رسالة شخصية لعميل محدد
        """
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Send error: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """
        ⚡ بث رسالة لجميع المتصلين (متوازي)
        """
        if not self.active_connections:
            return
        
        # ⚡ إرسال متوازي باستخدام asyncio.gather
        async def safe_send(conn):
            try:
                await conn.send_json(message)
                return None
            except Exception:
                return conn
        
        results = await asyncio.gather(
            *[safe_send(conn) for conn in self.active_connections.copy()],
            return_exceptions=True
        )
        
        # إزالة الاتصالات المقطوعة
        for result in results:
            if result is not None and not isinstance(result, Exception):
                self.disconnect(result)
    
    async def broadcast_alert(self, alert_data: dict):
        """
        ⚡ بث تنبيه جديد لجميع مشتركي التنبيهات (متوازي)
        """
        if not self.alert_subscribers:
            return
        
        message = {
            "type": "new_alert",
            "data": alert_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # ⚡ إرسال متوازي
        async def safe_send(conn):
            try:
                await conn.send_json(message)
                return None
            except Exception:
                return conn
        
        results = await asyncio.gather(
            *[safe_send(conn) for conn in self.alert_subscribers.copy()],
            return_exceptions=True
        )
        
        for result in results:
            if result is not None and not isinstance(result, Exception):
                self.disconnect(result)
        
        logger.info(f"Alert broadcast to {len(self.alert_subscribers)} subscriber(s)")
    
    async def broadcast_to_camera(self, camera_id: str, message: dict):
        """
        ⚡ بث رسالة لمشتركي كاميرا محددة (متوازي)
        """
        subscribers = self.camera_subscribers.get(camera_id)
        if not subscribers:
            return
        
        # ⚡ إرسال متوازي
        async def safe_send(conn):
            try:
                await conn.send_json(message)
                return None
            except Exception:
                return conn
        
        results = await asyncio.gather(
            *[safe_send(conn) for conn in subscribers.copy()],
            return_exceptions=True
        )
        
        for result in results:
            if result is not None and not isinstance(result, Exception):
                self.disconnect(result)
    
    async def broadcast_status(self, status: dict):
        """
        بث تحديث حالة النظام لجميع المشتركين
        
        Format:
        {
          "type": "status_update",
          "data": {
            "cameras_online": 12,
            "alerts_today": 24,
            "system_status": "متصل"
          }
        }
        """
        message = {
            "type": "status_update",
            "data": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        disconnected = []
        for connection in self.alert_subscribers.copy():
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)
    
    def update_system_status(self, cameras_online: int = None, alerts_today: int = None, system_status: str = None):
        """تحديث حالة النظام"""
        if cameras_online is not None:
            self.system_status["cameras_online"] = cameras_online
        if alerts_today is not None:
            self.system_status["alerts_today"] = alerts_today
        if system_status is not None:
            self.system_status["system_status"] = system_status
    
    async def broadcast_detection(self, camera_id: str, detection_data: dict):
        """
        بث كشف جديد لمشتركي كاميرا
        """
        message = {
            "type": "detection",
            "camera_id": camera_id,
            "data": detection_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast_to_camera(camera_id, message)
    
    async def broadcast_frame(self, camera_id: str, frame_data: bytes):
        """
        بث إطار فيديو لمشتركي كاميرا
        """
        if camera_id not in self.camera_subscribers:
            return
        
        disconnected = []
        for connection in self.camera_subscribers[camera_id].copy():
            try:
                await connection.send_bytes(frame_data)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)
    
    def get_stats(self) -> dict:
        """
        إحصائيات الاتصالات
        """
        return {
            "total_connections": len(self.active_connections),
            "alert_subscribers": len(self.alert_subscribers),
            "camera_subscriptions": {
                camera_id: len(subscribers)
                for camera_id, subscribers in self.camera_subscribers.items()
            },
            "pending_messages": sum(len(q) for q in self.message_queues.values()),
            "system_status": self.system_status
        }


# إنشاء مدير الاتصالات العام
manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    """
    الحصول على مدير الاتصالات
    """
    return manager


@router.websocket("/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    نقطة اتصال WebSocket للتنبيهات المباشرة
    
    الرسائل المُرسلة:
    - {"type": "new_alert", "data": {...}}
    - {"type": "alert_updated", "data": {...}}
    
    الرسائل المُستقبلة:
    - {"action": "subscribe"}
    - {"action": "unsubscribe"}
    - {"action": "ping"}
    """
    await manager.connect(websocket, {"type": "alerts"})
    manager.subscribe_alerts(websocket)
    
    try:
        # إرسال رسالة ترحيب
        await manager.send_personal(websocket, {
            "type": "connected",
            "message": "مرحباً بك في نظام نظرة",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        while True:
            try:
                # استقبال الرسائل
                data = await websocket.receive_json()
                
                action = data.get("action")
                
                if action == "ping":
                    manager.update_heartbeat(websocket)
                    await manager.send_personal(websocket, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                elif action == "pong":
                    manager.update_heartbeat(websocket)
                
                elif action == "subscribe":
                    manager.subscribe_alerts(websocket)
                    await manager.send_personal(websocket, {
                        "type": "subscribed",
                        "channel": "alerts"
                    })
                
                elif action == "unsubscribe":
                    manager.unsubscribe_alerts(websocket)
                    await manager.send_personal(websocket, {
                        "type": "unsubscribed",
                        "channel": "alerts"
                    })
                
                elif action == "get_stats":
                    await manager.send_personal(websocket, {
                        "type": "stats",
                        "data": manager.get_stats()
                    })
                
                else:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": f"إجراء غير معروف: {action}"
                    })
                    
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": "صيغة JSON غير صحيحة"
                })
                
    except WebSocketDisconnect:
        logger.info("Alerts WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


@router.websocket("/stream/{camera_id}")
async def websocket_stream(websocket: WebSocket, camera_id: str):
    """
    نقطة اتصال WebSocket لبث الفيديو المعالج
    
    يُرسل إطارات الفيديو مع مربعات الكشف
    
    الرسائل المُرسلة:
    - {"type": "frame", "data": "base64_encoded_frame"}
    - {"type": "detection", "data": {...}}
    
    الرسائل المُستقبلة:
    - {"action": "subscribe"}
    - {"action": "unsubscribe"}
    - {"action": "ping"}
    """
    await manager.connect(websocket, {"type": "stream", "camera_id": camera_id})
    manager.subscribe_camera(websocket, camera_id)
    
    try:
        # إرسال رسالة ترحيب
        await manager.send_personal(websocket, {
            "type": "connected",
            "camera_id": camera_id,
            "message": f"تم الاتصال ببث الكاميرا: {camera_id}",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        while True:
            try:
                data = await websocket.receive_json()
                
                action = data.get("action")
                
                if action == "ping":
                    manager.update_heartbeat(websocket)
                    await manager.send_personal(websocket, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                elif action == "pong":
                    manager.update_heartbeat(websocket)
                
                elif action == "unsubscribe":
                    manager.unsubscribe_camera(websocket, camera_id)
                    await manager.send_personal(websocket, {
                        "type": "unsubscribed",
                        "camera_id": camera_id
                    })
                    break
                
                elif action == "get_info":
                    await manager.send_personal(websocket, {
                        "type": "stream_info",
                        "camera_id": camera_id,
                        "subscribers": len(manager.camera_subscribers.get(camera_id, set()))
                    })
                    
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": "صيغة JSON غير صحيحة"
                })
                
    except WebSocketDisconnect:
        logger.info(f"Camera stream disconnected: {camera_id}")
    except Exception as e:
        logger.error(f"Stream WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


@router.websocket("")
async def websocket_general(websocket: WebSocket):
    """
    نقطة اتصال WebSocket عامة
    
    يمكن من خلالها الاشتراك في أي قناة
    """
    await manager.connect(websocket)
    
    try:
        await manager.send_personal(websocket, {
            "type": "connected",
            "message": "مرحباً بك في نظام نظرة",
            "available_channels": ["alerts", "stream/{camera_id}"],
            "timestamp": datetime.utcnow().isoformat()
        })
        
        while True:
            try:
                data = await websocket.receive_json()
                
                action = data.get("action")
                
                if action == "ping":
                    manager.update_heartbeat(websocket)
                    await manager.send_personal(websocket, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                elif action == "pong":
                    manager.update_heartbeat(websocket)
                
                elif action == "subscribe_alerts":
                    manager.subscribe_alerts(websocket)
                    await manager.send_personal(websocket, {
                        "type": "subscribed",
                        "channel": "alerts"
                    })
                
                elif action == "unsubscribe_alerts":
                    manager.unsubscribe_alerts(websocket)
                    await manager.send_personal(websocket, {
                        "type": "unsubscribed",
                        "channel": "alerts"
                    })
                
                elif action == "subscribe_camera":
                    camera_id = data.get("camera_id")
                    if camera_id:
                        manager.subscribe_camera(websocket, camera_id)
                        await manager.send_personal(websocket, {
                            "type": "subscribed",
                            "channel": f"camera:{camera_id}"
                        })
                
                elif action == "unsubscribe_camera":
                    camera_id = data.get("camera_id")
                    if camera_id:
                        manager.unsubscribe_camera(websocket, camera_id)
                        await manager.send_personal(websocket, {
                            "type": "unsubscribed",
                            "channel": f"camera:{camera_id}"
                        })
                
                elif action == "get_stats":
                    await manager.send_personal(websocket, {
                        "type": "stats",
                        "data": manager.get_stats()
                    })
                
                else:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": f"إجراء غير معروف: {action}"
                    })
                    
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": "صيغة JSON غير صحيحة"
                })
                
    except WebSocketDisconnect:
        logger.info("General WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


# دوال للاستخدام من خدمات أخرى
async def notify_alert(alert: dict):
    """
    إرسال إشعار تنبيه جديد
    يُستخدم من خدمة الكشف عند اكتشاف سلاح
    """
    await manager.broadcast_alert(alert)


async def notify_detection(camera_id: str, detection: dict):
    """
    إرسال إشعار كشف
    يُستخدم لإرسال نتائج الكشف المباشر
    """
    await manager.broadcast_detection(camera_id, detection)


async def notify_detection_event(event_data: dict):
    """
    إرسال حدث كشف لجميع المشتركين في الكاميرا
    يُستخدم من detection_worker
    """
    camera_id = event_data.get("camera_id")
    if camera_id:
        await manager.broadcast_to_camera(camera_id, event_data)
        
        # إذا كان هناك كشوفات، أرسل تنبيه
        detections = event_data.get("detections", [])
        if detections:
            for det in detections:
                await manager.broadcast_alert({
                    "type": "weapon_detected",
                    "camera_id": camera_id,
                    "class_name": det.get("class_name"),
                    "confidence": det.get("confidence"),
                    "bbox": {
                        "x1": det.get("x1"),
                        "y1": det.get("y1"),
                        "x2": det.get("x2"),
                        "y2": det.get("y2")
                    },
                    "timestamp": event_data.get("timestamp")
                })


async def notify_camera_status(camera_id: str, status: str):
    """
    إرسال تحديث حالة كاميرا
    """
    await manager.broadcast({
        "type": "camera_status",
        "camera_id": camera_id,
        "status": status,
        "timestamp": datetime.utcnow().isoformat()
    })


async def push_detection_result(result: dict):
    """
    بث نتيجة كشف من Pipeline إلى جميع المشتركين
    
    يُستدعى من detection_pipeline.py عند اكتشاف كائنات
    
    Args:
        result: dict مع camera_id, detections, frame_size, processing_time_ms
    """
    camera_id = result.get("camera_id")
    if not camera_id:
        return
    
    message = {
        "type": "detection",
        "camera_id": camera_id,
        "timestamp": datetime.utcnow().isoformat(),
        "frame_width": result.get("frame_size", {}).get("width", 1920),
        "frame_height": result.get("frame_size", {}).get("height", 1080),
        "processing_time_ms": result.get("processing_time_ms", 0),
        "detections": [
            {
                "class_name": d.get("class_name"),
                "class_name_ar": d.get("class_name_ar"),
                "confidence": d.get("confidence"),
                "x1": d.get("bbox", {}).get("x1", 0),
                "y1": d.get("bbox", {}).get("y1", 0),
                "x2": d.get("bbox", {}).get("x2", 0),
                "y2": d.get("bbox", {}).get("y2", 0),
                "width": d.get("bbox", {}).get("x2", 0) - d.get("bbox", {}).get("x1", 0),
                "height": d.get("bbox", {}).get("y2", 0) - d.get("bbox", {}).get("y1", 0),
                "detection_type": d.get("detection_type"),
                "severity": d.get("severity")
            }
            for d in result.get("detections", [])
        ]
    }
    
    # بث للمشتركين في هذه الكاميرا
    await manager.broadcast_to_camera(camera_id, message)
    
    # إذا كان هناك كشوفات، أرسل تنبيه أيضاً
    if result.get("detections"):
        alert_message = {
            "type": "detection_alert",
            "camera_id": camera_id,
            "count": len(result.get("detections", [])),
            "severity": max(
                (d.get("severity", "low") for d in result.get("detections", [])),
                key=lambda x: {"critical": 3, "high": 2, "medium": 1, "low": 0}.get(x, 0),
                default="low"
            ),
            "timestamp": datetime.utcnow().isoformat()
        }
        await manager.broadcast_alert(alert_message)


@router.websocket("/detection/{camera_id}")
async def websocket_detection(websocket: WebSocket, camera_id: str):
    """
    نقطة اتصال WebSocket للكشف المباشر
    
    ترسل إحداثيات الكشف فقط (بدون صورة) لرسمها على الفيديو
    
    الرسائل المُرسلة:
    - {"type": "detection", "camera_id": "...", "detections": [...], "frame_width": 1920, "frame_height": 1080}
    """
    await manager.connect(websocket, {"type": "detection", "camera_id": camera_id})
    manager.subscribe_camera(websocket, camera_id)
    
    try:
        # إرسال رسالة ترحيب
        await manager.send_personal(websocket, {
            "type": "connected",
            "message": f"متصل بكشف الكاميرا: {camera_id}",
            "camera_id": camera_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        logger.info(f"Detection connection: {camera_id}")
        
        while True:
            try:
                # استقبال الرسائل
                data = await websocket.receive_json()
                
                action = data.get("action")
                
                if action == "ping":
                    manager.update_heartbeat(websocket)
                    await manager.send_personal(websocket, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                elif action == "pong":
                    manager.update_heartbeat(websocket)
                    
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        logger.info(f"Detection disconnected: {camera_id}")
    except Exception as e:
        logger.error(f"Detection WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)

