// ═══════════════════════════════════════════════════════════════════════════
// نظرة - بطاقة الحادثة
// IncidentCard.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import type { Incident, IncidentStatus } from '../../types';
import { IncidentStatusColors, IncidentStatusIcons, WeaponTypeIcons } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface IncidentCardProps {
  incident: Incident;
  onReview: (id: string, status: 'مؤكدة' | 'إنذار كاذب') => void;
  onClose: (id: string) => void;
  onViewDetails: (incident: Incident) => void;
  isExpanded?: boolean;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onReview,
  onClose,
  onViewDetails,
  isExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(isExpanded);

  const getStatusColor = (status: IncidentStatus) => {
    return IncidentStatusColors[status] || '#6B7280';
  };

  const getStatusBgClass = (status: IncidentStatus) => {
    const bgMap: Record<IncidentStatus, string> = {
      'نشطة': 'bg-red-900/30 border-red-800',
      'مغلقة': 'bg-gray-800/50 border-gray-700',
      'تمت المراجعة': 'bg-orange-900/30 border-orange-800',
      'مؤكدة': 'bg-orange-900/40 border-orange-700',
      'إنذار كاذب': 'bg-green-900/30 border-green-800',
    };
    return bgMap[status] || 'bg-gray-800 border-gray-700';
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ar });
    } catch {
      return timestamp;
    }
  };

  const isActive = incident.status === 'نشطة';

  return (
    <div 
      className={`rounded-xl border-2 transition-all duration-300 ${getStatusBgClass(incident.status)} ${
        isActive ? 'shadow-lg shadow-red-900/20' : ''
      }`}
    >
      {/* رأس البطاقة */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* معلومات الحادثة */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {/* نوع السلاح */}
              <span className="text-2xl">
                {WeaponTypeIcons[incident.primaryWeaponType] || '⚠️'}
              </span>
              
              {/* اسم السلاح والحالة */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg">
                    {incident.primaryWeaponType}
                  </span>
                  <span 
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ 
                      backgroundColor: `${getStatusColor(incident.status)}20`,
                      color: getStatusColor(incident.status),
                      border: `1px solid ${getStatusColor(incident.status)}40`
                    }}
                  >
                    {IncidentStatusIcons[incident.status]} {incident.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  📹 {incident.cameraName}
                  {incident.location && ` • ${incident.location}`}
                </p>
              </div>
            </div>

            {/* إحصائيات */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-blue-400">🔔</span>
                <span>{incident.alertCount} تنبيه</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-green-400">📊</span>
                <span>{Math.round(incident.maxConfidence * 100)}% أعلى ثقة</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <span>⏱️</span>
                <span>{formatTime(incident.startedAt)}</span>
              </div>
            </div>
          </div>

          {/* الصورة المصغرة */}
          {incident.bestSnapshot && (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-700">
              <img
                src={
                  incident.bestSnapshot.startsWith('http') 
                    ? incident.bestSnapshot 
                    : `http://localhost:8000/${incident.bestSnapshot.replace(/^\/+/, '')}`
                }
                alt="لقطة الكشف"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23374151" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236B7280" font-size="12">لا صورة</text></svg>';
                }}
              />
            </div>
          )}

          {/* زر التوسيع */}
          <button className="text-gray-400 hover:text-white transition-colors p-1">
            <svg 
              className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* المحتوى الموسع */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">
          {/* تفاصيل إضافية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">عدد الكشوفات</p>
              <p className="text-white font-bold text-lg">{incident.detectionCount}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">متوسط الثقة</p>
              <p className="text-white font-bold text-lg">{Math.round(incident.avgConfidence * 100)}%</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">وقت البدء</p>
              <p className="text-white text-sm">{formatTime(incident.startedAt)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">آخر كشف</p>
              <p className="text-white text-sm">
                {incident.lastDetectionAt ? formatTime(incident.lastDetectionAt) : 'غير متاح'}
              </p>
            </div>
          </div>

          {/* الملاحظات */}
          {incident.notes && (
            <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
              <p className="text-gray-400 text-xs mb-1">📝 ملاحظات</p>
              <p className="text-gray-300 text-sm">{incident.notes}</p>
            </div>
          )}

          {/* معلومات المراجعة */}
          {incident.reviewedBy && (
            <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
              <p className="text-gray-400 text-xs mb-1">✅ تمت المراجعة بواسطة</p>
              <p className="text-gray-300 text-sm">
                {incident.reviewedBy}
                {incident.reviewedAt && ` • ${formatTime(incident.reviewedAt)}`}
              </p>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => onViewDetails(incident)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              عرض التفاصيل
            </button>

            {isActive && (
              <>
                <button
                  onClick={() => onReview(incident.id, 'مؤكدة')}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm"
                >
                  ✓ تأكيد التهديد
                </button>
                <button
                  onClick={() => onReview(incident.id, 'إنذار كاذب')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                >
                  ✗ إنذار كاذب
                </button>
                <button
                  onClick={() => onClose(incident.id)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                >
                  إغلاق الحادثة
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentCard;

