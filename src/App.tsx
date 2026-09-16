import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  Download,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Settings2,
  FileAudio,
  Radio,
  Share2,
} from 'lucide-react';
import { VoiceMood, ServerConfig, RvcStatus } from './types';
import { generateSyntheticSpeech } from './utils/audio';
import { RvcModal } from './components/RvcModal';
import { AudioConverter } from './components/AudioConverter';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tts' | 'convert'>('tts');
  const [text, setText] = useState<string>('');
  const [mood, setMood] = useState<VoiceMood>('Neutral');
  const [speed, setSpeed] = useState<number>(1.0);
  const [targetVoice, setTargetVoice] = useState<'aisha' | 'rvc'>('aisha');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRvcConverting, setIsRvcConverting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Audio output state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLabel, setAudioLabel] = useState<string>('');
  const [lastAishaAudioId, setLastAishaAudioId] = useState<string | null>(null);

  // Server & RVC states
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [rvcUrl, setRvcUrl] = useState<string>(() => {
    return localStorage.getItem('mening_ovozim_rvc_url') || 'http://localhost:5005';
  });
  const [rvcStatus, setRvcStatus] = useState<RvcStatus | null>(null);
  const [isCheckingRvc, setIsCheckingRvc] = useState<boolean>(false);
  const [isRvcModalOpen, setIsRvcModalOpen] = useState<boolean>(false);

  // Audio playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check backend server config on mount
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: ServerConfig) => {
        setConfig(data);
        if (data.rvcServerUrl && !localStorage.getItem('mening_ovozim_rvc_url')) {
          setRvcUrl(data.rvcServerUrl);
        }
      })
      .catch(() => {
        setConfig(null);
      });
  }, []);

  // Ping RVC server status
  const checkRvcHealth = async (urlToCheck?: string) => {
    setIsCheckingRvc(true);
    const target = urlToCheck || rvcUrl;
    try {
      const res = await fetch(`/api/rvc/status?url=${encodeURIComponent(target)}`);
      const data: RvcStatus = await res.json();
      setRvcStatus(data);
    } catch {
      setRvcStatus({
        online: false,
        url: target,
        error: 'Ulanishda xatolik',
      });
    } finally {
      setIsCheckingRvc(false);
    }
  };

  useEffect(() => {
    checkRvcHealth(rvcUrl);
  }, [rvcUrl]);

  const handleUpdateRvcUrl = (newUrl: string) => {
    setRvcUrl(newUrl);
    localStorage.setItem('mening_ovozim_rvc_url', newUrl);
    checkRvcHealth(newUrl);
  };

  // Generate TTS
  const handleGenerate = async (forceDemo: boolean = false) => {
    setErrorMessage(null);
    setWarningMessage(null);
    setSuccessMessage(null);

    const trimmedText = text.trim();
    if (!trimmedText) {
      setWarningMessage('Iltimos, matn kiriting.');
      return;
    }

    if (trimmedText.length > 1000) {
      setErrorMessage(
        `Matn uzunligi 1000 ta belgidan oshmasligi kerak. Hozirda: ${trimmedText.length} ta belgi.`
      );
      return;
    }

    setIsLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      if (forceDemo) {
        const { dataUrl } = await generateSyntheticSpeech(trimmedText, mood, speed);
        setAudioUrl(dataUrl);
        setAudioLabel('Sintezlangan Namuna Ovoz');
        setLastAishaAudioId(null);
        setSuccessMessage('Namuna ovoz muvaffaqiyatli yaratildi!');
        setIsLoading(false);
        return;
      }

      const applyRvc = targetVoice === 'rvc' && rvcStatus?.online;

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmedText,
          mood,
          speed,
          applyRvc,
          rvcUrl,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && (data.audioBase64 || data.audioUrl)) {
        const playableSource = data.audioBase64 || data.audioUrl;
        setAudioUrl(playableSource);
        setLastAishaAudioId(data.aishaAudioId || null);

        if (data.rvcApplied) {
          setAudioLabel('Shoyadbek Ovozi (Aisha + RVC Model)');
          setSuccessMessage('Ovoz Aisha AI orqali yaratilib, Shoyadbek ovoziga (RVC) o\'girildi!');
        } else {
          setAudioLabel('Gulnoza (Aisha AI)');
          if (targetVoice === 'rvc') {
            setWarningMessage(
              "RVC serveri faol bo'lmagani sababli Aisha AI (Gulnoza) ovozida taqdim etildi. Shoyadbek ovozi uchun RVC serverni yoqing."
            );
          } else {
            setSuccessMessage('Ovoz Aisha AI orqali muvaffaqiyatli yaratildi!');
          }
        }
      } else {
        if (data.code === 'MISSING_API_KEY') {
          const { dataUrl } = await generateSyntheticSpeech(trimmedText, mood, speed);
          setAudioUrl(dataUrl);
          setAudioLabel('Sintezlangan Namuna');
          setWarningMessage(
            "AISHA_API_KEY sozlanmagan. Namuna ovoz yaratildi. Haqiqiy ovoz uchun AISHA_API_KEY sozlanishi lozim."
          );
        } else {
          setErrorMessage(data.error || 'Ovoz yaratishda xatolik yuz berdi.');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Noma\'lum xatolik';
      setErrorMessage(`Serverga ulanishda xatolik: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert currently loaded Aisha audio into Shoyadbek RVC voice
  const handleConvertToShoyadbek = async () => {
    if (!audioUrl) return;
    if (!rvcStatus?.online) {
      setIsRvcModalOpen(true);
      return;
    }

    setIsRvcConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/rvc/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId: lastAishaAudioId,
          audioBase64: audioUrl.startsWith('data:') ? audioUrl : undefined,
          rvcUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.audioBase64 || data.audioUrl)) {
        const converted = data.audioBase64 || data.audioUrl;
        setAudioUrl(converted);
        setAudioLabel('Shoyadbek Ovozi (RVC)');
        setSuccessMessage('Ovoz Shoyadbek RVC modeliga muvaffaqiyatli aylantirildi!');
      } else {
        setErrorMessage(data.error || 'RVC aylantirishda xatolik yuz berdi.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Noma\'lum xatolik';
      setErrorMessage(`Serverga ulanishda xatolik: ${msg}`);
    } finally {
      setIsRvcConverting(false);
    }
  };

  // Custom player events
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => {
        console.error('Audio play error:', e);
      });
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleReset = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isTextTooLong = text.trim().length > 1000;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#262730] flex flex-col items-center py-8 px-4 sm:px-6">
      {/* Main Container */}
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xs border border-gray-200/80 p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
              🎙️
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                Mening Ovozim
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Aisha AI O'zbekcha TTS &bull; Shoyadbek Ovozi RVC Klonlash
              </p>
            </div>
          </div>

          {/* RVC Settings Trigger */}
          <button
            type="button"
            onClick={() => setIsRvcModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-xs transition-colors cursor-pointer self-start sm:self-center"
          >
            <Settings2 className="w-3.5 h-3.5 text-gray-500" />
            <span>RVC Server</span>
            <span className={`w-2 h-2 rounded-full ${rvcStatus?.online ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          </button>
        </div>

        {/* Status Indicators Bar */}
        <div className="mt-5 p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Aisha AI Status */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-700">Aisha AI:</span>
              {config?.hasAishaKey ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Ulandi
                </span>
              ) : (
                <span className="font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  API Kalit kutilmoqda
                </span>
              )}
            </div>

            {/* Shoyadbek RVC Status */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-700">Shoyadbek RVC:</span>
              {rvcStatus?.online ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Faol
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRvcModalOpen(true)}
                  className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <AlertCircle className="w-3 h-3 text-amber-600" /> O'chiq (Ulash)
                </button>
              )}
            </div>
          </div>

          {/* Model index badge */}
          <div className="text-gray-500 text-[11px] font-mono">
            Model: <span className="text-gray-800 font-semibold">shoyadbek_ovoz_40e_160s.pth</span>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="mt-6 flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('tts')}
            className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'tts'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Matndan Nutqqa (TTS)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('convert')}
            className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'convert'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileAudio className="w-4 h-4" />
            <span>Ovoz Aylantirish (RVC)</span>
          </button>
        </div>

        {/* Tab 1: Text to Speech */}
        {activeTab === 'tts' && (
          <div className="mt-6 space-y-5">
            {/* Target Voice Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Chiquvchi ovoz turi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetVoice('aisha')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    targetVoice === 'aisha'
                      ? 'border-red-600 bg-red-50/40 ring-1 ring-red-600'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${targetVoice === 'aisha' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">Gulnoza (Aisha AI)</p>
                    <p className="text-xs text-gray-500 mt-0.5">Asl O'zbekcha ayol ovozi</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetVoice('rvc')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    targetVoice === 'rvc'
                      ? 'border-red-600 bg-red-50/40 ring-1 ring-red-600'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${targetVoice === 'rvc' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm text-gray-900">Shoyadbek Ovozi</p>
                      <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono">
                        RVC Model
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">O'zingizning klonlangan ovozingiz</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Text Input Area */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="text-input"
                  className="text-sm font-semibold text-gray-800"
                >
                  Matn
                </label>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    isTextTooLong
                      ? 'bg-red-100 text-red-700 font-bold'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {text.length} / 1000 ta belgi
                </span>
              </div>
              <textarea
                id="text-input"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Bu yerga matningizni yozing..."
                className={`w-full p-3.5 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none text-base transition-all resize-y shadow-xs ${
                  isTextTooLong
                    ? 'border-red-400 focus:ring-2 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                }`}
              />
              <div className="mt-1.5 flex justify-between text-xs text-gray-400">
                <span>O'zbek tilidagi matn (lotin yoki kirill)</span>
                {isTextTooLong && (
                  <span className="text-red-600 font-medium">
                    Matn 1000 ta belgidan oshmasligi kerak!
                  </span>
                )}
              </div>
            </div>

            {/* Controls: Mood & Speed Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Mood Select */}
              <div>
                <label
                  htmlFor="mood-select"
                  className="block text-sm font-semibold text-gray-800 mb-2"
                >
                  Kayfiyat (Aisha AI)
                </label>
                <select
                  id="mood-select"
                  value={mood}
                  onChange={(e) => setMood(e.target.value as VoiceMood)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-xs text-sm"
                >
                  <option value="Neutral">Neutral (Neytral)</option>
                  <option value="Cheerful">Cheerful (Xushchaqchaq)</option>
                  <option value="Happy">Happy (Baxtli)</option>
                  <option value="Sad">Sad (G'amgin)</option>
                </select>
              </div>

              {/* Speed Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label
                    htmlFor="speed-slider"
                    className="text-sm font-semibold text-gray-800"
                  >
                    Tezlik
                  </label>
                  <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-semibold">
                    {speed.toFixed(1)}x
                  </span>
                </div>
                <input
                  id="speed-slider"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-red-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1 font-mono">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>
            </div>

            {/* Feedback Messages */}
            {warningMessage && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{warningMessage}</p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{successMessage}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="generate-btn"
                type="button"
                disabled={isLoading || isTextTooLong}
                onClick={() => handleGenerate(false)}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Ovoz yaratilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>
                      {targetVoice === 'rvc' ? "Shoyadbek ovozida yaratish" : "Ovoz yaratish (Aisha)"}
                    </span>
                  </>
                )}
              </button>

              <button
                id="demo-btn"
                type="button"
                disabled={isLoading || isTextTooLong}
                onClick={() => handleGenerate(true)}
                className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
                title="Sintezlangan namuna ovoz yaratish"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Namuna sinash</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Audio Converter (RVC) */}
        {activeTab === 'convert' && (
          <div className="mt-6">
            <AudioConverter
              rvcStatus={rvcStatus}
              rvcUrl={rvcUrl}
              onOpenRvcModal={() => setIsRvcModalOpen(true)}
              onAudioConverted={(url, label) => {
                setAudioUrl(url);
                setAudioLabel(label);
                setLastAishaAudioId(null);
              }}
            />
          </div>
        )}

        {/* Generated Audio Output Player */}
        {audioUrl && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-red-600" />
                <span>Yaratilgan ovoz</span>
              </h2>
              {audioLabel && (
                <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md border border-gray-200/80">
                  {audioLabel}
                </span>
              )}
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
              {/* Hidden native audio element synced with custom UI */}
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => {
                  setErrorMessage("Audioni o'ynatishda brauzerda xatolik yuz berdi. Yuklab olish tugmasidan foydalaning.");
                }}
              />

              {/* Custom Player Controls */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer shrink-0"
                  aria-label={isPlaying ? "To'xtatish" : "Eshitish"}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-white" />
                  ) : (
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-2.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors cursor-pointer"
                  title="Boshidan boshlash"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Progress Bar */}
                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.05"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-red-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-xs font-mono text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>

              {/* Secondary actions: convert Aisha to Shoyadbek if applicable */}
              {audioLabel.includes('Gulnoza') && (
                <div className="p-3 bg-white border border-gray-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <span className="text-gray-600">
                    Ushbu Aisha AI ovozini Shoyadbekning RVC modeliga o'tkazmoqchimisiz?
                  </span>
                  <button
                    type="button"
                    disabled={isRvcConverting}
                    onClick={handleConvertToShoyadbek}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isRvcConverting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Aylantirilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Shoyadbek ovoziga o'tkazish</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Standard HTML5 Audio fallback for native controls */}
              <audio
                src={audioUrl}
                controls
                className="w-full mt-2"
              />

              {/* Download Button */}
              <div className="flex justify-end pt-1">
                <a
                  id="download-btn"
                  href={audioUrl}
                  download="shoyadbek_ovoz.wav"
                  className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2.5 px-4 rounded-lg shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Yuklab olish (.wav)</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RVC Server Modal */}
      <RvcModal
        isOpen={isRvcModalOpen}
        onClose={() => setIsRvcModalOpen(false)}
        config={config}
        rvcStatus={rvcStatus}
        rvcUrl={rvcUrl}
        onUpdateRvcUrl={handleUpdateRvcUrl}
        onCheckStatus={() => checkRvcHealth(rvcUrl)}
        isCheckingStatus={isCheckingRvc}
      />

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-gray-400">
        Mening Ovozim &bull; Aisha AI TTS &bull; Shoyadbek Ovozi RVC (shoyadbek_ovoz_40e_160s.pth)
      </div>
    </div>
  );
}
