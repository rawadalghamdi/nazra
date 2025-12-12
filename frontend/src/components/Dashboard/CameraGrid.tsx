import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Maximize2,
  Settings,
  AlertTriangle,
  MoreVertical,
  Signal,
  SignalZero,
  Circle,
  Grid3X3,
  LayoutGrid,
  Grid2X2,
  Search,
  Filter,
  RefreshCw,
  X,
  Rows,
} from 'lucide-react';
import type { CameraCardData, GridLayout } from '../../types';
import { cameraService } from '../../services/api';
import { StreamWithDetection } from '../Camera/StreamWithDetection';

// ═══════════════════════════════════════════════════════════════════════════
// واجهات المكون
// ═══════════════════════════════════════════════════════════════════════════
interface CameraGridProps {
  cameras?: CameraCardData[];
  layout?: GridLayout;
  onCameraClick?: (cameraId: string) => void;
  onLayoutChange?: (layout: GridLayout) => void;
  onCameraSettings?: (cameraId: string) => void;
  showSearch?: boolean;
  showFilters?: boolean;
}

interface CameraCardProps {
  camera: CameraCardData;
  onClick?: () => void;
  onSettings?: () => void;
}

interface FilterOptions {
  status: 'all' | 'online' | 'offline';
  hasAlert: 'all' | 'yes' | 'no';
}

// خيارات التخطيط
const layoutOptions: { value: GridLayout; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: '2x2', label: '2×2', icon: Grid2X2 },
  { value: '2x3', label: '2×3', icon: LayoutGrid },
  { value: '3x3', label: '3×3', icon: Grid3X3 },
  { value: '4x4', label: '4×4', icon: Rows },
];

function CameraGrid({ 
  cameras: propCameras, 
  layout = '2x3',
  onCameraClick,
  onLayoutChange,
  onCameraSettings,
  showSearch = true,
  showFilters = true,
}: CameraGridProps) {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<CameraCardData[]>(propCameras || []);
  const [currentLayout, setCurrentLayout] = useState<GridLayout>(layout);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    hasAlert: 'all',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(!propCameras);

  // جلب الكاميرات من API إذا لم يتم تمريرها كـ props
  useEffect(() => {
    if (!propCameras) {
      fetchCameras();
    }
  }, [propCameras]);

  // تحديث الكاميرات عند تغيير propCameras
  useEffect(() => {
    if (propCameras) {
      setCameras(propCameras);
    }
  }, [propCameras]);

  const fetchCameras = async () => {
    setIsLoading(true);
    try {
      const data = await cameraService.getAll();
      // تحويل البيانات لتتوافق مع CameraCardData
      const cameraCardData: CameraCardData[] = data.map(cam => ({
        id: cam.id,
        name: cam.name,
        location: cam.location,
        status: cam.status as 'online' | 'offline',
        isRecording: cam.isRecording,
        resolution: cam.resolution,
        rtspUrl: cam.rtspUrl,
        hasAlert: false, // سيتم تحديثها من التنبيهات
        alertCount: 0,
      }));
      
      // إضافة كاميرات المحاكاة (Simulation Cameras)
      const simulationCameras: CameraCardData[] = [
        {
        id: 'simulation',
        name: '🔫 محاكاة مسدس',
        location: 'فيديو تجريبي - مسدس',
        status: 'online',
        isRecording: false,
        resolution: '720p',
        rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=pistol_video_simulation.mp4',
          hasAlert: false,
          alertCount: 0,
        },
        {
          id: 'simulation-knife',
          name: '🔪 محاكاة سكين',
          location: 'knife_video_simulation.mp4',
          status: 'online',
          isRecording: false,
          resolution: '720p',
          rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=knife_video_simulation.mp4',
          hasAlert: false,
          alertCount: 0,
        },
      ];
      
      setCameras([...simulationCameras, ...cameraCardData]);
    } catch (error) {
      console.error('خطأ في جلب الكاميرات:', error);
      // حتى في حالة الخطأ، أضف كاميرات المحاكاة
      const simulationCameras: CameraCardData[] = [
        {
        id: 'simulation',
        name: '🔫 محاكاة مسدس',
        location: 'فيديو تجريبي - مسدس',
        status: 'online',
        isRecording: false,
        resolution: '720p',
        rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=pistol_video_simulation.mp4',
          hasAlert: false,
          alertCount: 0,
        },
        {
          id: 'simulation-knife',
          name: '🔪 محاكاة سكين',
          location: 'knife_video_simulation.mp4',
          status: 'online',
          isRecording: false,
          resolution: '720p',
          rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=knife_video_simulation.mp4',
          hasAlert: false,
          alertCount: 0,
        },
      ];
      setCameras(simulationCameras);
    } finally {
      setIsLoading(false);
    }
  };

  // تصفية الكاميرات
  const filteredCameras = useMemo(() => {
    return cameras.filter(camera => {
      const matchesSearch = searchQuery === '' || 
        camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        camera.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filters.status === 'all' || camera.status === filters.status;
      const matchesAlert = filters.hasAlert === 'all' || 
        (filters.hasAlert === 'yes' && camera.hasAlert) ||
        (filters.hasAlert === 'no' && !camera.hasAlert);
      return matchesSearch && matchesStatus && matchesAlert;
    });
  }, [cameras, searchQuery, filters]);

  // تغيير التخطيط
  const handleLayoutChange = (newLayout: GridLayout) => {
    setCurrentLayout(newLayout);
    onLayoutChange?.(newLayout);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCameras();
    setIsRefreshing(false);
  };

  const handleCameraClick = (cameraId: string) => {
    // كاميرا المحاكاة لا تحتاج للتنقل - فقط عرض في الشبكة
    if (cameraId.startsWith('simulation')) {
      return;
    }
    if (onCameraClick) {
      onCameraClick(cameraId);
    } else {
      navigate(`/cameras/${cameraId}`);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilters({ status: 'all', hasAlert: 'all' });
  };

  // تحديد عدد الكاميرات حسب التخطيط
  const getVisibleCameras = () => {
    const counts: Record<GridLayout, number> = {
      '2x2': 4,
      '2x3': 6,
      '3x3': 9,
      '4x4': 16,
    };
    return filteredCameras.slice(0, counts[currentLayout]);
  };

  // تحديد أعمدة الشبكة
  const getGridClass = () => {
    const classes: Record<GridLayout, string> = {
      '2x2': 'grid-cols-2',
      '2x3': 'grid-cols-3',
      '3x3': 'grid-cols-3',
      '4x4': 'grid-cols-4',
    };
    return classes[currentLayout];
  };

  const visibleCameras = getVisibleCameras();
  const onlineCameras = cameras.filter(c => c.status === 'online').length;
  const alertCameras = cameras.filter(c => c.hasAlert).length;
  const hasActiveFilters = searchQuery !== '' || filters.status !== 'all' || filters.hasAlert !== 'all';

  // عرض حالة التحميل
  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-nazra-text-muted">جاري تحميل الكاميرات...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* شريط العنوان */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-saudi-green-50 rounded-xl">
            <Video className="w-5 h-5 text-saudi-green-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-nazra-text">البث المباشر</h2>
            <div className="flex items-center gap-3 text-sm text-nazra-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {onlineCameras} متصلة
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                {cameras.length - onlineCameras} غير متصلة
              </span>
              {alertCameras > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-orange-500">
                    <AlertTriangle className="w-3 h-3" />
                    {alertCameras} تنبيهات
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* أدوات التحكم */}
        <div className="flex items-center gap-3 w-full lg:w-auto">
          {/* البحث */}
          {showSearch && (
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nazra-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن كاميرا..."
                className="w-full pl-3 pr-10 py-2 bg-nazra-lightest border border-nazra-border rounded-lg text-nazra-text placeholder:text-nazra-text-muted focus:outline-none focus:ring-2 focus:ring-saudi-green-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-nazra-text-muted hover:text-nazra-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* الفلاتر */}
          {showFilters && (
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`
                  p-2 rounded-lg border transition-colors
                  ${showFilterMenu || hasActiveFilters
                    ? 'bg-saudi-green-50 border-saudi-green-500 text-saudi-green-500'
                    : 'bg-nazra-lightest border-nazra-border text-nazra-text-muted hover:text-nazra-text'
                  }
                `}
              >
                <Filter className="w-4 h-4" />
              </button>

              {showFilterMenu && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-nazra-border rounded-xl shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-nazra-text">الفلاتر</h4>
                    {hasActiveFilters && (
                      <button onClick={resetFilters} className="text-xs text-saudi-green-500 hover:underline">
                        إعادة ضبط
                      </button>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="text-sm text-nazra-text-muted mb-2 block">الحالة</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterOptions['status'] }))}
                      className="w-full px-3 py-2 bg-nazra-lightest border border-nazra-border rounded-lg text-sm"
                    >
                      <option value="all">الكل</option>
                      <option value="online">متصل</option>
                      <option value="offline">غير متصل</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-nazra-text-muted mb-2 block">التنبيهات</label>
                    <select
                      value={filters.hasAlert}
                      onChange={(e) => setFilters(prev => ({ ...prev, hasAlert: e.target.value as FilterOptions['hasAlert'] }))}
                      className="w-full px-3 py-2 bg-nazra-lightest border border-nazra-border rounded-lg text-sm"
                    >
                      <option value="all">الكل</option>
                      <option value="yes">بها تنبيهات</option>
                      <option value="no">بدون تنبيهات</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setShowFilterMenu(false)}
                    className="w-full mt-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600 transition-colors"
                  >
                    تطبيق
                  </button>
                </div>
              )}
            </div>
          )}

          {/* تحديث */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-nazra-text-muted hover:text-nazra-text hover:bg-nazra-lightest rounded-lg transition-colors border border-nazra-border"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

        {/* أزرار التخطيط */}
          <div className="flex items-center bg-nazra-lightest rounded-lg p-1 border border-nazra-border">
            {layoutOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => handleLayoutChange(option.value)}
                  className={`
                    p-2 rounded-lg transition-all duration-200
                    ${currentLayout === option.value 
                      ? 'bg-saudi-green-500 text-white' 
                      : 'text-nazra-text-muted hover:text-nazra-text hover:bg-nazra-lighter'
                    }
                  `}
                  title={option.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
          
          <button className="p-2 text-nazra-text-muted hover:text-nazra-text hover:bg-nazra-lightest rounded-lg transition-colors border border-nazra-border">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* رسالة عدم وجود نتائج */}
      {filteredCameras.length === 0 && (
        <div className="text-center py-12">
          <VideoOff className="w-12 h-12 text-nazra-text-muted mx-auto mb-4" />
          <p className="text-nazra-text-muted">لم يتم العثور على كاميرات</p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-4 text-saudi-green-500 hover:underline">
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      )}

      {/* شبكة الكاميرات */}
      {filteredCameras.length > 0 && (
        <div className={`grid ${getGridClass()} gap-4`}>
          {visibleCameras.map((camera) => (
            <CameraCard 
              key={camera.id} 
              camera={camera} 
              onClick={() => handleCameraClick(camera.id)}
              onSettings={() => onCameraSettings?.(camera.id)}
            />
          ))}
        </div>
      )}

      {/* رسالة المزيد من الكاميرات */}
      {filteredCameras.length > visibleCameras.length && (
        <div className="text-center mt-4 pt-4 border-t border-nazra-border">
          <p className="text-sm text-nazra-text-muted">
            عرض {visibleCameras.length} من {filteredCameras.length} كاميرا
          </p>
          <button
            onClick={() => navigate('/cameras')}
            className="mt-2 text-saudi-green-500 hover:underline text-sm"
          >
            عرض جميع الكاميرات
          </button>
        </div>
      )}
    </div>
  );
}

// مكون بطاقة الكاميرا
function CameraCard({ camera, onClick, onSettings }: CameraCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isOnline = camera.status === 'online';
  
  // استخدام رابط الكاميرا مباشرة إذا كان HTTP (أسرع)
  const rtspUrl = camera.rtspUrl || '';
  const isDirectHttp = rtspUrl.startsWith('http://') || rtspUrl.startsWith('https://');
  
  // للـ IP Webcam: استخدم /video مباشرة للـ MJPEG stream
  // للباقي: استخدم Backend proxy
  const streamUrl = isDirectHttp ? rtspUrl : `http://localhost:8000/api/v1/stream/${camera.id}`;

  return (
    <div
      className={`
        relative rounded-xl overflow-hidden bg-white border transition-all duration-300 cursor-pointer group shadow-sm
        ${isOnline 
          ? 'border-nazra-border hover:border-saudi-green-500' 
          : 'border-red-200 hover:border-alert-critical'
        }
        ${camera.hasAlert ? 'ring-2 ring-alert-orange/50 animate-pulse-alert' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* منطقة الفيديو */}
      <div className="aspect-video relative bg-gray-900">
        {isOnline && !hasError ? (
          <>
            {/* بث الفيديو مع طبقة الكشف */}
            <StreamWithDetection
              cameraId={camera.id}
              streamUrl={streamUrl}
              className="w-full h-full object-cover"
              showDetectionInfo={false}
            />

            {/* مؤشر التسجيل */}
            {camera.isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-alert-critical/90 px-2 py-1 rounded-full">
                <Circle className="w-2 h-2 fill-white text-white animate-pulse" />
                <span className="text-xs text-white font-medium">REC</span>
              </div>
            )}

            {/* تنبيه على الكاميرا */}
            {camera.hasAlert && camera.alertCount && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-alert-orange/90 px-2 py-1 rounded-full animate-pulse">
                <AlertTriangle className="w-3 h-3 text-white" />
                <span className="text-xs text-white font-medium">{camera.alertCount}</span>
              </div>
            )}
          </>
        ) : (
          // حالة غير متصل أو خطأ
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <VideoOff className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {hasError ? 'فشل الاتصال' : 'الكاميرا غير متصلة'}
              </p>
              {hasError && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHasError(false);
                  }}
                  className="mt-2 px-2 py-1 bg-saudi-green-500/20 text-saudi-green-400 rounded text-xs hover:bg-saudi-green-500/30"
                >
                  إعادة المحاولة
                </button>
              )}
            </div>
          </div>
        )}

        {/* تراكب عند التمرير */}
        <div className={`
          absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent
          transition-opacity duration-300
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <Maximize2 className="w-4 h-4 text-white" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onSettings?.(); }}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <Settings className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* شريط المعلومات السفلي */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* مؤشر الحالة */}
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-status-online' : 'bg-status-offline'} ${isOnline ? 'animate-pulse' : ''}`}></div>
              <span className="text-white text-sm font-medium truncate max-w-[120px]">
                {camera.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* جودة الفيديو */}
              {camera.resolution && (
                <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded">
                  {camera.resolution}
                </span>
              )}
              
              {/* مؤشر الإشارة */}
              {isOnline ? (
                <Signal className="w-4 h-4 text-status-online" />
              ) : (
                <SignalZero className="w-4 h-4 text-status-offline" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* معلومات إضافية */}
      <div className="p-3 bg-nazra-lightest border-t border-nazra-border">
        <div className="flex items-center justify-between">
          <p className="text-xs text-nazra-text-muted truncate">{camera.location}</p>
          <button className="p-1 text-nazra-text-light hover:text-nazra-text transition-colors opacity-0 group-hover:opacity-100">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CameraGrid;
