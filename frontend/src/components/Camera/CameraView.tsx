function CameraView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">الكاميرات</h1>
        <p className="text-gray-400 mt-1">مراقبة البث المباشر</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* كاميرا وهمية للعرض */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card">
            <div className="video-container bg-nazra-dark">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-saudi-green-500/30 border-t-saudi-green-500 rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-400 text-sm">جاري التحميل...</p>
                </div>
              </div>
              {/* شريط المعلومات */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-white text-sm">كاميرا {i}</span>
                  </div>
                  <span className="text-xs text-gray-400">HD</span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <h4 className="font-medium text-white">المدخل {i}</h4>
              <p className="text-sm text-gray-400">البوابة الرئيسية</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CameraView;
