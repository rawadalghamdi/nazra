// ═══════════════════════════════════════════════════════════════════════════
// نظرة - صفحة الحوادث الرئيسية (الكاميرا أولاً)
// IncidentsPage.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import type { Incident, IncidentsByCamera, IncidentStats } from '../../types';
import { CameraIncidentsGroup } from './CameraIncidentsGroup';
import { incidentService } from '../../services/api';
import { useAlertWebSocket } from '../../hooks/useWebSocket';

type FilterStatus = 'الكل' | 'نشطة' | 'مغلقة' | 'مؤكدة' | 'إنذار كاذب';

export const IncidentsPage: React.FC = () => {
  const [incidentsByCamera, setIncidentsByCamera] = useState<IncidentsByCamera | null>(null);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('الكل');
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // WebSocket للتنبيهات الفورية
  const { isConnected } = useAlertWebSocket();

  // جلب البيانات
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [incidentsData, statsData] = await Promise.all([
        incidentService.getByCamera(activeOnly),
        incidentService.getStats(),
      ]);
      setIncidentsByCamera(incidentsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError('حدث خطأ أثناء جلب الحوادث');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // تحديث تلقائي كل 30 ثانية
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeOnly]);

  // معالجة مراجعة الحادثة
  const handleReviewIncident = async (id: string, status: 'مؤكدة' | 'إنذار كاذب') => {
    try {
      await incidentService.review(id, {
        status,
        reviewedBy: 'المشرف', // يمكن تغييره للمستخدم الحالي
      });
      fetchData(); // إعادة تحميل البيانات
    } catch (err) {
      console.error('Error reviewing incident:', err);
    }
  };

  // معالجة إغلاق الحادثة
  const handleCloseIncident = async (id: string) => {
    try {
      await incidentService.close(id);
      fetchData();
    } catch (err) {
      console.error('Error closing incident:', err);
    }
  };

  // معالجة عرض التفاصيل
  const handleViewDetails = (incident: Incident) => {
    setSelectedIncident(incident);
  };

  // فلترة الكاميرات
  const filteredCameras = incidentsByCamera?.cameras.filter(camera => {
    if (filterStatus === 'الكل') return true;
    if (filterStatus === 'نشطة') return camera.activeIncidents > 0;
    return camera.incidents.some(inc => inc.status === filterStatus);
  }) || [];

  return (
    <div className="min-h-screen bg-gray-900 p-6" dir="rtl">
      {/* رأس الصفحة */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              الحوادث
            </h1>
            <p className="text-gray-400 mt-1">
              عرض الحوادث مجمعة حسب الكاميرا - أسهل للمراجعة والمتابعة
            </p>
          </div>

          {/* أزرار التحكم */}
          <div className="flex items-center gap-4">
            {/* مؤشر الاتصال */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              isConnected 
                ? 'bg-green-900/30 border-green-800' 
                : 'bg-yellow-900/30 border-yellow-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              }`}></span>
              <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
                {isConnected ? 'مباشر' : 'غير متصل'}
              </span>
            </div>

            {/* زر التحديث */}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              تحديث
            </button>
          </div>
        </div>

        {/* الإحصائيات */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-400">🔴</span>
                <span className="text-red-400 text-sm">نشطة</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalActive}</p>
            </div>
            <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400">📅</span>
                <span className="text-blue-400 text-sm">اليوم</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalToday}</p>
            </div>
            <div className="bg-orange-900/30 border border-orange-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-orange-400">⚠️</span>
                <span className="text-orange-400 text-sm">مؤكدة</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalConfirmed}</p>
            </div>
            <div className="bg-green-900/30 border border-green-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-400">✅</span>
                <span className="text-green-400 text-sm">إنذارات كاذبة</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalFalseAlarms}</p>
            </div>
            <div className="bg-purple-900/30 border border-purple-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-400">📹</span>
                <span className="text-purple-400 text-sm">كاميرات</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.camerasWithIncidents}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400">🔔</span>
                <span className="text-gray-400 text-sm">إجمالي التنبيهات</span>
              </div>
              <p className="text-2xl font-bold text-white">{incidentsByCamera?.totalAlerts || 0}</p>
            </div>
          </div>
        )}

        {/* فلاتر */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* فلتر الحالة */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">الحالة:</span>
            <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 p-1">
              {(['الكل', 'نشطة', 'مغلقة', 'مؤكدة', 'إنذار كاذب'] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* عرض النشطة فقط */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">عرض النشطة فقط</span>
          </label>
        </div>
      </div>

      {/* المحتوى */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">جاري تحميل الحوادث...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <span className="text-6xl mb-4 block">⚠️</span>
              <h3 className="text-xl font-medium text-white mb-2">خطأ في التحميل</h3>
              <p className="text-gray-400 mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        ) : filteredCameras.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <span className="text-6xl mb-4 block">🎉</span>
              <h3 className="text-xl font-medium text-white mb-2">لا توجد حوادث</h3>
              <p className="text-gray-400">
                {activeOnly || filterStatus !== 'الكل'
                  ? 'جرب تغيير الفلاتر للعثور على نتائج'
                  : 'النظام آمن حالياً - لا توجد حوادث مسجلة'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCameras.map((camera) => (
              <CameraIncidentsGroup
                key={camera.cameraId}
                camera={camera}
                onReviewIncident={handleReviewIncident}
                onCloseIncident={handleCloseIncident}
                onViewIncidentDetails={handleViewDetails}
                defaultExpanded={camera.activeIncidents > 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* نافذة تفاصيل الحادثة */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onReview={handleReviewIncident}
          onCloseIncident={handleCloseIncident}
        />
      )}
    </div>
  );
};

// نافذة تفاصيل الحادثة
const IncidentDetailModal: React.FC<{
  incident: Incident;
  onClose: () => void;
  onReview: (id: string, status: 'مؤكدة' | 'إنذار كاذب') => void;
  onCloseIncident: (id: string) => void;
}> = ({ incident, onClose, onReview, onCloseIncident }) => {
  const [fullIncident, setFullIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await incidentService.getById(incident.id);
        setFullIncident(data);
      } catch (err) {
        console.error('Error fetching incident details:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [incident.id]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس النافذة */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🎯 تفاصيل الحادثة
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            ✕
          </button>
        </div>

        {/* المحتوى */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-400">جاري التحميل...</p>
            </div>
          ) : fullIncident ? (
            <div className="space-y-6">
              {/* معلومات الحادثة */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">الكاميرا</p>
                  <p className="text-white font-medium">{fullIncident.cameraName}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">نوع السلاح</p>
                  <p className="text-white font-medium">{fullIncident.primaryWeaponType}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">عدد التنبيهات</p>
                  <p className="text-white font-medium">{fullIncident.alertCount}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">أعلى ثقة</p>
                  <p className="text-white font-medium">{Math.round(fullIncident.maxConfidence * 100)}%</p>
                </div>
              </div>

              {/* الصورة الرئيسية */}
              {fullIncident.bestSnapshot && (
                <div className="rounded-xl overflow-hidden border border-gray-700">
                  <img
                    src={
                      fullIncident.bestSnapshot.startsWith('http') 
                        ? fullIncident.bestSnapshot 
                        : `http://localhost:8000/${fullIncident.bestSnapshot.replace(/^\/+/, '')}`
                    }
                    alt="أفضل لقطة"
                    className="w-full h-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* قائمة التنبيهات */}
              {fullIncident.alerts && fullIncident.alerts.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-3">
                    التنبيهات ({fullIncident.alerts.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {fullIncident.alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className="flex items-center justify-between bg-gray-700/30 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {alert.weaponType === 'مسدس' ? '🔫' : '🔪'}
                          </span>
                          <div>
                            <p className="text-white text-sm">{alert.weaponType}</p>
                            <p className="text-gray-400 text-xs">{new Date(alert.timestamp).toLocaleString('ar-SA')}</p>
                          </div>
                        </div>
                        <span className="text-green-400 font-medium">
                          {Math.round(alert.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* أزرار الإجراءات */}
              {fullIncident.status === 'نشطة' && (
                <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => {
                      onReview(fullIncident.id, 'مؤكدة');
                      onClose();
                    }}
                    className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
                  >
                    ✓ تأكيد التهديد
                  </button>
                  <button
                    onClick={() => {
                      onReview(fullIncident.id, 'إنذار كاذب');
                      onClose();
                    }}
                    className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
                  >
                    ✗ إنذار كاذب
                  </button>
                  <button
                    onClick={() => {
                      onCloseIncident(fullIncident.id);
                      onClose();
                    }}
                    className="py-3 px-6 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg"
                  >
                    إغلاق
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center">تعذر تحميل التفاصيل</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentsPage;

