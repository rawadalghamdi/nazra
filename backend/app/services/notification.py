"""
خدمة الإشعارات - Notification Service
======================================
إرسال الإشعارات عبر قنوات متعددة
"""

import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass
import logging
import json

from app.config import settings

# إعداد السجل
logger = logging.getLogger("نظرة.الإشعارات")

# استيراد اختياري
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    httpx = None
    HTTPX_AVAILABLE = False


@dataclass
class Notification:
    """
    إشعار واحد
    """
    id: str
    title: str
    message: str
    notification_type: str  # alert, info, warning, error
    priority: str  # critical, high, medium, low
    data: Optional[Dict] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "title": self.title,
            "message": self.message,
            "type": self.notification_type,
            "priority": self.priority,
            "data": self.data,
            "timestamp": self.timestamp.isoformat()
        }


class NotificationService:
    """
    خدمة الإشعارات
    ==============
    ترسل الإشعارات عبر قنوات متعددة
    """
    
    def __init__(self):
        self.enabled = settings.NOTIFICATION_ENABLED
        self.sound_enabled = settings.NOTIFICATION_SOUND
        self.email_enabled = settings.EMAIL_ENABLED
        self.sms_enabled = settings.SMS_ENABLED
        
        # قائمة الإشعارات الأخيرة
        self._recent_notifications: List[Notification] = []
        self._max_recent = 100
        
        # المستمعين
        self._listeners: List[Any] = []
        
        logger.info("🔔 تم تهيئة خدمة الإشعارات")
    
    async def send_alert_notification(
        self,
        alert_id: str,
        camera_name: str,
        weapon_type: str,
        location: str,
        confidence: float,
        image_url: Optional[str] = None
    ) -> bool:
        """
        إرسال إشعار تنبيه جديد
        """
        if not self.enabled:
            return False
        
        # تحديد الأولوية بناءً على نوع السلاح
        priority = "critical" if weapon_type in ["مسدس", "بندقية"] else "high"
        
        notification = Notification(
            id=alert_id,
            title=f"🚨 تنبيه أمني - {weapon_type}",
            message=f"تم اكتشاف {weapon_type} في {location} عبر {camera_name} (ثقة: {confidence:.0%})",
            notification_type="alert",
            priority=priority,
            data={
                "alert_id": alert_id,
                "camera_name": camera_name,
                "weapon_type": weapon_type,
                "location": location,
                "confidence": confidence,
                "image_url": image_url
            }
        )
        
        return await self._send_notification(notification)
    
    async def send_camera_notification(
        self,
        camera_id: str,
        camera_name: str,
        status: str,
        message: str
    ) -> bool:
        """
        إرسال إشعار حالة كاميرا
        """
        if not self.enabled:
            return False
        
        notification_type = "warning" if status in ["error", "offline"] else "info"
        priority = "high" if status == "error" else "medium"
        
        notification = Notification(
            id=f"camera_{camera_id}_{datetime.utcnow().timestamp()}",
            title=f"📷 {camera_name} - {status}",
            message=message,
            notification_type=notification_type,
            priority=priority,
            data={
                "camera_id": camera_id,
                "camera_name": camera_name,
                "status": status
            }
        )
        
        return await self._send_notification(notification)
    
    async def send_system_notification(
        self,
        title: str,
        message: str,
        notification_type: str = "info",
        priority: str = "medium",
        data: Optional[Dict] = None
    ) -> bool:
        """
        إرسال إشعار نظام عام
        """
        if not self.enabled:
            return False
        
        notification = Notification(
            id=f"system_{datetime.utcnow().timestamp()}",
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            data=data
        )
        
        return await self._send_notification(notification)
    
    async def _send_notification(self, notification: Notification) -> bool:
        """
        إرسال الإشعار عبر جميع القنوات
        """
        logger.info(f"📤 إرسال إشعار: {notification.title}")
        
        # حفظ في القائمة الأخيرة
        self._recent_notifications.insert(0, notification)
        if len(self._recent_notifications) > self._max_recent:
            self._recent_notifications.pop()
        
        success = True
        
        # إرسال للمستمعين (WebSocket)
        for listener in self._listeners:
            try:
                await listener(notification.to_dict())
            except Exception as e:
                logger.error(f"❌ خطأ في إرسال للمستمع: {e}")
        
        # إرسال بريد إلكتروني
        if self.email_enabled and notification.priority in ["critical", "high"]:
            email_sent = await self._send_email(notification)
            if not email_sent:
                logger.warning("⚠️ فشل إرسال البريد الإلكتروني")
        
        # إرسال SMS
        if self.sms_enabled and notification.priority == "critical":
            sms_sent = await self._send_sms(notification)
            if not sms_sent:
                logger.warning("⚠️ فشل إرسال الرسالة النصية")
        
        logger.info(f"✅ تم إرسال الإشعار: {notification.id}")
        
        return success
    
    async def _send_email(self, notification: Notification) -> bool:
        """
        إرسال بريد إلكتروني
        """
        # TODO: تنفيذ إرسال البريد الإلكتروني
        logger.info(f"📧 إرسال بريد إلكتروني: {notification.title}")
        return True
    
    async def _send_sms(self, notification: Notification) -> bool:
        """
        إرسال رسالة نصية
        """
        # TODO: تنفيذ إرسال الرسائل النصية
        logger.info(f"📱 إرسال رسالة نصية: {notification.title}")
        return True
    
    async def _send_webhook(self, notification: Notification, webhook_url: str) -> bool:
        """
        إرسال إشعار عبر Webhook
        """
        if not HTTPX_AVAILABLE:
            logger.warning("⚠️ httpx غير متوفر")
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook_url,
                    json=notification.to_dict(),
                    timeout=10.0
                )
                return response.is_success
        except Exception as e:
            logger.error(f"❌ خطأ في Webhook: {e}")
            return False
    
    def add_listener(self, callback):
        """
        إضافة مستمع للإشعارات
        """
        self._listeners.append(callback)
    
    def remove_listener(self, callback):
        """
        إزالة مستمع
        """
        if callback in self._listeners:
            self._listeners.remove(callback)
    
    def get_recent_notifications(self, limit: int = 20) -> List[Dict]:
        """
        جلب الإشعارات الأخيرة
        """
        return [n.to_dict() for n in self._recent_notifications[:limit]]
    
    def clear_notifications(self):
        """
        مسح الإشعارات
        """
        self._recent_notifications.clear()
        logger.info("🗑️ تم مسح الإشعارات")


# إنشاء خدمة الإشعارات العامة
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    """
    الحصول على خدمة الإشعارات العامة
    """
    global _notification_service
    
    if _notification_service is None:
        _notification_service = NotificationService()
    
    return _notification_service


async def send_alert(
    alert_id: str,
    camera_name: str,
    weapon_type: str,
    location: str,
    confidence: float,
    image_url: Optional[str] = None
) -> bool:
    """
    دالة مساعدة لإرسال إشعار تنبيه
    """
    service = get_notification_service()
    return await service.send_alert_notification(
        alert_id=alert_id,
        camera_name=camera_name,
        weapon_type=weapon_type,
        location=location,
        confidence=confidence,
        image_url=image_url
    )
