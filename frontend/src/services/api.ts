import axios from 'axios';
import type { 
  Camera, Alert, DashboardStats, SystemSettings,
  Incident, IncidentsByCamera, IncidentStats 
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

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

// تحويل البيانات من camelCase إلى snake_case للباك إند
const transformCameraToBackend = (camera: Partial<Camera>) => {
  return {
    name: camera.name,
    location: camera.location,
    rtsp_url: camera.rtspUrl,
    detection_enabled: camera.detectionEnabled,
    sensitivity: camera.sensitivity !== undefined ? camera.sensitivity / 100 : undefined, // تحويل من 0-100 إلى 0-1
  };
};

// تحويل البيانات من snake_case إلى camelCase للفرونت إند
const transformCameraFromBackend = (data: any): Camera => {
  return {
    id: data.id,
    name: data.name,
    location: data.location,
    rtspUrl: data.rtsp_url,
    status: data.status,
    isRecording: data.is_recording,
    detectionEnabled: data.detection_enabled,
    sensitivity: Math.round(data.sensitivity * 100), // تحويل من 0-1 إلى 0-100
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastDetection: data.last_seen,
    resolution: data.resolution,
    fps: data.fps,
  };
};

// خدمات الكاميرات
export const cameraService = {
  // جلب جميع الكاميرات
  getAll: async (): Promise<Camera[]> => {
    const response = await api.get('/cameras');
    return response.data.map(transformCameraFromBackend);
  },

  // جلب كاميرا محددة
  getById: async (id: string): Promise<Camera> => {
    const response = await api.get(`/cameras/${id}`);
    return transformCameraFromBackend(response.data);
  },

  // إضافة كاميرا جديدة
  create: async (camera: Partial<Camera>): Promise<Camera> => {
    const payload = transformCameraToBackend(camera);
    const response = await api.post('/cameras', payload);
    return transformCameraFromBackend(response.data);
  },

  // تحديث كاميرا
  update: async (id: string, camera: Partial<Camera>): Promise<Camera> => {
    const payload = transformCameraToBackend(camera);
    const response = await api.put(`/cameras/${id}`, payload);
    return transformCameraFromBackend(response.data);
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
    console.log('📋 [alertService.getAll] Raw API response:', response.data.alerts?.length, response.data.alerts?.[0]);
    const transformed = response.data.alerts.map(transformAlertFromBackend);
    console.log('📋 [alertService.getAll] After transform:', transformed?.length, transformed?.[0]);
    return {
      alerts: transformed,
      total: response.data.total,
    };
  },

  // جلب تنبيه محدد
  getById: async (id: string): Promise<Alert> => {
    const response = await api.get(`/alerts/${id}`);
    return transformAlertFromBackend(response.data);
  },

  // تأكيد استلام تنبيه
  acknowledge: async (id: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/acknowledge`);
    return transformAlertFromBackend(response.data);
  },

  // حل تنبيه
  resolve: async (id: string, notes?: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/resolve`, { notes });
    return transformAlertFromBackend(response.data);
  },

  // تصنيف كإنذار كاذب
  markFalsePositive: async (id: string, notes?: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/false-positive`, { notes });
    return transformAlertFromBackend(response.data);
  },

  // تحديث حالة التنبيه
  updateStatus: async (id: string, status: string, notes?: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/status`, { status, notes });
    return transformAlertFromBackend(response.data);
  },

  // إضافة ملاحظة للتنبيه
  addNote: async (id: string, note: string): Promise<Alert> => {
    const response = await api.patch(`/alerts/${id}/note`, { note });
    return transformAlertFromBackend(response.data);
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
    pending: number;
    under_review: number;
    confirmed: number;
    false_alarms: number;
    total_today: number;
  }> => {
    const response = await api.get('/alerts/stats');
    // API يرجع: total_today, pending, confirmed, false_alarms, under_review
    return {
      total: response.data.total_today || 0,
      pending: response.data.pending || 0,
      under_review: response.data.under_review || 0,
      confirmed: response.data.confirmed || 0,
      false_alarms: response.data.false_alarms || 0,
      total_today: response.data.total_today || 0,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// خدمات الحوادث - Incidents Service
// ─────────────────────────────────────────────────────────────────────────────

// تحويل بيانات الحادثة من الباك إند
const transformIncidentFromBackend = (data: any): Incident => {
  const severityMap: Record<string, string> = {
    'حرج': 'critical',
    'عالي': 'high',
    'متوسط': 'medium',
    'منخفض': 'low',
  };

  return {
    id: data.id,
    cameraId: data.camera_id,
    cameraName: data.camera_name || 'كاميرا غير معروفة',
    location: data.location,
    primaryWeaponType: data.primary_weapon_type || 'مسدس',
    status: data.status || 'نشطة',
    severity: (severityMap[data.severity] || data.severity || 'high') as any,
    alertCount: data.alert_count || 0,
    detectionCount: data.detection_count || 0,
    maxConfidence: data.max_confidence || 0,
    avgConfidence: data.avg_confidence || 0,
    bestSnapshot: data.best_snapshot,
    thumbnail: data.thumbnail,
    startedAt: data.started_at,
    lastDetectionAt: data.last_detection_at,
    endedAt: data.ended_at,
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    notes: data.notes,
    alerts: data.alerts?.map(transformAlertFromBackend),
  };
};

export const incidentService = {
  // جلب جميع الحوادث
  getAll: async (params?: {
    status?: string;
    cameraId?: string;
    weaponType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ incidents: Incident[]; total: number; pages: number }> => {
    const response = await api.get('/incidents', { params });
    return {
      incidents: response.data.incidents.map(transformIncidentFromBackend),
      total: response.data.total,
      pages: response.data.pages,
    };
  },

  // جلب الحوادث مجمعة حسب الكاميرا (العرض الرئيسي)
  getByCamera: async (activeOnly: boolean = false): Promise<IncidentsByCamera> => {
    const response = await api.get('/incidents/by-camera', { 
      params: { active_only: activeOnly } 
    });
    return {
      cameras: response.data.cameras.map((cam: any) => ({
        cameraId: cam.camera_id,
        cameraName: cam.camera_name,
        location: cam.location,
        activeIncidents: cam.active_incidents,
        totalIncidents: cam.total_incidents,
        totalAlerts: cam.total_alerts,
        lastIncidentAt: cam.last_incident_at,
        incidents: cam.incidents.map(transformIncidentFromBackend),
      })),
      totalCameras: response.data.total_cameras,
      totalActiveIncidents: response.data.total_active_incidents,
      totalAlerts: response.data.total_alerts,
    };
  },

  // جلب حادثة محددة مع التنبيهات
  getById: async (id: string): Promise<Incident> => {
    const response = await api.get(`/incidents/${id}`);
    return transformIncidentFromBackend(response.data);
  },

  // جلب إحصائيات الحوادث
  getStats: async (): Promise<IncidentStats> => {
    const response = await api.get('/incidents/stats');
    return {
      totalActive: response.data.total_active,
      totalToday: response.data.total_today,
      totalReviewed: response.data.total_reviewed,
      totalConfirmed: response.data.total_confirmed,
      totalFalseAlarms: response.data.total_false_alarms,
      camerasWithIncidents: response.data.cameras_with_incidents,
    };
  },

  // مراجعة حادثة
  review: async (id: string, data: {
    status: 'تمت المراجعة' | 'مؤكدة' | 'إنذار كاذب';
    notes?: string;
    reviewedBy: string;
  }): Promise<Incident> => {
    const response = await api.put(`/incidents/${id}/review`, {
      status: data.status,
      notes: data.notes,
      reviewed_by: data.reviewedBy,
    });
    return transformIncidentFromBackend(response.data);
  },

  // إغلاق حادثة
  close: async (id: string): Promise<Incident> => {
    const response = await api.put(`/incidents/${id}/close`);
    return transformIncidentFromBackend(response.data);
  },

  // حذف حادثة
  delete: async (id: string): Promise<void> => {
    await api.delete(`/incidents/${id}`);
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
    // تحويل البيانات من الباك إند للفرونت إند
    return response.data.map((alert: any) => transformAlertFromBackend(alert));
  },
};

// تحويل بيانات التنبيه من الباك إند
const transformAlertFromBackend = (data: any): Alert => {
  // خريطة تحويل الخطورة من العربية للإنجليزية
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

  // خريطة تحويل نوع السلاح لنوع الكشف
  const weaponToDetectionType: Record<string, string> = {
    'مسدس': 'weapon',
    'بندقية': 'weapon',
    'سكين': 'knife',
    'أخرى': 'suspicious_object',
    'pistol': 'weapon',
    'rifle': 'weapon',
    'knife': 'knife',
    'other': 'suspicious_object',
  };

  return {
    id: data.id,
    cameraId: data.camera_id,
    cameraName: data.camera_name || 'كاميرا غير معروفة',
    location: data.location || '',
    timestamp: data.timestamp,
    weaponType: data.weapon_type || 'مسدس',
    detectionType: (weaponToDetectionType[data.weapon_type] || 'weapon') as any,
    severity: (severityMap[data.severity] || 'high') as any,
    status: data.status || 'جديد',
    confidence: data.confidence || 0,  // Keep as 0-1 float
    imageSnapshot: data.image_snapshot || data.image_url || '',
    videoClip: data.video_clip || data.video_clip_url || '',
    boundingBox: data.bounding_box || { x: 0, y: 0, width: 0, height: 0 },
  };
};

// خدمات حالة النظام
export const systemService = {
  // فحص حالة الخادم
  getHealth: async (): Promise<{
    status: string;
    service: string;
    version: string;
    timestamp: string;
  }> => {
    // استخدام /api/health بدلاً من /health لأنه خارج prefix
    const response = await api.get('/health', { baseURL: '/api' });
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

// خدمات الكشف
export interface DetectionResult {
  success: boolean;
  timestamp: string;
  processing_time_ms: number;
  image_info: {
    filename: string;
    width: number;
    height: number;
    channels: number;
  };
  detection_summary: {
    total_detections: number;
    weapons_found: number;
    knives_found: number;
    has_critical: boolean;
    has_high: boolean;
  };
  detections: Array<{
    id: string;
    class_name: string;
    class_name_ar: string;
    confidence: number;
    confidence_raw: number;
    bbox: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    };
    detection_type: string;
    severity: string;
    severity_ar: string;
  }>;
  annotated_image: string;
}

export interface DetectionStatus {
  success: boolean;
  model_loaded: boolean;
  model_path: string;
  device: string;
  confidence_threshold: number;
  statistics: {
    total_frames: number;
    total_detections: number;
    average_time_ms: number;
    last_detection: string | null;
  };
  supported_classes: string[];
  timestamp: string;
}

export const detectionService = {
  // الحصول على حالة نموذج الكشف
  getStatus: async (): Promise<DetectionStatus> => {
    const response = await api.get('/detection/status');
    return response.data;
  },

  // اختبار الكشف على صورة
  testImage: async (file: File): Promise<DetectionResult> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/detection/test', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // اختبار الكشف وإرجاع الصورة مباشرة
  testImageReturnImage: async (file: File): Promise<Blob> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/detection/test/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    });
    return response.data;
  },

  // الحصول على الفئات المدعومة
  getClasses: async (): Promise<{
    success: boolean;
    total_classes: number;
    classes: Array<{
      class_name: string;
      class_name_ar: string;
      detection_type: string;
      severity: string;
    }>;
  }> => {
    const response = await api.get('/detection/classes');
    return response.data;
  },
};

export default api;
