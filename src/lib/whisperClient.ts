import { normalizeWhisperChunks, type RawWhisperChunk } from "@/lib/subtitles";
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
  signal?: AbortSignal;
  onDeviceDetected?: (device: "webgpu" | "wasm") => void;
  onStatus?: (stage: "loading-model" | "transcribing", message: string) => void;
  onModelProgress?: (progress: ModelProgressInfo) => void;
  onLiveText?: (text: string) => void;
}

export interface TranscriptionResult {
  text: string;
  words: WordToken[];
  device: "webgpu" | "wasm";
}

const WORKER_STARTUP_TIMEOUT_MS = 20_000;
const WORKER_INACTIVITY_TIMEOUT_MS = 95_000;

let sharedWorker: Worker | null = null;
let sharedWorkerReady = false;
let activeReject: ((err: Error) => void) | null = null;

function createWorker(): Worker {
  sharedWorkerReady = false;
  sharedWorker = new Worker(
    new URL("../workers/whisper.worker.ts", import.meta.url),
    { type: "module" }
  );
  return sharedWorker;
}

function getWorker(): Worker {
  if (!sharedWorker) {
    return createWorker();
  }
  return sharedWorker;
}

export function resetWhisperWorker(): void {
  if (sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
  sharedWorkerReady = false;
}

export function cancelTranscription(): void {
  const reject = activeReject;
  activeReject = null;
  resetWhisperWorker();
  if (reject) {
    reject(new Error("Transcripción cancelada."));
  }
}

/**
 * Instructs the transcription worker to dispose Transformers.js pipeline tensors,
 * then terminates the worker completely to guarantee RAM release before Phase 2 (FFmpeg).
 */
export async function disposeWhisperWorker(): Promise<void> {
  const worker = sharedWorker;
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

  if (sharedWorker === worker) {
    worker.terminate();
    sharedWorker = null;
    sharedWorkerReady = false;
  }
}

export function transcribeAudioInBrowser({
  audio,
  modelId,
  durationSec,
  signal,
  onDeviceDetected,
  onStatus,
  onModelProgress,
  onLiveText,
}: TranscribeOptions): Promise<TranscriptionResult> {
  if (signal?.aborted) {
    return Promise.reject(new Error("Transcripción cancelada."));
  }

  const worker = getWorker();
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
          true
        );
      }, WORKER_INACTIVITY_TIMEOUT_MS);
    };

    const cleanup = () => {
      clearTimers();
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.removeEventListener("messageerror", handleMessageError);
      signal?.removeEventListener("abort", handleAbort);
      if (activeReject === failFromCancel) {
        activeReject = null;
      }
    };

    const succeed = (result: TranscriptionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const fail = (err: Error, shouldResetWorker = false) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (shouldResetWorker) {
        resetWhisperWorker();
      }
      reject(new Error(formatTranscriptionError(err)));
    };

    const failFromCancel = (err: Error) => {
      fail(err, false);
    };
    activeReject = failFromCancel;

    const handleAbort = () => {
      fail(new Error("Transcripción cancelada."), true);
    };

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "ready") {
        sharedWorkerReady = true;
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
        case "result": {
          const rawChunks = (msg.chunks ?? []) as RawWhisperChunk[];
          const words = normalizeWhisperChunks(rawChunks, durationSec);
          succeed({
            text: msg.text ?? "",
            words,
            device: msg.device ?? "wasm",
          });
          break;
        }
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
        true
      );
    };

    const handleMessageError = () => {
      fail(
        new Error("Error de comunicación con el motor de transcripción."),
        true
      );
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.addEventListener("messageerror", handleMessageError);
    signal?.addEventListener("abort", handleAbort, { once: true });

    if (!sharedWorkerReady) {
      startupTimer = window.setTimeout(() => {
        fail(
          new Error(
            "El motor de transcripción tardó demasiado en iniciar (timeout). Recarga o inténtalo de nuevo."
          ),
          true
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
      },
      [copyForTransfer.buffer]
    );
  });
}
