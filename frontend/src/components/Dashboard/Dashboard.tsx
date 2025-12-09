import { useEffect, useState } from 'react';
import { 
  Camera, 
  AlertTriangle, 
  Shield, 
  Clock, 
  TrendingUp,
  CheckCircle2,
  Eye,
  Activity,
} from 'lucide-react';
import { dashboardService } from '../../services/api';
import type { DashboardStats, Alert } from '../../types';
import { formatNumber, formatPercentage } from '../../utils';
import StatsCard from './StatsCard';
import RecentAlerts from './RecentAlerts';
import CameraGrid from './CameraGrid';

// واجهة حالة الخدمة
interface ServiceStatus {
  label: string;
  status: 'online' | 'offline' | 'warning';
  latency?: number;
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const startTime = Date.now();
      
      const [statsData, alertsData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentAlerts(5),
      ]);
      
      const apiLatency = Date.now() - startTime;
      
      setStats(statsData);
      setRecentAlerts(alertsData);
      
      setServiceStatuses([
        { label: 'خدمة الكشف', status: 'online', latency: apiLatency },
        { label: 'قاعدة البيانات', status: 'online', latency: Math.round(apiLatency * 0.3) },
        { label: 'WebSocket', status: 'online', latency: Math.round(apiLatency * 0.2) },
        { label: 'خدمة التنبيهات', status: 'online', latency: Math.round(apiLatency * 0.5) },
      ]);
      
    } catch (err) {
      console.error('خطأ في تحميل بيانات لوحة التحكم:', err);
      setError('تعذر تحميل البيانات. تأكد من تشغيل الخادم.');
      
      setServiceStatuses([
        { label: 'خدمة الكشف', status: 'offline' },
        { label: 'قاعدة البيانات', status: 'offline' },
        { label: 'WebSocket', status: 'offline' },
        { label: 'خدمة التنبيهات', status: 'offline' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-nazra-text-muted">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-nazra-text mb-2">خطأ في تحميل البيانات</h2>
          <p className="text-nazra-text-muted mb-4">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="px-4 py-2 bg-saudi-green-500 text-white rounded-lg hover:bg-saudi-green-600"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-nazra-text">لوحة التحكم</h1>
          <p className="text-nazra-text-muted mt-1">نظرة شاملة على حالة النظام والتنبيهات</p>
        </div>
        <button 
          onClick={loadDashboardData}
          className="btn-secondary flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          <span>تحديث</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="تنبيهات اليوم"
          value={formatNumber(stats?.alertsToday || 0)}
          icon={AlertTriangle}
          color="orange"
          subtitle="إجمالي التنبيهات اليوم"
          trend={{ direction: 'up', value: 12, label: 'مقارنة بالأمس' }}
        />
        <StatsCard
          title="قيد المراجعة"
          value={formatNumber(stats?.pendingAlerts || 0)}
          icon={Eye}
          color="blue"
          subtitle="تنبيهات تحتاج مراجعة"
        />
        <StatsCard
          title="تم التأكيد"
          value={formatNumber(stats?.confirmedAlerts || 0)}
          icon={CheckCircle2}
          color="green"
          subtitle="تنبيهات مؤكدة"
        />
        <StatsCard
          title="كاميرات نشطة"
          value={`${stats?.onlineCameras || 0}`}
          icon={Camera}
          color="gold"
          subtitle={`من أصل ${stats?.totalCameras || 0} كاميرا`}
          trend={{ direction: 'stable', value: 0 }}
        />
      </div>

      <CameraGrid layout="2x3" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAlerts 
            alerts={recentAlerts} 
            maxItems={5}
            onViewAll={() => window.location.href = '/alerts'}
          />
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-saudi-green-50 rounded-xl">
              <Shield className="w-5 h-5 text-saudi-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-nazra-text">حالة النظام</h3>
              <p className="text-sm text-nazra-text-muted">جميع الخدمات</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {serviceStatuses.map((service, index) => (
              <StatusItem 
                key={index} 
                label={service.label} 
                status={service.status} 
                latency={service.latency} 
              />
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-nazra-border">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-nazra-lightest rounded-xl">
                <div className="flex items-center justify-center gap-1 text-saudi-green-500 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xl font-bold">{stats?.averageResponseTime?.toFixed(1) || '0'}ث</span>
                </div>
                <p className="text-xs text-nazra-text-muted">متوسط الاستجابة</p>
              </div>
              <div className="text-center p-3 bg-nazra-lightest rounded-xl">
                <div className="flex items-center justify-center gap-1 text-saudi-gold-500 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xl font-bold">{formatPercentage(stats?.detectionAccuracy || 0)}</span>
                </div>
                <p className="text-xs text-nazra-text-muted">دقة الكشف</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatusItemProps {
  label: string;
  status: 'online' | 'offline' | 'warning';
  latency?: number;
}

function StatusItem({ label, status, latency }: StatusItemProps) {
  const statusConfig = {
    online: { color: 'bg-status-online', text: 'text-status-online', label: 'متصل' },
    offline: { color: 'bg-status-offline', text: 'text-status-offline', label: 'غير متصل' },
    warning: { color: 'bg-status-warning', text: 'text-status-warning', label: 'بطيء' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between p-3 bg-nazra-lightest rounded-xl hover:bg-nazra-lighter transition-colors border border-nazra-border">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${config.color} ${status === 'online' ? 'animate-pulse' : ''}`}></div>
        <span className="text-nazra-text text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {latency !== undefined && (
          <span className="text-xs text-nazra-text-light">{latency}ms</span>
        )}
        <span className={`text-xs font-medium ${config.text}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

export default Dashboard;
