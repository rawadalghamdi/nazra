// ═══════════════════════════════════════════════════════════════════════════
// نظرة - نافذة التنبيه المنبثقة
// AlertPopup.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import type { Alert } from '../../types';
import { WeaponTypeIcons } from '../../types';
import { useAlertSound } from '../../hooks/useAlertSound';

interface AlertPopupProps {
  alert: Alert;
  onDismiss: () => void;
  onConfirm?: (id: string) => void;
  onMarkFalse?: (id: string) => void;
  onViewDetails?: (alert: Alert) => void;
  autoCloseDelay?: number; // بالثواني، 0 = لا يغلق تلقائياً
}

// تنسيق الوقت
const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const AlertPopup: React.FC<AlertPopupProps> = ({
  alert,
  onDismiss,
  onConfirm,
  onMarkFalse,
  onViewDetails,
  autoCloseDelay = 0,
}) => {
  const [isFlashing, setIsFlashing] = useState(true);
  const [countdown, setCountdown] = useState(autoCloseDelay);
  const popupRef = useRef<HTMLDivElement>(null);
  const { playAlertSound, stopAlertSound } = useAlertSound();

  // تشغيل صوت التنبيه
  useEffect(() => {
    playAlertSound();
    return () => {
      stopAlertSound();
    };
  }, [playAlertSound, stopAlertSound]);

  // تأثير الوميض
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlashing((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // العد التنازلي للإغلاق التلقائي
  useEffect(() => {
    if (autoCloseDelay <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoCloseDelay, onDismiss]);

  // تأثير الاهتزاز عند الظهور
  useEffect(() => {
    if (popupRef.current) {
      popupRef.current.classList.add('animate-shake');
      setTimeout(() => {
        popupRef.current?.classList.remove('animate-shake');
      }, 820);
    }
  }, []);

  const handleConfirm = () => {
    stopAlertSound();
    onConfirm?.(alert.id);
    onDismiss();
  };

  const handleMarkFalse = () => {
    stopAlertSound();
    onMarkFalse?.(alert.id);
    onDismiss();
  };

  const handleViewDetails = () => {
    stopAlertSound();
    onViewDetails?.(alert);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* خلفية وميضية */}
      <div
        className={`absolute inset-0 transition-colors duration-300 ${
          isFlashing ? 'bg-red-900/30' : 'bg-transparent'
        }`}
      />

      {/* النافذة المنبثقة */}
      <div
        ref={popupRef}
        className={`
          relative bg-gray-900 rounded-2xl w-full max-w-lg mx-4 overflow-hidden
          shadow-2xl transform transition-all
          ${isFlashing ? 'ring-4 ring-red-500 shadow-red-500/50' : 'ring-2 ring-red-600'}
        `}
        dir="rtl"
      >
        {/* شريط التنبيه العلوي المتحرك */}
        <div className="relative h-2 bg-red-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-gradient-x" />
        </div>

        {/* محتوى التنبيه */}
        <div className="p-6">
          {/* الرأس */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={`text-4xl ${isFlashing ? 'animate-bounce' : ''}`}>🚨</span>
              <div>
                <h2 className="text-2xl font-bold text-red-500">تنبيه أمني!</h2>
                <p className="text-gray-400 text-sm">تم رصد تهديد محتمل</p>
              </div>
            </div>
            {autoCloseDelay > 0 && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-full px-3 py-1">
                <span className="text-gray-400 text-sm">إغلاق خلال</span>
                <span className="text-white font-bold">{countdown}ث</span>
              </div>
            )}
          </div>

          {/* معلومات التنبيه */}
          <div className="bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
            {/* الصورة */}
            {alert.imageSnapshot && (
              <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden mb-4">
                <img
                  src={
                    alert.imageSnapshot.startsWith('data:') 
                      ? alert.imageSnapshot 
                      : alert.imageSnapshot.startsWith('http')
                        ? alert.imageSnapshot
                        : `http://localhost:8000/${alert.imageSnapshot.replace(/^\/+/, '')}`
                  }
                  alt="صورة الرصد"
                  className="w-full h-full object-cover"
                />
                {/* مربع الكشف */}
                {alert.boundingBox && (
                  <div
                    className={`absolute border-3 ${isFlashing ? 'border-red-400' : 'border-red-600'} bg-red-500/20`}
                    style={{
                      left: `${alert.boundingBox.x}%`,
                      top: `${alert.boundingBox.y}%`,
                      width: `${alert.boundingBox.width}%`,
                      height: `${alert.boundingBox.height}%`,
                    }}
                  />
                )}
                {/* شارة نوع السلاح */}
                <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                  <span>{WeaponTypeIcons[alert.weaponType]}</span>
                  <span>{alert.weaponType}</span>
                </div>
              </div>
            )}

            {/* تفاصيل */}
            <div className="grid grid-cols-2 gap-3">
              {/* الكاميرا */}
              <div className="flex items-center gap-2">
                <span className="text-blue-400">📹</span>
                <span className="text-white text-sm">{alert.cameraName}</span>
              </div>

              {/* الوقت */}
              <div className="flex items-center gap-2">
                <span className="text-purple-400">🕐</span>
                <span className="text-white text-sm" dir="ltr">{formatTime(alert.timestamp)}</span>
              </div>

              {/* الموقع */}
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-green-400">📍</span>
                <span className="text-white text-sm">{alert.location}</span>
              </div>
            </div>

            {/* نسبة الثقة */}
            <div className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3">
              <span className="text-gray-400">نسبة الثقة</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${alert.confidence}%` }}
                  />
                </div>
                <span className="text-red-400 font-bold">{alert.confidence.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleConfirm}
              className="flex flex-col items-center gap-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
            >
              <span className="text-2xl">✅</span>
              <span className="text-sm font-medium">تأكيد</span>
            </button>
            <button
              onClick={handleMarkFalse}
              className="flex flex-col items-center gap-1 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
            >
              <span className="text-2xl">❌</span>
              <span className="text-sm font-medium">كاذب</span>
            </button>
            <button
              onClick={handleViewDetails}
              className="flex flex-col items-center gap-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
            >
              <span className="text-2xl">👁️</span>
              <span className="text-sm font-medium">التفاصيل</span>
            </button>
          </div>

          {/* زر الإغلاق */}
          <button
            onClick={() => {
              stopAlertSound();
              onDismiss();
            }}
            className="w-full mt-3 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors text-sm"
          >
            تجاهل مؤقتاً
          </button>
        </div>

        {/* شريط التنبيه السفلي المتحرك */}
        <div className="relative h-2 bg-red-900 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-gradient-x-reverse" />
        </div>
      </div>
    </div>
  );
};

export default AlertPopup;
