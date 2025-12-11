import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  Bell,
  Settings,
  Shield,
  Video,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAlertStore } from '../../hooks/useStore';
import { alertService } from '../../services/api';

// واجهة عنصر القائمة
interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'alerts'; // مفتاح للـ badge الديناميكي
}

// عناصر القائمة الرئيسية (بدون badge ثابت)
const navigationItems: NavigationItem[] = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'البث المباشر', href: '/live', icon: Video },
  { name: 'التنبيهات', href: '/alerts', icon: Bell, badgeKey: 'alerts' },
  { name: 'الكاميرات', href: '/cameras', icon: Camera },
  { name: 'اختبار الكشف', href: '/detection', icon: Crosshair },
  { name: 'التقارير', href: '/reports', icon: FileBarChart },
  { name: 'الإعدادات', href: '/settings', icon: Settings },
];

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pendingAlertsCount, setPendingAlertsCount] = useState(0);
  const location = useLocation();
  
  // الحصول على عدد التنبيهات غير المقروءة من الـ Store
  const unreadCount = useAlertStore((state) => state.unreadCount);
  
  // جلب عدد التنبيهات الجديدة من API عند التحميل
  useEffect(() => {
    const fetchAlertsCount = async () => {
      try {
        const stats = await alertService.getStats();
        // التنبيهات الجديدة + قيد المراجعة
        const pending = (stats.new || 0) + (stats.reviewing || 0);
        setPendingAlertsCount(pending);
      } catch (error) {
        console.error('خطأ في جلب عدد التنبيهات:', error);
      }
    };
    
    fetchAlertsCount();
    
    // تحديث كل 30 ثانية
    const interval = setInterval(fetchAlertsCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // استخدام أكبر قيمة بين Store و API
  const alertsBadge = Math.max(unreadCount, pendingAlertsCount);
  
  // إنشاء navigation مع badges ديناميكية
  const navigation = useMemo(() => {
    return navigationItems.map(item => ({
      ...item,
      badge: item.badgeKey === 'alerts' ? alertsBadge : undefined,
    }));
  }, [alertsBadge]);

  return (
    <aside 
      className={`
        ${isCollapsed ? 'w-20' : 'w-72'} 
        bg-white border-l border-nazra-border 
        flex flex-col transition-all duration-300 relative shadow-sm
      `}
    >
      {/* زر الطي/التوسيع */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3 top-20 z-10 w-6 h-6 bg-white border border-nazra-border rounded-full flex items-center justify-center text-nazra-text-muted hover:text-saudi-green-500 hover:border-saudi-green-500 transition-colors shadow-sm"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* الشعار */}
      <div className="h-20 flex items-center justify-center border-b border-nazra-border px-4">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-12 h-12 bg-gradient-to-br from-saudi-green-500 to-saudi-green-700 rounded-xl flex items-center justify-center shadow-glow-green">
            <Shield className="w-7 h-7 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-nazra-text font-display">نظرة</h1>
              <p className="text-xs text-saudi-green-500 font-medium">الكشف الاستباقي</p>
            </div>
          )}
        </div>
      </div>

      {/* القائمة الرئيسية */}
      <nav className="flex-1 p-4 space-y-2">
        {!isCollapsed && (
          <p className="text-xs text-nazra-text-light uppercase tracking-wider mb-4 px-4">
            القائمة الرئيسية
          </p>
        )}
        
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`
                flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} 
                px-4 py-3.5 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-gradient-to-l from-saudi-green-500 to-saudi-green-600 text-white shadow-glow-green' 
                  : 'text-nazra-text-muted hover:bg-saudi-green-50 hover:text-saudi-green-600'
                }
              `}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
              
              {!isCollapsed && (
                <>
                  <span className="font-medium flex-1">{item.name}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="min-w-[1.5rem] h-6 bg-alert-orange text-white text-xs font-bold rounded-full flex items-center justify-center px-2 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              
              {isCollapsed && item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-alert-orange text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* معلومات النظام */}
      <div className="p-4 border-t border-nazra-border">
        {!isCollapsed ? (
          <div className="bg-nazra-lightest rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-status-online rounded-full animate-pulse"></div>
              <span className="text-sm text-nazra-text">النظام يعمل</span>
            </div>
            <div className="text-xs text-nazra-text-muted space-y-1">
              <p>الإصدار: 1.2.0</p>
              <p>آخر تحديث: {new Date().toLocaleDateString('ar-SA')}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-3 h-3 bg-status-online rounded-full animate-pulse" title="النظام يعمل"></div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
