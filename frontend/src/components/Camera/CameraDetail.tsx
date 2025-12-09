import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video,
  ArrowRight,
  Settings,
  AlertTriangle,
  Clock,
  Calendar,
  Activity,
  Shield,
  Eye,
  Signal,
  HardDrive,
  Cpu,
  Sliders,
  MapPin,
  RefreshCw,
  Download,
  Share2,
  MoreVertical,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Circle,
} from 'lucide-react';
import type { Camera, Alert, Detection } from '../../types';
import { cameraService, alertService, cameraStreamService } from '../../services/api';
import LiveStream from './LiveStream';

// واجهة إحصائيات الكاميرا
interface CameraStats {
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
}

// ═══════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════
function CameraDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [camera, setCamera] = useState<Camera | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [cameraStats, setCameraStats] = useState<CameraStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'settings' | 'stats'>('alerts');
  const [sensitivity, setSensitivity] = useState(75);

  // ─────────────────────────────────────────────────────────────────────────────
  // جلب البيانات من API
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('معرف الكاميرا غير موجود');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // جلب بيانات الكاميرا
        const cameraData = await cameraService.getById(id);
        setCamera(cameraData);
        setSensitivity(cameraData.sensitivity || 75);

        // جلب التنبيهات المرتبطة بالكاميرا
        try {
          const alertsResponse = await alertService.getAll({ cameraId: id, limit: 10 });
          setAlerts(alertsResponse.alerts || []);
        } catch {
          // التنبيهات اختيارية - لا نريد فشل الصفحة إذا لم تتوفر
          setAlerts([]);
        }

        // جلب إحصائيات الكاميرا
        try {
          const statsData = await cameraStreamService.getCameraStats(id);
          setCameraStats(statsData);
        } catch {
          // الإحصائيات اختيارية
          setCameraStats(null);
        }

        // الكشوفات فارغة حتى يتم تنفيذ البث المباشر
        setDetections([]);
      } catch (err) {
        console.error('خطأ في جلب بيانات الكاميرا:', err);
        setError('تعذر تحميل بيانات الكاميرا. تأكد من تشغيل الخادم.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // ─────────────────────────────────────────────────────────────────────────────
  // إذا كانت البيانات جاري تحميلها
  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-nazra-text-muted">جاري تحميل بيانات الكاميرا...</p>
        </div>
      </div>
    );
  }

  // عرض رسالة الخطأ
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-nazra-text mb-2">خطأ في تحميل البيانات</h2>
          <p className="text-nazra-text-muted mb-4">{error}</p>
          <button
            onClick={() => navigate('/cameras')}
            className="px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600"
          >
            العودة لقائمة الكاميرات
          </button>
        </div>
      </div>
    );
  }

  if (!camera) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-nazra-text mb-2">الكاميرا غير موجودة</h2>
          <p className="text-nazra-text-muted mb-4">لم يتم العثور على الكاميرا المطلوبة</p>
          <button
            onClick={() => navigate('/cameras')}
            className="px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600"
          >
            العودة لقائمة الكاميرات
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // مكون إحصائية
  // ─────────────────────────────────────────────────────────────────────────────
  const StatCard = ({ icon: Icon, label, value, color, subValue }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    color: string;
    subValue?: string;
  }) => (
    <div className="bg-white rounded-xl border border-nazra-border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-nazra-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-nazra-text">{value}</p>
      {subValue && <p className="text-xs text-nazra-text-muted mt-1">{subValue}</p>}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // مكون التنبيه
  // ─────────────────────────────────────────────────────────────────────────────
  const AlertItem = ({ alert }: { alert: Alert }) => {
    const severityColors = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };

    const statusColors = {
      'جديد': 'bg-red-500',
      'قيد المراجعة': 'bg-yellow-500',
      'مؤكد': 'bg-green-500',
      'إنذار كاذب': 'bg-gray-500',
    };

    return (
      <div className="flex items-center gap-4 p-4 bg-nazra-lightest rounded-xl border border-nazra-border hover:border-saudi-green-300 transition-colors cursor-pointer">
        {/* أيقونة نوع السلاح */}
        <div className={`p-3 rounded-xl ${alert.detectionType === 'weapon' ? 'bg-red-100' : 'bg-orange-100'}`}>
          {alert.weaponType === 'مسدس' ? '🔫' : '🔪'}
        </div>

        {/* المعلومات */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[alert.severity]}`}>
              {alert.severity === 'critical' ? 'حرج' : 
               alert.severity === 'high' ? 'عالي' : 
               alert.severity === 'medium' ? 'متوسط' : 'منخفض'}
            </span>
            <span className="text-xs text-nazra-text-muted">•</span>
            <span className="text-xs text-nazra-text-muted">{alert.weaponType}</span>
          </div>
          <p className="text-sm text-nazra-text">
            تم رصد {alert.weaponType} بثقة {alert.confidence}%
          </p>
          <p className="text-xs text-nazra-text-muted mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(alert.timestamp).toLocaleString('ar-SA')}
          </p>
        </div>

        {/* الحالة */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[alert.status]}`}></span>
          <span className="text-sm text-nazra-text-muted">{alert.status}</span>
        </div>

        {/* سهم */}
        <ChevronLeft className="w-5 h-5 text-nazra-text-muted" />
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* شريط التنقل */}
      <div className="flex items-center gap-2 text-sm text-nazra-text-muted">
        <button onClick={() => navigate('/cameras')} className="hover:text-saudi-green-500">
          الكاميرات
        </button>
        <ArrowRight className="w-4 h-4 rotate-180" />
        <span className="text-nazra-text">{camera.name}</span>
      </div>

      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${camera.status === 'online' ? 'bg-green-100' : 'bg-red-100'}`}>
            <Video className={`w-6 h-6 ${camera.status === 'online' ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-nazra-text">{camera.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                camera.status === 'online' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {camera.status === 'online' ? 'متصل' : 'غير متصل'}
              </span>
              {camera.isRecording && (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                  <Circle className="w-2 h-2 fill-red-500" />
                  يسجل
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-nazra-text-muted mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {camera.location}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Signal className="w-4 h-4" />
                {camera.resolution} @ {camera.fps}fps
              </span>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex items-center gap-2">
          <button className="p-2.5 border border-nazra-border rounded-lg hover:bg-nazra-lightest transition-colors">
            <RefreshCw className="w-5 h-5 text-nazra-text-muted" />
          </button>
          <button className="p-2.5 border border-nazra-border rounded-lg hover:bg-nazra-lightest transition-colors">
            <Download className="w-5 h-5 text-nazra-text-muted" />
          </button>
          <button className="p-2.5 border border-nazra-border rounded-lg hover:bg-nazra-lightest transition-colors">
            <Share2 className="w-5 h-5 text-nazra-text-muted" />
          </button>
          <button className="p-2.5 border border-nazra-border rounded-lg hover:bg-nazra-lightest transition-colors">
            <MoreVertical className="w-5 h-5 text-nazra-text-muted" />
          </button>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* البث المباشر */}
        <div className="lg:col-span-2">
          <LiveStream
            camera={camera}
            detections={detections}
            showControls={true}
            showOverlay={true}
            className="rounded-2xl overflow-hidden shadow-lg"
          />
        </div>

        {/* الشريط الجانبي */}
        <div className="space-y-6">
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={AlertTriangle}
              label="التنبيهات"
              value={alerts.length}
              color="bg-red-100 text-red-600"
              subValue="هذا الأسبوع"
            />
            <StatCard
              icon={Shield}
              label="الكشف"
              value={camera.detectionEnabled ? 'مفعّل' : 'معطّل'}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              icon={Activity}
              label="الحساسية"
              value={`${camera.sensitivity}%`}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              icon={Clock}
              label="آخر كشف"
              value={camera.lastDetection ? new Date(camera.lastDetection).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'لا يوجد'}
              color="bg-purple-100 text-purple-600"
            />
          </div>

          {/* معلومات إضافية */}
          <div className="bg-white rounded-xl border border-nazra-border p-4">
            <h3 className="font-semibold text-nazra-text mb-4">معلومات الكاميرا</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-nazra-text-muted">معرّف الكاميرا</span>
                <code className="bg-nazra-lightest px-2 py-1 rounded text-xs">{camera.id}</code>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-nazra-text-muted">رابط RTSP</span>
                <code className="bg-nazra-lightest px-2 py-1 rounded text-xs max-w-[150px] truncate">
                  {camera.rtspUrl}
                </code>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-nazra-text-muted">تاريخ الإضافة</span>
                <span className="text-nazra-text">
                  {new Date(camera.createdAt).toLocaleDateString('ar-SA')}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-nazra-text-muted">آخر تحديث</span>
                <span className="text-nazra-text">
                  {new Date(camera.updatedAt).toLocaleDateString('ar-SA')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="bg-white rounded-xl border border-nazra-border overflow-hidden">
        {/* شريط التبويبات */}
        <div className="flex border-b border-nazra-border">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'alerts'
                ? 'text-saudi-green-600 border-b-2 border-saudi-green-500 bg-saudi-green-50/50'
                : 'text-nazra-text-muted hover:text-nazra-text'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            سجل التنبيهات
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">
              {alerts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'settings'
                ? 'text-saudi-green-600 border-b-2 border-saudi-green-500 bg-saudi-green-50/50'
                : 'text-nazra-text-muted hover:text-nazra-text'
            }`}
          >
            <Settings className="w-4 h-4" />
            إعدادات الكشف
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'stats'
                ? 'text-saudi-green-600 border-b-2 border-saudi-green-500 bg-saudi-green-50/50'
                : 'text-nazra-text-muted hover:text-nazra-text'
            }`}
          >
            <Activity className="w-4 h-4" />
            الإحصائيات
          </button>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-6">
          {/* سجل التنبيهات */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-nazra-text font-medium">لا توجد تنبيهات</p>
                  <p className="text-nazra-text-muted text-sm">لم يتم رصد أي تهديدات من هذه الكاميرا</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <AlertItem key={alert.id} alert={alert} />
                ))
              )}
            </div>
          )}

          {/* إعدادات الكشف */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* تفعيل الكشف */}
              <div className="flex items-center justify-between p-4 bg-nazra-lightest rounded-xl">
                <div>
                  <h4 className="font-medium text-nazra-text">تفعيل الكشف التلقائي</h4>
                  <p className="text-sm text-nazra-text-muted">تشغيل نظام الكشف الذكي</p>
                </div>
                <button
                  onClick={() => setCamera(prev => prev ? { ...prev, detectionEnabled: !prev.detectionEnabled } : null)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    camera.detectionEnabled ? 'bg-saudi-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                    camera.detectionEnabled ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>

              {/* حساسية الكشف */}
              <div className="p-4 bg-nazra-lightest rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-nazra-text flex items-center gap-2">
                      <Sliders className="w-4 h-4" />
                      حساسية الكشف
                    </h4>
                    <p className="text-sm text-nazra-text-muted">تحديد مستوى الحساسية</p>
                  </div>
                  <span className="text-2xl font-bold text-saudi-green-600">{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-saudi-green-500"
                />
                <div className="flex justify-between mt-2 text-xs text-nazra-text-muted">
                  <span>منخفضة</span>
                  <span>متوسطة</span>
                  <span>عالية</span>
                </div>
              </div>

              {/* أنواع الكشف */}
              <div className="p-4 bg-nazra-lightest rounded-xl">
                <h4 className="font-medium text-nazra-text mb-4">أنواع الكشف المفعّلة</h4>
                <div className="space-y-3">
                  {['الأسلحة النارية', 'السكاكين والأدوات الحادة', 'الأجسام المشبوهة'].map((type, index) => (
                    <label key={index} className="flex items-center justify-between cursor-pointer">
                      <span className="text-nazra-text">{type}</span>
                      <input
                        type="checkbox"
                        defaultChecked={true}
                        className="w-5 h-5 rounded border-nazra-border text-saudi-green-500 focus:ring-saudi-green-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* حفظ الإعدادات */}
              <button className="w-full py-3 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600 transition-colors font-medium">
                حفظ الإعدادات
              </button>
            </div>
          )}

          {/* الإحصائيات */}
          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-nazra-lightest rounded-xl p-6 text-center">
                <Cpu className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-nazra-text">
                  {cameraStats ? `${(cameraStats.accuracy * 100).toFixed(0)}%` : '-'}
                </p>
                <p className="text-sm text-nazra-text-muted mt-1">دقة الكشف</p>
              </div>
              <div className="bg-nazra-lightest rounded-xl p-6 text-center">
                <Eye className="w-8 h-8 text-green-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-nazra-text">
                  {cameraStats ? cameraStats.totalDetections.toLocaleString('ar-SA') : '-'}
                </p>
                <p className="text-sm text-nazra-text-muted mt-1">عملية كشف</p>
              </div>
              <div className="bg-nazra-lightest rounded-xl p-6 text-center">
                <HardDrive className="w-8 h-8 text-purple-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-nazra-text">
                  {cameraStats?.storageUsed || '-'}
                </p>
                <p className="text-sm text-nazra-text-muted mt-1">تسجيلات محفوظة</p>
              </div>
              <div className="bg-nazra-lightest rounded-xl p-6 text-center">
                <Activity className="w-8 h-8 text-orange-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-nazra-text">
                  {cameraStats ? `${cameraStats.uptime}ms` : '-'}
                </p>
                <p className="text-sm text-nazra-text-muted mt-1">زمن الاستجابة</p>
              </div>
              <div className="bg-nazra-lightest rounded-xl p-6 text-center">
                <Calendar className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-nazra-text">
                  {cameraStats?.alertsCount?.total?.toLocaleString('ar-SA') || '-'}
                </p>
                <p className="text-sm text-nazra-text-muted mt-1">إجمالي التنبيهات</p>
              </div>
              <div className="bg-nazra-lightest rounded-xl p-6 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-nazra-text">
                  {cameraStats?.alertsCount ? 
                    `${((cameraStats.alertsCount.falsePositive / (cameraStats.alertsCount.total || 1)) * 100).toFixed(0)}%` 
                    : '-'}
                </p>
                <p className="text-sm text-nazra-text-muted mt-1">نسبة الإنذارات الكاذبة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CameraDetail;
