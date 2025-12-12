// ═══════════════════════════════════════════════════════════════════════════
// نظرة - صفحة التنبيهات الرئيسية
// AlertsPage.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import type { Alert } from '../../types';
import { AlertCard } from './AlertCard';
import { AlertsFilter, type AlertFilters } from './AlertsFilter';
import { AlertDetail } from './AlertDetail';
import { alertService } from '../../services/api';
import { useAlertStore, useCameraStore } from '../../hooks/useStore';
import { useAlertWebSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

type ViewMode = 'grid' | 'list' | 'camera';

const defaultFilters: AlertFilters = {
  status: 'الكل',
  weaponType: 'الكل',
  cameraId: 'الكل',
  dateRange: { start: '', end: '' },
  sortBy: 'time',
  sortOrder: 'desc',
};

// ─────────────────────────────────────────────────────────────────────────────
// مكون مجموعة الكاميرا
// ─────────────────────────────────────────────────────────────────────────────
interface CameraGroup {
  cameraId: string;
  cameraName: string;
  location: string;
  alerts: Alert[];
  newCount: number;
  totalCount: number;
  lastAlertTime: string;
}

interface CameraAlertGroupProps {
  group: CameraGroup;
  onConfirm: (id: string) => void;
  onMarkFalse: (id: string) => void;
  onViewVideo: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onViewDetails: (alert: Alert) => void;
}

const CameraAlertGroup: React.FC<CameraAlertGroupProps> = ({
  group,
  onConfirm,
  onMarkFalse,
  onViewVideo,
  onAddNote,
  onViewDetails,
}) => {
  const [expanded, setExpanded] = useState(group.newCount > 0);

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ar });
    } catch {
      return timestamp;
    }
  };

  const hasNewAlerts = group.newCount > 0;

  return (
    <div 
      className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
        hasNewAlerts 
          ? 'bg-red-950/30 border-red-800/50 shadow-lg shadow-red-900/10' 
          : 'bg-gray-800/30 border-gray-700/50'
      }`}
    >
      {/* رأس المجموعة */}
      <div 
        className={`p-4 cursor-pointer transition-colors ${
          hasNewAlerts ? 'hover:bg-red-900/20' : 'hover:bg-gray-700/30'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* معلومات الكاميرا */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                hasNewAlerts ? 'bg-red-900/50' : 'bg-gray-700/50'
              }`}>
                📹
              </div>
              {hasNewAlerts && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse">
                  {group.newCount}
                </span>
              )}
            </div>

            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                {group.cameraName}
                {hasNewAlerts && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
                    🔴 جديد
                  </span>
                )}
              </h3>
              <p className="text-gray-400 text-sm">
                {group.location || 'موقع غير محدد'}
              </p>
            </div>
          </div>

          {/* إحصائيات سريعة */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{group.totalCount}</p>
              <p className="text-xs text-gray-400">تنبيه</p>
            </div>
            <div className="text-center hidden md:block">
              <p className="text-sm text-gray-300">{formatTime(group.lastAlertTime)}</p>
              <p className="text-xs text-gray-500">آخر تنبيه</p>
            </div>

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

      {/* قائمة التنبيهات */}
      {expanded && (
        <div className="border-t border-gray-700/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onConfirm={onConfirm}
                onMarkFalse={onMarkFalse}
                onViewVideo={onViewVideo}
                onAddNote={onAddNote}
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// الصفحة الرئيسية
// ─────────────────────────────────────────────────────────────────────────────
export const AlertsPage: React.FC = () => {
  const { alerts, setAlerts, updateAlert, addAlert, showAlertPopup } = useAlertStore();
  const { cameras } = useCameraStore();
  const [filters, setFilters] = useState<AlertFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('camera'); // الافتراضي: عرض بالكاميرا
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const itemsPerPage = 50; // زيادة للعرض المجمع

  // 🔴 WebSocket للتنبيهات الفورية
  const { lastAlert, isConnected } = useAlertWebSocket();

  // 🔔 استقبال التنبيهات الجديدة من WebSocket
  useEffect(() => {
    if (lastAlert) {
      const alertData = lastAlert as any;
      const newAlert: Alert = {
        id: alertData.id || alertData.alert_id || `alert-${Date.now()}`,
        cameraId: alertData.cameraId || alertData.camera_id || 'simulation',
        cameraName: alertData.cameraName || alertData.camera_name || 'كاميرا المحاكاة',
        location: alertData.location || 'فيديو تجريبي',
        weaponType: alertData.weaponType || alertData.weapon_type || 'سكين',
        detectionType: alertData.detectionType || 'weapon',
        confidence: alertData.confidence || 0,
        imageSnapshot: alertData.imageSnapshot || alertData.image_snapshot || '',
        boundingBox: alertData.boundingBox || alertData.bbox || alertData.bounding_box || { x: 0, y: 0, width: 100, height: 100 },
        timestamp: alertData.timestamp || new Date().toISOString(),
        status: 'جديد',
        severity: alertData.severity || 'high',
      };

      const exists = alerts.some(a => a.id === newAlert.id);
      if (!exists) {
        console.log('🚨 تنبيه جديد من WebSocket:', newAlert);
        addAlert(newAlert);
        showAlertPopup(newAlert);
        setTotalAlerts(prev => prev + 1);
      }
    }
  }, [lastAlert, alerts, addAlert, showAlertPopup]);

  // جلب التنبيهات
  useEffect(() => {
    const fetchAlerts = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | number | undefined> = {
          page: currentPage,
          limit: itemsPerPage,
        };

        if (filters.status !== 'الكل') {
          params.status = filters.status;
        }
        if (filters.cameraId !== 'الكل') {
          params.cameraId = filters.cameraId;
        }
        if (filters.dateRange.start) {
          params.startDate = filters.dateRange.start;
        }
        if (filters.dateRange.end) {
          params.endDate = filters.dateRange.end;
        }

        const response = await alertService.getAll(params);
        setAlerts(response.alerts);
        setTotalAlerts(response.total);
      } catch (error) {
        console.error('خطأ في جلب التنبيهات:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, [currentPage, filters, setAlerts]);

  // فلترة وترتيب التنبيهات
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    if (filters.status !== 'الكل') {
      result = result.filter((alert) => alert.status === filters.status);
    }

    if (filters.weaponType !== 'الكل') {
      result = result.filter((alert) => alert.weaponType === filters.weaponType);
    }

    if (filters.cameraId !== 'الكل') {
      result = result.filter((alert) => alert.cameraId === filters.cameraId);
    }

    if (filters.dateRange.start) {
      const startDate = new Date(filters.dateRange.start);
      result = result.filter((alert) => new Date(alert.timestamp) >= startDate);
    }
    if (filters.dateRange.end) {
      const endDate = new Date(filters.dateRange.end);
      result = result.filter((alert) => new Date(alert.timestamp) <= endDate);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'time':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'priority':
          const priorityOrder = { 'جديد': 0, 'قيد المراجعة': 1, 'مؤكد': 2, 'إنذار كاذب': 3 };
          comparison = priorityOrder[a.status] - priorityOrder[b.status];
          break;
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [alerts, filters]);

  // تجميع التنبيهات حسب الكاميرا
  const alertsByCamera = useMemo((): CameraGroup[] => {
    const groups: Record<string, CameraGroup> = {};

    filteredAlerts.forEach((alert) => {
      const cameraId = alert.cameraId;
      
      if (!groups[cameraId]) {
        groups[cameraId] = {
          cameraId,
          cameraName: alert.cameraName,
          location: alert.location,
          alerts: [],
          newCount: 0,
          totalCount: 0,
          lastAlertTime: alert.timestamp,
        };
      }

      groups[cameraId].alerts.push(alert);
      groups[cameraId].totalCount++;
      
      if (alert.status === 'جديد') {
        groups[cameraId].newCount++;
      }

      // تحديث آخر وقت
      if (new Date(alert.timestamp) > new Date(groups[cameraId].lastAlertTime)) {
        groups[cameraId].lastAlertTime = alert.timestamp;
      }
    });

    // ترتيب: الكاميرات مع تنبيهات جديدة أولاً
    return Object.values(groups).sort((a, b) => {
      if (a.newCount !== b.newCount) {
        return b.newCount - a.newCount;
      }
      return new Date(b.lastAlertTime).getTime() - new Date(a.lastAlertTime).getTime();
    });
  }, [filteredAlerts]);

  // إجراءات التنبيهات
  const handleConfirm = async (id: string) => {
    try {
      const updated = await alertService.resolve(id);
      updateAlert(id, { ...updated, status: 'مؤكد' });
    } catch (error) {
      console.error('خطأ في تأكيد التنبيه:', error);
    }
  };

  const handleMarkFalse = async (id: string) => {
    try {
      const updated = await alertService.markFalsePositive(id);
      updateAlert(id, { ...updated, status: 'إنذار كاذب' });
    } catch (error) {
      console.error('خطأ في تصنيف التنبيه:', error);
    }
  };

  const handleViewVideo = (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (alert) {
      setSelectedAlert(alert);
    }
  };

  const handleAddNote = async (id: string, note: string) => {
    try {
      await alertService.resolve(id, note);
      updateAlert(id, { notes: note, status: 'قيد المراجعة' });
    } catch (error) {
      console.error('خطأ في إضافة ملاحظة:', error);
    }
  };

  const handleViewDetails = (alert: Alert) => {
    setSelectedAlert(alert);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  };

  // حساب صفحات التصفح
  const totalPages = Math.ceil(totalAlerts / itemsPerPage);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    return {
      total: alerts.length,
      new: alerts.filter((a) => a.status === 'جديد').length,
      reviewing: alerts.filter((a) => a.status === 'قيد المراجعة').length,
      confirmed: alerts.filter((a) => a.status === 'مؤكد').length,
      falsePositive: alerts.filter((a) => a.status === 'إنذار كاذب').length,
      cameras: alertsByCamera.length,
    };
  }, [alerts, alertsByCamera]);

  return (
    <div className="min-h-screen bg-gray-900 p-6" dir="rtl">
      {/* رأس الصفحة */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl">🔔</span>
              التنبيهات
            </h1>
            <p className="text-gray-400 mt-1">
              {viewMode === 'camera' 
                ? `${stats.cameras} كاميرا • ${totalAlerts} تنبيه`
                : `مراقبة وإدارة تنبيهات الكشف عن الأسلحة`
              }
            </p>
          </div>

          {/* أزرار التحكم */}
          <div className="flex items-center gap-4">
            {/* مؤشر حالة الاتصال */}
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

            {/* عرض الإحصائيات السريعة */}
            <div className="hidden lg:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-red-400">{stats.new} جديد</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-900/30 border border-orange-800 rounded-lg">
                <span className="text-orange-400">{stats.reviewing} قيد المراجعة</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-900/30 border border-green-800 rounded-lg">
                <span className="text-green-400">{stats.confirmed} مؤكد</span>
              </div>
            </div>

            {/* تبديل وضع العرض */}
            <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 p-1">
              <button
                onClick={() => setViewMode('camera')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'camera'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="عرض بالكاميرا"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="عرض شبكي"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="عرض قائمة"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* فلاتر البحث */}
        <AlertsFilter
          filters={filters}
          onFiltersChange={setFilters}
          cameras={cameras}
          onReset={handleResetFilters}
        />
      </div>

      {/* محتوى التنبيهات */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">جاري تحميل التنبيهات...</p>
            </div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <span className="text-6xl mb-4 block">🎉</span>
              <h3 className="text-xl font-medium text-white mb-2">لا توجد تنبيهات</h3>
              <p className="text-gray-400">
                {filters.status !== 'الكل' || filters.weaponType !== 'الكل' || filters.cameraId !== 'الكل'
                  ? 'جرب تغيير الفلاتر للعثور على نتائج'
                  : 'النظام آمن حالياً'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* عرض بالكاميرا (الجديد) */}
            {viewMode === 'camera' && (
              <div className="space-y-4">
                {alertsByCamera.map((group) => (
                  <CameraAlertGroup
                    key={group.cameraId}
                    group={group}
                    onConfirm={handleConfirm}
                    onMarkFalse={handleMarkFalse}
                    onViewVideo={handleViewVideo}
                    onAddNote={handleAddNote}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}

            {/* عرض شبكي */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onConfirm={handleConfirm}
                    onMarkFalse={handleMarkFalse}
                    onViewVideo={handleViewVideo}
                    onAddNote={handleAddNote}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}

            {/* عرض قائمة */}
            {viewMode === 'list' && (
              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onConfirm={handleConfirm}
                    onMarkFalse={handleMarkFalse}
                    onViewVideo={handleViewVideo}
                    onAddNote={handleAddNote}
                    onViewDetails={handleViewDetails}
                    isCompact={false}
                  />
                ))}
              </div>
            )}

            {/* التصفح - فقط للعرض الشبكي والقائمة */}
            {viewMode !== 'camera' && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  السابق
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  التالي
                </button>
              </div>
            )}

            {/* معلومات الصفحة */}
            {viewMode !== 'camera' && (
              <div className="text-center text-gray-500 text-sm">
                عرض {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalAlerts)} من {totalAlerts} تنبيه
              </div>
            )}
          </>
        )}
      </div>

      {/* نافذة التفاصيل */}
      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onConfirm={handleConfirm}
          onMarkFalse={handleMarkFalse}
          onAddNote={handleAddNote}
        />
      )}
    </div>
  );
};

export default AlertsPage;
