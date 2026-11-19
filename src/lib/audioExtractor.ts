import {
  disposeFFmpeg,
  extractAudioPcmWithFFmpeg,
} from "@/lib/ffmpegClient";

const TARGET_SAMPLE_RATE = 16000;
const WEB_AUDIO_TIMEOUT_MS = 20_000;

interface ExtractAudioOptions {
  signal?: AbortSignal;
  onFallbackToFFmpeg?: () => void;
  onFfmpegDownloadProgress?: (ratio: number) => void;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Transcripción cancelada.");
  }
}

/**
 * Decodes and resamples a video file's audio track to 16kHz mono Float32Array PCM.
 * Tries the native Web Audio API first for instant decoding, and automatically
 * falls back to FFmpeg.wasm for MOV/QuickTime or codecs unsupported by AudioContext.
 */
export async function extractAudio16kMono(
  file: File,
  options: ExtractAudioOptions = {}
): Promise<Float32Array> {
  const { signal, onFallbackToFFmpeg, onFfmpegDownloadProgress } = options;
  throwIfAborted(signal);

  try {
    const pcm = await decodeWithWebAudio(file, signal);
    throwIfAborted(signal);
    if (pcm.length > 0) {
      return pcm;
    }
  } catch (err) {
    throwIfAborted(signal);
    if (err instanceof Error && err.message.includes("cancelada")) {
      throw err;
    }
    // Container/codec not decodable by browser AudioContext (common for some MOV files).
  }

  throwIfAborted(signal);
  onFallbackToFFmpeg?.();
  try {
    const pcm = await extractAudioPcmWithFFmpeg(file, onFfmpegDownloadProgress);
    throwIfAborted(signal);
    if (pcm.length === 0) {
      throw new Error(
        "No se detectó ninguna pista de audio en este video. Asegúrate de que el archivo tenga sonido."
      );
    }
    return pcm;
  } finally {
    // Release FFmpeg WASM heap immediately before Phase 1 AI allocates its model/tensors.
    disposeFFmpeg();
  }
}

async function decodeWithWebAudio(
  file: File,
  signal?: AbortSignal
): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) {
    throw new Error("AudioContext no disponible");
  }

  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);
  const audioCtx = new AudioCtx();

  try {
    const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error("Web Audio decode timeout"));
        }
      }, WEB_AUDIO_TIMEOUT_MS);

      const onAbort = () => {
        if (!done) {
          done = true;
          window.clearTimeout(timer);
          reject(new Error("Transcripción cancelada."));
        }
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      audioCtx
        .decodeAudioData(buffer)
        .then((res) => {
          if (!done) {
            done = true;
            window.clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve(res);
          }
        })
        .catch((err) => {
          if (!done) {
            done = true;
            window.clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            reject(err);
          }
        });
    });

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
