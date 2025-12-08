"""
روتر الإعدادات
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.database import get_db
from app.models.database import SystemSettings
from app.models.schemas import SystemSettingsResponse, SystemSettingsUpdate

router = APIRouter()

# الإعدادات الافتراضية
DEFAULT_SETTINGS = {
    "alert_sound": True,
    "auto_acknowledge": False,
    "retention_days": 30,
    "default_sensitivity": 0.7,
    "email_notifications": False,
    "sms_notifications": False,
    "webhook_url": None
}

@router.get("", response_model=SystemSettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    """جلب الإعدادات"""
    settings = {}
    
    result = await db.execute(select(SystemSettings))
    db_settings = result.scalars().all()
    
    # تحويل إلى قاموس
    for setting in db_settings:
        settings[setting.key] = setting.value
    
    # دمج مع الإعدادات الافتراضية
    final_settings = {**DEFAULT_SETTINGS, **settings}
    
    return SystemSettingsResponse(**final_settings)

@router.put("", response_model=SystemSettingsResponse)
async def update_settings(
    settings_data: SystemSettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """تحديث الإعدادات"""
    update_data = settings_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        # البحث عن الإعداد
        result = await db.execute(
            select(SystemSettings).where(SystemSettings.key == key)
        )
        setting = result.scalar_one_or_none()
        
        if setting:
            setting.value = str(value)
        else:
            new_setting = SystemSettings(key=key, value=str(value))
            db.add(new_setting)
    
    await db.commit()
    
    return await get_settings(db)
