// ═══════════════════════════════════════════════════════════════════════════
// نظرة - مزود التنبيهات للتطبيق
// AlertProvider.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useAlertStore } from '../../hooks/useStore';
import { AlertPopup } from './AlertPopup';
import { AlertDetail } from './AlertDetail';
import { alertService } from '../../services/api';
import type { Alert } from '../../types';

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const {
    showPopup,
    popupAlert,
    selectedAlert,
    hideAlertPopup,
    setSelectedAlert,
    updateAlertStatus,
    addAlertNote,
  } = useAlertStore();

  // تأكيد التنبيه
  const handleConfirm = useCallback(
    async (id: string) => {
      try {
        await alertService.resolve(id);
        updateAlertStatus(id, 'مؤكد', 'المستخدم الحالي');
        hideAlertPopup();
      } catch (error) {
        console.error('خطأ في تأكيد التنبيه:', error);
      }
    },
    [updateAlertStatus, hideAlertPopup]
  );

  // تصنيف كإنذار كاذب
  const handleMarkFalse = useCallback(
    async (id: string) => {
      try {
        await alertService.markFalsePositive(id);
        updateAlertStatus(id, 'إنذار كاذب', 'المستخدم الحالي');
        hideAlertPopup();
      } catch (error) {
        console.error('خطأ في تصنيف التنبيه:', error);
      }
    },
    [updateAlertStatus, hideAlertPopup]
  );

  // عرض التفاصيل
  const handleViewDetails = useCallback(
    (alert: Alert) => {
      hideAlertPopup();
      setSelectedAlert(alert);
    },
    [hideAlertPopup, setSelectedAlert]
  );

  // إضافة ملاحظة
  const handleAddNote = useCallback(
    async (id: string, note: string) => {
      try {
        await alertService.addNote(id, note);
        addAlertNote(id, note);
      } catch (error) {
        console.error('خطأ في إضافة ملاحظة:', error);
      }
    },
    [addAlertNote]
  );

  // تجاهل النافذة المنبثقة
  const handleDismissPopup = useCallback(() => {
    hideAlertPopup();
  }, [hideAlertPopup]);

  // إغلاق التفاصيل
  const handleCloseDetail = useCallback(() => {
    setSelectedAlert(null);
  }, [setSelectedAlert]);

  return (
    <>
      {children}

      {/* نافذة التنبيه المنبثقة */}
      {showPopup && popupAlert && (
        <AlertPopup
          alert={popupAlert}
          onDismiss={handleDismissPopup}
          onConfirm={handleConfirm}
          onMarkFalse={handleMarkFalse}
          onViewDetails={handleViewDetails}
          autoCloseDelay={30}
        />
      )}

      {/* نافذة تفاصيل التنبيه */}
      {selectedAlert && (
        <AlertDetail
          alert={selectedAlert}
          onClose={handleCloseDetail}
          onConfirm={handleConfirm}
          onMarkFalse={handleMarkFalse}
          onAddNote={handleAddNote}
        />
      )}
    </>
  );
};

export default AlertProvider;
