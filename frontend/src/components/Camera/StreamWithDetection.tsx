import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * مكون بث الفيديو مع كشف الأسلحة
 * ================================
 * أفضل الممارسات العالمية:
 * 1. WebSocket Push للكشف الفوري
 * 2. Canvas Overlay للرسم
 * 3. Smooth animations
 * 4. Reconnection logic
 */

interface Detection {
  class_name: string;
  class_name_ar?: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  detection_type?: string;
  severity?: string;
}

interface DetectionMessage {
  type: string;
  camera_id: string;
  timestamp: string;
  frame_width: number;
  frame_height: number;
  processing_time_ms: number;
  detections: Detection[];
}

interface StreamWithDetectionProps {
  cameraId: string;
  streamUrl: string;
  className?: string;
  showDetectionInfo?: boolean;
  onDetection?: (detections: Detection[]) => void;
}

// ألوان الكشف حسب الفئة
const CLASS_COLORS: Record<string, string> = {
  'Knife': '#FFA500',
  'knife': '#FFA500',
  'سكين': '#FFA500',
  'Handgun': '#FF0000',
  'handgun': '#FF0000',
  'مسدس': '#FF0000',
  'weapon': '#FF0000',
  'default': '#FF0000'
};

const WS_URL = 'ws://localhost:8000/ws/detection';

export function StreamWithDetection({
  cameraId,
  streamUrl,
  className = '',
  showDetectionInfo = true,
  onDetection
}: StreamWithDetectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [frameSize, setFrameSize] = useState({ width: 1920, height: 1080 });
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [wsDisabled, setWsDisabled] = useState(false); // Circuit breaker
  
  // 🛡️ Simulation streams don't need WebSocket (detection is in the stream)
  const isSimulation = cameraId.startsWith('simulation') || streamUrl.includes('/simulation/stream');
  const MAX_RECONNECT_ATTEMPTS = 5; // Stop after 5 failures
  
  // الرسم مع Animation
  const drawDetectionsAnimated = useCallback((dets: Detection[], frameW: number, frameH: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // مسح Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (dets.length === 0) return;
    
    // حساب النسب
    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const scaleX = displayWidth / frameW;
    const scaleY = displayHeight / frameH;
    
    // رسم كل كشف مع تأثيرات
    dets.forEach((det) => {
      const x = det.x1 * scaleX;
      const y = det.y1 * scaleY;
      const w = det.width * scaleX;
      const h = det.height * scaleY;
      
      const color = CLASS_COLORS[det.class_name] || CLASS_COLORS.default;
      
      // تأثير Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      
      // رسم المربع الخارجي
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      
      // رسم الزوايا المميزة
      ctx.shadowBlur = 0;
      ctx.lineWidth = 4;
      const cornerLen = Math.min(25, w / 4, h / 4);
      
      // الزوايا الأربع
      const corners = [
        [[x, y + cornerLen], [x, y], [x + cornerLen, y]],
        [[x + w - cornerLen, y], [x + w, y], [x + w, y + cornerLen]],
        [[x, y + h - cornerLen], [x, y + h], [x + cornerLen, y + h]],
        [[x + w - cornerLen, y + h], [x + w, y + h], [x + w, y + h - cornerLen]]
      ];
      
      corners.forEach(corner => {
        ctx.beginPath();
        ctx.moveTo(corner[0][0], corner[0][1]);
        ctx.lineTo(corner[1][0], corner[1][1]);
        ctx.lineTo(corner[2][0], corner[2][1]);
        ctx.stroke();
      });
      
      // رسم Label مع خلفية
      const label = det.class_name_ar || det.class_name;
      const confidence = Math.round(det.confidence * 100);
      const text = `${label}: ${confidence}%`;
      
      ctx.font = 'bold 14px Arial';
      const textMetrics = ctx.measureText(text);
      const textHeight = 20;
      const padding = 6;
      
      // خلفية Label
      ctx.fillStyle = color;
      ctx.fillRect(x, y - textHeight - padding, textMetrics.width + padding * 2, textHeight + padding);
      
      // نص Label
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, x + padding, y - padding - 2);
      
      // مؤشر Severity
      if (det.severity === 'critical') {
        // رسم دائرة تحذير
        ctx.beginPath();
        ctx.arc(x + w - 10, y + 10, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FF0000';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('!', x + w - 13, y + 14);
      }
    });
  }, []);
  
  // تحديث حجم Canvas
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    
    // إعادة رسم الكشوفات
    if (detections.length > 0) {
      drawDetectionsAnimated(detections, frameSize.width, frameSize.height);
    }
  }, [detections, frameSize, drawDetectionsAnimated]);
  
  // الاتصال بـ WebSocket
  const connectWebSocket = useCallback(() => {
    // 🛡️ تخطي WebSocket لكاميرا المحاكاة (الكشف مدمج في البث)
    if (isSimulation) {
      console.log(`⏭️ Skipping WebSocket for simulation camera (detection is in stream)`);
      return;
    }
    
    // 🛡️ Circuit breaker - توقف بعد عدة محاولات فاشلة
    if (wsDisabled || connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`🛑 WebSocket disabled for ${cameraId} after ${connectionAttempts} attempts`);
      setWsDisabled(true);
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = `${WS_URL}/${cameraId}`;
    console.log(`🔗 Connecting to WebSocket: ${wsUrl} (attempt ${connectionAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`✅ WebSocket connected: ${cameraId}`);
      setIsConnected(true);
      setConnectionAttempts(0);
    };
    
    ws.onmessage = (event) => {
      try {
        const data: DetectionMessage = JSON.parse(event.data);
        
        if (data.type === 'detection') {
          // تحديث الكشوفات
          setDetections(data.detections);
          setFrameSize({ width: data.frame_width, height: data.frame_height });
          setProcessingTime(data.processing_time_ms);
          
          // رسم باستخدام requestAnimationFrame للسلاسة
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          animationFrameRef.current = requestAnimationFrame(() => {
            drawDetectionsAnimated(data.detections, data.frame_width, data.frame_height);
          });
          
          // Callback
          if (onDetection && data.detections.length > 0) {
            onDetection(data.detections);
          }
        } else if (data.type === 'ping') {
          // الرد على ping
          ws.send(JSON.stringify({ action: 'pong' }));
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };
    
    ws.onclose = () => {
      console.log(`🔌 WebSocket disconnected: ${cameraId}`);
      setIsConnected(false);
      
      // 🛡️ توقف إذا تجاوزنا الحد الأقصى
      if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS - 1) {
        console.log(`🛑 Max reconnection attempts reached for ${cameraId}`);
        setWsDisabled(true);
        return;
      }
      
      // إعادة الاتصال بتأخير متزايد
      const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
      setConnectionAttempts(prev => prev + 1);
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, delay);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = ws;
  }, [cameraId, connectionAttempts, drawDetectionsAnimated, onDetection, isSimulation, wsDisabled]);
  
  // بدء الاتصال
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);
  
  // تحديث Canvas عند تغيير الحجم
  useEffect(() => {
    const handleResize = () => updateCanvasSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateCanvasSize]);
  
  // بناء URL للـ MJPEG stream
  // إذا كان simulation أو يحتوي على /stream أو /video، استخدم الرابط كما هو
  const mjpegUrl = (cameraId.startsWith('simulation') || streamUrl.includes('/simulation/stream') || streamUrl.includes('/stream') || streamUrl.includes('/video'))
    ? streamUrl  // استخدم الرابط المُمرر مباشرة
    : `/api/v1/stream/${cameraId}`; // Backend MJPEG proxy
  
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* صورة البث - MJPEG stream مباشر */}
      <img
        ref={imgRef}
        src={mjpegUrl}
        alt="بث مباشر"
        className="w-full h-full object-cover"
        onLoad={updateCanvasSize}
      />
      
      {/* Canvas للكشوفات */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ zIndex: 10 }}
      />
      
      {/* معلومات الكشف */}
      {showDetectionInfo && (
        <div className="absolute bottom-2 left-2 flex items-center gap-2" style={{ zIndex: 20 }}>
          {/* حالة الاتصال */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-500/80' : 'bg-yellow-500/80'
          } text-white backdrop-blur-sm`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-white/50'}`} />
            {isConnected ? 'AI مفعّل' : 'جاري الاتصال...'}
          </div>
          
          {/* وقت المعالجة */}
          {processingTime > 0 && (
            <div className="px-2 py-1 rounded-full text-xs font-medium bg-gray-700/80 text-white backdrop-blur-sm">
              {processingTime.toFixed(0)}ms
            </div>
          )}
          
          {/* تنبيه الكشف */}
          {detections.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/90 text-white backdrop-blur-sm animate-pulse">
              ⚠️ {detections.length} تهديد
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StreamWithDetection;
