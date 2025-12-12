// ═══════════════════════════════════════════════════════════════════════════
// نظرة - بطاقة التنبيه الواحد
// AlertCard.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import type { Alert, AlertStatus, WeaponType } from '../../types';
import { AlertStatusColors, WeaponTypeIcons } from '../../types';

interface AlertCardProps {
  alert: Alert;
  onConfirm?: (id: string) => void;
  onMarkFalse?: (id: string) => void;
  onViewVideo?: (id: string) => void;
  onAddNote?: (id: string, note: string) => void;
  onViewDetails?: (alert: Alert) => void;
  isCompact?: boolean;
}

// تنسيق التاريخ بالعربية
const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// الحصول على لون الحالة
export const getStatusColor = (status: AlertStatus): string => {
  return AlertStatusColors[status] || '#6B7280';
};

// الحصول على كلاس خلفية الحالة
const getStatusBgClass = (status: AlertStatus): string => {
  switch (status) {
    case 'جديد':
      return 'bg-red-600 animate-pulse';
    case 'قيد المراجعة':
      return 'bg-orange-500';
    case 'مؤكد':
      return 'bg-green-600';
    case 'إنذار كاذب':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
};

// الحصول على كلاس حدود البطاقة
const getCardBorderClass = (status: AlertStatus): string => {
  switch (status) {
    case 'جديد':
      return 'border-red-500 border-2 shadow-red-500/20 shadow-lg animate-border-pulse';
    case 'قيد المراجعة':
      return 'border-orange-500 border-2';
    case 'مؤكد':
      return 'border-green-500 border-2';
    case 'إنذار كاذب':
      return 'border-gray-500 border';
    default:
      return 'border-gray-700 border';
  }
};

// الحصول على أيقونة السلاح
const getWeaponIcon = (weaponType: WeaponType): string => {
  return WeaponTypeIcons[weaponType] || '⚠️';
};

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onConfirm,
  onMarkFalse,
  onViewVideo,
  onAddNote,
  onViewDetails,
  isCompact = false,
}) => {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');

  const handleAddNote = () => {
    if (noteText.trim() && onAddNote) {
      onAddNote(alert.id, noteText);
      setNoteText('');
      setShowNoteInput(false);
    }
  };

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(alert);
    }
  };

  return (
    <div
      className={`
        bg-gray-800 rounded-xl overflow-hidden transition-all duration-300
        hover:transform hover:scale-[1.02] hover:shadow-xl
        ${getCardBorderClass(alert.status)}
        ${alert.status === 'جديد' ? 'ring-2 ring-red-500 ring-opacity-50' : ''}
      `}
    >
      {/* رأس البطاقة */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-xl">⚠️</span>
          <span className="text-white font-bold">تنبيه #{alert.id.slice(-4)}</span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getStatusBgClass(alert.status)}`}
        >
          {alert.status}
        </span>
      </div>

      {/* محتوى البطاقة */}
      <div className="p-4">
        <div className={`flex ${isCompact ? 'flex-col' : 'flex-row'} gap-4`}>
          {/* صورة الرصد */}
          <div
            className={`relative ${isCompact ? 'w-full h-40' : 'w-40 h-32'} bg-gray-900 rounded-lg overflow-hidden cursor-pointer group`}
            onClick={handleCardClick}
          >
            {alert.imageSnapshot ? (
              <>
                <img
                  src={
                    alert.imageSnapshot.startsWith('data:') 
                      ? alert.imageSnapshot 
                      : alert.imageSnapshot.startsWith('http')
                        ? alert.imageSnapshot
                        : `http://localhost:8000/${alert.imageSnapshot.replace(/^\/+/, '')}`
                  }
                  alt="صورة الرصد"
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {/* مربع الكشف */}
                {alert.boundingBox && (
                  <div
                    className="absolute border-2 border-red-500 bg-red-500/20 animate-pulse"
                    style={{
                      left: `${alert.boundingBox.x}%`,
                      top: `${alert.boundingBox.y}%`,
                      width: `${alert.boundingBox.width}%`,
                      height: `${alert.boundingBox.height}%`,
                    }}
                  />
                )}
                {/* شارة التكبير */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-2xl">🔍</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                <span className="text-4xl">📷</span>
              </div>
            )}
          </div>

          {/* تفاصيل التنبيه */}
          <div className="flex-1 space-y-2">
            {/* الكاميرا */}
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-blue-400">📹</span>
              <span className="font-medium">{alert.cameraName}</span>
            </div>

            {/* الموقع */}
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="text-green-400">📍</span>
              <span>{alert.location}</span>
            </div>

            {/* الوقت */}
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="text-purple-400">🕐</span>
              <span dir="ltr">
                {formatTime(alert.timestamp)} - {formatDate(alert.timestamp)}
              </span>
            </div>

            {/* نوع السلاح */}
            <div className="flex items-center gap-2 text-gray-300">
              <span>{getWeaponIcon(alert.weaponType)}</span>
              <span className="font-medium text-red-400">{alert.weaponType}</span>
            </div>

            {/* نسبة الثقة */}
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">📊</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-sm">نسبة الثقة</span>
                  <span
                    className={`font-bold ${
                      alert.confidence >= 90
                        ? 'text-red-400'
                        : alert.confidence >= 70
                          ? 'text-orange-400'
                          : 'text-yellow-400'
                    }`}
                  >
                    {alert.confidence.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      alert.confidence >= 90
                        ? 'bg-red-500'
                        : alert.confidence >= 70
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                    }`}
                    style={{ width: `${alert.confidence}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* الملاحظات الموجودة */}
        {alert.notes && (
          <div className="mt-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <span>📝</span>
              <span>ملاحظة:</span>
            </div>
            <p className="text-gray-300 text-sm">{alert.notes}</p>
          </div>
        )}

        {/* معلومات المراجعة */}
        {alert.reviewedBy && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
            <span>👤</span>
            <span>تمت المراجعة بواسطة: {alert.reviewedBy}</span>
            {alert.reviewedAt && (
              <span>- {new Date(alert.reviewedAt).toLocaleString('ar-SA')}</span>
            )}
          </div>
        )}
      </div>

      {/* إدخال الملاحظة */}
      {showNoteInput && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="أضف ملاحظتك هنا..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleAddNote}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              حفظ
            </button>
            <button
              onClick={() => setShowNoteInput(false)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* أزرار الإجراءات */}
      <div className="grid grid-cols-4 gap-px bg-gray-700 border-t border-gray-700">
        {/* زر التأكيد */}
        <button
          onClick={() => onConfirm?.(alert.id)}
          disabled={alert.status === 'مؤكد'}
          className={`
            flex items-center justify-center gap-2 py-3 transition-colors
            ${
              alert.status === 'مؤكد'
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-800 text-green-400 hover:bg-green-900/50 hover:text-green-300'
            }
          `}
        >
          <span>✅</span>
          <span className="text-sm">تأكيد</span>
        </button>

        {/* زر إنذار كاذب */}
        <button
          onClick={() => onMarkFalse?.(alert.id)}
          disabled={alert.status === 'إنذار كاذب'}
          className={`
            flex items-center justify-center gap-2 py-3 transition-colors
            ${
              alert.status === 'إنذار كاذب'
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-800 text-red-400 hover:bg-red-900/50 hover:text-red-300'
            }
          `}
        >
          <span>❌</span>
          <span className="text-sm">كاذب</span>
        </button>

        {/* زر الفيديو */}
        <button
          onClick={() => onViewVideo?.(alert.id)}
          disabled={!alert.videoClip}
          className={`
            flex items-center justify-center gap-2 py-3 transition-colors
            ${
              alert.videoClip
                ? 'bg-gray-800 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
        >
          <span>👁️</span>
          <span className="text-sm">فيديو</span>
        </button>

        {/* زر الملاحظة */}
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="flex items-center justify-center gap-2 py-3 bg-gray-800 text-yellow-400 hover:bg-yellow-900/50 hover:text-yellow-300 transition-colors"
        >
          <span>📝</span>
          <span className="text-sm">ملاحظة</span>
        </button>
      </div>
    </div>
  );
};

export default AlertCard;
