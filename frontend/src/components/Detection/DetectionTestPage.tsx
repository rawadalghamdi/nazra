import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Upload, 
  Camera, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Image as ImageIcon,
  RefreshCw,
  Info,
  Crosshair,
  Video
} from 'lucide-react';
import { detectionService, DetectionResult, DetectionStatus } from '../../services/api';

const DetectionTestPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // جلب حالة النموذج
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const data = await detectionService.getStatus();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // عند تحميل الصفحة
  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // معالجة اختيار الملف
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار ملف صورة (JPEG أو PNG)');
      return;
    }
    
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  // معالجة السحب والإفلات
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // تشغيل الكشف
  const runDetection = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await detectionService.testImage(selectedFile);
      setResult(data);
      
      // تحديث الإحصائيات
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'حدث خطأ أثناء معالجة الصورة');
    } finally {
      setIsLoading(false);
    }
  };

  // تحديد لون الخطورة
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* العنوان */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-500" />
                اختبار نموذج الكشف
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                قم برفع صورة لاختبار نموذج الكشف عن الأسلحة
              </p>
            </div>
            <Link
              to="/detection/video"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Video className="w-5 h-5" />
              اختبار فيديو
            </Link>
          </div>
        </div>

        {/* حالة النموذج */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Info className="w-5 h-5" />
              حالة النموذج
            </h2>
            <button
              onClick={fetchStatus}
              disabled={isLoadingStatus}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {status && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  {status.model_loaded ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-sm text-gray-500">حالة النموذج</span>
                </div>
                <p className={`font-semibold ${status.model_loaded ? 'text-green-600' : 'text-red-600'}`}>
                  {status.model_loaded ? 'نشط' : 'غير محمل'}
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Camera className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-500">الجهاز</span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {status.device?.toUpperCase() || 'N/A'}
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crosshair className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-gray-500">حد الثقة</span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {Math.round((status.confidence_threshold || 0) * 100)}%
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-gray-500">متوسط الوقت</span>
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {status.statistics?.average_time_ms?.toFixed(0) || 0} ms
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* منطقة رفع الصورة */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              رفع صورة
            </h2>
            
            {/* منطقة السحب والإفلات */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${dragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              
              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="معاينة"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-gray-500">
                    {selectedFile?.name}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <ImageIcon className="w-16 h-16 mx-auto text-gray-400" />
                  <div>
                    <p className="text-gray-600 dark:text-gray-300">
                      اسحب الصورة هنا أو انقر للاختيار
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      PNG, JPG, JPEG
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* زر الكشف */}
            <button
              onClick={runDetection}
              disabled={!selectedFile || isLoading}
              className={`w-full mt-4 py-3 px-4 rounded-lg font-semibold text-white transition-all
                ${!selectedFile || isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  جاري التحليل...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" />
                  تشغيل الكشف
                </span>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* نتائج الكشف */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Crosshair className="w-5 h-5" />
              نتائج الكشف
            </h2>
            
            {result ? (
              <div className="space-y-4">
                {/* الصورة المعالجة */}
                {result.annotated_image && (
                  <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img
                      src={`data:image/jpeg;base64,${result.annotated_image}`}
                      alt="نتيجة الكشف"
                      className="w-full"
                    />
                  </div>
                )}

                {/* ملخص النتائج */}
                <div className={`p-4 rounded-lg border ${
                  result.detection_summary.total_detections > 0
                    ? result.detection_summary.has_critical
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                    : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                }`}>
                  <div className="flex items-center gap-3">
                    {result.detection_summary.total_detections > 0 ? (
                      <AlertTriangle className={`w-8 h-8 ${
                        result.detection_summary.has_critical ? 'text-red-500' : 'text-orange-500'
                      }`} />
                    ) : (
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    )}
                    <div>
                      <p className="font-semibold text-lg">
                        {result.detection_summary.total_detections > 0
                          ? `تم اكتشاف ${result.detection_summary.total_detections} سلاح!`
                          : 'لم يتم اكتشاف أسلحة'
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        زمن المعالجة: {result.processing_time_ms} ms
                      </p>
                    </div>
                  </div>
                </div>

                {/* تفاصيل الكشف */}
                {result.detections.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                      تفاصيل الكشف:
                    </h3>
                    {result.detections.map((det, idx) => (
                      <div
                        key={det.id || idx}
                        className={`p-4 rounded-lg border ${getSeverityBgColor(det.severity)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${getSeverityColor(det.severity)}`} />
                            <div>
                              <p className="font-semibold text-lg">{det.class_name_ar}</p>
                              <p className="text-sm opacity-75">{det.class_name}</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-2xl font-bold">{det.confidence}%</p>
                            <p className="text-sm opacity-75">{det.severity_ar}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* إحصائيات الصورة */}
                <div className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p>الملف: {result.image_info.filename}</p>
                  <p>الأبعاد: {result.image_info.width} × {result.image_info.height}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Shield className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>قم برفع صورة وتشغيل الكشف لرؤية النتائج</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionTestPage;
