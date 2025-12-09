import { 
  AlertTriangle, 
  Clock, 
  ChevronLeft,
  Eye,
  CheckCircle2,
  XCircle,
  Shield,
  Crosshair,
  Package,
} from 'lucide-react';
import type { Alert, AlertSeverity, DetectionType } from '../../types';
import { formatRelativeTime, getSeverityLabel } from '../../utils';

// واجهة خصائص المكون
interface RecentAlertsProps {
  alerts: Alert[];
  maxItems?: number;
  showViewAll?: boolean;
  onAlertClick?: (alertId: string) => void;
  onViewAll?: () => void;
}

// أيقونات أنواع الكشف
const detectionIcons: Record<DetectionType, React.ComponentType<{ className?: string }>> = {
  weapon: Crosshair,
  knife: Shield,
  suspicious_object: Package,
};

// تسميات أنواع الكشف
const detectionTypeLabels: Record<DetectionType, string> = {
  weapon: 'سلاح ناري',
  knife: 'سكين',
  suspicious_object: 'جسم مشبوه',
};

// ألوان الخطورة
const severityStyles: Record<AlertSeverity, { bg: string; border: string; text: string; dot: string }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-alert-critical',
    text: 'text-alert-critical',
    dot: 'bg-alert-critical',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-alert-high',
    text: 'text-alert-high',
    dot: 'bg-alert-high',
  },
  medium: {
    bg: 'bg-amber-50',
    border: 'border-alert-medium',
    text: 'text-alert-medium',
    dot: 'bg-alert-medium',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-alert-low',
    text: 'text-alert-low',
    dot: 'bg-alert-low',
  },
};

function RecentAlerts({ 
  alerts = [], 
  maxItems = 5,
  showViewAll = true,
  onAlertClick,
  onViewAll,
}: RecentAlertsProps) {
  // عرض التنبيهات المُمررة فقط
  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <div className="card h-full">
      {/* العنوان */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-alert-orange" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nazra-text">آخر التنبيهات</h3>
            <p className="text-sm text-nazra-text-muted">
              {displayAlerts.filter(a => a.status === 'جديد').length} تنبيه جديد
            </p>
          </div>
        </div>
        
        {showViewAll && (
          <button 
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-saudi-green-500 hover:text-saudi-green-600 transition-colors group"
          >
            <span>عرض الكل</span>
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </button>
        )}
      </div>

      {/* قائمة التنبيهات */}
      <div className="space-y-3">
        {displayAlerts.map((alert, index) => (
          <AlertItem 
            key={alert.id} 
            alert={alert} 
            onClick={() => onAlertClick?.(alert.id)}
            isNew={index === 0 && alert.status === 'جديد'}
          />
        ))}
      </div>

      {/* رسالة فارغة */}
      {displayAlerts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-saudi-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-status-online" />
          </div>
          <p className="text-nazra-text-muted">لا توجد تنبيهات جديدة</p>
          <p className="text-sm text-nazra-text-light mt-1">النظام يعمل بشكل طبيعي</p>
        </div>
      )}
    </div>
  );
}

// مكون عنصر التنبيه
interface AlertItemProps {
  alert: Alert;
  onClick?: () => void;
  isNew?: boolean;
}

function AlertItem({ alert, onClick, isNew }: AlertItemProps) {
  const styles = severityStyles[alert.severity];
  const DetectionIcon = detectionIcons[alert.detectionType];

  // أيقونة الحالة
  const getStatusIcon = () => {
    switch (alert.status) {
      case 'جديد':
        return <div className={`w-2 h-2 rounded-full ${styles.dot} animate-pulse`}></div>;
      case 'قيد المراجعة':
        return <Eye className="w-4 h-4 text-blue-400" />;
      case 'مؤكد':
        return <CheckCircle2 className="w-4 h-4 text-status-online" />;
      case 'إنذار كاذب':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  // تسمية الحالة
  const getStatusLabel = () => {
    const labels: Record<string, string> = {
      'جديد': 'جديد',
      'قيد المراجعة': 'قيد المراجعة',
      'مؤكد': 'تم التأكيد',
      'إنذار كاذب': 'إنذار كاذب',
    };
    return labels[alert.status] || alert.status;
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative flex items-center gap-4 p-4 rounded-xl
        border-r-4 ${styles.border} ${styles.bg}
        hover:bg-nazra-lightest transition-all duration-200 cursor-pointer
        group border border-nazra-border
        ${isNew ? 'animate-pulse-alert ring-1 ring-alert-critical/30' : ''}
      `}
    >
      {/* أيقونة نوع الكشف */}
      <div className={`p-2.5 rounded-xl ${styles.bg} ${styles.text}`}>
        <DetectionIcon className="w-5 h-5" />
      </div>

      {/* التفاصيل */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-semibold ${styles.text}`}>
            {detectionTypeLabels[alert.detectionType]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${styles.bg} ${styles.text} border ${styles.border}`}>
            {getSeverityLabel(alert.severity)}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <span className="text-nazra-text">{alert.cameraName}</span>
          <span className="text-nazra-text-light">•</span>
          <span className="text-nazra-text-muted">{alert.location || 'موقع غير محدد'}</span>
        </div>
      </div>

      {/* الوقت والحالة */}
      <div className="text-left flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 text-nazra-text-muted text-sm">
          <Clock className="w-4 h-4" />
          <span>{formatRelativeTime(alert.timestamp)}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span className="text-xs text-nazra-text-light">{getStatusLabel()}</span>
        </div>
        
        {/* نسبة الثقة */}
        <div className="flex items-center gap-1">
          <div className="w-16 h-1.5 bg-nazra-lightest rounded-full overflow-hidden border border-nazra-border">
            <div 
              className={`h-full ${styles.dot} rounded-full`}
              style={{ width: `${alert.confidence * 100}%` }}
            ></div>
          </div>
          <span className="text-xs text-nazra-text-light">{(alert.confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* سهم التنقل */}
      <ChevronLeft className="w-5 h-5 text-nazra-text-light group-hover:text-nazra-text-muted group-hover:-translate-x-1 transition-all" />
    </div>
  );
}

export default RecentAlerts;
