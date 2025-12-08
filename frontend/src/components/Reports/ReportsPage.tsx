import { useState, useEffect } from 'react';
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  Camera,
  Clock,
  Filter,
  ChevronDown
} from 'lucide-react';
import { alertService, cameraService } from '../../services/api';

interface ReportStats {
  totalAlerts: number;
  resolvedAlerts: number;
  pendingAlerts: number;
  activeCameras: number;
  alertsByDay: { date: string; count: number }[];
  alertsByType: { type: string; count: number }[];
}

function ReportsPage() {
  const [dateRange, setDateRange] = useState('week');
  const [stats, setStats] = useState<ReportStats>({
    totalAlerts: 0,
    resolvedAlerts: 0,
    pendingAlerts: 0,
    activeCameras: 0,
    alertsByDay: [],
    alertsByType: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // جلب التنبيهات
      const alertsResponse = await alertService.getAll();
      const alerts = alertsResponse.alerts || [];
      
      // جلب الكاميرات
      const cameras = await cameraService.getAll() || [];

      // حساب الإحصائيات
      const resolvedAlerts = alerts.filter((a: any) => a.status === 'resolved').length;
      const pendingAlerts = alerts.filter((a: any) => a.status === 'pending' || a.status === 'new').length;
      const activeCameras = cameras.filter((c: any) => c.status === 'active' || c.is_active).length;

      // تجميع التنبيهات حسب اليوم
      const alertsByDayMap = new Map<string, number>();
      const today = new Date();
      const daysToShow = dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        alertsByDayMap.set(dateStr, 0);
      }

      alerts.forEach((alert: any) => {
        const alertDate = new Date(alert.created_at || alert.timestamp).toISOString().split('T')[0];
        if (alertsByDayMap.has(alertDate)) {
          alertsByDayMap.set(alertDate, (alertsByDayMap.get(alertDate) || 0) + 1);
        }
      });

      const alertsByDay = Array.from(alertsByDayMap.entries()).map(([date, count]) => ({
        date,
        count
      }));

      // تجميع التنبيهات حسب النوع
      const alertsByTypeMap = new Map<string, number>();
      alerts.forEach((alert: any) => {
        const type = alert.detection_type || alert.type || 'غير محدد';
        alertsByTypeMap.set(type, (alertsByTypeMap.get(type) || 0) + 1);
      });

      const alertsByType = Array.from(alertsByTypeMap.entries()).map(([type, count]) => ({
        type: translateType(type),
        count
      }));

      setStats({
        totalAlerts: alerts.length,
        resolvedAlerts,
        pendingAlerts,
        activeCameras,
        alertsByDay,
        alertsByType
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const translateType = (type: string) => {
    const translations: Record<string, string> = {
      'weapon': 'سلاح',
      'gun': 'مسدس',
      'knife': 'سكين',
      'rifle': 'بندقية',
      'person': 'شخص',
      'غير محدد': 'غير محدد'
    };
    return translations[type.toLowerCase()] || type;
  };

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      dateRange,
      stats
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nazra-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const maxAlertCount = Math.max(...stats.alertsByDay.map(d => d.count), 1);

  return (
    <div className="p-6 space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-saudi-green-500 to-saudi-green-700 rounded-xl flex items-center justify-center">
            <FileBarChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-nazra-text">التقارير</h1>
            <p className="text-nazra-text-muted text-sm">تحليل وإحصائيات النظام</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* فلتر الفترة */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-nazra-border rounded-lg px-4 py-2 pr-10 text-nazra-text focus:outline-none focus:ring-2 focus:ring-saudi-green-500"
            >
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوم</option>
              <option value="quarter">آخر 90 يوم</option>
            </select>
            <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nazra-text-muted pointer-events-none" />
          </div>

          {/* زر التصدير */}
          <button
            onClick={exportReport}
            className="flex items-center gap-2 bg-saudi-green-500 hover:bg-saudi-green-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير التقرير
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saudi-green-500"></div>
        </div>
      ) : (
        <>
          {/* بطاقات الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="إجمالي التنبيهات"
              value={stats.totalAlerts}
              icon={AlertTriangle}
              color="text-yellow-500"
              bgColor="bg-yellow-100"
            />
            <StatCard
              title="تنبيهات معالجة"
              value={stats.resolvedAlerts}
              icon={TrendingUp}
              color="text-green-500"
              bgColor="bg-green-100"
            />
            <StatCard
              title="تنبيهات معلقة"
              value={stats.pendingAlerts}
              icon={Clock}
              color="text-red-500"
              bgColor="bg-red-100"
            />
            <StatCard
              title="الكاميرات النشطة"
              value={stats.activeCameras}
              icon={Camera}
              color="text-blue-500"
              bgColor="bg-blue-100"
            />
          </div>

          {/* الرسوم البيانية */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* التنبيهات حسب اليوم */}
            <div className="bg-white rounded-xl border border-nazra-border p-6">
              <h3 className="text-lg font-semibold text-nazra-text mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-saudi-green-500" />
                التنبيهات حسب اليوم
              </h3>
              <div className="h-64 flex items-end justify-between gap-1">
                {stats.alertsByDay.slice(-14).map((day, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-saudi-green-500 rounded-t transition-all hover:bg-saudi-green-600"
                      style={{ 
                        height: `${(day.count / maxAlertCount) * 100}%`,
                        minHeight: day.count > 0 ? '8px' : '2px'
                      }}
                      title={`${day.date}: ${day.count} تنبيه`}
                    />
                    <span className="text-xs text-nazra-text-muted rotate-45 origin-right whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* التنبيهات حسب النوع */}
            <div className="bg-white rounded-xl border border-nazra-border p-6">
              <h3 className="text-lg font-semibold text-nazra-text mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5 text-saudi-green-500" />
                التنبيهات حسب النوع
              </h3>
              <div className="space-y-4">
                {stats.alertsByType.length > 0 ? (
                  stats.alertsByType.map((type, index) => {
                    const percentage = stats.totalAlerts > 0 
                      ? Math.round((type.count / stats.totalAlerts) * 100) 
                      : 0;
                    return (
                      <div key={index}>
                        <div className="flex justify-between mb-1">
                          <span className="text-nazra-text">{type.type}</span>
                          <span className="text-nazra-text-muted">{type.count} ({percentage}%)</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-l from-saudi-green-400 to-saudi-green-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-nazra-text-muted text-center py-8">لا توجد بيانات</p>
                )}
              </div>
            </div>
          </div>

          {/* ملخص التقرير */}
          <div className="bg-white rounded-xl border border-nazra-border p-6">
            <h3 className="text-lg font-semibold text-nazra-text mb-4">ملخص التقرير</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-saudi-green-500">
                  {stats.totalAlerts > 0 
                    ? Math.round((stats.resolvedAlerts / stats.totalAlerts) * 100) 
                    : 0}%
                </p>
                <p className="text-nazra-text-muted mt-1">معدل المعالجة</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-saudi-green-500">
                  {stats.alertsByDay.length > 0 
                    ? Math.round(stats.alertsByDay.reduce((sum, d) => sum + d.count, 0) / stats.alertsByDay.length * 10) / 10
                    : 0}
                </p>
                <p className="text-nazra-text-muted mt-1">متوسط التنبيهات اليومي</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-saudi-green-500">
                  {stats.activeCameras}
                </p>
                <p className="text-nazra-text-muted mt-1">كاميرات تعمل</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// مكون بطاقة الإحصائيات
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-nazra-border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-nazra-text">{value}</p>
          <p className="text-nazra-text-muted text-sm">{title}</p>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
