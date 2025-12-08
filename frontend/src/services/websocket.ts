/**
 * ═══════════════════════════════════════════════════════════════════════════
 * نظرة - خدمة WebSocket المتقدمة
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ميزات:
 * - إعادة الاتصال التلقائي عند الانقطاع
 * - Queue للرسائل أثناء الانقطاع
 * - Heartbeat للتحقق من الاتصال
 * - معالجة الأخطاء
 */

import type { Alert, VideoFrame } from '../types';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

// أنواع الرسائل
export type WebSocketMessageType = 
  | 'new_alert' 
  | 'status_update' 
  | 'frame' 
  | 'detection'
  | 'connected'
  | 'subscribed'
  | 'unsubscribed'
  | 'ping'
  | 'pong'
  | 'error'
  | 'camera_status';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  data?: T;
  timestamp?: string;
  message?: string;
  camera_id?: string;
  channel?: string;
}

export interface SystemStatus {
  cameras_online: number;
  alerts_today: number;
  system_status: string;
}

// Handlers
type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void;
type AlertHandler = (alert: Alert) => void;
type StatusHandler = (status: SystemStatus) => void;
type DetectionHandler = (frame: VideoFrame) => void;
type ConnectionHandler = (connected: boolean) => void;

// ثوابت التكوين
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // تأخيرات متصاعدة
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 25000; // 25 ثانية
const MESSAGE_QUEUE_MAX_SIZE = 50;

/**
 * خدمة WebSocket المتقدمة لنظام نظرة
 */
class WebSocketService {
  private alertsSocket: WebSocket | null = null;
  private streamSockets: Map<string, WebSocket> = new Map();
  
  // Handlers
  private messageHandlers: MessageHandler[] = [];
  private alertHandlers: AlertHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private detectionHandlers: Map<string, DetectionHandler> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  
  // حالة الاتصال
  private _isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPong: number = Date.now();
  
  // طابور الرسائل
  private messageQueue: Array<{ action: string; data?: Record<string, unknown> }> = [];
  
  // معرف العميل للاستمرارية
  private clientId: string;
  
  constructor() {
    // إنشاء أو استرداد معرف العميل
    this.clientId = this.getOrCreateClientId();
  }
  
  private getOrCreateClientId(): string {
    let clientId = localStorage.getItem('nazra_client_id');
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('nazra_client_id', clientId);
    }
    return clientId;
  }

  /**
   * الاتصال بخادم WebSocket للتنبيهات
   */
  connect(): void {
    if (this.alertsSocket?.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket متصل بالفعل');
      return;
    }

    this.connectToAlerts();
  }

  private connectToAlerts(): void {
    try {
      const url = `${WS_BASE_URL}/alerts?client_id=${this.clientId}`;
      console.log(`🔌 جاري الاتصال بـ WebSocket: ${url}`);
      
      this.alertsSocket = new WebSocket(url);
      this.setupAlertSocketListeners();
    } catch (error) {
      console.error('❌ فشل إنشاء اتصال WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private setupAlertSocketListeners(): void {
    if (!this.alertsSocket) return;

    this.alertsSocket.onopen = () => {
      console.log('✅ تم الاتصال بخادم التنبيهات');
      this._isConnected = true;
      this.reconnectAttempts = 0;
      
      // بدء Heartbeat
      this.startHeartbeat();
      
      // إرسال الرسائل المتراكمة
      this.flushMessageQueue();
      
      // إخطار المستمعين
      this.notifyConnectionHandlers(true);
    };

    this.alertsSocket.onclose = (event) => {
      console.log(`🔌 تم إغلاق الاتصال: ${event.code} - ${event.reason}`);
      this._isConnected = false;
      this.stopHeartbeat();
      this.notifyConnectionHandlers(false);
      
      // إعادة الاتصال التلقائي إذا لم يكن الإغلاق متعمداً
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.alertsSocket.onerror = (error) => {
      console.error('❌ خطأ في WebSocket:', error);
    };

    this.alertsSocket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // تحديث وقت آخر استجابة
      if (message.type === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      
      // معالجة ping من الخادم
      if (message.type === 'ping') {
        this.sendAction('pong');
        return;
      }

      // معالجة الرسائل حسب النوع
      switch (message.type) {
        case 'new_alert':
          if (message.data) {
            this.alertHandlers.forEach(handler => handler(message.data as Alert));
          }
          break;
          
        case 'status_update':
          if (message.data) {
            this.statusHandlers.forEach(handler => handler(message.data as SystemStatus));
          }
          break;
          
        case 'detection':
          if (message.data && message.camera_id) {
            const handler = this.detectionHandlers.get(message.camera_id);
            if (handler) handler(message.data as VideoFrame);
            
            // إرسال للمستمع العام
            const allHandler = this.detectionHandlers.get('all');
            if (allHandler) allHandler(message.data as VideoFrame);
          }
          break;
          
        case 'connected':
          console.log('📢 رسالة ترحيب:', message.message);
          break;
          
        case 'subscribed':
        case 'unsubscribed':
          console.log(`📋 ${message.type}: ${message.channel}`);
          break;
          
        case 'error':
          console.error('⚠️ خطأ من الخادم:', message.message);
          break;
      }

      // إرسال للمستمعين العامين
      this.messageHandlers.forEach(handler => handler(message));
      
    } catch (error) {
      console.error('❌ خطأ في معالجة الرسالة:', error);
    }
  }

  /**
   * Heartbeat للتحقق من الاتصال
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPong = Date.now();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.alertsSocket?.readyState === WebSocket.OPEN) {
        // إرسال ping
        this.sendAction('ping');
        
        // التحقق من آخر pong
        const timeSinceLastPong = Date.now() - this.lastPong;
        if (timeSinceLastPong > HEARTBEAT_INTERVAL * 2) {
          console.warn('⚠️ لم يتم استلام pong، جاري إعادة الاتصال...');
          this.alertsSocket?.close();
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * إعادة الاتصال التلقائي
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ تم تجاوز الحد الأقصى لمحاولات إعادة الاتصال');
      return;
    }

    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    console.log(`🔄 إعادة الاتصال خلال ${delay / 1000} ثواني... (المحاولة ${this.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectToAlerts();
    }, delay);
  }

  /**
   * طابور الرسائل
   */
  private queueMessage(action: string, data?: Record<string, unknown>): void {
    if (this.messageQueue.length >= MESSAGE_QUEUE_MAX_SIZE) {
      this.messageQueue.shift(); // إزالة أقدم رسالة
    }
    this.messageQueue.push({ action, data });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this._isConnected) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.sendAction(msg.action, msg.data);
      }
    }
  }

  /**
   * إرسال رسالة
   */
  private sendAction(action: string, data?: Record<string, unknown>): boolean {
    if (this.alertsSocket?.readyState !== WebSocket.OPEN) {
      // إضافة للطابور إذا لم يكن متصلاً
      if (action !== 'ping' && action !== 'pong') {
        this.queueMessage(action, data);
      }
      return false;
    }

    try {
      const message = data ? { action, ...data } : { action };
      this.alertsSocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('❌ خطأ في إرسال الرسالة:', error);
      return false;
    }
  }

  /**
   * قطع الاتصال
   */
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.alertsSocket) {
      this.alertsSocket.close(1000, 'User disconnect');
      this.alertsSocket = null;
    }

    // إغلاق جميع اتصالات البث
    this.streamSockets.forEach((socket) => {
      socket.close(1000, 'User disconnect');
    });
    this.streamSockets.clear();

    this._isConnected = false;
    this.notifyConnectionHandlers(false);
  }

  /**
   * الاتصال ببث كاميرا
   */
  connectToStream(cameraId: string): void {
    if (this.streamSockets.has(cameraId)) {
      return;
    }

    try {
      const url = `${WS_BASE_URL}/stream/${cameraId}?client_id=${this.clientId}`;
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log(`📹 تم الاتصال ببث الكاميرا: ${cameraId}`);
      };

      socket.onclose = () => {
        console.log(`📹 تم إغلاق بث الكاميرا: ${cameraId}`);
        this.streamSockets.delete(cameraId);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'frame' || message.type === 'detection') {
            const handler = this.detectionHandlers.get(cameraId);
            if (handler) handler(message.data);
          }
        } catch {
          // قد تكون بيانات ثنائية
          const handler = this.detectionHandlers.get(cameraId);
          if (handler) handler({ cameraId, frameData: event.data, timestamp: Date.now(), detections: [] });
        }
      };

      this.streamSockets.set(cameraId, socket);
    } catch (error) {
      console.error(`❌ فشل الاتصال ببث الكاميرا ${cameraId}:`, error);
    }
  }

  /**
   * قطع الاتصال ببث كاميرا
   */
  disconnectFromStream(cameraId: string): void {
    const socket = this.streamSockets.get(cameraId);
    if (socket) {
      socket.close(1000, 'Unsubscribe');
      this.streamSockets.delete(cameraId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // الاشتراكات والمستمعين
  // ─────────────────────────────────────────────────────────────────────────────

  subscribeToCamera(cameraId: string): void {
    this.sendAction('subscribe_camera', { camera_id: cameraId });
    this.connectToStream(cameraId);
  }

  unsubscribeFromCamera(cameraId: string): void {
    this.sendAction('unsubscribe_camera', { camera_id: cameraId });
    this.disconnectFromStream(cameraId);
  }

  /**
   * إضافة مستمع للتنبيهات
   */
  onAlert(handler: AlertHandler): () => void {
    this.alertHandlers.push(handler);
    return () => {
      const index = this.alertHandlers.indexOf(handler);
      if (index > -1) this.alertHandlers.splice(index, 1);
    };
  }

  /**
   * إضافة مستمع لحالة النظام
   */
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    return () => {
      const index = this.statusHandlers.indexOf(handler);
      if (index > -1) this.statusHandlers.splice(index, 1);
    };
  }

  /**
   * إضافة مستمع للكشف
   */
  onDetection(cameraId: string, handler: DetectionHandler): () => void {
    this.detectionHandlers.set(cameraId, handler);
    return () => {
      this.detectionHandlers.delete(cameraId);
    };
  }

  /**
   * إضافة مستمع عام للرسائل
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) this.messageHandlers.splice(index, 1);
    };
  }

  /**
   * إضافة مستمع لحالة الاتصال
   */
  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      const index = this.connectionHandlers.indexOf(handler);
      if (index > -1) this.connectionHandlers.splice(index, 1);
    };
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  /**
   * حالة الاتصال
   */
  isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * عدد محاولات إعادة الاتصال
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * طلب إحصائيات الاتصالات
   */
  requestStats(): void {
    this.sendAction('get_stats');
  }
}

// تصدير نسخة واحدة
export const wsService = new WebSocketService();
export default wsService;
