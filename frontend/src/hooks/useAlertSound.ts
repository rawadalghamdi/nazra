// ═══════════════════════════════════════════════════════════════════════════
// نظرة - نظام صوت التنبيهات
// useAlertSound.tsx
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useRef, useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// متجر إعدادات الصوت
interface SoundSettingsStore {
  isMuted: boolean;
  volume: number;
  soundType: 'alarm' | 'beep' | 'siren';
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setSoundType: (type: 'alarm' | 'beep' | 'siren') => void;
  toggleMute: () => void;
}

export const useSoundSettings = create<SoundSettingsStore>()(
  persist(
    (set) => ({
      isMuted: false,
      volume: 0.7,
      soundType: 'alarm',
      setMuted: (muted) => set({ isMuted: muted }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setSoundType: (type) => set({ soundType: type }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    }),
    {
      name: 'nazra-sound-settings',
    }
  )
);

// Hook للتحكم في صوت التنبيهات
export const useAlertSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { isMuted, volume, soundType } = useSoundSettings();

  // تشغيل الصوت باستخدام Web Audio API
  const playWithWebAudio = useCallback(() => {
    if (isMuted) return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gainNode = audioContextRef.current.createGain();
      gainNode.connect(audioContextRef.current.destination);
      gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);

      // تشغيل صوت متكرر
      const playTone = () => {
        if (!audioContextRef.current) return;

        const oscillator = audioContextRef.current.createOscillator();
        const currentGain = audioContextRef.current.createGain();
        
        oscillator.connect(currentGain);
        currentGain.connect(audioContextRef.current.destination);
        currentGain.gain.setValueAtTime(volume, audioContextRef.current.currentTime);

        switch (soundType) {
          case 'alarm':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContextRef.current.currentTime + 0.3);
            break;
          case 'beep':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1000, audioContextRef.current.currentTime);
            break;
          case 'siren':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(600, audioContextRef.current.currentTime);
            oscillator.frequency.linearRampToValueAtTime(1200, audioContextRef.current.currentTime + 0.3);
            break;
        }

        oscillator.start();
        oscillator.stop(audioContextRef.current.currentTime + 0.3);
      };

      // تشغيل فوري
      playTone();

      // تكرار كل نصف ثانية
      intervalRef.current = setInterval(playTone, 600);
      setIsPlaying(true);
    } catch (error) {
      console.error('فشل تشغيل الصوت:', error);
    }
  }, [isMuted, volume, soundType]);

  // تشغيل صوت التنبيه
  const playAlertSound = useCallback(() => {
    if (isMuted) return;

    try {
      // محاولة استخدام ملف صوت أولاً
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/alert.mp3');
        audioRef.current.loop = true;
      }

      audioRef.current.volume = volume;
      audioRef.current.play().catch(() => {
        // إذا فشل تشغيل الملف، استخدم Web Audio API
        playWithWebAudio();
      });

      setIsPlaying(true);
    } catch {
      // استخدام Web Audio API كبديل
      playWithWebAudio();
    }
  }, [isMuted, volume, playWithWebAudio]);

  // إيقاف صوت التنبيه
  const stopAlertSound = useCallback(() => {
    // إيقاف ملف الصوت
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // إيقاف المؤقت
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // إيقاف Web Audio
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  // تشغيل صوت اختباري
  const playTestSound = useCallback(() => {
    if (isMuted) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

      switch (soundType) {
        case 'alarm':
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);
          break;
        case 'beep':
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          break;
        case 'siren':
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.5);
          oscillator.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 1);
          break;
      }

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1);
    } catch (error) {
      console.error('فشل تشغيل صوت الاختبار:', error);
    }
  }, [isMuted, volume, soundType]);

  // تنظيف عند الإزالة
  useEffect(() => {
    return () => {
      stopAlertSound();
    };
  }, [stopAlertSound]);

  return {
    playAlertSound,
    stopAlertSound,
    playTestSound,
    isPlaying,
    isMuted,
    volume,
    soundType,
  };
};

export default useAlertSound;
