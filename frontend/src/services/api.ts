import axios from 'axios';
import type { Camera, Alert, DashboardStats, SystemSettings } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// إنشاء نسخة من axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// اعتراض الطلبات لإضافة التوكن
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// خدمات الكاميرات
export const cameraService = {
  // جلب جميع الكاميرات
  getAll: async (): Promise<Camera[]> => {
    const response = await api.get('/cameras');
    return response.data;
  },

  // جلب كاميرا محددة
  getById: async (id: string): Promise<Camera> => {
    const response = await api.get(`/cameras/${id}`);
    return response.data;
  },

  // إضافة كاميرا جديدة
  create: async (camera: Partial<Camera>): Promise<Camera> => {
    const response = await api.post('/cameras', camera);
    return response.data;
  },

  // تحديث كاميرا
  update: async (id: string, camera: Partial<Camera>): Promise<Camera> => {
    const response = await api.put(`/cameras/${id}`, camera);
    return response.data;
  },

  // حذف كاميرا
  delete: async (id: string): Promise<void> => {
    await api.delete(`/cameras/${id}`);
  },

  // تبديل حالة الكشف
  toggleDetection: async (id: string, enabled: boolean): Promise<Camera> => {
    const response = await api.patch(`/cameras/${id}/detection`, { enabled });
    return response.data;
  },
};

// خدمات التنبيهات
export const alertService = {
  // جلب جميع التنبيهات
  getAll: async (params?: {
    status?: string;
    severity?: string;
    cameraId?: string;
    weaponType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ alerts: Alert[]; total: number }> => {
    const response = await api.get('/alerts', { params });
    return response.data;
  },

  // جلب تنبيه محدد
  getById: async (id: string): Promise<Alert> => {
    const response = await api.get(`/alerts/${id}`);
    return response.data;
  },

  // تأكيد استلام تنبيه
  acknowledge: async (id: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/acknowledge`);
    return response.data;
  },

  // حل تنبيه
  resolve: async (id: string, notes?: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/resolve`, { notes });
    return response.data;
  },

  // تصنيف كإنذار كاذب
  markFalsePositive: async (id: string, notes?: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/false-positive`, { notes });
    return response.data;
  },

  // تحديث حالة التنبيه
  updateStatus: async (id: string, status: string, notes?: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/status`, { status, notes });
    return response.data;
  },

  // إضافة ملاحظة للتنبيه
  addNote: async (id: string, note: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/note`, { note });
    return response.data;
  },

  // جلب صورة التنبيه
  getImage: async (id: string): Promise<string> => {
    const response = await api.get(`/alerts/${id}/image`);
    return response.data;
  },

  // جلب فيديو التنبيه
  getVideo: async (id: string): Promise<string> => {
    const response = await api.get(`/alerts/${id}/video`);
    return response.data;
  },

  // تصدير التنبيهات
  export: async (params: {
    format: 'pdf' | 'csv' | 'xlsx';
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<Blob> => {
    const response = await api.get('/alerts/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // جلب إحصائيات التنبيهات
  getStats: async (): Promise<{
    total: number;
    new: number;
    reviewing: number;
    confirmed: number;
    falsePositive: number;
    today: number;
    thisWeek: number;
  }> => {
    const response = await api.get('/alerts/stats');
    return response.data;
  },
};

// خدمات الكاميرات المتقدمة
export const cameraStreamService = {
  // الحصول على رابط البث
  getStreamUrl: async (cameraId: string): Promise<{ url: string; type: string }> => {
    const response = await api.get(`/cameras/${cameraId}/stream`);
    return response.data;
  },

  // اختبار اتصال الكاميرا
  testConnection: async (rtspUrl: string): Promise<{ 
    success: boolean; 
    message: string;
    resolution?: string;
    fps?: number;
  }> => {
    const response = await api.post('/cameras/test-connection', { rtspUrl });
    return response.data;
  },

  // التقاط صورة من الكاميرا
  takeSnapshot: async (cameraId: string): Promise<{ imageUrl: string }> => {
    const response = await api.post(`/cameras/${cameraId}/snapshot`);
    return response.data;
  },

  // بدء/إيقاف التسجيل
  toggleRecording: async (cameraId: string, start: boolean): Promise<{ 
    recording: boolean; 
    recordingId?: string 
  }> => {
    const response = await api.post(`/cameras/${cameraId}/recording`, { start });
    return response.data;
  },

  // جلب التسجيلات
  getRecordings: async (cameraId: string, params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    recordings: Array<{
      id: string;
      startTime: string;
      endTime: string;
      duration: number;
      size: string;
      url: string;
    }>;
    total: number;
  }> => {
    const response = await api.get(`/cameras/${cameraId}/recordings`, { params });
    return response.data;
  },

  // تحديث إعدادات الكشف للكاميرا
  updateDetectionSettings: async (cameraId: string, settings: {
    enabled: boolean;
    sensitivity: number;
    detectionTypes: string[];
  }): Promise<Camera> => {
    const response = await api.patch(`/cameras/${cameraId}/detection-settings`, settings);
    return response.data;
  },

  // جلب إحصائيات الكاميرا
  getCameraStats: async (cameraId: string): Promise<{
    totalDetections: number;
    accuracy: number;
    uptime: number;
    lastActivity: string;
    storageUsed: string;
    alertsCount: {
      total: number;
      confirmed: number;
      falsePositive: number;
    };
  }> => {
    const response = await api.get(`/cameras/${cameraId}/stats`);
    return response.data;
  },

  // اكتشاف كاميرات ONVIF
  discoverOnvifCameras: async (networkRange?: string): Promise<Array<{
    ip: string;
    name: string;
    manufacturer: string;
    model: string;
  }>> => {
    const response = await api.post('/cameras/discover-onvif', { networkRange });
    return response.data;
  },
};

// خدمات لوحة التحكم
export const dashboardService = {
  // جلب الإحصائيات
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  // جلب آخر التنبيهات
  getRecentAlerts: async (limit: number = 10): Promise<Alert[]> => {
    const response = await api.get('/dashboard/recent-alerts', {
      params: { limit },
    });
    return response.data;
  },
};

// خدمات الإعدادات
export const settingsService = {
  // جلب الإعدادات
  get: async (): Promise<SystemSettings> => {
    const response = await api.get('/settings');
    return response.data;
  },

  // تحديث الإعدادات
  update: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const response = await api.put('/settings', settings);
    return response.data;
  },
};

export default api;
