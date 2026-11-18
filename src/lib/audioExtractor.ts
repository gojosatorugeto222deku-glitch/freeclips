import { extractAudioPcmWithFFmpeg } from "@/lib/ffmpegClient";

const TARGET_SAMPLE_RATE = 16000;

/**
 * Decodes and resamples a video file's audio track to 16kHz mono Float32Array PCM.
 * Tries the native Web Audio API first for instant decoding, and automatically
 * falls back to FFmpeg.wasm for MOV/QuickTime or codecs unsupported by AudioContext.
 */
export async function extractAudio16kMono(
  file: File,
  onFallbackToFFmpeg?: () => void
): Promise<Float32Array> {
  try {
    const pcm = await decodeWithWebAudio(file);
    if (pcm.length > 0) {
      return pcm;
    }
  } catch {
    // Container/codec not decodable by browser AudioContext (common for some MOV files).
  }

  onFallbackToFFmpeg?.();
  const pcm = await extractAudioPcmWithFFmpeg(file);
  if (pcm.length === 0) {
    throw new Error(
      "No se detectó ninguna pista de audio en este video. Asegúrate de que el archivo tenga sonido."
    );
  }
  return pcm;
}

async function decodeWithWebAudio(file: File): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) {
    throw new Error("AudioContext no disponible");
  }

  const buffer = await file.arrayBuffer();
  const audioCtx = new AudioCtx();

  try {
    const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
    if (decoded.numberOfChannels === 0 || decoded.duration <= 0) {
      throw new Error("El video no contiene audio");
    }

    const frameCount = Math.max(
      1,
      Math.ceil(decoded.duration * TARGET_SAMPLE_RATE)
    );
    const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);

    const monoBuffer = offline.createBuffer(
      1,
      decoded.length,
      decoded.sampleRate
    );
    const monoData = monoBuffer.getChannelData(0);

    for (let ch = 0; ch < decoded.numberOfChannels; ch += 1) {
      const channelData = decoded.getChannelData(ch);
      for (let i = 0; i < decoded.length; i += 1) {
        monoData[i] += channelData[i] / decoded.numberOfChannels;
      }
    }

    const source = offline.createBufferSource();
    source.buffer = monoBuffer;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } finally {
    await audioCtx.close().catch(() => {});
  }
}
