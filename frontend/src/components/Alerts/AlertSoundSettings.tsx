// ═══════════════════════════════════════════════════════════════════════════
// نظرة - مكون إعدادات صوت التنبيه
// AlertSoundSettings.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useAlertSound, useSoundSettings } from '../../hooks/useAlertSound';

export const AlertSoundSettings: React.FC = () => {
  const { isMuted, volume, soundType, setVolume, setSoundType, toggleMute } = useSoundSettings();
  const { playTestSound } = useAlertSound();

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4" dir="rtl">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <span>🔊</span>
        إعدادات صوت التنبيه
      </h3>

      {/* تبديل كتم الصوت */}
      <div className="flex items-center justify-between">
        <span className="text-gray-300">كتم الصوت</span>
        <button
          onClick={toggleMute}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            isMuted ? 'bg-gray-600' : 'bg-blue-600'
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
              isMuted ? 'right-1' : 'right-8'
            }`}
          />
        </button>
      </div>

      {/* مستوى الصوت */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">مستوى الصوت</span>
          <span className="text-white font-medium">{Math.round(volume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          disabled={isMuted}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
      </div>

      {/* نوع الصوت */}
      <div className="space-y-2">
        <span className="text-gray-300">نوع الصوت</span>
        <div className="grid grid-cols-3 gap-2">
          {(['alarm', 'beep', 'siren'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSoundType(type)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                soundType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {type === 'alarm' && '🔔 إنذار'}
              {type === 'beep' && '🔊 بيب'}
              {type === 'siren' && '🚨 صفارة'}
            </button>
          ))}
        </div>
      </div>

      {/* زر الاختبار */}
      <button
        onClick={playTestSound}
        disabled={isMuted}
        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <span>🔈</span>
        <span>اختبار الصوت</span>
      </button>
    </div>
  );
};

export default AlertSoundSettings;
