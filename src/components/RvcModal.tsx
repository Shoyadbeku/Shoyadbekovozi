import React, { useState } from 'react';
import {
  X,
  Server,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { RvcStatus, ServerConfig } from '../types';

interface RvcModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ServerConfig | null;
  rvcStatus: RvcStatus | null;
  rvcUrl: string;
  onUpdateRvcUrl: (url: string) => void;
  onCheckStatus: () => void;
  isCheckingStatus: boolean;
}

export const RvcModal: React.FC<RvcModalProps> = ({
  isOpen,
  onClose,
  config,
  rvcStatus,
  rvcUrl,
  onUpdateRvcUrl,
  onCheckStatus,
  isCheckingStatus,
}) => {
  const [copiedColab, setCopiedColab] = useState(false);
  const [copiedLocal, setCopiedLocal] = useState(false);
  const [inputUrl, setInputUrl] = useState(rvcUrl);

  if (!isOpen) return null;

  const colabScript = `# 1. Kutubxonalarni o'rnatish
!pip install -q rvc-python gdown fastapi uvicorn pyngrok python-multipart

# 2. Model va Indexni yuklab olish
import gdown, os
if not os.path.exists("shoyadbek_ovoz_40e_160s.pth"):
    gdown.download(id="1JxU5sGAMaLVfdj0oWA3O-BORu0q80goO", output="shoyadbek_ovoz_40e_160s.pth", quiet=False)

# 3. Server faylini yuklab olish yoki ishga tushirish
# rvc_server.py faylini ishga tushiring va ngrok orqali URL oling
from pyngrok import ngrok
# ngrok.set_auth_token("SIZNING_NGROK_TOKENINGIZ")
public_url = ngrok.connect(5005)
print(f"RVC Server URL: {public_url}")
!python rvc_server.py`;

  const localScript = `# Lokal muhitda ishga tushirish (Python 3.10+):
pip install rvc-python gdown fastapi uvicorn python-multipart
python rvc_server.py`;

  const handleCopy = (text: string, type: 'colab' | 'local') => {
    navigator.clipboard.writeText(text);
    if (type === 'colab') {
      setCopiedColab(true);
      setTimeout(() => setCopiedColab(false), 2000);
    } else {
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 2000);
    }
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateRvcUrl(inputUrl.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-100/80 text-red-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Shoyadbek Ovozi (RVC) Serveri
              </h3>
              <p className="text-xs text-gray-500">
                Ovoz klonlash modeli: <span className="font-mono font-medium">shoyadbek_ovoz_40e_160s.pth</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            rvcStatus?.online
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-3">
              {rvcStatus?.online ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {rvcStatus?.online
                    ? 'RVC Server ulandi va faol!'
                    : 'RVC Server hozirda o\'chiq yoki ulanmagan'}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  Joriy manzil: <span className="font-mono font-medium">{rvcUrl || 'Mavjud emas'}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckStatus}
              disabled={isCheckingStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-300 hover:bg-gray-50 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
              <span>Tekshirish</span>
            </button>
          </div>

          {/* URL Configuration Form */}
          <form onSubmit={handleSaveUrl} className="space-y-2">
            <label htmlFor="rvc-url-input" className="block text-sm font-semibold text-gray-800">
              RVC Server Manzili (URL)
            </label>
            <div className="flex gap-2">
              <input
                id="rvc-url-input"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="masalan: http://localhost:5005 yoki https://xyz.ngrok-free.app"
                className="flex-1 px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Saqlash
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Lokal kompyuteringizda yoki Google Colab / Ngrok orqali olingan URL manzilini kiriting.
            </p>
          </form>

          {/* Model info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                <Cpu className="w-4 h-4 text-red-600" />
                <span>Model Fayli:</span>
              </div>
              <p className="font-mono text-gray-900">shoyadbek_ovoz_40e_160s.pth</p>
              <p className="text-gray-500">Hajmi: ~55 MB (Drive ID: 1JxU5s...)</p>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                <Terminal className="w-4 h-4 text-emerald-600" />
                <span>Faiss Index:</span>
              </div>
              <p className="font-mono text-gray-900">shoyadbek_ovoz.index</p>
              <p className="text-gray-500">
                {config?.hasIndexFile ? '✓ Loyihada mavjud (4.3 MB)' : 'Topilmadi'}
              </p>
            </div>
          </div>

          {/* Colab / Local Setup Guide */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center justify-between">
              <span>Serverni ishga tushirish qo'llanmasi</span>
              <a
                href="https://colab.research.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 font-medium"
              >
                Google Colab <ExternalLink className="w-3 h-3" />
              </a>
            </h4>

            {/* Option A: Google Colab */}
            <div className="bg-gray-900 text-gray-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-300 font-semibold border-b border-gray-800 pb-2">
                <span>1-variant: Google Colab (Bepul GPU T4)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(colabScript, 'colab')}
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedColab ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedColab ? 'Nusxalandi' : 'Nusxa olish'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono overflow-x-auto text-gray-200 leading-relaxed max-h-32">
                {colabScript}
              </pre>
            </div>

            {/* Option B: Local */}
            <div className="bg-gray-900 text-gray-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-300 font-semibold border-b border-gray-800 pb-2">
                <span>2-variant: O'z kompyuteringizda (Lokal)</span>
                <button
                  type="button"
                  onClick={() => handleCopy(localScript, 'local')}
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedLocal ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedLocal ? 'Nusxalandi' : 'Nusxa olish'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono overflow-x-auto text-gray-200 leading-relaxed">
                {localScript}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
