import { useState } from 'react';
import {
  X,
  Video,
  MapPin,
  Link2,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Sliders,
  Wifi,
  Monitor,
} from 'lucide-react';
import type { Camera } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// واجهات المكون
// ═══════════════════════════════════════════════════════════════════════════
interface AddCameraModalProps {
  camera?: Camera;
  onClose: () => void;
  onSave: (camera: Partial<Camera>) => void;
}

type ConnectionType = 'rtsp' | 'onvif';

interface FormData {
  name: string;
  location: string;
  connectionType: ConnectionType;
  // RTSP
  rtspUrl: string;
  // ONVIF
  onvifIp: string;
  onvifPort: string;
  onvifUsername: string;
  onvifPassword: string;
  // إعدادات عامة
  resolution: string;
  fps: number;
  sensitivity: number;
  detectionEnabled: boolean;
}

interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════
function AddCameraModal({ camera, onClose, onSave }: AddCameraModalProps) {
  const isEditing = !!camera;
  
  // حالة النموذج
  const [formData, setFormData] = useState<FormData>({
    name: camera?.name || '',
    location: camera?.location || '',
    connectionType: 'rtsp',
    rtspUrl: camera?.rtspUrl || '',
    onvifIp: '',
    onvifPort: '80',
    onvifUsername: '',
    onvifPassword: '',
    resolution: camera?.resolution || '1920x1080',
    fps: camera?.fps || 30,
    sensitivity: camera?.sensitivity || 75,
    detectionEnabled: camera?.detectionEnabled ?? true,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResult>({ status: 'idle' });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [activeTab, setActiveTab] = useState<'connection' | 'settings'>('connection');

  // ─────────────────────────────────────────────────────────────────────────────
  // التحقق من الصحة
  // ─────────────────────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'اسم الكاميرا مطلوب';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'الموقع مطلوب';
    }

    if (formData.connectionType === 'rtsp') {
      if (!formData.rtspUrl.trim()) {
        newErrors.rtspUrl = 'رابط RTSP مطلوب';
      } else if (!formData.rtspUrl.startsWith('rtsp://')) {
        newErrors.rtspUrl = 'الرابط يجب أن يبدأ بـ rtsp://';
      }
    } else {
      if (!formData.onvifIp.trim()) {
        newErrors.onvifIp = 'عنوان IP مطلوب';
      } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.onvifIp)) {
        newErrors.onvifIp = 'عنوان IP غير صالح';
      }
      
      if (!formData.onvifPort.trim()) {
        newErrors.onvifPort = 'المنفذ مطلوب';
      }
      
      if (!formData.onvifUsername.trim()) {
        newErrors.onvifUsername = 'اسم المستخدم مطلوب';
      }
      
      if (!formData.onvifPassword.trim()) {
        newErrors.onvifPassword = 'كلمة المرور مطلوبة';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // اختبار الاتصال
  // ─────────────────────────────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    setConnectionTest({ status: 'testing' });
    
    // محاكاة اختبار الاتصال
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // نجاح عشوائي للمحاكاة
    const success = Math.random() > 0.3;
    
    if (success) {
      setConnectionTest({ 
        status: 'success', 
        message: 'تم الاتصال بنجاح! الكاميرا متصلة وتعمل.' 
      });
    } else {
      setConnectionTest({ 
        status: 'error', 
        message: 'فشل الاتصال. تأكد من صحة البيانات وأن الكاميرا متصلة بالشبكة.' 
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // حفظ البيانات
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const rtspUrl = formData.connectionType === 'rtsp' 
      ? formData.rtspUrl 
      : `rtsp://${formData.onvifUsername}:${formData.onvifPassword}@${formData.onvifIp}:${formData.onvifPort}/stream1`;

    onSave({
      name: formData.name,
      location: formData.location,
      rtspUrl,
      resolution: formData.resolution,
      fps: formData.fps,
      sensitivity: formData.sensitivity,
      detectionEnabled: formData.detectionEnabled,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // تحديث الحقل
  // ─────────────────────────────────────────────────────────────────────────────
  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    // إعادة ضبط اختبار الاتصال عند تغيير البيانات
    if (connectionTest.status !== 'idle') {
      setConnectionTest({ status: 'idle' });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* العنوان */}
        <div className="flex items-center justify-between p-6 border-b border-nazra-border bg-nazra-lightest">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-saudi-green-100 rounded-xl">
              <Video className="w-5 h-5 text-saudi-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-nazra-text">
                {isEditing ? 'تعديل الكاميرا' : 'إضافة كاميرا جديدة'}
              </h2>
              <p className="text-sm text-nazra-text-muted">
                {isEditing ? 'قم بتعديل إعدادات الكاميرا' : 'أدخل بيانات الكاميرا الجديدة'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-nazra-text-muted hover:text-nazra-text hover:bg-nazra-lighter rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* التبويبات */}
        <div className="flex border-b border-nazra-border">
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'connection'
                ? 'text-saudi-green-600 border-b-2 border-saudi-green-500 bg-saudi-green-50/50'
                : 'text-nazra-text-muted hover:text-nazra-text'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Wifi className="w-4 h-4" />
              إعدادات الاتصال
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-saudi-green-600 border-b-2 border-saudi-green-500 bg-saudi-green-50/50'
                : 'text-nazra-text-muted hover:text-nazra-text'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings className="w-4 h-4" />
              إعدادات الكشف
            </div>
          </button>
        </div>

        {/* المحتوى */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'connection' ? (
            <div className="space-y-6">
              {/* المعلومات الأساسية */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* اسم الكاميرا */}
                <div>
                  <label className="block text-sm font-medium text-nazra-text mb-2">
                    <Video className="w-4 h-4 inline ml-2" />
                    اسم الكاميرا *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="مثال: كاميرا البوابة الرئيسية"
                    className={`w-full px-4 py-2.5 bg-nazra-lightest border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 ${
                      errors.name ? 'border-red-500' : 'border-nazra-border'
                    }`}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* الموقع */}
                <div>
                  <label className="block text-sm font-medium text-nazra-text mb-2">
                    <MapPin className="w-4 h-4 inline ml-2" />
                    الموقع *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="مثال: المدخل الشمالي"
                    className={`w-full px-4 py-2.5 bg-nazra-lightest border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 ${
                      errors.location ? 'border-red-500' : 'border-nazra-border'
                    }`}
                  />
                  {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                </div>
              </div>

              {/* نوع الاتصال */}
              <div>
                <label className="block text-sm font-medium text-nazra-text mb-3">نوع الاتصال</label>
                <div className="flex gap-4">
                  <label className={`
                    flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${formData.connectionType === 'rtsp' 
                      ? 'border-saudi-green-500 bg-saudi-green-50' 
                      : 'border-nazra-border hover:border-nazra-lighter'
                    }
                  `}>
                    <input
                      type="radio"
                      name="connectionType"
                      value="rtsp"
                      checked={formData.connectionType === 'rtsp'}
                      onChange={() => updateField('connectionType', 'rtsp')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.connectionType === 'rtsp' ? 'border-saudi-green-500' : 'border-gray-300'
                    }`}>
                      {formData.connectionType === 'rtsp' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-saudi-green-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-nazra-text">RTSP</p>
                      <p className="text-xs text-nazra-text-muted">اتصال مباشر عبر رابط البث</p>
                    </div>
                  </label>

                  <label className={`
                    flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${formData.connectionType === 'onvif' 
                      ? 'border-saudi-green-500 bg-saudi-green-50' 
                      : 'border-nazra-border hover:border-nazra-lighter'
                    }
                  `}>
                    <input
                      type="radio"
                      name="connectionType"
                      value="onvif"
                      checked={formData.connectionType === 'onvif'}
                      onChange={() => updateField('connectionType', 'onvif')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formData.connectionType === 'onvif' ? 'border-saudi-green-500' : 'border-gray-300'
                    }`}>
                      {formData.connectionType === 'onvif' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-saudi-green-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-nazra-text">ONVIF</p>
                      <p className="text-xs text-nazra-text-muted">اكتشاف تلقائي للكاميرا</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* إعدادات RTSP */}
              {formData.connectionType === 'rtsp' && (
                <div className="bg-nazra-lightest rounded-xl p-4 border border-nazra-border">
                  <h4 className="font-medium text-nazra-text mb-4 flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    إعدادات RTSP
                  </h4>
                  <div>
                    <label className="block text-sm text-nazra-text-muted mb-2">رابط البث *</label>
                    <input
                      type="text"
                      value={formData.rtspUrl}
                      onChange={(e) => updateField('rtspUrl', e.target.value)}
                      placeholder="rtsp://192.168.1.100:554/stream1"
                      dir="ltr"
                      className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 font-mono text-sm ${
                        errors.rtspUrl ? 'border-red-500' : 'border-nazra-border'
                      }`}
                    />
                    {errors.rtspUrl && <p className="text-red-500 text-xs mt-1">{errors.rtspUrl}</p>}
                    <p className="text-xs text-nazra-text-muted mt-2">
                      صيغة الرابط: rtsp://[username:password@]ip:port/path
                    </p>
                  </div>
                </div>
              )}

              {/* إعدادات ONVIF */}
              {formData.connectionType === 'onvif' && (
                <div className="bg-nazra-lightest rounded-xl p-4 border border-nazra-border">
                  <h4 className="font-medium text-nazra-text mb-4 flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    إعدادات ONVIF
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* IP */}
                    <div>
                      <label className="block text-sm text-nazra-text-muted mb-2">عنوان IP *</label>
                      <input
                        type="text"
                        value={formData.onvifIp}
                        onChange={(e) => updateField('onvifIp', e.target.value)}
                        placeholder="192.168.1.100"
                        dir="ltr"
                        className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 font-mono ${
                          errors.onvifIp ? 'border-red-500' : 'border-nazra-border'
                        }`}
                      />
                      {errors.onvifIp && <p className="text-red-500 text-xs mt-1">{errors.onvifIp}</p>}
                    </div>

                    {/* المنفذ */}
                    <div>
                      <label className="block text-sm text-nazra-text-muted mb-2">المنفذ *</label>
                      <input
                        type="text"
                        value={formData.onvifPort}
                        onChange={(e) => updateField('onvifPort', e.target.value)}
                        placeholder="80"
                        dir="ltr"
                        className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 font-mono ${
                          errors.onvifPort ? 'border-red-500' : 'border-nazra-border'
                        }`}
                      />
                      {errors.onvifPort && <p className="text-red-500 text-xs mt-1">{errors.onvifPort}</p>}
                    </div>

                    {/* اسم المستخدم */}
                    <div>
                      <label className="block text-sm text-nazra-text-muted mb-2">اسم المستخدم *</label>
                      <input
                        type="text"
                        value={formData.onvifUsername}
                        onChange={(e) => updateField('onvifUsername', e.target.value)}
                        placeholder="admin"
                        dir="ltr"
                        className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 ${
                          errors.onvifUsername ? 'border-red-500' : 'border-nazra-border'
                        }`}
                      />
                      {errors.onvifUsername && <p className="text-red-500 text-xs mt-1">{errors.onvifUsername}</p>}
                    </div>

                    {/* كلمة المرور */}
                    <div>
                      <label className="block text-sm text-nazra-text-muted mb-2">كلمة المرور *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.onvifPassword}
                          onChange={(e) => updateField('onvifPassword', e.target.value)}
                          placeholder="••••••••"
                          dir="ltr"
                          className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500 ${
                            errors.onvifPassword ? 'border-red-500' : 'border-nazra-border'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-nazra-text-muted hover:text-nazra-text"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.onvifPassword && <p className="text-red-500 text-xs mt-1">{errors.onvifPassword}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* اختبار الاتصال */}
              <div className="border-t border-nazra-border pt-4">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={connectionTest.status === 'testing'}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {connectionTest.status === 'testing' ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      جاري اختبار الاتصال...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-5 h-5" />
                      اختبار الاتصال
                    </>
                  )}
                </button>

                {/* نتيجة الاختبار */}
                {connectionTest.status !== 'idle' && connectionTest.status !== 'testing' && (
                  <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                    connectionTest.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    {connectionTest.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        connectionTest.status === 'success' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {connectionTest.status === 'success' ? 'نجح الاتصال' : 'فشل الاتصال'}
                      </p>
                      <p className={`text-sm ${
                        connectionTest.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {connectionTest.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* إعدادات الكشف */
            <div className="space-y-6">
              {/* إعدادات الدقة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* الدقة */}
                <div>
                  <label className="block text-sm font-medium text-nazra-text mb-2">
                    <Monitor className="w-4 h-4 inline ml-2" />
                    دقة الفيديو
                  </label>
                  <select
                    value={formData.resolution}
                    onChange={(e) => updateField('resolution', e.target.value)}
                    className="w-full px-4 py-2.5 bg-nazra-lightest border border-nazra-border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500"
                  >
                    <option value="1920x1080">1080p (1920×1080)</option>
                    <option value="1280x720">720p (1280×720)</option>
                    <option value="854x480">480p (854×480)</option>
                    <option value="640x360">360p (640×360)</option>
                  </select>
                </div>

                {/* معدل الإطارات */}
                <div>
                  <label className="block text-sm font-medium text-nazra-text mb-2">
                    معدل الإطارات (FPS)
                  </label>
                  <select
                    value={formData.fps}
                    onChange={(e) => updateField('fps', parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 bg-nazra-lightest border border-nazra-border rounded-lg focus:outline-none focus:ring-2 focus:ring-saudi-green-500"
                  >
                    <option value={30}>30 fps</option>
                    <option value={25}>25 fps</option>
                    <option value={20}>20 fps</option>
                    <option value={15}>15 fps</option>
                  </select>
                </div>
              </div>

              {/* حساسية الكشف */}
              <div>
                <label className="block text-sm font-medium text-nazra-text mb-2">
                  <Sliders className="w-4 h-4 inline ml-2" />
                  حساسية الكشف: {formData.sensitivity}%
                </label>
                <div className="bg-nazra-lightest rounded-xl p-4 border border-nazra-border">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.sensitivity}
                    onChange={(e) => updateField('sensitivity', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-saudi-green-500"
                  />
                  <div className="flex justify-between mt-2 text-xs text-nazra-text-muted">
                    <span>منخفضة (0%)</span>
                    <span>متوسطة (50%)</span>
                    <span>عالية (100%)</span>
                  </div>
                  <p className="text-xs text-nazra-text-muted mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <AlertTriangle className="w-4 h-4 inline ml-1 text-yellow-600" />
                    حساسية عالية قد تؤدي إلى تنبيهات كاذبة أكثر. حساسية منخفضة قد تفوت بعض الكشوفات.
                  </p>
                </div>
              </div>

              {/* تفعيل الكشف */}
              <div className="bg-nazra-lightest rounded-xl p-4 border border-nazra-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-nazra-text">تفعيل الكشف التلقائي</h4>
                    <p className="text-sm text-nazra-text-muted mt-1">
                      تشغيل نظام الكشف الذكي عن التهديدات لهذه الكاميرا
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField('detectionEnabled', !formData.detectionEnabled)}
                    className={`
                      relative w-14 h-7 rounded-full transition-colors
                      ${formData.detectionEnabled ? 'bg-saudi-green-500' : 'bg-gray-300'}
                    `}
                  >
                    <span className={`
                      absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow
                      ${formData.detectionEnabled ? 'right-1' : 'left-1'}
                    `} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* أزرار الإجراءات */}
        <div className="flex items-center justify-between p-6 border-t border-nazra-border bg-nazra-lightest">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-nazra-border text-nazra-text rounded-lg hover:bg-white transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600 transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isEditing ? 'حفظ التغييرات' : 'إضافة الكاميرا'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddCameraModal;
