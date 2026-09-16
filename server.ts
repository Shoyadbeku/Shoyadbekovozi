import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory audio cache to support streaming with HTTP Range requests
interface CachedAudio {
  buffer: Buffer;
  createdAt: number;
  label?: string;
}
const audioCache = new Map<string, CachedAudio>();

function pruneAudioCache() {
  if (audioCache.size > 50) {
    const keys = Array.from(audioCache.keys());
    for (let i = 0; i < keys.length - 25; i++) {
      audioCache.delete(keys[i]);
    }
  }
}

// Helper to forward audio buffer to RVC conversion server
async function convertWithRvc(buffer: Buffer, rvcUrl: string): Promise<Buffer> {
  const cleanUrl = rvcUrl.replace(/\/+$/, '');
  const formData = new FormData();
  const blob = new Blob([buffer], { type: 'audio/wav' });
  formData.append('file', blob, 'input.wav');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for RVC inference

  try {
    const res = await fetch(`${cleanUrl}/convert`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`RVC server xatosi (${res.status}): ${errText || res.statusText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 audio conversion
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Mening Ovozim' });
  });

  // Config route
  app.get('/api/config', (req, res) => {
    const hasAishaKey = Boolean(process.env.AISHA_API_KEY && process.env.AISHA_API_KEY.trim().length > 0);
    const hasIndexFile = fs.existsSync(path.join(process.cwd(), 'shoyadbek_ovoz.index'));
    const defaultRvcUrl = process.env.RVC_SERVER_URL?.trim() || 'http://localhost:5005';

    res.json({
      hasAishaKey,
      model: 'Gulnoza (Aisha AI)',
      rvcModel: 'shoyadbek_ovoz_40e_160s.pth',
      rvcIndex: 'shoyadbek_ovoz.index',
      hasIndexFile,
      rvcServerUrl: defaultRvcUrl,
      driveFileId: '1JxU5sGAMaLVfdj0oWA3O-BORu0q80goO',
      supportedMoods: ['Neutral', 'Cheerful', 'Happy', 'Sad'],
    });
  });

  // Check RVC Server Health / Status
  app.get('/api/rvc/status', async (req, res) => {
    const queryUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const targetUrl = queryUrl || process.env.RVC_SERVER_URL?.trim() || 'http://localhost:5005';
    const cleanUrl = targetUrl.replace(/\/+$/, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const resp = await fetch(`${cleanUrl}/health`, { signal: controller.signal });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        // Ensure it is indeed our RVC service and not a different service
        const isRvc = data && (data.service?.includes('RVC') || data.model?.includes('shoyadbek'));
        if (isRvc) {
          return res.json({ online: true, url: cleanUrl, info: data });
        }
      }
      return res.json({
        online: false,
        url: cleanUrl,
        error: 'Ushbu manzilda RVC serveri topilmadi.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ulanish xatosi';
      return res.json({
        online: false,
        url: cleanUrl,
        error: `RVC serverga ulanib bo'lmadi (${msg}).`,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  // Convert audio using RVC (Shoyadbek Ovozi)
  app.post('/api/rvc/convert', async (req, res) => {
    const { audioId, audioBase64, rvcUrl } = req.body || {};
    const targetRvcUrl = (typeof rvcUrl === 'string' && rvcUrl.trim())
      ? rvcUrl.trim()
      : (process.env.RVC_SERVER_URL?.trim() || 'http://localhost:5005');

    let inputBuffer: Buffer | null = null;

    if (audioId && audioCache.has(audioId)) {
      inputBuffer = audioCache.get(audioId)!.buffer;
    } else if (audioBase64 && typeof audioBase64 === 'string') {
      const base64Data = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
      inputBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!inputBuffer || inputBuffer.length === 0) {
      return res.status(400).json({
        error: 'O\'zgartirish uchun audio topilmadi. Avval audio yarating yoki yuklang.',
      });
    }

    try {
      const convertedBuffer = await convertWithRvc(inputBuffer, targetRvcUrl);

      const id = crypto.randomUUID();
      audioCache.set(id, {
        buffer: convertedBuffer,
        createdAt: Date.now(),
        label: 'Shoyadbek Ovozi (RVC)',
      });
      pruneAudioCache();

      const base64Output = `data:audio/wav;base64,${convertedBuffer.toString('base64')}`;

      return res.json({
        success: true,
        id,
        audioUrl: `/api/audio/${id}.wav`,
        audioBase64: base64Output,
        sizeBytes: convertedBuffer.length,
        modelUsed: 'shoyadbek_ovoz_40e_160s.pth',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Noma\'lum xatolik';
      return res.status(502).json({
        error: `RVC orqali ovoz aylantirishda xatolik: ${message}`,
      });
    }
  });

  // Serve cached audio with HTTP Range support (critical for Safari / iOS WebKit)
  app.get('/api/audio/:id.wav', (req, res) => {
    const cached = audioCache.get(req.params.id);
    if (!cached) {
      return res.status(404).send('Audio topilmadi yoki muddati o\'tgan.');
    }

    const { buffer } = cached;
    const total = buffer.length;
    const range = req.headers.range;

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline; filename="ovoz.wav"');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (isNaN(start) || isNaN(end) || start >= total || end >= total || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', chunkSize);
      return res.send(buffer.subarray(start, end + 1));
    } else {
      res.setHeader('Content-Length', total);
      return res.send(buffer);
    }
  });

  // Text-To-Speech endpoint via Aisha AI with optional RVC piping
  app.post('/api/tts', async (req, res) => {
    const { text, mood = 'Neutral', speed = 1.0, applyRvc = false, rvcUrl } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Iltimos, matn kiriting.' });
    }

    const cleanText = text.trim();
    if (cleanText.length > 1000) {
      return res.status(400).json({
        error: 'Matn uzunligi 1000 ta belgidan oshmasligi kerak (hozirda: ' + cleanText.length + ' ta belgi).',
      });
    }

    const aishaApiKey = process.env.AISHA_API_KEY?.trim();
    if (!aishaApiKey) {
      return res.status(400).json({
        error: "AISHA_API_KEY sozlanmagan. Iltimos, API kalitingizni sozlang.",
        code: 'MISSING_API_KEY',
      });
    }

    try {
      // Aisha AI TTS endpoint requires multipart/form-data with X-Api-Key
      const formData = new FormData();
      formData.append('transcript', cleanText);
      formData.append('language', 'uz');
      formData.append('model', 'Gulnoza');
      formData.append('mood', mood);
      formData.append('speed', String(speed));

      const aishaRes = await fetch('https://back.aisha.group/api/v1/tts/post/', {
        method: 'POST',
        headers: {
          'X-Api-Key': aishaApiKey,
        },
        body: formData,
      });

      if (!aishaRes.ok) {
        const errorText = await aishaRes.text();
        return res.status(aishaRes.status).json({
          error: `Aisha AI xatosi (${aishaRes.status}): ${errorText || aishaRes.statusText}`,
        });
      }

      const aishaData = (await aishaRes.json()) as { audio_path?: string };
      if (!aishaData.audio_path) {
        return res.status(502).json({
          error: "Aisha AI ovoz yaratdi, lekin audio manzilini qaytarmadi.",
        });
      }

      // Download the generated WAV from CDN
      const cdnRes = await fetch(aishaData.audio_path);
      if (!cdnRes.ok) {
        return res.status(502).json({
          error: `Aisha CDN'dan audio yuklab olinmadi (${cdnRes.status})`,
        });
      }

      const arrayBuffer = await cdnRes.arrayBuffer();
      let finalBuffer = Buffer.from(arrayBuffer);
      let rvcApplied = false;

      const aishaAudioId = crypto.randomUUID();
      audioCache.set(aishaAudioId, {
        buffer: finalBuffer,
        createdAt: Date.now(),
        label: 'Aisha AI (Gulnoza)',
      });

      // Optionally apply RVC if requested
      if (applyRvc) {
        const targetRvcUrl = (typeof rvcUrl === 'string' && rvcUrl.trim())
          ? rvcUrl.trim()
          : (process.env.RVC_SERVER_URL?.trim() || 'http://localhost:8000');

        try {
          finalBuffer = await convertWithRvc(finalBuffer, targetRvcUrl);
          rvcApplied = true;
        } catch (rvcErr: unknown) {
          // Keep Aisha voice and inform user
          console.warn('RVC conversion failed, using original Aisha voice:', rvcErr);
        }
      }

      const finalId = rvcApplied ? crypto.randomUUID() : aishaAudioId;
      if (rvcApplied) {
        audioCache.set(finalId, {
          buffer: finalBuffer,
          createdAt: Date.now(),
          label: 'Shoyadbek Ovozi (RVC)',
        });
      }
      pruneAudioCache();

      const audioBase64 = `data:audio/wav;base64,${finalBuffer.toString('base64')}`;

      return res.json({
        success: true,
        id: finalId,
        audioUrl: `/api/audio/${finalId}.wav`,
        audioBase64,
        cdnUrl: aishaData.audio_path,
        sizeBytes: finalBuffer.length,
        rvcApplied,
        aishaAudioId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Noma\'lum xatolik';
      return res.status(502).json({
        error: `Aisha AI serveriga ulanishda xatolik: ${message}`,
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
