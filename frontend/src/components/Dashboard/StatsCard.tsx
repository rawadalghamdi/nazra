import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// واجهة خصائص بطاقة الإحصائيات
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'green' | 'red' | 'blue' | 'gold' | 'orange';
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    label?: string;
  };
  onClick?: () => void;
}

// ألوان البطاقات
const colorClasses = {
  green: {
    bg: 'bg-saudi-green-50',
    border: 'border-saudi-green-200',
    icon: 'bg-saudi-green-100 text-saudi-green-600',
    glow: 'hover:shadow-lg hover:border-saudi-green-300',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'bg-red-100 text-alert-critical',
    glow: 'hover:shadow-lg hover:border-red-300',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    glow: 'hover:shadow-lg hover:border-blue-300',
  },
  gold: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'bg-amber-100 text-saudi-gold-600',
    glow: 'hover:shadow-lg hover:border-amber-300',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'bg-orange-100 text-alert-orange',
    glow: 'hover:shadow-lg hover:border-orange-300',
  },
};

// ألوان الاتجاهات
const trendColors = {
  up: 'text-status-online',
  down: 'text-alert-critical',
  stable: 'text-nazra-text-muted',
};

// أيقونات الاتجاهات
const TrendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle,
  trend,
  onClick,
}: StatsCardProps) {
  const colors = colorClasses[color];
  const TrendIcon = trend ? TrendIcons[trend.direction] : null;

  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl p-5 
        bg-white border ${colors.border}
        transition-all duration-300 
        ${colors.glow}
        ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
        group
        shadow-sm
      `}
    >
      {/* خلفية متدرجة */}
      <div className={`absolute inset-0 ${colors.bg} opacity-30`}></div>
      
      {/* تأثير التوهج */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-radial from-gray-100 to-transparent rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative">
        {/* الصف العلوي - الأيقونة والعنوان */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-nazra-text-muted text-sm font-medium mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-nazra-text">{value}</p>
              
              {/* مؤشر الاتجاه */}
              {trend && TrendIcon && (
                <div className={`flex items-center gap-1 ${trendColors[trend.direction]}`}>
                  <TrendIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{trend.value}%</span>
                </div>
              )}
            </div>
          </div>
          
          {/* الأيقونة */}
          <div className={`p-3 rounded-xl ${colors.icon} transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>

        {/* الصف السفلي - العنوان الفرعي */}
        {subtitle && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-nazra-text-light">{subtitle}</p>
            {trend?.label && (
              <p className={`text-xs ${trendColors[trend.direction]}`}>
                {trend.label}
              </p>
            )}
          </div>
        )}
      </div>

      {/* خط زخرفي سفلي */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${colors.icon.replace('text-', 'bg-').split(' ')[0]} opacity-70`}></div>
    </div>
  );
}

// مكون شريط الإحصائيات
interface StatsBarProps {
  stats: {
    id: string;
    title: string;
    value: string | number;
    icon: LucideIcon;
    color: 'green' | 'red' | 'blue' | 'gold' | 'orange';
    subtitle?: string;
    trend?: {
      direction: 'up' | 'down' | 'stable';
      value: number;
      label?: string;
    };
  }[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatsCard
          key={stat.id}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          color={stat.color}
          subtitle={stat.subtitle}
          trend={stat.trend}
        />
      ))}
    </div>
  );
}

export default StatsCard;
