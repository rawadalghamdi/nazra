"""
مخططات Pydantic
================
"""

from app.schemas.alert import (
    AlertBase,
    AlertCreate,
    AlertUpdate,
    AlertReview,
    AlertResponse,
    AlertStats,
    AlertListResponse,
)
from app.schemas.camera import (
    CameraBase,
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraStatus as CameraStatusResponse,
    CameraTestResult,
)

__all__ = [
    # Alert Schemas
    "AlertBase",
    "AlertCreate",
    "AlertUpdate",
    "AlertReview",
    "AlertResponse",
    "AlertStats",
    "AlertListResponse",
    # Camera Schemas
    "CameraBase",
    "CameraCreate",
    "CameraUpdate",
    "CameraResponse",
    "CameraStatusResponse",
    "CameraTestResult",
]
