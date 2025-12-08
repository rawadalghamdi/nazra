import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Camera as CameraIcon,
  Download,
  Video,
  VideoOff,
  Settings,
  Volume2,
  VolumeX,
  RefreshCw,
  Circle,
  Signal,
  SignalLow,
  SignalZero,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import type { Camera, Detection } from '../../types';

// ═══════════════════════════════════════════════════════════════════════════
// واجهات المكون
// ═══════════════════════════════════════════════════════════════════════════
interface LiveStreamProps {
  camera: Camera;
  detections?: Detection[];
  showControls?: boolean;
  showOverlay?: boolean;
  onFullscreen?: () => void;
  onSnapshot?: (imageData: string) => void;
  onRecordingToggle?: (isRecording: boolean) => void;
  className?: string;
}

interface StreamStats {
  fps: number;
  bitrate: string;
  latency: number;
  quality: 'جيدة' | 'متوسطة' | 'ضعيفة';
}

// ═══════════════════════════════════════════════════════════════════════════
// ألوان أنواع الكشف
// ═══════════════════════════════════════════════════════════════════════════
const detectionColors: Record<string, string> = {
  weapon: '#DC2626',      // أحمر
  knife: '#F59E0B',       // برتقالي
  suspicious_object: '#8B5CF6', // بنفسجي
};

const detectionLabels: Record<string, string> = {
  weapon: 'سلاح',
  knife: 'سكين',
  suspicious_object: 'جسم مشبوه',
};

// ═══════════════════════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════════════════════
function LiveStream({
  camera,
  detections = [],
  showControls = true,
  showOverlay = true,
  onFullscreen,
  onSnapshot,
  onRecordingToggle,
  className = '',
}: LiveStreamProps) {
  // حالات المكون
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(camera.isRecording);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [streamStats, setStreamStats] = useState<StreamStats>({
    fps: camera.fps || 30,
    bitrate: '2.5 Mbps',
    latency: 45,
    quality: 'جيدة',
  });
  const [connectionRetries, setConnectionRetries] = useState(0);

  // المراجع
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const isOnline = camera.status === 'online';

  // ─────────────────────────────────────────────────────────────────────────────
  // رسم مربعات الكشف
  // ─────────────────────────────────────────────────────────────────────────────
  const drawDetections = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // تحديث أبعاد الكانفاس
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;

    // مسح الكانفاس
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // رسم كل كشف
    detections.forEach((detection) => {
      const { boundingBox, type, confidence } = detection;
      const color = detectionColors[type] || '#DC2626';
      
      // حساب الإحداثيات النسبية
      const x = boundingBox.x * canvas.width;
      const y = boundingBox.y * canvas.height;
      const width = boundingBox.width * canvas.width;
      const height = boundingBox.height * canvas.height;

      // رسم المربع
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // رسم الخلفية للتسمية
      const label = `${detectionLabels[type] || type} ${Math.round(confidence * 100)}%`;
      ctx.font = 'bold 14px Cairo, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const textHeight = 20;
      const padding = 8;

      ctx.fillStyle = color;
      ctx.fillRect(
        x,
        y - textHeight - padding,
        textWidth + padding * 2,
        textHeight + padding
      );

      // رسم التسمية
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, x + padding, y - padding);

      // رسم زوايا مميزة
      const cornerLength = 15;
      ctx.lineWidth = 4;
      
      // الزاوية العلوية اليسرى
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      ctx.stroke();

      // الزاوية العلوية اليمنى
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerLength);
      ctx.stroke();

      // الزاوية السفلية اليسرى
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerLength);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerLength, y + height);
      ctx.stroke();

      // الزاوية السفلية اليمنى
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerLength);
      ctx.stroke();

      // تأثير الوميض للكشف الجديد
      if (Date.now() - detection.timestamp < 3000) {
        ctx.strokeStyle = `${color}66`;
        ctx.lineWidth = 8;
        ctx.strokeRect(x - 4, y - 4, width + 8, height + 8);
      }
    });

    // طلب الإطار التالي
    animationRef.current = requestAnimationFrame(drawDetections);
  }, [detections]);

  // ─────────────────────────────────────────────────────────────────────────────
  // تأثيرات جانبية
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying && detections.length > 0) {
      animationRef.current = requestAnimationFrame(drawDetections);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, detections, drawDetections]);

  // محاكاة إحصائيات البث
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && isPlaying) {
        setStreamStats({
          fps: Math.floor(28 + Math.random() * 4),
          bitrate: `${(2.0 + Math.random() * 1).toFixed(1)} Mbps`,
          latency: Math.floor(30 + Math.random() * 30),
          quality: Math.random() > 0.2 ? 'جيدة' : 'متوسطة',
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOnline, isPlaying]);

  // ─────────────────────────────────────────────────────────────────────────────
  // معالجات الأحداث
  // ─────────────────────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleRecording = () => {
    const newState = !isRecording;
    setIsRecording(newState);
    onRecordingToggle?.(newState);
  };

  const handleSnapshot = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    if (video) {
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        onSnapshot?.(imageData);
        
        // تحميل الصورة
        const link = document.createElement('a');
        link.download = `snapshot_${camera.name}_${new Date().toISOString()}.png`;
        link.href = imageData;
        link.click();
      }
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!isFullscreen) {
        containerRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
      onFullscreen?.();
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 1));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleRetryConnection = () => {
    setConnectionRetries(prev => prev + 1);
    // محاكاة إعادة الاتصال
    setTimeout(() => {
      setConnectionRetries(0);
    }, 2000);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // مؤشر جودة الإشارة
  // ─────────────────────────────────────────────────────────────────────────────
  const SignalIndicator = () => {
    if (!isOnline) return <SignalZero className="w-4 h-4 text-red-500" />;
    if (streamStats.latency > 100) return <SignalLow className="w-4 h-4 text-yellow-500" />;
    return <Signal className="w-4 h-4 text-green-500" />;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // العرض
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div 
      ref={containerRef}
      className={`relative bg-gray-900 rounded-xl overflow-hidden group ${className}`}
    >
      {/* منطقة الفيديو */}
      <div 
        className="relative aspect-video"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
      >
        {isOnline ? (
          <>
            {/* عنصر الفيديو */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay={isPlaying}
              muted={isMuted}
              playsInline
              poster={camera.thumbnail}
            >
              {/* مصدر البث - يمكن استبداله بـ HLS أو WebRTC */}
              <source src={camera.rtspUrl} type="application/x-rtsp" />
            </video>

            {/* كانفاس رسم الكشف */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* محاكاة البث عند عدم توفر الفيديو الحقيقي */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/30 to-transparent pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-400 text-sm">جاري البث المباشر...</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          // حالة عدم الاتصال
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
            <VideoOff className="w-16 h-16 text-gray-500 mb-4" />
            <p className="text-gray-400 text-lg mb-4">الكاميرا غير متصلة</p>
            <button
              onClick={handleRetryConnection}
              disabled={connectionRetries > 0}
              className="flex items-center gap-2 px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${connectionRetries > 0 ? 'animate-spin' : ''}`} />
              {connectionRetries > 0 ? 'جاري إعادة الاتصال...' : 'إعادة الاتصال'}
            </button>
          </div>
        )}
      </div>

      {/* تراكب المعلومات */}
      {showOverlay && isOnline && (
        <>
          {/* الشريط العلوي */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between">
              {/* معلومات الكاميرا */}
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <div>
                  <h3 className="text-white font-semibold">{camera.name}</h3>
                  <p className="text-gray-300 text-sm">{camera.location}</p>
                </div>
              </div>

              {/* إحصائيات البث */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-1.5">
                  <SignalIndicator />
                  <span className="text-white text-sm">{streamStats.fps} FPS</span>
                </div>
                
                <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-1.5">
                  <span className={`text-sm ${
                    streamStats.quality === 'جيدة' ? 'text-green-400' :
                    streamStats.quality === 'متوسطة' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {camera.resolution || '1080p'}
                  </span>
                </div>

                {/* مؤشر التسجيل */}
                {isRecording && (
                  <div className="flex items-center gap-2 bg-red-500/90 rounded-lg px-3 py-1.5">
                    <Circle className="w-3 h-3 fill-white text-white animate-pulse" />
                    <span className="text-white text-sm font-medium">REC</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* تنبيهات الكشف */}
          {detections.length > 0 && (
            <div className="absolute top-20 right-4 bg-red-500/90 rounded-lg px-4 py-2 animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <span className="text-white font-bold">{detections.length} كشف نشط!</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* أزرار التحكم */}
      {showControls && (
        <div className={`
          absolute bottom-0 left-0 right-0 
          bg-gradient-to-t from-black/80 to-transparent 
          p-4 transition-opacity duration-300
          ${isFullscreen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}>
          <div className="flex items-center justify-between">
            {/* أزرار التحكم الرئيسية */}
            <div className="flex items-center gap-2">
              {/* تشغيل/إيقاف */}
              <button
                onClick={handlePlayPause}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white" />
                )}
              </button>

              {/* كتم الصوت */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-white" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>

              {/* فاصل */}
              <div className="w-px h-6 bg-white/30 mx-2" />

              {/* التكبير/التصغير */}
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                title="تصغير"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>

              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>

              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                title="تكبير"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>

              <button
                onClick={handleResetZoom}
                disabled={zoom === 1}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                title="إعادة ضبط التكبير"
              >
                <RotateCcw className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center gap-2">
              {/* لقطة شاشة */}
              <button
                onClick={handleSnapshot}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="لقطة شاشة"
              >
                <CameraIcon className="w-5 h-5 text-white" />
              </button>

              {/* تسجيل */}
              <button
                onClick={handleRecording}
                className={`p-2.5 rounded-lg transition-colors ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-white/20 hover:bg-white/30'
                }`}
                title={isRecording ? 'إيقاف التسجيل' : 'بدء التسجيل'}
              >
                <Video className="w-5 h-5 text-white" />
              </button>

              {/* تحميل */}
              <button
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="تحميل"
              >
                <Download className="w-5 h-5 text-white" />
              </button>

              {/* الإعدادات */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="الإعدادات"
              >
                <Settings className="w-5 h-5 text-white" />
              </button>

              {/* فاصل */}
              <div className="w-px h-6 bg-white/30 mx-2" />

              {/* ملء الشاشة */}
              <button
                onClick={handleFullscreen}
                className="p-2.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isFullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5 text-white" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* شريط إحصائيات إضافي */}
          <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-white/20">
            <div className="text-center">
              <p className="text-gray-400 text-xs">معدل البث</p>
              <p className="text-white text-sm font-medium">{streamStats.bitrate}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">التأخير</p>
              <p className="text-white text-sm font-medium">{streamStats.latency}ms</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-xs">الجودة</p>
              <p className={`text-sm font-medium ${
                streamStats.quality === 'جيدة' ? 'text-green-400' :
                streamStats.quality === 'متوسطة' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {streamStats.quality}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الإعدادات */}
      {showSettings && (
        <div className="absolute bottom-20 left-4 bg-gray-800 rounded-xl p-4 min-w-[250px] shadow-xl">
          <h4 className="text-white font-semibold mb-4">إعدادات البث</h4>
          
          <div className="space-y-4">
            {/* جودة الفيديو */}
            <div>
              <label className="text-gray-300 text-sm mb-2 block">جودة الفيديو</label>
              <select className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm">
                <option value="auto">تلقائي</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </div>

            {/* عرض مربعات الكشف */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">عرض مربعات الكشف</span>
              <button className="w-10 h-5 bg-saudi-green-500 rounded-full relative">
                <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>

            {/* التسجيل التلقائي */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">تسجيل عند الكشف</span>
              <button className="w-10 h-5 bg-gray-600 rounded-full relative">
                <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full mt-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            إغلاق
          </button>
        </div>
      )}
    </div>
  );
}

export default LiveStream;
