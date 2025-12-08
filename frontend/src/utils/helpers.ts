import type { AlertSeverity, CameraStatus } from '../types';

// ترجمة مستوى التنبيه
export function getSeverityLabel(severity: AlertSeverity): string {
  const labels: Record<AlertSeverity, string> = {
    critical: 'حرج',
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
  };
  return labels[severity];
}

// لون مستوى التنبيه
export function getSeverityColor(severity: AlertSeverity): string {
  const colors: Record<AlertSeverity, string> = {
    critical: 'bg-alert-critical',
    high: 'bg-alert-high',
    medium: 'bg-alert-medium',
    low: 'bg-alert-low',
  };
  return colors[severity];
}

// ترجمة حالة الكاميرا
export function getCameraStatusLabel(status: CameraStatus): string {
  const labels: Record<CameraStatus, string> = {
    online: 'متصلة',
    offline: 'غير متصلة',
    error: 'خطأ',
    maintenance: 'صيانة',
  };
  return labels[status];
}

// لون حالة الكاميرا
export function getCameraStatusColor(status: CameraStatus): string {
  const colors: Record<CameraStatus, string> = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    error: 'bg-red-500',
    maintenance: 'bg-yellow-500',
  };
  return colors[status];
}

// تنسيق النسبة المئوية
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// تنسيق الرقم بالعربية
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ar-SA').format(value);
}
