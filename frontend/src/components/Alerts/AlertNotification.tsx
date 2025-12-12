/**
 * ═══════════════════════════════════════════════════════════════════════════
 * نظرة - مكون التنبيه المنبثق المتقدم
 * AlertNotification.tsx
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * يظهر عند استقبال تنبيه جديد عبر WebSocket
 * ميزات:
 * - تشغيل الصوت
 * - إظهار النافذة المنبثقة
 * - وميض الشاشة
 * - طابور التنبيهات
 * - الانتظار للتأكيد
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAlertWebSocket } from '../../hooks/useWebSocket';
import { useAlertSound } from '../../hooks/useAlertSound';
import { AlertPopup } from './AlertPopup';
import type { Alert } from '../../types';

interface AlertNotificationProps {
  /** عند تأكيد التنبيه */
  onConfirm?: (alertId: string) => void;
  /** عند تحديد التنبيه كإنذار كاذب */
  onMarkFalse?: (alertId: string) => void;
  /** عند طلب عرض تفاصيل التنبيه */
  onViewDetails?: (alert: Alert) => void;
  /** تأخير الإغلاق التلقائي (بالثواني، 0 = لا يغلق تلقائياً) */
  autoCloseDelay?: number;
  /** الحد الأقصى للتنبيهات في الطابور */
  maxQueueSize?: number;
  /** تفعيل وميض الشاشة */
  enableScreenFlash?: boolean;
  /** تفعيل الإشعارات المكدسة */
  enableStackedNotifications?: boolean;
}

export const AlertNotification: React.FC<AlertNotificationProps> = ({
  onConfirm,
  onMarkFalse,
  onViewDetails,
  autoCloseDelay = 0,
  maxQueueSize = 10,
  enableScreenFlash = true,
  enableStackedNotifications = true,
}) => {
  const { lastAlert, acknowledgeAlert } = useAlertWebSocket();
  const { playAlertSound, stopAlertSound } = useAlertSound();
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [pendingAlerts, setPendingAlerts] = useState<Alert[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const processedAlerts = useRef<Set<string>>(new Set());

  // معالجة تنبيه جديد من WebSocket
  useEffect(() => {
    if (lastAlert && !processedAlerts.current.has(lastAlert.id)) {
      processedAlerts.current.add(lastAlert.id);
      
      // إضافة للطابور
      setPendingAlerts(prev => {
        const newQueue = [...prev, lastAlert];
        // الحفاظ على الحد الأقصى
        if (newQueue.length > maxQueueSize) {
          return newQueue.slice(-maxQueueSize);
        }
        return newQueue;
      });
    }
  }, [lastAlert, maxQueueSize]);

  // عرض التنبيه التالي من الطابور
  useEffect(() => {
    if (!currentAlert && pendingAlerts.length > 0) {
      const nextAlert = pendingAlerts[0];
      setCurrentAlert(nextAlert);
      setPendingAlerts(prev => prev.slice(1));
      setShowPopup(true);
      
      // تشغيل الصوت
      playAlertSound();
      
      // وميض الشاشة
      if (enableScreenFlash) {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 3000);
      }
    }
  }, [currentAlert, pendingAlerts, playAlertSound, enableScreenFlash]);

  // إغلاق التنبيه الحالي
  const handleDismiss = useCallback(() => {
    stopAlertSound();
    setShowPopup(false);
    
    if (currentAlert) {
      acknowledgeAlert(currentAlert.id);
    }
    
    // الانتظار قليلاً ثم إظهار التنبيه التالي
    setTimeout(() => {
      setCurrentAlert(null);
    }, 300);
  }, [currentAlert, acknowledgeAlert, stopAlertSound]);

  // تأكيد التنبيه
  const handleConfirm = useCallback((alertId: string) => {
    onConfirm?.(alertId);
    handleDismiss();
  }, [onConfirm, handleDismiss]);

  // تحديد كإنذار كاذب
  const handleMarkFalse = useCallback((alertId: string) => {
    onMarkFalse?.(alertId);
    handleDismiss();
  }, [onMarkFalse, handleDismiss]);

  // عرض التفاصيل
  const handleViewDetails = useCallback((alert: Alert) => {
    onViewDetails?.(alert);
    handleDismiss();
  }, [onViewDetails, handleDismiss]);

  // تنظيف التنبيهات المعالجة القديمة (كل 5 دقائق)
  useEffect(() => {
    const interval = setInterval(() => {
      if (processedAlerts.current.size > 100) {
        processedAlerts.current.clear();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (!showPopup || !currentAlert) {
    return null;
  }

  return (
    <>
      {/* وميض الشاشة */}
      {isFlashing && enableScreenFlash && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          <div className="absolute inset-0 animate-flash bg-red-500/20" />
        </div>
      )}

      {/* النافذة المنبثقة */}
      <AlertPopup
        alert={currentAlert}
        onDismiss={handleDismiss}
        onConfirm={handleConfirm}
        onMarkFalse={handleMarkFalse}
        onViewDetails={handleViewDetails}
        autoCloseDelay={autoCloseDelay}
      />

      {/* عداد التنبيهات المعلقة */}
      {enableStackedNotifications && pendingAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[101]">
          <div className="bg-red-600 text-white px-4 py-2 rounded-full shadow-lg animate-pulse flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <span className="font-bold">{pendingAlerts.length}</span>
            <span className="text-sm">تنبيهات أخرى</span>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// مكون مؤشر حالة الاتصال
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectionStatusIndicatorProps {
  className?: string;
  showText?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  className = '',
  showText = true,
}) => {
  const { isConnected, reconnectAttempts } = useAlertWebSocket();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`w-3 h-3 rounded-full ${
          isConnected
            ? 'bg-green-500 animate-pulse'
            : reconnectAttempts > 0
            ? 'bg-yellow-500 animate-bounce'
            : 'bg-red-500'
        }`}
      />
      {showText && (
        <span
          className={`text-sm ${
            isConnected
              ? 'text-green-500'
              : reconnectAttempts > 0
              ? 'text-yellow-500'
              : 'text-red-500'
          }`}
        >
          {isConnected
            ? 'متصل'
            : reconnectAttempts > 0
            ? `جاري إعادة الاتصال (${reconnectAttempts})`
            : 'غير متصل'}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// مكون إحصائيات النظام الفورية
// ─────────────────────────────────────────────────────────────────────────────

interface LiveSystemStatsProps {
  className?: string;
}

export const LiveSystemStats: React.FC<LiveSystemStatsProps> = ({ className = '' }) => {
  const { status, isConnected } = useAlertWebSocket();

  if (!isConnected || !status) {
    return (
      <div className={`flex items-center gap-4 text-gray-500 ${className}`}>
        <span>جاري الاتصال...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-green-400">📹</span>
        <span className="text-white font-bold">{status.cameras_online}</span>
        <span className="text-gray-400 text-sm">كاميرا متصلة</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-red-400">🚨</span>
        <span className="text-white font-bold">{status.alerts_today}</span>
        <span className="text-gray-400 text-sm">تنبيه اليوم</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className={status.system_status === 'متصل' ? 'text-green-400' : 'text-yellow-400'}>
          ⚡
        </span>
        <span className={`font-bold ${status.system_status === 'متصل' ? 'text-green-400' : 'text-yellow-400'}`}>
          {status.system_status}
        </span>
      </div>
    </div>
  );
};

export default AlertNotification;
