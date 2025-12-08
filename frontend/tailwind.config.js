/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // دعم RTL للغة العربية
  theme: {
    extend: {
      // الألوان السعودية الرسمية
      colors: {
        // الأخضر السعودي
        'saudi-green': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#006C35', // اللون الأساسي
          600: '#005a2c',
          700: '#004a24',
          800: '#003a1c',
          900: '#002a14',
        },
        // الذهبي السعودي
        'saudi-gold': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#C4A35A', // اللون الأساسي
          600: '#b8963f',
          700: '#a58532',
          800: '#8a6d2a',
          900: '#6f5621',
        },
        // ألوان التنبيهات
        'alert': {
          critical: '#DC2626',
          high: '#F97316',
          medium: '#EAB308',
          low: '#22C55E',
          orange: '#F5A623',
        },
        // ألوان النظام - ثيم فاتح
        'nazra': {
          // خلفيات فاتحة
          light: '#FFFFFF',
          lighter: '#F8FAFC',
          lightest: '#F1F5F9',
          // حدود وخطوط
          border: '#E2E8F0',
          'border-dark': '#CBD5E1',
          // نصوص
          text: '#1E293B',
          'text-muted': '#64748B',
          'text-light': '#94A3B8',
          // ألوان مساعدة
          accent: '#006C35',
          'accent-light': '#dcfce7',
        },
        // ألوان إضافية
        'status': {
          online: '#22C55E',
          offline: '#EF4444',
          warning: '#F59E0B',
          maintenance: '#8B5CF6',
        }
      },
      fontFamily: {
        'arabic': ['IBM Plex Sans Arabic', 'Tajawal', 'Cairo', 'sans-serif'],
        'display': ['IBM Plex Sans Arabic', 'Almarai', 'sans-serif'],
        'mono': ['IBM Plex Mono', 'monospace'],
      },
      // إعدادات RTL
      spacing: {
        'rtl': 'var(--spacing-rtl)',
      },
      animation: {
        'pulse-alert': 'pulse-alert 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'flash': 'flash 0.5s ease-in-out 3',
        'shake': 'shake 0.82s cubic-bezier(.36,.07,.19,.97) both',
        'gradient-x': 'gradient-x 2s ease infinite',
        'gradient-x-reverse': 'gradient-x-reverse 2s ease infinite',
      },
      keyframes: {
        'pulse-alert': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slideInRight': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slideInLeft': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fadeIn': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scaleIn': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px rgba(0, 108, 53, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 108, 53, 0.5)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'flash': {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        'shake': {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'gradient-x-reverse': {
          '0%, 100%': { backgroundPosition: '100% 50%' },
          '50%': { backgroundPosition: '0% 50%' },
        },
      },
      boxShadow: {
        'glow-green': '0 0 15px rgba(0, 108, 53, 0.3)',
        'glow-red': '0 0 15px rgba(220, 38, 38, 0.3)',
        'glow-orange': '0 0 15px rgba(245, 166, 35, 0.3)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
  // دعم RTL
  corePlugins: {
    preflight: true,
  },
}
