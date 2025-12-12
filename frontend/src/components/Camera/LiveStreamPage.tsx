import { useState, useEffect } from 'react';
import { 
  Video, 
  VideoOff, 
  Maximize2,
  Grid,
  LayoutGrid,
  Square,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { cameraService } from '../../services/api';
import type { Camera } from '../../types';
import { StreamWithDetection } from './StreamWithDetection';

// أنماط عرض الشبكة
type GridLayout = '1x1' | '2x2' | '3x3' | '4x4';

const gridLayouts: { value: GridLayout; label: string; cols: number }[] = [
  { value: '1x1', label: 'كاميرا واحدة', cols: 1 },
  { value: '2x2', label: '4 كاميرات', cols: 2 },
  { value: '3x3', label: '9 كاميرات', cols: 3 },
  { value: '4x4', label: '16 كاميرا', cols: 4 },
];

function LiveStreamPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridLayout, setGridLayout] = useState<GridLayout>('2x2');
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // جلب الكاميرات
  const fetchCameras = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await cameraService.getAll();
      
      // إضافة كاميرات المحاكاة (Simulation Cameras)
      const nowIso = new Date().toISOString();
      const simulationCameras: Camera[] = [
        {
        id: 'simulation',
        name: '🔫 محاكاة مسدس',
        location: 'فيديو تجريبي - مسدس',
        status: 'online',
        isRecording: false,
        detectionEnabled: true,
        sensitivity: 75,
        resolution: '720p',
        fps: 24,
        rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=pistol_video_simulation.mp4',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: 'simulation-knife',
          name: '🔪 محاكاة سكين',
          location: 'knife_video_simulation.mp4',
          status: 'online',
          isRecording: false,
          detectionEnabled: true,
          sensitivity: 75,
          resolution: '720p',
          fps: 24,
          rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=knife_video_simulation.mp4',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ];
      
      setCameras([...simulationCameras, ...data]);
    } catch (err) {
      console.error('خطأ في جلب الكاميرات:', err);
      // حتى في حالة الخطأ، أضف كاميرات المحاكاة
      const nowIso = new Date().toISOString();
      const simulationCameras: Camera[] = [
        {
        id: 'simulation',
        name: '🔫 محاكاة مسدس',
        location: 'فيديو تجريبي - مسدس',
        status: 'online',
        isRecording: false,
        detectionEnabled: true,
        sensitivity: 75,
        resolution: '720p',
        fps: 24,
        rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=pistol_video_simulation.mp4',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: 'simulation-knife',
          name: '🔪 محاكاة سكين',
          location: 'knife_video_simulation.mp4',
          status: 'online',
          isRecording: false,
          detectionEnabled: true,
          sensitivity: 75,
          resolution: '720p',
          fps: 24,
          rtspUrl: 'http://localhost:8000/api/v1/stream/simulation/stream?video=knife_video_simulation.mp4',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ];
      setCameras(simulationCameras);
      setError(null); // لا تُظهر الخطأ لأن المحاكاة متاحة
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchCameras, 30000);
    return () => clearInterval(interval);
  }, []);

  // الحصول على عدد الأعمدة
  const getGridCols = () => {
    const layout = gridLayouts.find(l => l.value === gridLayout);
    return layout?.cols || 2;
  };

  // الكاميرات المتصلة
  const onlineCameras = cameras.filter(c => c.status === 'online');
  const offlineCameras = cameras.filter(c => c.status !== 'online');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-nazra-text-muted">جاري تحميل الكاميرات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <VideoOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-nazra-text mb-4">{error}</p>
          <button
            onClick={fetchCameras}
            className="px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* العنوان وأدوات التحكم */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nazra-text">البث المباشر</h1>
          <p className="text-nazra-text-muted mt-1">
            <span className="text-saudi-green-500 font-semibold">{onlineCameras.length}</span> متصلة • 
            <span className="text-red-500 font-semibold mr-1">{offlineCameras.length}</span> غير متصلة
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* اختيار نمط الشبكة */}
          <div className="flex items-center gap-1 bg-nazra-lightest rounded-lg p-1">
            {gridLayouts.map((layout) => (
              <button
                key={layout.value}
                onClick={() => setGridLayout(layout.value)}
                className={`p-2 rounded-md transition-colors ${
                  gridLayout === layout.value
                    ? 'bg-saudi-green-500 text-white'
                    : 'text-nazra-text-muted hover:text-nazra-text hover:bg-white'
                }`}
                title={layout.label}
              >
                {layout.value === '1x1' && <Square className="w-4 h-4" />}
                {layout.value === '2x2' && <Grid className="w-4 h-4" />}
                {layout.value === '3x3' && <LayoutGrid className="w-4 h-4" />}
                {layout.value === '4x4' && <LayoutGrid className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {/* زر التحديث */}
          <button
            onClick={fetchCameras}
            className="p-2 text-nazra-text-muted hover:text-saudi-green-500 hover:bg-saudi-green-50 rounded-lg transition-colors"
            title="تحديث"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* شبكة الكاميرات */}
      {cameras.length === 0 ? (
        <div className="card">
          <div className="text-center py-16">
            <Video className="w-16 h-16 text-nazra-text-light mx-auto mb-4" />
            <p className="text-nazra-text-muted text-lg">لا توجد كاميرات</p>
            <p className="text-nazra-text-light text-sm mt-1">قم بإضافة كاميرات من صفحة إدارة الكاميرات</p>
          </div>
        </div>
      ) : (
        <div 
          className={`grid gap-4`}
          style={{ 
            gridTemplateColumns: `repeat(${getGridCols()}, minmax(0, 1fr))` 
          }}
        >
          {cameras.slice(0, getGridCols() * getGridCols()).map((camera) => (
            <CameraStreamCard
              key={camera.id}
              camera={camera}
              onFullscreen={() => {
                setSelectedCamera(camera.id);
                setIsFullscreen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* عرض ملء الشاشة */}
      {isFullscreen && selectedCamera && (
        <FullscreenView
          camera={cameras.find(c => c.id === selectedCamera)!}
          onClose={() => {
            setIsFullscreen(false);
            setSelectedCamera(null);
          }}
        />
      )}
    </div>
  );
}

// مكون بطاقة البث
interface CameraStreamCardProps {
  camera: Camera;
  onFullscreen: () => void;
}

function CameraStreamCard({ camera, onFullscreen }: CameraStreamCardProps) {
  const isOnline = camera.status === 'online';
  const [hasError, setHasError] = useState(false);
  
  // استخدام رابط الكاميرا مباشرة إذا كان HTTP (أسرع)
  const rtspUrl = (camera as any).rtspUrl || (camera as any).rtsp_url || '';
  const isDirectHttp = rtspUrl.startsWith('http://') || rtspUrl.startsWith('https://');
  const streamUrl = isDirectHttp ? rtspUrl : `http://localhost:8000/api/v1/stream/${camera.id}`;

  return (
    <div className="card p-0 overflow-hidden group">
      {/* منطقة الفيديو */}
      <div className="relative aspect-video bg-gray-900">
        {isOnline && !hasError ? (
          <>
            {/* بث الفيديو مع طبقة الكشف */}
            <StreamWithDetection
              cameraId={camera.id}
              streamUrl={streamUrl}
              className="w-full h-full"
              showDetectionInfo={true}
              onDetection={(detections) => {
                if (detections.length > 0) {
                  console.log(`🚨 تم الكشف عن ${detections.length} تهديد(ات) في ${camera.name}`);
                }
              }}
            />

            {/* مؤشر البث المباشر */}
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-white text-xs font-medium">مباشر</span>
            </div>

            {/* أزرار التحكم */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2">
                <button className="p-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-black/70 transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={onFullscreen}
                className="p-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-black/70 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <VideoOff className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {hasError ? 'فشل الاتصال بالكاميرا' : 'الكاميرا غير متصلة'}
              </p>
              {hasError && (
                <button
                  onClick={() => {
                    setHasError(false);
                  }}
                  className="mt-2 px-3 py-1 bg-saudi-green-500/20 text-saudi-green-400 rounded text-xs hover:bg-saudi-green-500/30"
                >
                  إعادة المحاولة
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* معلومات الكاميرا */}
      <div className="p-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-saudi-green-500' : 'bg-red-500'}`}></span>
            <span className="font-medium text-nazra-text text-sm">{camera.name}</span>
          </div>
          <Video className={`w-4 h-4 ${isOnline ? 'text-saudi-green-500' : 'text-gray-400'}`} />
        </div>
        <p className="text-xs text-nazra-text-muted mt-1 truncate">{camera.location}</p>
      </div>
    </div>
  );
}

// مكون العرض بملء الشاشة
interface FullscreenViewProps {
  camera: Camera;
  onClose: () => void;
}

function FullscreenView({ camera, onClose }: FullscreenViewProps) {
  // استخدام رابط الكاميرا مباشرة إذا كان HTTP
  const rtspUrl = (camera as any).rtspUrl || (camera as any).rtsp_url || '';
  const isDirectHttp = rtspUrl.startsWith('http://') || rtspUrl.startsWith('https://');
  const streamUrl = isDirectHttp ? rtspUrl : `http://localhost:8000/api/v1/stream/${camera.id}`;
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* شريط علوي */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-white font-medium">{camera.name}</span>
            <span className="text-white/60 text-sm">• {camera.location}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* منطقة الفيديو مع الكشف */}
      <div className="absolute inset-0 flex items-center justify-center pt-16">
        <StreamWithDetection
          cameraId={camera.id}
          streamUrl={streamUrl}
          className="max-w-full max-h-full object-contain"
          showDetectionInfo={true}
        />
      </div>
    </div>
  );
}

export default LiveStreamPage;
