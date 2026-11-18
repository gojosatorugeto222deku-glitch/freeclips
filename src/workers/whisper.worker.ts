import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import type { ModelProgressInfo, WhisperModelId } from "@/types/subtitle";

env.allowLocalModels = false;
env.useBrowserCache = true;

interface TranscribeRequestMessage {
  type: "transcribe";
  requestId: string;
  modelId: WhisperModelId;
  audio: Float32Array;
}

type ExecutionDevice = "webgpu" | "wasm";

let cachedModelId: WhisperModelId | null = null;
let cachedDevice: ExecutionDevice | null = null;
let cachedPipeline: AutomaticSpeechRecognitionPipeline | null = null;

async function detectDevice(): Promise<ExecutionDevice> {
  try {
    const nav = self.navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    if (nav?.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    // WebGPU unavailable inside this browser/worker context.
  }
  return "wasm";
}

function getDtypeForDevice(device: ExecutionDevice) {
  if (device === "webgpu") {
    return {
      encoder_model: "fp32" as const,
      decoder_model_merged: "q4" as const,
    };
  }
  return {
    encoder_model: "q8" as const,
    decoder_model_merged: "q8" as const,
  };
}

async function getOrCreatePipeline(
  modelId: WhisperModelId,
  device: ExecutionDevice,
  requestId: string
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (
    cachedPipeline &&
    cachedModelId === modelId &&
    cachedDevice === device
  ) {
    return cachedPipeline;
  }

  if (cachedPipeline && typeof cachedPipeline.dispose === "function") {
    await cachedPipeline.dispose().catch(() => {});
    cachedPipeline = null;
  }

  self.postMessage({
    type: "status",
    requestId,
    stage: "loading-model",
    message: "Preparando modelo de voz IA (solo la primera vez)...",
  });

  const asr = await pipeline("automatic-speech-recognition", modelId, {
    device,
    dtype: getDtypeForDevice(device),
    progress_callback: (info: {
      status?: string;
      file?: string;
      progress?: number;
      loaded?: number;
      total?: number;
    }) => {
      const progressPayload: ModelProgressInfo = {
        file: info.file ?? "",
        progress: typeof info.progress === "number" ? info.progress : 0,
        loaded: info.loaded,
        total: info.total,
        status: info.status ?? "progress",
      };
      self.postMessage({
        type: "progress",
        requestId,
        progress: progressPayload,
      });
    },
  });

  cachedPipeline = asr;
  cachedModelId = modelId;
  cachedDevice = device;
  return asr;
}

async function runTranscription(
  modelId: WhisperModelId,
  audio: Float32Array,
  device: ExecutionDevice,
  requestId: string
) {
  const transcriber = await getOrCreatePipeline(modelId, device, requestId);

  self.postMessage({
    type: "status",
    requestId,
    stage: "transcribing",
    message: "Transcribiendo voz en español palabra por palabra...",
  });

  const output = await transcriber(audio, {
    chunk_length_s: 29,
    stride_length_s: 5,
    return_timestamps: "word",
    language: "spanish",
    task: "transcribe",
  });

  const single = Array.isArray(output) ? output[0] : output;
  return {
    text: single?.text ?? "",
    chunks: single?.chunks ?? [],
  };
}

self.addEventListener(
  "message",
  async (event: MessageEvent<TranscribeRequestMessage>) => {
    const data = event.data;
    if (!data || data.type !== "transcribe") return;

    const { requestId, modelId, audio } = data;
    let device = await detectDevice();
    self.postMessage({ type: "device", requestId, device });

    try {
      const result = await runTranscription(modelId, audio, device, requestId);
      self.postMessage({
        type: "result",
        requestId,
        device,
        text: result.text,
        chunks: result.chunks,
      });
    } catch (primaryErr) {
      if (device === "webgpu") {
        device = "wasm";
        self.postMessage({ type: "device", requestId, device });
        self.postMessage({
          type: "status",
          requestId,
          stage: "loading-model",
          message: "WebGPU falló en este dispositivo; cambiando a modo CPU WASM...",
        });
        try {
          const fallbackResult = await runTranscription(
            modelId,
            audio,
            "wasm",
            requestId
          );
          self.postMessage({
            type: "result",
            requestId,
            device: "wasm",
            text: fallbackResult.text,
            chunks: fallbackResult.chunks,
          });
          return;
        } catch (fallbackErr) {
          self.postMessage({
            type: "error",
            requestId,
            error:
              fallbackErr instanceof Error
                ? fallbackErr.message
                : String(fallbackErr),
          });
          return;
        }
      }

      self.postMessage({
        type: "error",
        requestId,
        error:
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
    }
  }
);
