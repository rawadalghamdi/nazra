// ═══════════════════════════════════════════════════════════════════════════
// نظرة - تفاصيل التنبيه الكاملة
// AlertDetail.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import type { Alert, AlertStatus } from '../../types';
import { WeaponTypeIcons } from '../../types';

interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  onConfirm?: (id: string) => void;
  onMarkFalse?: (id: string) => void;
  onAddNote?: (id: string, note: string) => void;
}

// تنسيق التاريخ بالعربية
const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// الحصول على كلاس لون الحالة
const getStatusBgClass = (status: AlertStatus): string => {
  switch (status) {
    case 'جديد':
      return 'bg-red-600';
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

export const AlertDetail: React.FC<AlertDetailProps> = ({
  alert,
  onClose,
  onConfirm,
  onMarkFalse,
  onAddNote,
}) => {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [imageZoom, setImageZoom] = useState(1);
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // إغلاق عند النقر خارج النافذة
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // منع التمرير في الخلفية
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const handleAddNote = () => {
    if (noteText.trim() && onAddNote) {
      onAddNote(alert.id, noteText);
      setNoteText('');
      setShowNoteInput(false);
    }
  };

  const handleZoomIn = () => {
    setImageZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setImageZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setImageZoom(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700 animate-scale-in"
        dir="rtl"
      >
        {/* رأس النافذة */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="text-xl font-bold text-white">
                تفاصيل التنبيه #{alert.id.slice(-4)}
              </h2>
              <p className="text-gray-400 text-sm">{formatDateTime(alert.timestamp)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full text-white text-sm font-medium ${getStatusBgClass(alert.status)}`}
            >
              {alert.status}
            </span>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* محتوى النافذة */}
        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-180px)] overflow-hidden">
          {/* القسم الأيسر - الصورة/الفيديو */}
          <div className="lg:w-2/3 bg-gray-900 relative">
            {/* تبويبات صورة/فيديو */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setActiveTab('image')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'image'
                    ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="ml-2">📷</span>
                الصورة
              </button>
              <button
                onClick={() => setActiveTab('video')}
                disabled={!alert.videoClip}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'video'
                    ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                    : alert.videoClip
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                <span className="ml-2">🎬</span>
                الفيديو
              </button>
            </div>

            {/* عرض الصورة */}
            {activeTab === 'image' && (
              <div className="relative h-[400px] lg:h-[500px] overflow-hidden">
                {/* أدوات التكبير */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-gray-900/80 rounded-lg p-2">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 text-white hover:bg-gray-700 rounded transition-colors"
                    title="تصغير"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-white text-sm px-2">{(imageZoom * 100).toFixed(0)}%</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-2 text-white hover:bg-gray-700 rounded transition-colors"
                    title="تكبير"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-2 text-white hover:bg-gray-700 rounded transition-colors"
                    title="إعادة تعيين"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>

                {/* الصورة مع مربع الكشف */}
                <div
                  className="w-full h-full flex items-center justify-center overflow-auto"
                  style={{ cursor: imageZoom > 1 ? 'move' : 'default' }}
                >
                  <div className="relative" style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center' }}>
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
                          className="max-w-full max-h-[500px] object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = '0.5';
                          }}
                        />
                        {/* مربع الكشف */}
                        {alert.boundingBox && (
                          <div
                            className="absolute border-4 border-red-500 bg-red-500/20"
                            style={{
                              left: `${alert.boundingBox.x}%`,
                              top: `${alert.boundingBox.y}%`,
                              width: `${alert.boundingBox.width}%`,
                              height: `${alert.boundingBox.height}%`,
                            }}
                          >
                            <div className="absolute -top-8 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {alert.weaponType} - {alert.confidence.toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <div className="text-center">
                          <span className="text-6xl block mb-4">📷</span>
                          <p>لا توجد صورة متاحة</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* عرض الفيديو */}
            {activeTab === 'video' && (
              <div className="h-[400px] lg:h-[500px] flex items-center justify-center bg-black">
                {alert.videoClip ? (
                  <video
                    ref={videoRef}
                    src={alert.videoClip}
                    controls
                    className="max-w-full max-h-full"
                    autoPlay
                  >
                    المتصفح لا يدعم تشغيل الفيديو
                  </video>
                ) : (
                  <div className="text-center text-gray-600">
                    <span className="text-6xl block mb-4">🎬</span>
                    <p>لا يوجد فيديو متاح لهذا التنبيه</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* القسم الأيمن - التفاصيل */}
          <div className="lg:w-1/3 p-6 overflow-y-auto border-t lg:border-t-0 lg:border-r border-gray-700">
            {/* معلومات التنبيه */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">معلومات التنبيه</h3>

              {/* الكاميرا */}
              <div className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg">
                <span className="text-blue-400 text-xl">📹</span>
                <div>
                  <p className="text-gray-400 text-sm">الكاميرا</p>
                  <p className="text-white font-medium">{alert.cameraName}</p>
                </div>
              </div>

              {/* الموقع */}
              <div className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg">
                <span className="text-green-400 text-xl">📍</span>
                <div>
                  <p className="text-gray-400 text-sm">الموقع</p>
                  <p className="text-white font-medium">{alert.location}</p>
                </div>
              </div>

              {/* نوع السلاح */}
              <div className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg">
                <span className="text-xl">{WeaponTypeIcons[alert.weaponType]}</span>
                <div>
                  <p className="text-gray-400 text-sm">نوع السلاح</p>
                  <p className="text-red-400 font-bold text-lg">{alert.weaponType}</p>
                </div>
              </div>

              {/* نسبة الثقة */}
              <div className="p-3 bg-gray-900/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-xl">📊</span>
                    <span className="text-gray-400 text-sm">نسبة الثقة</span>
                  </div>
                  <span
                    className={`font-bold text-lg ${
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
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
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

              {/* إحداثيات مربع الكشف */}
              {alert.boundingBox && (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-400 text-xl">📐</span>
                    <span className="text-gray-400 text-sm">إحداثيات الكشف</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-800 rounded px-2 py-1">
                      <span className="text-gray-500">X:</span>
                      <span className="text-white mr-1">{alert.boundingBox.x.toFixed(1)}%</span>
                    </div>
                    <div className="bg-gray-800 rounded px-2 py-1">
                      <span className="text-gray-500">Y:</span>
                      <span className="text-white mr-1">{alert.boundingBox.y.toFixed(1)}%</span>
                    </div>
                    <div className="bg-gray-800 rounded px-2 py-1">
                      <span className="text-gray-500">العرض:</span>
                      <span className="text-white mr-1">{alert.boundingBox.width.toFixed(1)}%</span>
                    </div>
                    <div className="bg-gray-800 rounded px-2 py-1">
                      <span className="text-gray-500">الارتفاع:</span>
                      <span className="text-white mr-1">{alert.boundingBox.height.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* سجل المراجعة */}
              {alert.reviewedBy && (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-cyan-400 text-xl">👤</span>
                    <span className="text-gray-400 text-sm">المراجعة</span>
                  </div>
                  <p className="text-white text-sm">
                    تمت المراجعة بواسطة: <span className="font-medium">{alert.reviewedBy}</span>
                  </p>
                  {alert.reviewedAt && (
                    <p className="text-gray-500 text-xs mt-1">
                      {formatDateTime(alert.reviewedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* الملاحظات */}
              {alert.notes && (
                <div className="p-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-400 text-xl">📝</span>
                    <span className="text-gray-400 text-sm">الملاحظات</span>
                  </div>
                  <p className="text-white text-sm">{alert.notes}</p>
                </div>
              )}

              {/* إضافة ملاحظة جديدة */}
              {showNoteInput && (
                <div className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="أضف ملاحظتك هنا..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none h-24"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNote}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      حفظ الملاحظة
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
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onConfirm?.(alert.id)}
              disabled={alert.status === 'مؤكد'}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                alert.status === 'مؤكد'
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <span>✅</span>
              <span>تأكيد التهديد</span>
            </button>
            <button
              onClick={() => onMarkFalse?.(alert.id)}
              disabled={alert.status === 'إنذار كاذب'}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                alert.status === 'إنذار كاذب'
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <span>❌</span>
              <span>إنذار كاذب</span>
            </button>
            <button
              onClick={() => setShowNoteInput(!showNoteInput)}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <span>📝</span>
              <span>إضافة ملاحظة</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDetail;
