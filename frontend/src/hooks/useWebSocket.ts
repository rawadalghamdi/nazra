/**
 * ═══════════════════════════════════════════════════════════════════════════
 * نظرة - Hooks للاتصال بـ WebSocket
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { wsService, type SystemStatus } from '../services/websocket';
import type { VideoFrame, Alert } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// واجهات
// ─────────────────────────────────────────────────────────────────────────────

interface UseWebSocketOptions {
  onDetection?: (frame: VideoFrame) => void;
  onAlert?: (alert: Alert) => void;
  onStatusUpdate?: (status: SystemStatus) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  reconnectAttempts: number;
  subscribeToCamera: (cameraId: string) => void;
  unsubscribeFromCamera: (cameraId: string) => void;
  connect: () => void;
  disconnect: () => void;
}

interface UseAlertWebSocketReturn {
  isConnected: boolean;
  lastAlert: Alert | null;
  status: SystemStatus | null;
  alertQueue: Alert[];
  reconnectAttempts: number;
  connect: () => void;
  disconnect: () => void;
  clearAlertQueue: () => void;
  acknowledgeAlert: (alertId: string) => void;
}

interface UseStreamWebSocketReturn {
  isConnected: boolean;
  lastFrame: VideoFrame | null;
  connect: () => void;
  disconnect: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// useWebSocket - Hook أساسي للاتصال
// ─────────────────────────────────────────────────────────────────────────────

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { onDetection, onAlert, onStatusUpdate, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(wsService.isConnected());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const isInitialized = useRef(false);

  // الاتصال التلقائي
  useEffect(() => {
    if (autoConnect && !isInitialized.current) {
      wsService.connect();
      isInitialized.current = true;
    }

    // مراقبة حالة الاتصال
    const unsubConnection = wsService.onConnection((connected) => {
      setIsConnected(connected);
      setReconnectAttempts(wsService.getReconnectAttempts());
    });

    return () => {
      unsubConnection();
    };
  }, [autoConnect]);

  // مستمع للكشف
  useEffect(() => {
    if (onDetection) {
      return wsService.onDetection('all', onDetection);
    }
  }, [onDetection]);

  // مستمع للتنبيهات
  useEffect(() => {
    if (onAlert) {
      return wsService.onAlert(onAlert);
    }
  }, [onAlert]);

  // مستمع لتحديثات الحالة
  useEffect(() => {
    if (onStatusUpdate) {
      return wsService.onStatus(onStatusUpdate);
    }
  }, [onStatusUpdate]);

  const subscribeToCamera = useCallback((cameraId: string) => {
    wsService.subscribeToCamera(cameraId);
  }, []);

  const unsubscribeFromCamera = useCallback((cameraId: string) => {
    wsService.unsubscribeFromCamera(cameraId);
  }, []);

  return {
    isConnected,
    reconnectAttempts,
    subscribeToCamera,
    unsubscribeFromCamera,
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useAlertWebSocket - Hook متخصص للتنبيهات
// ─────────────────────────────────────────────────────────────────────────────

export function useAlertWebSocket(): UseAlertWebSocketReturn {
  const [isConnected, setIsConnected] = useState(wsService.isConnected());
  const [lastAlert, setLastAlert] = useState<Alert | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [alertQueue, setAlertQueue] = useState<Alert[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    // الاتصال التلقائي
    if (!isInitialized.current) {
      wsService.connect();
      isInitialized.current = true;
    }

    // مراقبة حالة الاتصال
    const unsubConnection = wsService.onConnection((connected) => {
      setIsConnected(connected);
    });

    // مستمع للتنبيهات
    const unsubAlert = wsService.onAlert((alert) => {
      setLastAlert(alert);
      setAlertQueue((prev) => [...prev, alert]);
    });

    // مستمع لتحديثات الحالة
    const unsubStatus = wsService.onStatus((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubConnection();
      unsubAlert();
      unsubStatus();
    };
  }, []);

  const clearAlertQueue = useCallback(() => {
    setAlertQueue([]);
    setLastAlert(null);
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlertQueue((prev) => prev.filter((alert) => alert.id !== alertId));
    if (lastAlert?.id === alertId) {
      setLastAlert(null);
    }
  }, [lastAlert]);

  return {
    isConnected,
    lastAlert,
    status,
    alertQueue,
    reconnectAttempts: wsService.getReconnectAttempts(),
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
    clearAlertQueue,
    acknowledgeAlert,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useStreamWebSocket - Hook متخصص لبث الكاميرات
// ─────────────────────────────────────────────────────────────────────────────

export function useStreamWebSocket(cameraId: string): UseStreamWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastFrame, setLastFrame] = useState<VideoFrame | null>(null);

  useEffect(() => {
    if (!cameraId) return;

    // الاتصال بالخدمة
    wsService.connect();
    wsService.connectToStream(cameraId);
    setIsConnected(true);

    // مستمع للإطارات
    const unsubDetection = wsService.onDetection(cameraId, (frame) => {
      setLastFrame(frame);
    });

    // مراقبة حالة الاتصال
    const unsubConnection = wsService.onConnection((connected) => {
      setIsConnected(connected);
    });

    return () => {
      wsService.disconnectFromStream(cameraId);
      unsubDetection();
      unsubConnection();
      setIsConnected(false);
    };
  }, [cameraId]);

  return {
    isConnected,
    lastFrame,
    connect: () => {
      wsService.connect();
      wsService.connectToStream(cameraId);
    },
    disconnect: () => wsService.disconnectFromStream(cameraId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useConnectionStatus - Hook لمراقبة حالة الاتصال فقط
// ─────────────────────────────────────────────────────────────────────────────

export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(wsService.isConnected());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    const unsubConnection = wsService.onConnection((connected) => {
      setIsConnected(connected);
      setReconnectAttempts(wsService.getReconnectAttempts());
    });

    return () => {
      unsubConnection();
    };
  }, []);

  return { isConnected, reconnectAttempts };
}

export default useWebSocket;
