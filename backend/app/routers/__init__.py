"""
روترات API
===========
"""

from app.routers.alerts import router as alerts_router
from app.routers.cameras import router as cameras_router
from app.routers.stream import router as stream_router
from app.routers.websocket import router as websocket_router

__all__ = [
    "alerts_router",
    "cameras_router",
    "stream_router",
    "websocket_router",
]
