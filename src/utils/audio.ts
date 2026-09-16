// Helper to encode PCM audio buffer to standard WAV format Blob
export function bufferToWaveBlob(audioBuffer: AudioBuffer): Blob {
  const numOfChan = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels: Float32Array[] = [];
  let sampleRate = audioBuffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // FMT sub-chunk
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // format size (16 for PCM)
  setUint16(1); // format 1: PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16); // 16-bit depth

  // data sub-chunk
  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  while (offset < audioBuffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      const s = Math.max(-1, Math.min(1, channels[i][offset]));
      const pcm16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(pos, pcm16 | 0, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Generate realistic synthetic vocal sound for preview/demo when no external API key is active
export async function generateSyntheticSpeech(
  text: string,
  mood: string,
  speed: number
): Promise<{ blob: Blob; url: string; dataUrl: string }> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  // Words count calculation
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);
  const durationPerWord = (0.35 / speed);
  const totalDuration = Math.max(1.2, wordCount * durationPerWord);

  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * totalDuration);
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  // Pitch base based on mood
  let baseFreq = 160; // male voice pitch
  if (mood === 'Happy' || mood === 'Cheerful') baseFreq = 185;
  if (mood === 'Sad') baseFreq = 140;

  let currentPhase = 0;

  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const wordIndex = Math.floor(t / durationPerWord);
    const wordProgress = (t % durationPerWord) / durationPerWord;

    // Speech envelope per word
    const attack = Math.min(1, wordProgress / 0.1);
    const release = Math.max(0, 1 - Math.pow(wordProgress, 4));
    const envelope = attack * release;

    // Formant simulation for natural voice timber
    const pitchMod = Math.sin(2 * Math.PI * 3.5 * t) * 6;
    const freq = (baseFreq + pitchMod) * (1 + (wordIndex % 3) * 0.05);

    currentPhase += (2 * Math.PI * freq) / sampleRate;

    // Vocal tract harmonic overtones
    const f1 = Math.sin(currentPhase);
    const f2 = 0.5 * Math.sin(currentPhase * 2);
    const f3 = 0.25 * Math.sin(currentPhase * 3);
    const f4 = 0.12 * Math.sin(currentPhase * 4);
    const noise = (Math.random() * 2 - 1) * 0.04;

    data[i] = (f1 + f2 + f3 + f4 + noise) * envelope * 0.45;
  }

  await ctx.close();
  const blob = bufferToWaveBlob(buffer);
  const url = URL.createObjectURL(blob);
  const dataUrl = await blobToDataUrl(blob);
  return { blob, url, dataUrl };
}
