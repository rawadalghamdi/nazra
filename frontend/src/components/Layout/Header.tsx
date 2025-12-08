import { useState, useEffect } from 'react';
import { 
  Bell, 
  User, 
  Search, 
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAlertStore } from '../../hooks/useStore';
import type { SystemStatusType } from '../../types';

// واجهة حالة النظام
interface ConnectionStatus {
  type: SystemStatusType;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

// حالات الاتصال
const connectionStatuses: Record<SystemStatusType, ConnectionStatus> = {
  connected: {
    type: 'connected',
    label: 'متصل',
    color: 'text-status-online',
    icon: Wifi,
  },
  disconnected: {
    type: 'disconnected',
    label: 'غير متصل',
    color: 'text-status-offline',
    icon: WifiOff,
  },
  warning: {
    type: 'warning',
    label: 'تحذير',
    color: 'text-status-warning',
    icon: Wifi,
  },
  error: {
    type: 'error',
    label: 'خطأ',
    color: 'text-status-offline',
    icon: WifiOff,
  },
};

function Header() {
  const { unreadCount } = useAlertStore();
  const [connectionStatus] = useState<SystemStatusType>('connected');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // تحديث الوقت كل دقيقة
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const status = connectionStatuses[connectionStatus];
  const StatusIcon = status.icon;

  // تنسيق التاريخ والوقت
  const formattedDate = currentTime.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const formattedTime = currentTime.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="h-20 bg-white border-b border-nazra-border flex items-center justify-between px-6 shadow-sm">
      {/* الجانب الأيمن - البحث والتاريخ */}
      <div className="flex items-center gap-6 flex-1">
        {/* البحث */}
        <div className={`relative max-w-md w-full transition-all duration-300 ${isSearchFocused ? 'max-w-lg' : ''}`}>
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nazra-text-light" />
          <input
            type="text"
            placeholder="بحث في الكاميرات والتنبيهات..."
            className="input-field w-full pr-12"
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          <kbd className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-2 py-1 text-xs text-nazra-text-light bg-nazra-lightest border border-nazra-border rounded">
            ⌘K
          </kbd>
        </div>

        {/* التاريخ والوقت */}
        <div className="hidden lg:flex flex-col items-start">
          <span className="text-sm text-nazra-text-muted">{formattedDate}</span>
          <span className="text-lg font-semibold text-nazra-text">{formattedTime}</span>
        </div>
      </div>

      {/* الجانب الأيسر - حالة النظام والإجراءات */}
      <div className="flex items-center gap-4">
        {/* حالة الاتصال */}
        <div className="flex items-center gap-3 px-4 py-2 bg-nazra-lightest rounded-xl border border-nazra-border">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              connectionStatus === 'connected' ? 'bg-status-online' : 
              connectionStatus === 'warning' ? 'bg-status-warning' : 'bg-status-offline'
            } animate-pulse`}></div>
            <span className={`text-sm font-medium ${status.color}`}>
              حالة النظام: {status.label}
            </span>
          </div>
          <StatusIcon className={`w-4 h-4 ${status.color}`} />
        </div>

        {/* زر التحديث */}
        <button 
          className="p-2.5 text-nazra-text-muted hover:text-saudi-green-500 hover:bg-saudi-green-50 rounded-xl transition-all duration-200"
          title="تحديث"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        {/* التنبيهات */}
        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2.5 text-nazra-text-muted hover:text-saudi-green-500 hover:bg-saudi-green-50 rounded-xl transition-all duration-200"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-alert-critical text-white text-xs font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* قائمة التنبيهات المنسدلة */}
          {isNotificationsOpen && (
            <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-nazra-border rounded-xl shadow-xl z-50 animate-scale-in">
              <div className="p-4 border-b border-nazra-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-nazra-text">التنبيهات</h3>
                  <span className="text-xs text-nazra-text-muted">{unreadCount} جديد</span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {/* عينة من التنبيهات */}
                <NotificationItem 
                  title="كشف سلاح"
                  description="المدخل الرئيسي - كاميرا 1"
                  time="منذ 5 دقائق"
                  type="critical"
                />
                <NotificationItem 
                  title="كشف جسم مشبوه"
                  description="موقف السيارات - كاميرا 3"
                  time="منذ 15 دقيقة"
                  type="warning"
                />
                <NotificationItem 
                  title="كاميرا غير متصلة"
                  description="البوابة الشرقية - كاميرا 5"
                  time="منذ ساعة"
                  type="info"
                />
              </div>
              <div className="p-3 border-t border-nazra-border">
                <a href="/alerts" className="block text-center text-sm text-saudi-green-500 hover:text-saudi-green-600 font-medium">
                  عرض جميع التنبيهات
                </a>
              </div>
            </div>
          )}
        </div>

        {/* الإعدادات */}
        <button 
          className="p-2.5 text-nazra-text-muted hover:text-saudi-green-500 hover:bg-saudi-green-50 rounded-xl transition-all duration-200"
          title="الإعدادات"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* الفاصل */}
        <div className="h-10 w-px bg-nazra-border"></div>

        {/* المستخدم */}
        <div className="relative">
          <button 
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-nazra-lightest rounded-xl transition-all duration-200"
          >
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-nazra-text">أحمد محمد</p>
              <p className="text-xs text-nazra-text-muted">مشرف النظام</p>
            </div>
            <div className="w-11 h-11 bg-gradient-to-br from-saudi-green-500 to-saudi-green-700 rounded-xl flex items-center justify-center shadow-md">
              <User className="w-5 h-5 text-white" />
            </div>
            <ChevronDown className={`w-4 h-4 text-nazra-text-muted transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* قائمة المستخدم */}
          {isUserMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-nazra-border rounded-xl shadow-xl z-50 animate-scale-in">
              <div className="p-4 border-b border-nazra-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-saudi-green-500 to-saudi-green-700 rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-nazra-text">أحمد محمد</p>
                    <p className="text-xs text-nazra-text-muted">admin@nazra.sa</p>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <UserMenuItem icon={User} label="الملف الشخصي" />
                <UserMenuItem icon={Settings} label="الإعدادات" />
                <UserMenuItem icon={Shield} label="الأمان" />
                <div className="h-px bg-nazra-border my-2"></div>
                <UserMenuItem icon={LogOut} label="تسجيل الخروج" danger />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// مكون عنصر التنبيه
interface NotificationItemProps {
  title: string;
  description: string;
  time: string;
  type: 'critical' | 'warning' | 'info';
}

function NotificationItem({ title, description, time, type }: NotificationItemProps) {
  const colors = {
    critical: 'bg-red-50 border-alert-critical',
    warning: 'bg-orange-50 border-alert-orange',
    info: 'bg-blue-50 border-blue-500',
  };

  return (
    <div className={`p-3 rounded-lg border-r-2 ${colors[type]} mb-2 hover:bg-nazra-lightest cursor-pointer transition-colors`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-nazra-text">{title}</p>
          <p className="text-xs text-nazra-text-muted mt-1">{description}</p>
        </div>
        <span className="text-xs text-nazra-text-light">{time}</span>
      </div>
    </div>
  );
}

// مكون عنصر قائمة المستخدم
interface UserMenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
}

function UserMenuItem({ icon: Icon, label, danger }: UserMenuItemProps) {
  return (
    <button className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
      danger 
        ? 'text-alert-critical hover:bg-red-50' 
        : 'text-nazra-text hover:bg-nazra-lightest hover:text-saudi-green-600'
    }`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  );
}

export default Header;
