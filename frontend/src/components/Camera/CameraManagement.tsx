import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Plus,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  Edit2,
  Trash2,
  Settings,
  Play,
  Eye,
  WifiOff,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  Signal,
} from 'lucide-react';
import type { Camera } from '../../types';
import AddCameraModal from './AddCameraModal';

// ═══════════════════════════════════════════════════════════════════════════
// بيانات وهمية
// ═══════════════════════════════════════════════════════════════════════════
const mockCameras: Camera[] = [
  {
    id: 'cam-1',
    name: 'كاميرا البوابة الرئيسية',
    location: 'المدخل الشمالي',
    rtspUrl: 'rtsp://192.168.1.100:554/stream1',
    status: 'online',
    isRecording: true,
    lastDetection: '2024-03-15T10:30:00',
    detectionEnabled: true,
    sensitivity: 75,
    resolution: '1920x1080',
    fps: 30,
    createdAt: '2024-01-01T00:00:00',
    updatedAt: '2024-03-15T10:30:00',
  },
  {
    id: 'cam-2',
    name: 'كاميرا موقف السيارات',
    location: 'المنطقة A',
    rtspUrl: 'rtsp://192.168.1.101:554/stream1',
    status: 'online',
    isRecording: true,
    detectionEnabled: true,
    sensitivity: 80,
    resolution: '1920x1080',
    fps: 30,
    createdAt: '2024-01-05T00:00:00',
    updatedAt: '2024-03-10T14:20:00',
  },
  {
    id: 'cam-3',
    name: 'كاميرا الممر الشرقي',
    location: 'المدخل الشرقي',
    rtspUrl: 'rtsp://192.168.1.102:554/stream1',
    status: 'offline',
    isRecording: false,
    detectionEnabled: true,
    sensitivity: 70,
    resolution: '1280x720',
    fps: 25,
    createdAt: '2024-02-01T00:00:00',
    updatedAt: '2024-03-01T08:00:00',
  },
  {
    id: 'cam-4',
    name: 'كاميرا الردهة',
    location: 'الطابق الأرضي',
    rtspUrl: 'rtsp://192.168.1.103:554/stream1',
    status: 'error',
    isRecording: false,
    detectionEnabled: false,
    sensitivity: 65,
    resolution: '1920x1080',
    fps: 30,
    createdAt: '2024-02-15T00:00:00',
    updatedAt: '2024-03-14T16:45:00',
  },
  {
    id: 'cam-5',
    name: 'كاميرا المخزن',
    location: 'الطابق السفلي',
    rtspUrl: 'rtsp://192.168.1.104:554/stream1',
    status: 'online',
    isRecording: true,
    lastDetection: '2024-03-15T09:15:00',
    detectionEnabled: true,
    sensitivity: 85,
    resolution: '1280x720',
    fps: 20,
    createdAt: '2024-01-20T00:00:00',
    updatedAt: '2024-03-15T09:15:00',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════
function CameraManagement() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>(mockCameras);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'error'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // تصفية الكاميرات
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredCameras = useMemo(() => {
    return cameras.filter(camera => {
      const matchesSearch = searchQuery === '' ||
        camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        camera.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        camera.rtspUrl.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || camera.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [cameras, searchQuery, statusFilter]);

  // ─────────────────────────────────────────────────────────────────────────────
  // إحصائيات
  // ─────────────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: cameras.length,
    online: cameras.filter(c => c.status === 'online').length,
    offline: cameras.filter(c => c.status === 'offline').length,
    error: cameras.filter(c => c.status === 'error').length,
    recording: cameras.filter(c => c.isRecording).length,
  }), [cameras]);

  // ─────────────────────────────────────────────────────────────────────────────
  // معالجات الأحداث
  // ─────────────────────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const handleTestConnection = async (cameraId: string) => {
    setTestingConnection(cameraId);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setTestingConnection(null);
  };

  const handleDeleteCamera = (cameraId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الكاميرا؟')) {
      setCameras(prev => prev.filter(c => c.id !== cameraId));
    }
  };

  const handleToggleRecording = (cameraId: string) => {
    setCameras(prev => prev.map(c => 
      c.id === cameraId ? { ...c, isRecording: !c.isRecording } : c
    ));
  };

  const handleToggleDetection = (cameraId: string) => {
    setCameras(prev => prev.map(c => 
      c.id === cameraId ? { ...c, detectionEnabled: !c.detectionEnabled } : c
    ));
  };

  const handleSelectAll = () => {
    if (selectedCameras.length === filteredCameras.length) {
      setSelectedCameras([]);
    } else {
      setSelectedCameras(filteredCameras.map(c => c.id));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`هل أنت متأكد من حذف ${selectedCameras.length} كاميرا؟`)) {
      setCameras(prev => prev.filter(c => !selectedCameras.includes(c.id)));
      setSelectedCameras([]);
    }
  };

  const handleAddCamera = (camera: Partial<Camera>) => {
    const newCamera: Camera = {
      id: `cam-${Date.now()}`,
      name: camera.name || '',
      location: camera.location || '',
      rtspUrl: camera.rtspUrl || '',
      status: 'offline',
      isRecording: false,
      detectionEnabled: true,
      sensitivity: 75,
      resolution: '1920x1080',
      fps: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...camera,
    };
    setCameras(prev => [...prev, newCamera]);
    setShowAddModal(false);
  };

  const handleEditCamera = (camera: Partial<Camera>) => {
    if (editingCamera) {
      setCameras(prev => prev.map(c => 
        c.id === editingCamera.id ? { ...c, ...camera, updatedAt: new Date().toISOString() } : c
      ));
      setEditingCamera(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // مكون حالة الكاميرا
  // ─────────────────────────────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: Camera['status'] }) => {
    const config = {
      online: { label: 'متصل', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
      offline: { label: 'غير متصل', icon: WifiOff, className: 'bg-gray-100 text-gray-700' },
      error: { label: 'خطأ', icon: XCircle, className: 'bg-red-100 text-red-700' },
      maintenance: { label: 'صيانة', icon: Settings, className: 'bg-yellow-100 text-yellow-700' },
    };
    const { label, icon: Icon, className } = config[status];
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* العنوان والإحصائيات */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-saudi-green-50 rounded-xl">
            <Video className="w-6 h-6 text-saudi-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-nazra-text">إدارة الكاميرات</h1>
            <p className="text-nazra-text-muted">إدارة وتكوين جميع الكاميرات المتصلة بالنظام</p>
          </div>
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white rounded-lg border border-nazra-border">
            <span className="text-sm text-nazra-text-muted">الإجمالي</span>
            <p className="text-xl font-bold text-nazra-text">{stats.total}</p>
          </div>
          <div className="px-4 py-2 bg-green-50 rounded-lg border border-green-200">
            <span className="text-sm text-green-600">متصل</span>
            <p className="text-xl font-bold text-green-700">{stats.online}</p>
          </div>
          <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm text-gray-600">غير متصل</span>
            <p className="text-xl font-bold text-gray-700">{stats.offline}</p>
          </div>
          <div className="px-4 py-2 bg-red-50 rounded-lg border border-red-200">
            <span className="text-sm text-red-600">خطأ</span>
            <p className="text-xl font-bold text-red-700">{stats.error}</p>
          </div>
        </div>
      </div>

      {/* شريط الأدوات */}
      <div className="bg-white rounded-xl border border-nazra-border p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* البحث والفلاتر */}
          <div className="flex items-center gap-3 flex-1 w-full lg:w-auto">
            {/* البحث */}
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nazra-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن كاميرا..."
                className="w-full pl-3 pr-10 py-2.5 bg-nazra-lightest border border-nazra-border rounded-lg text-nazra-text placeholder:text-nazra-text-muted focus:outline-none focus:ring-2 focus:ring-saudi-green-500"
              />
            </div>

            {/* فلتر الحالة */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="appearance-none pl-8 pr-4 py-2.5 bg-nazra-lightest border border-nazra-border rounded-lg text-nazra-text focus:outline-none focus:ring-2 focus:ring-saudi-green-500"
              >
                <option value="all">جميع الحالات</option>
                <option value="online">متصل</option>
                <option value="offline">غير متصل</option>
                <option value="error">خطأ</option>
              </select>
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nazra-text-muted pointer-events-none" />
            </div>

            {/* تحديث */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 text-nazra-text-muted hover:text-nazra-text hover:bg-nazra-lightest rounded-lg transition-colors border border-nazra-border"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center gap-3">
            {selectedCameras.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                حذف ({selectedCameras.length})
              </button>
            )}

            <button className="flex items-center gap-2 px-4 py-2.5 border border-nazra-border text-nazra-text rounded-lg hover:bg-nazra-lightest transition-colors">
              <Download className="w-4 h-4" />
              تصدير
            </button>

            <button className="flex items-center gap-2 px-4 py-2.5 border border-nazra-border text-nazra-text rounded-lg hover:bg-nazra-lightest transition-colors">
              <Upload className="w-4 h-4" />
              استيراد
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة كاميرا
            </button>
          </div>
        </div>
      </div>

      {/* جدول الكاميرات */}
      <div className="bg-white rounded-xl border border-nazra-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-nazra-lightest border-b border-nazra-border">
                <th className="p-4 text-right">
                  <input
                    type="checkbox"
                    checked={selectedCameras.length === filteredCameras.length && filteredCameras.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-nazra-border text-saudi-green-500 focus:ring-saudi-green-500"
                  />
                </th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">الكاميرا</th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">الموقع</th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">رابط RTSP</th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">الحالة</th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">الدقة</th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">التسجيل</th>
                <th className="p-4 text-right text-sm font-semibold text-nazra-text">الكشف</th>
                <th className="p-4 text-center text-sm font-semibold text-nazra-text">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredCameras.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <VideoOff className="w-12 h-12 text-nazra-text-muted mx-auto mb-4" />
                    <p className="text-nazra-text-muted">لا توجد كاميرات مطابقة للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredCameras.map((camera) => (
                  <tr 
                    key={camera.id} 
                    className="border-b border-nazra-border hover:bg-nazra-lightest/50 transition-colors"
                  >
                    {/* checkbox */}
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedCameras.includes(camera.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCameras(prev => [...prev, camera.id]);
                          } else {
                            setSelectedCameras(prev => prev.filter(id => id !== camera.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-nazra-border text-saudi-green-500 focus:ring-saudi-green-500"
                      />
                    </td>

                    {/* اسم الكاميرا */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          camera.status === 'online' ? 'bg-green-100' : 
                          camera.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          <Video className={`w-5 h-5 ${
                            camera.status === 'online' ? 'text-green-600' : 
                            camera.status === 'error' ? 'text-red-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-nazra-text">{camera.name}</p>
                          <p className="text-xs text-nazra-text-muted">ID: {camera.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* الموقع */}
                    <td className="p-4">
                      <span className="text-nazra-text">{camera.location}</span>
                    </td>

                    {/* رابط RTSP */}
                    <td className="p-4">
                      <code className="text-xs bg-nazra-lightest px-2 py-1 rounded text-nazra-text-muted">
                        {camera.rtspUrl.length > 30 ? camera.rtspUrl.substring(0, 30) + '...' : camera.rtspUrl}
                      </code>
                    </td>

                    {/* الحالة */}
                    <td className="p-4">
                      <StatusBadge status={camera.status} />
                    </td>

                    {/* الدقة */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Signal className="w-4 h-4 text-nazra-text-muted" />
                        <span className="text-nazra-text">{camera.resolution}</span>
                        <span className="text-xs text-nazra-text-muted">@{camera.fps}fps</span>
                      </div>
                    </td>

                    {/* التسجيل */}
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleRecording(camera.id)}
                        disabled={camera.status !== 'online'}
                        className={`
                          relative w-12 h-6 rounded-full transition-colors
                          ${camera.isRecording ? 'bg-red-500' : 'bg-gray-300'}
                          ${camera.status !== 'online' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <span className={`
                          absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                          ${camera.isRecording ? 'right-1' : 'left-1'}
                        `} />
                      </button>
                    </td>

                    {/* الكشف */}
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleDetection(camera.id)}
                        disabled={camera.status !== 'online'}
                        className={`
                          relative w-12 h-6 rounded-full transition-colors
                          ${camera.detectionEnabled ? 'bg-saudi-green-500' : 'bg-gray-300'}
                          ${camera.status !== 'online' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <span className={`
                          absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                          ${camera.detectionEnabled ? 'right-1' : 'left-1'}
                        `} />
                      </button>
                    </td>

                    {/* الإجراءات */}
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* مشاهدة */}
                        <button
                          onClick={() => navigate(`/cameras/${camera.id}`)}
                          className="p-2 text-nazra-text-muted hover:text-saudi-green-500 hover:bg-saudi-green-50 rounded-lg transition-colors"
                          title="مشاهدة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* اختبار الاتصال */}
                        <button
                          onClick={() => handleTestConnection(camera.id)}
                          disabled={testingConnection === camera.id}
                          className="p-2 text-nazra-text-muted hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="اختبار الاتصال"
                        >
                          {testingConnection === camera.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>

                        {/* تعديل */}
                        <button
                          onClick={() => setEditingCamera(camera)}
                          className="p-2 text-nazra-text-muted hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* حذف */}
                        <button
                          onClick={() => handleDeleteCamera(camera.id)}
                          className="p-2 text-nazra-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* المزيد */}
                        <div className="relative">
                          <button
                            onClick={() => setShowActionsMenu(showActionsMenu === camera.id ? null : camera.id)}
                            className="p-2 text-nazra-text-muted hover:text-nazra-text hover:bg-nazra-lightest rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {showActionsMenu === camera.id && (
                            <div className="absolute left-0 mt-2 w-48 bg-white border border-nazra-border rounded-lg shadow-lg z-50">
                              <button 
                                onClick={() => {
                                  navigate(`/cameras/${camera.id}/settings`);
                                  setShowActionsMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-right text-nazra-text hover:bg-nazra-lightest"
                              >
                                <Settings className="w-4 h-4" />
                                إعدادات متقدمة
                              </button>
                              <button 
                                onClick={() => {
                                  // تصدير سجلات الكاميرا
                                  setShowActionsMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-right text-nazra-text hover:bg-nazra-lightest"
                              >
                                <Download className="w-4 h-4" />
                                تصدير السجلات
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* شريط الترقيم */}
        <div className="flex items-center justify-between p-4 border-t border-nazra-border bg-nazra-lightest">
          <p className="text-sm text-nazra-text-muted">
            عرض {filteredCameras.length} من {cameras.length} كاميرا
          </p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm border border-nazra-border rounded-lg hover:bg-white transition-colors">
              السابق
            </button>
            <button className="px-3 py-1.5 text-sm bg-saudi-green-500 text-white rounded-lg">1</button>
            <button className="px-3 py-1.5 text-sm border border-nazra-border rounded-lg hover:bg-white transition-colors">
              التالي
            </button>
          </div>
        </div>
      </div>

      {/* Modal إضافة/تعديل كاميرا */}
      {(showAddModal || editingCamera) && (
        <AddCameraModal
          camera={editingCamera || undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingCamera(null);
          }}
          onSave={editingCamera ? handleEditCamera : handleAddCamera}
        />
      )}
    </div>
  );
}

export default CameraManagement;
