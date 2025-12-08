// ═══════════════════════════════════════════════════════════════════════════
// نظرة - نظام الكشف الاستباقي عن التهديدات
// ملف الأنواع الرئيسي
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// أنواع التنبيهات
// ─────────────────────────────────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'جديد' | 'قيد المراجعة' | 'مؤكد' | 'إنذار كاذب';
export type AlertStatusEn = 'new' | 'reviewing' | 'confirmed' | 'false_positive';
export type WeaponType = 'مسدس' | 'سكين';
export type WeaponTypeEn = 'pistol' | 'knife';
export type DetectionType = 'weapon' | 'knife' | 'suspicious_object';

// واجهة التنبيه الكاملة
export interface Alert {
  id: string;
  cameraId: string;
  cameraName: string;                    // "كاميرا البوابة الرئيسية"
  location: string;                      // "المدخل الشمالي - المبنى A"
  timestamp: string;
  weaponType: WeaponType;
  detectionType: DetectionType;
  severity: AlertSeverity;
  status: AlertStatus;
  confidence: number;                    // 0-100%
  imageSnapshot: string;                 // Base64 صورة
  videoClip?: string;                    // رابط الفيديو
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  boundingBox: BoundingBox;
  // الحقول القديمة للتوافق
  imageUrl?: string;
  videoClipUrl?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

// خريطة حالات التنبيه بين العربية والإنجليزية
export const AlertStatusMap: Record<AlertStatus, AlertStatusEn> = {
  'جديد': 'new',
  'قيد المراجعة': 'reviewing',
  'مؤكد': 'confirmed',
  'إنذار كاذب': 'false_positive'
};

export const AlertStatusReverseMap: Record<AlertStatusEn, AlertStatus> = {
  'new': 'جديد',
  'reviewing': 'قيد المراجعة',
  'confirmed': 'مؤكد',
  'false_positive': 'إنذار كاذب'
};

// ألوان حالات التنبيه
export const AlertStatusColors: Record<AlertStatus, string> = {
  'جديد': '#DC2626',           // أحمر
  'قيد المراجعة': '#F59E0B',   // برتقالي
  'مؤكد': '#16A34A',           // أخضر
  'إنذار كاذب': '#6B7280'      // رمادي
};

// خريطة أنواع الأسلحة
export const WeaponTypeMap: Record<WeaponType, WeaponTypeEn> = {
  'مسدس': 'pistol',
  'سكين': 'knife'
};

// أيقونات أنواع الأسلحة
export const WeaponTypeIcons: Record<WeaponType, string> = {
  'مسدس': '🔫',
  'سكين': '🔪'
};

// ─────────────────────────────────────────────────────────────────────────────
// واجهات الشريط الجانبي
// ─────────────────────────────────────────────────────────────────────────────
export interface SidebarItem {
  id: string;
  name: string;
  nameEn: string;
  href: string;
  icon: string;
  badge?: number;
  isActive?: boolean;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهات حالة النظام
// ─────────────────────────────────────────────────────────────────────────────
export type SystemStatusType = 'connected' | 'disconnected' | 'warning' | 'error';

export interface SystemStatus {
  status: SystemStatusType;
  label: string;
  lastUpdate: string;
  services: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'warning';
  latency?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهات بطاقات الإحصائيات
// ─────────────────────────────────────────────────────────────────────────────
export interface StatCardData {
  id: string;
  title: string;
  value: number | string;
  icon: string;
  color: 'green' | 'red' | 'blue' | 'gold' | 'orange';
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    label: string;
  };
  subtitle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// صندوق الإحداثيات
// ─────────────────────────────────────────────────────────────────────────────
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهة الكاميرا
// ─────────────────────────────────────────────────────────────────────────────
export interface Camera {
  id: string;
  name: string;
  location: string;
  rtspUrl: string;
  status: CameraStatus;
  isRecording: boolean;
  lastDetection?: string;
  detectionEnabled: boolean;
  sensitivity: number;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  resolution?: string;
  fps?: number;
}

export type CameraStatus = 'online' | 'offline' | 'error' | 'maintenance';

// واجهة بطاقة الكاميرا للعرض
export interface CameraCardData {
  id: string;
  name: string;
  location: string;
  status: CameraStatus;
  isRecording: boolean;
  thumbnail?: string;
  resolution?: string;
  hasAlert?: boolean;
  alertCount?: number;
  lastActivity?: string;
}

// واجهة الكشف في الوقت الفعلي
export interface Detection {
  id: string;
  type: DetectionType;
  confidence: number;
  boundingBox: BoundingBox;
  timestamp: number;
}

// واجهة إطار الفيديو
export interface VideoFrame {
  cameraId: string;
  timestamp: number;
  frameData: string; // Base64
  detections: Detection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهة الإحصائيات
// ─────────────────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  totalAlerts: number;
  criticalAlerts: number;
  pendingAlerts: number;
  confirmedAlerts: number;
  alertsToday: number;
  alertsThisWeek: number;
  averageResponseTime: number;
  detectionAccuracy: number;
}

// واجهة المستخدم
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  avatar?: string;
  lastLogin?: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';
export type Permission = 
  | 'view_cameras'
  | 'manage_cameras'
  | 'view_alerts'
  | 'manage_alerts'
  | 'view_settings'
  | 'manage_settings'
  | 'manage_users';

// ─────────────────────────────────────────────────────────────────────────────
// واجهة الإعدادات
// ─────────────────────────────────────────────────────────────────────────────
export interface SystemSettings {
  alertSound: boolean;
  autoAcknowledge: boolean;
  retentionDays: number;
  defaultSensitivity: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  webhookUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهة رسالة WebSocket
// ─────────────────────────────────────────────────────────────────────────────
export interface WebSocketMessage {
  type: 'detection' | 'alert' | 'camera_status' | 'heartbeat';
  payload: unknown;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهات شبكة الكاميرات
// ─────────────────────────────────────────────────────────────────────────────
export type GridLayout = '2x2' | '2x3' | '3x3' | '4x4';

export interface CameraGridConfig {
  layout: GridLayout;
  showLabels: boolean;
  showStatus: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// واجهات التصدير
// ─────────────────────────────────────────────────────────────────────────────
export interface ExportOptions {
  format: 'pdf' | 'csv' | 'xlsx';
  dateRange: {
    start: string;
    end: string;
  };
  includeImages: boolean;
  includeVideos: boolean;
}
