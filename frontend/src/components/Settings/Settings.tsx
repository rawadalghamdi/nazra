function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">الإعدادات</h1>
        <p className="text-gray-400 mt-1">إعدادات النظام</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">إعدادات عامة</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">تفعيل صوت التنبيهات</p>
              <p className="text-sm text-gray-400">تشغيل صوت عند وصول تنبيه جديد</p>
            </div>
            <button className="w-12 h-6 bg-saudi-green-500 rounded-full relative">
              <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></span>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">إشعارات البريد الإلكتروني</p>
              <p className="text-sm text-gray-400">إرسال تنبيهات عبر البريد الإلكتروني</p>
            </div>
            <button className="w-12 h-6 bg-gray-600 rounded-full relative">
              <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
