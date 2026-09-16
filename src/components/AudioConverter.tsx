import React, { useState, useRef } from 'react';
import {
  Upload,
  Mic,
  Square,
  Sparkles,
  Loader2,
  Volume2,
  FileAudio,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { RvcStatus } from '../types';

interface AudioConverterProps {
  rvcStatus: RvcStatus | null;
  rvcUrl: string;
  onAudioConverted: (audioUrl: string, label: string) => void;
  onOpenRvcModal: () => void;
}

export const AudioConverter: React.FC<AudioConverterProps> = ({
  rvcStatus,
  rvcUrl,
  onAudioConverted,
  onOpenRvcModal,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputAudioUrl, setInputAudioUrl] = useState<string | null>(null);
  const [inputAudioBase64, setInputAudioBase64] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // File selection
  const handleFileChange = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('Audio fayl hajmi 20MB dan oshmasligi kerak.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setInputAudioUrl(objectUrl);

    const reader = new FileReader();
    reader.onloadend = () => {
      setInputAudioBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Microphone recording
  const startRecording = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const objectUrl = URL.createObjectURL(audioBlob);
        setInputAudioUrl(objectUrl);

        const reader = new FileReader();
        reader.onloadend = () => {
          setInputAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setErrorMessage(
        'Mikrofonni ishlatishga ruxsat berilmadi. Iltimos, brauzer sozlamalaridan ruxsat bering.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Trigger conversion
  const handleConvert = async () => {
    if (!inputAudioBase64) {
      setErrorMessage('Iltimos, avval audio fayl tanlang yoki ovozingizni yozib oling.');
      return;
    }

    if (!rvcStatus?.online) {
      setErrorMessage(
        "RVC serveri faol emas. Shoyadbek ovoziga aylantirish uchun avval RVC serverni ishga tushiring."
      );
      return;
    }

    setIsConverting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/rvc/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: inputAudioBase64,
          rvcUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.audioBase64 || data.audioUrl)) {
        const playableUrl = data.audioBase64 || data.audioUrl;
        setSuccessMessage('Audio Shoyadbek ovoziga (RVC) muvaffaqiyatli aylantirildi!');
        onAudioConverted(playableUrl, 'Shoyadbek Ovozi (RVC)');
      } else {
        setErrorMessage(data.error || 'Ovozni aylantirishda xatolik yuz berdi.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Noma\'lum xatolik';
      setErrorMessage(`Serverga ulanishda xatolik: ${msg}`);
    } finally {
      setIsConverting(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Upload and Record Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Upload Card */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-red-400 bg-gray-50/50 hover:bg-red-50/20 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-800">
            Audio faylni yuklang
          </p>
          <p className="text-xs text-gray-500 mt-1">
            WAV, MP3, M4A yoki OGG (maks. 20 MB)
          </p>
          {selectedFile && (
            <div className="mt-3 px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <FileAudio className="w-3.5 h-3.5 text-red-600" />
              <span className="truncate max-w-[180px]">{selectedFile.name}</span>
            </div>
          )}
        </div>

        {/* Record Card */}
        <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-white shadow-xs">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
            isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-100 text-gray-700'
          }`}>
            <Mic className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {isRecording ? 'Ovoz yozilmoqda...' : 'Mikrofon orqali yozish'}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            {isRecording ? formatDuration(recordingDuration) : 'O\'z ovozingizni jonli yozing'}
          </p>

          <div className="mt-4">
            {isRecording ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopRecording();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>To'xtatish</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startRecording();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Yozishni boshlash</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Input Audio Preview */}
      {inputAudioUrl && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <span>Kiritilgan audio namunasi:</span>
            </span>
            <span className="text-gray-400 font-normal">Asl ovoz</span>
          </div>
          <audio src={inputAudioUrl} controls className="w-full h-9" />
        </div>
      )}

      {/* Conversion Alerts */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-medium">{errorMessage}</p>
            {!rvcStatus?.online && (
              <button
                type="button"
                onClick={onOpenRvcModal}
                className="text-xs text-red-700 font-semibold underline hover:text-red-800 cursor-pointer block mt-1"
              >
                RVC Serverni ulash bo'yicha ko'rsatma &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Convert Action Button */}
      <div>
        <button
          type="button"
          disabled={!inputAudioBase64 || isConverting}
          onClick={handleConvert}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          {isConverting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Shoyadbek ovoziga aylantirilmoqda (RVC)...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Shoyadbek ovoziga aylantirish (RVC)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
