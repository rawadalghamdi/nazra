import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { alertService } from '../../services/api';
import type { AlertSeverity, DetectionType } from '../../types';
import { formatRelativeTime, getSeverityLabel } from '../../utils';

// واجهة التنبيه المحلية
interface LocalAlert {
  id: string;
  cameraId: string;
  cameraName: string;
  location: string;
  timestamp: string;
  weaponType: string;
  detectionType: DetectionType;
  severity: AlertSeverity;
  status: string;
  confidence: number;
  imageSnapshot: string;
  boundingBox: any;
}

// ألوان الخطورة
const severityStyles: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-600',
    dot: 'bg-red-500',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    text: 'text-orange-600',
    dot: 'bg-orange-500',
  },
  medium: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-600',
    dot: 'bg-amber-500',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-600',
    dot: 'bg-blue-500',
  },
};

// خريطة تحويل الخطورة
const severityMap: Record<string, string> = {
  'حرج': 'critical',
  'عالي': 'high',
  'متوسط': 'medium',
  'منخفض': 'low',
  'critical': 'critical',
  'high': 'high',
  'medium': 'medium',
  'low': 'low',
};

function AlertsList() {
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<LocalAlert | null>(null);

  // جلب التنبيهات
  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await alertService.getAll({
        page: currentPage,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      
      // البيانات تأتي محولة بالفعل من alertService.getAll
      // نحتاج فقط لتحويل confidence من 0-1 إلى 0-100 للعرض
      const transformedAlerts: LocalAlert[] = response.alerts.map((alert: any) => ({
        id: alert.id,
        cameraId: alert.cameraId,
        cameraName: alert.cameraName || 'كاميرا غير معروفة',
        location: alert.location || '',
        timestamp: alert.timestamp,
        weaponType: alert.weaponType || 'مسدس',
        detectionType: alert.detectionType || (alert.weaponType === 'سكين' ? 'knife' : 'weapon') as DetectionType,
        severity: (severityMap[alert.severity] || 'high') as AlertSeverity,
        status: alert.status || 'جديد',
        confidence: Math.round((alert.confidence || 0) * 100),
        imageSnapshot: alert.imageSnapshot || '',
        boundingBox: alert.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
      }));
      
      console.log('📋 Alerts loaded:', transformedAlerts.length, transformedAlerts[0]);
      setAlerts(transformedAlerts);
      setTotalPages(Math.ceil(response.total / 20) || 1);
    } catch (err) {
      console.error('خطأ في جلب التنبيهات:', err);
      setError('حدث خطأ أثناء جلب التنبيهات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [currentPage, statusFilter]);

  // تأكيد التنبيه
  const handleConfirm = async (alertId: string) => {
    try {
      const result = await alertService.resolve(alertId, 'تم التأكيد');
      console.log('✅ تم تأكيد التنبيه:', result);
      // تحديث الحالة محلياً
      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, status: 'مؤكد' } : a
      ));
    } catch (err) {
      console.error('خطأ في تأكيد التنبيه:', err);
      alert('حدث خطأ في تأكيد التنبيه');
    }
  };

  // تصنيف كإنذار كاذب
  const handleMarkFalse = async (alertId: string) => {
    try {
      const result = await alertService.markFalsePositive(alertId);
      console.log('❌ تم تصنيف التنبيه كإنذار كاذب:', result);
      // تحديث الحالة محلياً
      setAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, status: 'إنذار كاذب' } : a
      ));
    } catch (err) {
      console.error('خطأ في تصنيف التنبيه:', err);
      alert('حدث خطأ في تصنيف التنبيه');
    }
  };

  // عرض التفاصيل
  const handleViewDetails = (alert: LocalAlert) => {
    setSelectedAlert(alert);
  };

  // تصفية التنبيهات حسب البحث
  const filteredAlerts = alerts.filter(alert => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      alert.cameraName.toLowerCase().includes(query) ||
      alert.location?.toLowerCase().includes(query) ||
      alert.weaponType?.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-nazra-text-muted">جاري تحميل التنبيهات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-nazra-text mb-4">{error}</p>
          <button
            onClick={fetchAlerts}
            className="px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nazra-text">التنبيهات</h1>
          <p className="text-nazra-text-muted mt-1">جميع التنبيهات والإنذارات ({alerts.length} تنبيه)</p>
        </div>
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>تحديث</span>
        </button>
      </div>

      {/* فلاتر البحث */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          {/* البحث */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nazra-text-muted" />
              <input
                type="text"
                placeholder="ابحث في التنبيهات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-nazra-border rounded-lg bg-white focus:ring-2 focus:ring-saudi-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* فلتر الحالة */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-nazra-border rounded-lg bg-white focus:ring-2 focus:ring-saudi-green-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="جديد">جديد</option>
            <option value="قيد المراجعة">قيد المراجعة</option>
            <option value="مؤكد">مؤكد</option>
            <option value="إنذار كاذب">إنذار كاذب</option>
          </select>
        </div>
      </div>

      {/* قائمة التنبيهات */}
      {filteredAlerts.length === 0 ? (
        <div className="card">
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-saudi-green-500 mx-auto mb-4" />
            <p className="text-nazra-text-muted text-lg">لا توجد تنبيهات</p>
            <p className="text-nazra-text-light text-sm mt-1">النظام يعمل بشكل طبيعي</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const styles = severityStyles[alert.severity] || severityStyles.high;
            return (
              <div
                key={alert.id}
                className={`card border-r-4 ${styles.border} hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className="flex items-start gap-4">
                  {/* أيقونة الخطورة */}
                  <div className={`p-3 rounded-xl ${styles.bg}`}>
                    <AlertTriangle className={`w-6 h-6 ${styles.text}`} />
                  </div>

                  {/* التفاصيل */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`font-bold ${styles.text}`}>
                        {alert.weaponType}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${styles.bg} ${styles.text}`}>
                        {getSeverityLabel(alert.severity as AlertSeverity)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        alert.status === 'جديد' ? 'bg-red-100 text-red-600' :
                        alert.status === 'قيد المراجعة' ? 'bg-blue-100 text-blue-600' :
                        alert.status === 'مؤكد' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {alert.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-nazra-text-muted">
                      <span>{alert.cameraName}</span>
                      <span>•</span>
                      <span>{alert.location || 'موقع غير محدد'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatRelativeTime(alert.timestamp)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="text-sm text-nazra-text-muted">
                        نسبة الثقة: <span className="font-semibold text-nazra-text">{alert.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleViewDetails(alert); }}
                      className="p-2 text-nazra-text-muted hover:text-saudi-green-500 hover:bg-saudi-green-50 rounded-lg transition-colors"
                      title="عرض التفاصيل"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleConfirm(alert.id); }}
                      disabled={alert.status === 'مؤكد'}
                      className={`p-2 rounded-lg transition-colors ${
                        alert.status === 'مؤكد' 
                          ? 'text-green-500 bg-green-50 cursor-default' 
                          : 'text-nazra-text-muted hover:text-green-500 hover:bg-green-50'
                      }`}
                      title="تأكيد التنبيه"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleMarkFalse(alert.id); }}
                      disabled={alert.status === 'إنذار كاذب'}
                      className={`p-2 rounded-lg transition-colors ${
                        alert.status === 'إنذار كاذب' 
                          ? 'text-red-500 bg-red-50 cursor-default' 
                          : 'text-nazra-text-muted hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="إنذار كاذب"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ترقيم الصفحات */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-nazra-border hover:bg-nazra-lightest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 text-nazra-text">
            صفحة {currentPage} من {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-nazra-border hover:bg-nazra-lightest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* نافذة التفاصيل */}
      {selectedAlert && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* رأس النافذة */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    تفاصيل التنبيه
                  </h2>
                  <p className="text-gray-500 text-sm">{selectedAlert.cameraName}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* محتوى النافذة */}
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* صورة الكشف */}
              {selectedAlert.imageSnapshot && (
                <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                  <img
                    src={
                      selectedAlert.imageSnapshot.startsWith('data:') 
                        ? selectedAlert.imageSnapshot 
                        : selectedAlert.imageSnapshot.startsWith('http') 
                          ? selectedAlert.imageSnapshot 
                          : `http://localhost:8000/${selectedAlert.imageSnapshot.replace(/^\/+/, '')}`
                    }
                    alt="صورة الكشف"
                    className="w-full h-64 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                    }}
                  />
                </div>
              )}

              {/* معلومات التنبيه */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">نوع السلاح</p>
                  <p className="font-bold text-red-600">{selectedAlert.weaponType}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">نسبة الثقة</p>
                  <p className="font-bold text-gray-900">{selectedAlert.confidence}%</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">الموقع</p>
                  <p className="font-medium text-gray-900">{selectedAlert.location || 'غير محدد'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500 text-sm">الحالة</p>
                  <p className={`font-medium ${
                    selectedAlert.status === 'جديد' ? 'text-red-600' :
                    selectedAlert.status === 'مؤكد' ? 'text-green-600' :
                    selectedAlert.status === 'إنذار كاذب' ? 'text-gray-600' :
                    'text-blue-600'
                  }`}>{selectedAlert.status}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                  <p className="text-gray-500 text-sm">الوقت</p>
                  <p className="font-medium text-gray-900">{formatRelativeTime(selectedAlert.timestamp)}</p>
                </div>
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => { handleConfirm(selectedAlert.id); setSelectedAlert(null); }}
                  disabled={selectedAlert.status === 'مؤكد'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    selectedAlert.status === 'مؤكد'
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد</span>
                </button>
                <button
                  onClick={() => { handleMarkFalse(selectedAlert.id); setSelectedAlert(null); }}
                  disabled={selectedAlert.status === 'إنذار كاذب'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    selectedAlert.status === 'إنذار كاذب'
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>إنذار كاذب</span>
                </button>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertsList;
