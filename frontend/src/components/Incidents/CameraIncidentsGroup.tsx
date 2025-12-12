// ═══════════════════════════════════════════════════════════════════════════
// نظرة - مجموعة حوادث الكاميرا
// CameraIncidentsGroup.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import type { CameraIncidentsSummary, Incident } from '../../types';
import { IncidentCard } from './IncidentCard';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CameraIncidentsGroupProps {
  camera: CameraIncidentsSummary;
  onReviewIncident: (id: string, status: 'مؤكدة' | 'إنذار كاذب') => void;
  onCloseIncident: (id: string) => void;
  onViewIncidentDetails: (incident: Incident) => void;
  defaultExpanded?: boolean;
}

export const CameraIncidentsGroup: React.FC<CameraIncidentsGroupProps> = ({
  camera,
  onReviewIncident,
  onCloseIncident,
  onViewIncidentDetails,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded || camera.activeIncidents > 0);

  const hasActiveIncidents = camera.activeIncidents > 0;

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ar });
    } catch {
      return timestamp;
    }
  };

  return (
    <div 
      className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
        hasActiveIncidents 
          ? 'bg-red-950/30 border-red-800/50 shadow-lg shadow-red-900/10' 
          : 'bg-gray-800/30 border-gray-700/50'
      }`}
    >
      {/* رأس المجموعة - الكاميرا */}
      <div 
        className={`p-4 cursor-pointer transition-colors ${
          hasActiveIncidents ? 'hover:bg-red-900/20' : 'hover:bg-gray-700/30'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* معلومات الكاميرا */}
          <div className="flex items-center gap-4">
            {/* أيقونة الكاميرا مع مؤشر الحالة */}
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                hasActiveIncidents ? 'bg-red-900/50' : 'bg-gray-700/50'
              }`}>
                📹
              </div>
              {hasActiveIncidents && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse">
                  {camera.activeIncidents}
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                {camera.cameraName}
                {hasActiveIncidents && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
                    🔴 نشطة
                  </span>
                )}
              </h3>
              <p className="text-gray-400 text-sm">
                {camera.location || 'موقع غير محدد'}
              </p>
            </div>
          </div>

          {/* إحصائيات سريعة */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{camera.totalIncidents}</p>
              <p className="text-xs text-gray-400">حادثة</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{camera.totalAlerts}</p>
              <p className="text-xs text-gray-400">تنبيه</p>
            </div>
            {camera.lastIncidentAt && (
              <div className="text-center hidden md:block">
                <p className="text-sm text-gray-300">{formatTime(camera.lastIncidentAt)}</p>
                <p className="text-xs text-gray-500">آخر حادثة</p>
              </div>
            )}

            {/* زر التوسيع */}
            <button className="text-gray-400 hover:text-white transition-colors p-2">
              <svg 
                className={`w-6 h-6 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* قائمة الحوادث */}
      {expanded && (
        <div className="border-t border-gray-700/50">
          {camera.incidents.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <span className="text-4xl mb-2 block">✅</span>
              <p>لا توجد حوادث لهذه الكاميرا</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {camera.incidents.map((incident, index) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onReview={onReviewIncident}
                  onClose={onCloseIncident}
                  onViewDetails={onViewIncidentDetails}
                  isExpanded={index === 0 && incident.status === 'نشطة'}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CameraIncidentsGroup;

