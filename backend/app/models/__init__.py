"""
نماذج قاعدة البيانات
====================
"""

from app.models.camera import Camera
from app.models.alert import Alert, AlertStatus, WeaponType
from app.models.incident import Incident, IncidentStatus
from app.models.user import User

__all__ = [
    "Camera",
    "Alert",
    "AlertStatus",
    "WeaponType",
    "Incident",
    "IncidentStatus",
    "User",
]
