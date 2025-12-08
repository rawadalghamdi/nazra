import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

function Layout() {
  const [isLoading, setIsLoading] = useState(true);

  // محاكاة تحميل أولي
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-nazra-lighter">
        <div className="text-center">
          {/* شعار التحميل */}
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-saudi-green-500 to-saudi-green-700 rounded-2xl flex items-center justify-center shadow-glow-green animate-pulse mx-auto">
              <svg 
                className="w-10 h-10 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
                />
              </svg>
            </div>
            {/* دائرة التحميل */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-28 h-28 border-4 border-saudi-green-100 border-t-saudi-green-500 rounded-full animate-spin"></div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-nazra-text mb-2">نظرة</h1>
          <p className="text-nazra-text-muted text-sm">جاري تحميل النظام...</p>
          
          {/* شريط التقدم */}
          <div className="w-48 h-1 bg-nazra-border rounded-full mt-6 mx-auto overflow-hidden">
            <div className="h-full bg-saudi-green-500 rounded-full animate-shimmer" style={{ 
              width: '100%',
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(0, 108, 53, 0.5), transparent)',
              backgroundSize: '200% 100%',
            }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-nazra-lighter overflow-hidden" dir="rtl">
      {/* الشريط الجانبي */}
      <Sidebar />
      
      {/* المحتوى الرئيسي */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* الهيدر */}
        <Header />
        
        {/* المحتوى */}
        <main className="flex-1 overflow-auto p-6 bg-nazra-lighter">
          {/* خلفية زخرفية */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-saudi-green-500/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-saudi-green-500/5 rounded-full blur-3xl"></div>
          </div>
          
          {/* المحتوى الفعلي */}
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
