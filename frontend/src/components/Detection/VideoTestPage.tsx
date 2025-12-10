import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Video, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Play,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface VideoDetection {
  frame_number: number;
  timestamp_sec: number;
  class_name: string;
  class_name_ar: string;
  confidence: number;
  severity: string;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  frame_image: string;
}

interface VideoResult {
  success: boolean;
  video_info: {
    filename: string;
    width: number;
    height: number;
    fps: number;
    total_frames: number;
    duration_sec: number;
    frames_analyzed: number;
    skip_frames: number;
  };
  processing: {
    total_time_sec: number;
    avg_fps: number;
  };
  detection_summary: {
    total_detections: number;
    unique_frames_with_detections: number;
    by_class: Record<string, number>;
  };
  detections: VideoDetection[];
}

const VideoTestPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('يرجى اختيار ملف فيديو (MP4, MOV, AVI)');
      return;
    }
    
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setCurrentDetectionIndex(0);
  };

  const runVideoDetection = async () => {
    if (!selectedFile) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('http://localhost:8000/api/v1/detection/test/video', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'خطأ في معالجة الفيديو');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء معالجة الفيديو');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* العنوان */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Video className="w-8 h-8 text-purple-500" />
            اختبار الكشف على الفيديو
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            قم برفع فيديو لتحليله والكشف عن الأسلحة
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* رفع الفيديو */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              رفع فيديو
            </h2>
            
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                border-gray-300 dark:border-gray-600 hover:border-purple-400"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  <Video className="w-16 h-16 mx-auto text-purple-500" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-400">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Video className="w-16 h-16 mx-auto text-gray-400" />
                  <div>
                    <p className="text-gray-600 dark:text-gray-300">
                      انقر لاختيار فيديو
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      MP4, MOV, AVI
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={runVideoDetection}
              disabled={!selectedFile || isLoading}
              className={`w-full mt-4 py-3 px-4 rounded-lg font-semibold text-white transition-all
                ${!selectedFile || isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 active:scale-[0.98]'
                }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  جاري التحليل...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Play className="w-5 h-5" />
                  تحليل الفيديو
                </span>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                <p className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {error}
                </p>
              </div>
            )}

            {/* معلومات المعالجة */}
            {result && (
              <div className="mt-6 space-y-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                  معلومات الفيديو:
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-gray-500">الأبعاد</p>
                    <p className="font-semibold">{result.video_info.width} × {result.video_info.height}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-gray-500">المدة</p>
                    <p className="font-semibold">{formatTime(result.video_info.duration_sec)}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-gray-500">FPS</p>
                    <p className="font-semibold">{result.video_info.fps}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    <p className="text-gray-500">الإطارات المحللة</p>
                    <p className="font-semibold">{result.video_info.frames_analyzed}</p>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                      وقت المعالجة: {result.processing.total_time_sec.toFixed(1)} ثانية
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    متوسط السرعة: {result.processing.avg_fps} FPS
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* نتائج الكشف */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              نتائج الكشف
            </h2>
            
            {result ? (
              <div className="space-y-4">
                {/* ملخص النتائج */}
                <div className={`p-4 rounded-lg border ${
                  result.detection_summary.total_detections > 0
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/20'
                    : 'bg-green-50 border-green-200 dark:bg-green-900/20'
                }`}>
                  <div className="flex items-center gap-3">
                    {result.detection_summary.total_detections > 0 ? (
                      <AlertTriangle className="w-8 h-8 text-red-500" />
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
                      {result.detection_summary.total_detections > 0 && (
                        <p className="text-sm text-gray-500">
                          في {result.detection_summary.unique_frames_with_detections} إطار
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* إحصائيات حسب الفئة */}
                {Object.keys(result.detection_summary.by_class).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                      حسب النوع:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(result.detection_summary.by_class).map(([cls, count]) => (
                        <span
                          key={cls}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                        >
                          {cls}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* عرض الكشوفات */}
                {result.detections.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                        الكشوفات ({currentDetectionIndex + 1} من {result.detections.length}):
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentDetectionIndex(Math.max(0, currentDetectionIndex - 1))}
                          disabled={currentDetectionIndex === 0}
                          className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setCurrentDetectionIndex(Math.min(result.detections.length - 1, currentDetectionIndex + 1))}
                          disabled={currentDetectionIndex === result.detections.length - 1}
                          className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* الإطار الحالي */}
                    <div className="space-y-3">
                      {result.detections[currentDetectionIndex] && (
                        <>
                          <img
                            src={`data:image/jpeg;base64,${result.detections[currentDetectionIndex].frame_image}`}
                            alt={`Frame ${result.detections[currentDetectionIndex].frame_number}`}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getSeverityColor(result.detections[currentDetectionIndex].severity)}`} />
                              <span className="font-semibold">
                                {result.detections[currentDetectionIndex].class_name_ar}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="text-lg font-bold">
                                {result.detections[currentDetectionIndex].confidence}%
                              </span>
                              <span className="text-sm text-gray-500 mr-2">
                                @ {formatTime(result.detections[currentDetectionIndex].timestamp_sec)}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>قم برفع فيديو وتشغيل التحليل لرؤية النتائج</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTestPage;
