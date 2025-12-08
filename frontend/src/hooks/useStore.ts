import { create } from 'zustand';
import type { Alert, Camera, DashboardStats, AlertStatus } from '../types';

interface AlertStore {
  alerts: Alert[];
  unreadCount: number;
  selectedAlert: Alert | null;
  showPopup: boolean;
  popupAlert: Alert | null;
  addAlert: (alert: Alert) => void;
  updateAlert: (id: string, updates: Partial<Alert>) => void;
  setAlerts: (alerts: Alert[]) => void;
  clearAlerts: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setSelectedAlert: (alert: Alert | null) => void;
  showAlertPopup: (alert: Alert) => void;
  hideAlertPopup: () => void;
  updateAlertStatus: (id: string, status: AlertStatus, reviewedBy?: string) => void;
  addAlertNote: (id: string, note: string) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,
  selectedAlert: null,
  showPopup: false,
  popupAlert: null,
  
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadCount: state.unreadCount + 1,
      showPopup: alert.status === 'جديد',
      popupAlert: alert.status === 'جديد' ? alert : state.popupAlert,
    })),
    
  updateAlert: (id, updates) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
    
  setAlerts: (alerts) => set({ alerts }),
  
  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
  
  markAsRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id && a.status === 'جديد'
          ? { ...a, status: 'قيد المراجعة' as AlertStatus }
          : a
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
    
  markAllAsRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.status === 'جديد' ? { ...a, status: 'قيد المراجعة' as AlertStatus } : a
      ),
      unreadCount: 0,
    })),
    
  setSelectedAlert: (alert) => set({ selectedAlert: alert }),
  
  showAlertPopup: (alert) => set({ showPopup: true, popupAlert: alert }),
  
  hideAlertPopup: () => set({ showPopup: false, popupAlert: null }),
  
  updateAlertStatus: (id, status, reviewedBy) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              reviewedBy,
              reviewedAt: new Date().toISOString(),
            }
          : a
      ),
      unreadCount:
        status === 'جديد'
          ? state.unreadCount
          : Math.max(0, state.unreadCount - 1),
    })),
    
  addAlertNote: (id, note) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, notes: note } : a
      ),
    })),
}));

interface CameraStore {
  cameras: Camera[];
  selectedCamera: Camera | null;
  setCameras: (cameras: Camera[]) => void;
  setSelectedCamera: (camera: Camera | null) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
  cameras: [],
  selectedCamera: null,
  setCameras: (cameras) => set({ cameras }),
  setSelectedCamera: (camera) => set({ selectedCamera: camera }),
  updateCamera: (id, updates) =>
    set((state) => ({
      cameras: state.cameras.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
}));

interface DashboardStore {
  stats: DashboardStats | null;
  isLoading: boolean;
  setStats: (stats: DashboardStats) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  isLoading: false,
  setStats: (stats) => set({ stats }),
  setLoading: (isLoading) => set({ isLoading }),
}));
