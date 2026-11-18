import { normalizeWhisperChunks, type RawWhisperChunk } from "@/lib/subtitles";
import type {
  ModelProgressInfo,
  WhisperModelId,
  WordToken,
} from "@/types/subtitle";

interface TranscribeOptions {
  audio: Float32Array;
  modelId: WhisperModelId;
  durationSec?: number;
  onDeviceDetected?: (device: "webgpu" | "wasm") => void;
  onStatus?: (stage: "loading-model" | "transcribing", message: string) => void;
  onModelProgress?: (progress: ModelProgressInfo) => void;
}

export interface TranscriptionResult {
  text: string;
  words: WordToken[];
  device: "webgpu" | "wasm";
}

let sharedWorker: Worker | null = null;

function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL("../workers/whisper.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return sharedWorker;
}

export function resetWhisperWorker(): void {
  if (sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
}

/**
 * Instructs the Whisper worker to dispose Transformers.js pipeline tensors,
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
  }
}

export function transcribeAudioInBrowser({
  audio,
  modelId,
  durationSec,
  onDeviceDetected,
  onStatus,
  onModelProgress,
}: TranscribeOptions): Promise<TranscriptionResult> {
  const worker = getWorker();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.requestId !== requestId) return;

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
        case "result": {
          cleanup();
          const rawChunks = (msg.chunks ?? []) as RawWhisperChunk[];
          const words = normalizeWhisperChunks(rawChunks, durationSec);
          resolve({
            text: msg.text ?? "",
            words,
            device: msg.device ?? "wasm",
          });
          break;
        }
        case "error":
          cleanup();
          reject(new Error(msg.error || "Error durante la transcripción con Whisper."));
          break;
      }
    };

    const handleError = (err: ErrorEvent) => {
      cleanup();
      resetWhisperWorker();
      reject(
        new Error(
          err.message || "El worker de transcripción falló inesperadamente."
        )
      );
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

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
