import {
  expandChunksToWordTokens,
  splitAudioAtSilenceValleys,
  type AudioSegment,
} from "@/lib/audioSlicer";
import type { RawWhisperChunk } from "@/lib/subtitles";
import { formatTranscriptionError } from "@/lib/transcriptionProgress";
import type {
  ModelProgressInfo,
  WhisperModelId,
  WordToken,
} from "@/types/subtitle";

interface TranscribeOptions {
  audio: Float32Array;
  modelId: WhisperModelId;
  durationSec?: number;
  isMobile?: boolean;
  signal?: AbortSignal;
  onDeviceDetected?: (device: "webgpu" | "wasm") => void;
  onStatus?: (stage: "loading-model" | "transcribing", message: string) => void;
  onModelProgress?: (progress: ModelProgressInfo) => void;
  onLiveText?: (text: string) => void;
  onPartialWords?: (
    words: WordToken[],
    completedSegments: number,
    totalSegments: number
  ) => void;
}

export interface TranscriptionResult {
  text: string;
  words: WordToken[];
  device: "webgpu" | "wasm";
}

const WORKER_STARTUP_TIMEOUT_MS = 20_000;
const WORKER_INACTIVITY_TIMEOUT_MS = 95_000;

let primaryWorker: Worker | null = null;
let primaryWorkerReady = false;
let warmedModelId: WhisperModelId | null = null;
let inflightWarmup: {
  modelId: WhisperModelId;
  promise: Promise<void>;
} | null = null;

const helperWorkers = new Set<Worker>();
const activeCancelHandlers = new Set<() => void>();

function spawnWorker(): Worker {
  return new Worker(
    new URL("../workers/whisper.worker.ts", import.meta.url),
    { type: "module" }
  );
}

function getPrimaryWorker(): Worker {
  if (!primaryWorker) {
    primaryWorkerReady = false;
    warmedModelId = null;
    primaryWorker = spawnWorker();
    primaryWorker.addEventListener("message", (ev: MessageEvent) => {
      if (ev.data?.type === "ready") {
        primaryWorkerReady = true;
      }
    });
  }
  return primaryWorker;
}

function terminateHelperWorkers(): void {
  for (const w of helperWorkers) {
    try {
      w.terminate();
    } catch {}
  }
  helperWorkers.clear();
}

export function isTranscriptionEngineWarm(modelId: WhisperModelId): boolean {
  return Boolean(primaryWorker && warmedModelId === modelId);
}

export function resetWhisperWorker(): void {
  terminateHelperWorkers();
  if (primaryWorker) {
    primaryWorker.terminate();
    primaryWorker = null;
  }
  primaryWorkerReady = false;
  warmedModelId = null;
  inflightWarmup = null;
}

export function cancelTranscription(): void {
  const handlers = Array.from(activeCancelHandlers);
  activeCancelHandlers.clear();
  resetWhisperWorker();
  for (const fn of handlers) {
    fn();
  }
}

/**
 * Pre-warms the primary AI worker & ONNX sessions in the background as soon as
 * a video is loaded so clicking "Transcribir" starts inference immediately.
 */
export function warmupTranscriptionEngine(
  modelId: WhisperModelId,
  onProgress?: (progress: ModelProgressInfo) => void
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (primaryWorker && warmedModelId === modelId) {
    return Promise.resolve();
  }
  if (inflightWarmup && inflightWarmup.modelId === modelId) {
    return inflightWarmup.promise;
  }

  const worker = getPrimaryWorker();
  const requestId = `warm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const promise = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", onMsg);
      worker.removeEventListener("error", onErr);
    };
    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data;
      if (!msg || msg.requestId !== requestId) return;
      if (msg.type === "progress") {
        onProgress?.(msg.progress);
      } else if (msg.type === "warmed") {
        warmedModelId = modelId;
        cleanup();
        resolve();
      } else if (msg.type === "warmup-error") {
        cleanup();
        reject(new Error(msg.error || "Warmup failed"));
      }
    };
    const onErr = (err: ErrorEvent) => {
      cleanup();
      resetWhisperWorker();
      reject(new Error(err.message || "Worker warmup error"));
    };
    worker.addEventListener("message", onMsg);
    worker.addEventListener("error", onErr);
    worker.postMessage({ type: "warmup", requestId, modelId });
  }).finally(() => {
    if (inflightWarmup?.promise === promise) {
      inflightWarmup = null;
    }
  });

  inflightWarmup = { modelId, promise };
  return promise;
}

/**
 * Instructs the transcription worker to dispose Transformers.js pipeline tensors,
 * then terminates all workers completely to guarantee RAM release before Phase 2 (FFmpeg).
 */
export async function disposeWhisperWorker(): Promise<void> {
  terminateHelperWorkers();
  const worker = primaryWorker;
  warmedModelId = null;
  inflightWarmup = null;
  if (!worker) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      worker.removeEventListener("message", onDisposed);
      window.clearTimeout(timeoutId);
      resolve();
    };
    const onDisposed = (event: MessageEvent) => {
      if (event.data?.type === "disposed") {
        finish();
      }
    };
    const timeoutId = window.setTimeout(finish, 300);
    worker.addEventListener("message", onDisposed);
    try {
      worker.postMessage({ type: "dispose" });
    } catch {
      finish();
    }
  });

  if (primaryWorker === worker) {
    worker.terminate();
    primaryWorker = null;
    primaryWorkerReady = false;
  }
}

interface RawSegmentResponse {
  text: string;
  chunks: RawWhisperChunk[];
  device: "webgpu" | "wasm";
}

function runWorkerTranscribe(params: {
  worker: Worker;
  isPrimary: boolean;
  audio: Float32Array;
  modelId: WhisperModelId;
  fastTimestamps: boolean;
  keepAlive: boolean;
  signal?: AbortSignal;
  onDeviceDetected?: (device: "webgpu" | "wasm") => void;
  onStatus?: (stage: "loading-model" | "transcribing", message: string) => void;
  onModelProgress?: (progress: ModelProgressInfo) => void;
  onLiveText?: (text: string) => void;
}): Promise<RawSegmentResponse> {
  const {
    worker,
    isPrimary,
    audio,
    modelId,
    fastTimestamps,
    keepAlive,
    signal,
    onDeviceDetected,
    onStatus,
    onModelProgress,
    onLiveText,
  } = params;

  if (signal?.aborted) {
    return Promise.reject(new Error("Transcripción cancelada."));
  }

  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    let startupTimer: number | null = null;
    let inactivityTimer: number | null = null;

    const clearTimers = () => {
      if (startupTimer !== null) {
        window.clearTimeout(startupTimer);
        startupTimer = null;
      }
      if (inactivityTimer !== null) {
        window.clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    };

    const resetInactivityWatchdog = () => {
      if (inactivityTimer !== null) {
        window.clearTimeout(inactivityTimer);
      }
      inactivityTimer = window.setTimeout(() => {
        fail(
          new Error(
            "La transcripción tardó demasiado sin responder (timeout). Prueba con el modo Ligero (~39 MB)."
          ),
          isPrimary
        );
      }, WORKER_INACTIVITY_TIMEOUT_MS);
    };

    const handleCancel = () => {
      fail(new Error("Transcripción cancelada."), false);
    };

    const cleanup = () => {
      clearTimers();
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.removeEventListener("messageerror", handleMessageError);
      signal?.removeEventListener("abort", handleAbort);
      activeCancelHandlers.delete(handleCancel);
    };

    const succeed = (result: RawSegmentResponse) => {
      if (settled) return;
      settled = true;
      if (isPrimary && keepAlive) {
        warmedModelId = modelId;
      }
      cleanup();
      resolve(result);
    };

    const fail = (err: Error, shouldResetPrimary: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (shouldResetPrimary) {
        resetWhisperWorker();
      }
      reject(new Error(formatTranscriptionError(err)));
    };

    const handleAbort = () => {
      fail(new Error("Transcripción cancelada."), isPrimary);
    };

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "ready") {
        if (isPrimary) primaryWorkerReady = true;
        if (startupTimer !== null) {
          window.clearTimeout(startupTimer);
          startupTimer = null;
        }
        resetInactivityWatchdog();
        return;
      }

      if (msg.requestId !== requestId) return;

      if (startupTimer !== null) {
        window.clearTimeout(startupTimer);
        startupTimer = null;
      }
      resetInactivityWatchdog();

      switch (msg.type) {
        case "device":
          onDeviceDetected?.(msg.device);
          break;
        case "status":
          onStatus?.(msg.stage, msg.message);
          break;
        case "progress":
          onModelProgress?.(msg.progress);
          break;
        case "partial":
          if (typeof msg.text === "string" && msg.text.trim()) {
            onLiveText?.(msg.text.trim());
          }
          break;
        case "result":
          succeed({
            text: msg.text ?? "",
            chunks: (msg.chunks ?? []) as RawWhisperChunk[],
            device: msg.device ?? "wasm",
          });
          break;
        case "error":
          fail(
            new Error(msg.error || "Error durante la transcripción automática."),
            false
          );
          break;
      }
    };

    const handleError = (err: ErrorEvent) => {
      fail(
        new Error(
          err.message || "El motor de transcripción se detuvo inesperadamente."
        ),
        isPrimary
      );
    };

    const handleMessageError = () => {
      fail(
        new Error("Error de comunicación con el motor de transcripción."),
        isPrimary
      );
    };

    activeCancelHandlers.add(handleCancel);
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.addEventListener("messageerror", handleMessageError);
    signal?.addEventListener("abort", handleAbort, { once: true });

    if (!isPrimary || !primaryWorkerReady) {
      startupTimer = window.setTimeout(() => {
        fail(
          new Error(
            "El motor de transcripción tardó demasiado en iniciar (timeout). Recarga o inténtalo de nuevo."
          ),
          isPrimary
        );
      }, WORKER_STARTUP_TIMEOUT_MS);
    }
    resetInactivityWatchdog();

    const copyForTransfer = new Float32Array(audio);
    worker.postMessage(
      {
        type: "transcribe",
        requestId,
        modelId,
        audio: copyForTransfer,
        fastTimestamps,
        keepAlive,
      },
      [copyForTransfer.buffer]
    );
  });
}

export async function transcribeAudioInBrowser({
  audio,
  modelId,
  durationSec,
  isMobile = false,
  signal,
  onDeviceDetected,
  onStatus,
  onModelProgress,
  onLiveText,
  onPartialWords,
}: TranscribeOptions): Promise<TranscriptionResult> {
  if (signal?.aborted) {
    throw new Error("Transcripción cancelada.");
  }

  // Fast segment-level timestamps + PCM energy word alignment cuts inference time by ~32%.
  // Keep full DTW word timestamps for the high-accuracy Preciso model.
  const fastTimestamps =
    modelId !== "onnx-community/whisper-small_timestamped";

  const segments = splitAudioAtSilenceValleys(audio, 16000, 22, 26);
  const primary = getPrimaryWorker();

  // Single-segment fast path (clips <= 26s): zero chunking/merge overhead!
  if (segments.length <= 1) {
    const res = await runWorkerTranscribe({
      worker: primary,
      isPrimary: true,
      audio,
      modelId,
      fastTimestamps,
      keepAlive: !isMobile,
      signal,
      onDeviceDetected,
      onStatus,
      onModelProgress,
      onLiveText,
    });

    const words = expandChunksToWordTokens(res.chunks, {
      pcm: audio,
      totalDuration: durationSec,
      offsetSec: 0,
    });
    return { text: res.text, words, device: res.device };
  }

  // Multi-segment clips (> 26s):
  // First guarantee model weights are cached in Cache API via the primary worker
  // so any desktop helper worker initializes cleanly from cache without duplicate network fetches.
  if (!isTranscriptionEngineWarm(modelId)) {
    onStatus?.(
      "loading-model",
      "Preparando motor de voz IA (solo la primera vez)..."
    );
    await warmupTranscriptionEngine(modelId, onModelProgress);
  }
  if (signal?.aborted) {
    throw new Error("Transcripción cancelada.");
  }

  const hwCores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  const useParallelDesktop =
    !isMobile &&
    hwCores >= 4 &&
    segments.length >= 2 &&
    modelId !== "onnx-community/whisper-small_timestamped";

  const segmentWords: Array<WordToken[] | null> = new Array(
    segments.length
  ).fill(null);
  const segmentTexts: string[] = new Array(segments.length).fill("");
  let completedCount = 0;

  const emitProgressWords = () => {
    const ordered: WordToken[] = [];
    for (let i = 0; i < segmentWords.length; i += 1) {
      const list = segmentWords[i];
      if (list) ordered.push(...list);
    }
    onPartialWords?.(ordered, completedCount, segments.length);
  };

  let helper: Worker | null = null;
  if (useParallelDesktop) {
    helper = spawnWorker();
    helperWorkers.add(helper);
  }

  const totalSegments = segments.length;
  onStatus?.(
    "transcribing",
    useParallelDesktop
      ? `Transcribiendo ${totalSegments} segmentos en paralelo (2× velocidad)...`
      : `Transcribiendo segmento 1 de ${totalSegments}...`
  );

  let nextIdx = 0;
  const runQueueOnWorker = async (worker: Worker, isPrimary: boolean) => {
    while (nextIdx < segments.length) {
      if (signal?.aborted) {
        throw new Error("Transcripción cancelada.");
      }
      const seg: AudioSegment = segments[nextIdx];
      nextIdx += 1;

      const res = await runWorkerTranscribe({
        worker,
        isPrimary,
        audio: seg.pcm,
        modelId,
        fastTimestamps,
        keepAlive: isPrimary ? !isMobile : nextIdx < segments.length,
        signal,
        onDeviceDetected: isPrimary ? onDeviceDetected : undefined,
        onLiveText: seg.index === 0 ? onLiveText : undefined,
      });

      const words = expandChunksToWordTokens(res.chunks, {
        pcm: seg.pcm,
        totalDuration: durationSec,
        offsetSec: seg.startSec,
      });

      segmentWords[seg.index] = words;
      segmentTexts[seg.index] = res.text.trim();
      completedCount += 1;

      onStatus?.(
        "transcribing",
        completedCount < totalSegments
          ? `Transcribiendo voz... (${completedCount}/${totalSegments} segmentos listos)`
          : "Finalizando sincronización de subtítulos..."
      );
      emitProgressWords();
    }
  };

  try {
    if (helper) {
      await Promise.all([
        runQueueOnWorker(primary, true),
        runQueueOnWorker(helper, false),
      ]);
    } else {
      await runQueueOnWorker(primary, true);
    }

    const allWords: WordToken[] = [];
    for (const list of segmentWords) {
      if (list) allWords.push(...list);
    }

    return {
      text: segmentTexts.filter(Boolean).join(" ").trim(),
      words: allWords,
      device: "wasm",
    };
  } finally {
    if (helper) {
      helperWorkers.delete(helper);
      try {
        helper.terminate();
      } catch {}
    }
    if (isMobile) {
      await disposeWhisperWorker();
    }
  }
}
