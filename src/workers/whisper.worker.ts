import {
  env,
  pipeline,
  WhisperTextStreamer,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import {
  EXPECTED_MODEL_BYTES,
  ModelDownloadTracker,
  type RawHfProgressEvent,
} from "@/lib/transcriptionProgress";
import type { WhisperModelId } from "@/types/subtitle";

env.allowRemoteModels = true;
env.localModelPath = "/models/";
env.useBrowserCache = true;

type OnnxWasmConfig = {
  numThreads?: number;
  proxy?: boolean;
  wasmPaths?: string | { mjs?: string; wasm?: string };
};

type OnnxBackendEnv = {
  wasm?: OnnxWasmConfig;
};

type WorkerRequestMessage =
  | {
      type: "warmup";
      requestId: string;
      modelId: WhisperModelId;
    }
  | {
      type: "transcribe";
      requestId: string;
      modelId: WhisperModelId;
      audio: Float32Array;
      fastTimestamps?: boolean;
      keepAlive?: boolean;
    }
  | {
      type: "dispose";
      requestId?: string;
    };

const FETCH_HEADER_TIMEOUT_MS = 22_000;
const FETCH_MAX_ATTEMPTS = 3;
const SELF_HOSTED_MODEL_ID: WhisperModelId =
  "onnx-community/whisper-tiny_timestamped";
const SINGLE_WINDOW_SAMPLES = 30 * 16000;

// Guard against HuggingFace/CDN connections that hang before sending headers.
const nativeFetch = self.fetch.bind(self);
const resilientFetch: typeof fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const method = (init?.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return nativeFetch(input, init);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    if (init?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    init?.signal?.addEventListener("abort", onParentAbort, { once: true });

    const timer = self.setTimeout(
      () => controller.abort(),
      FETCH_HEADER_TIMEOUT_MS
    );
    try {
      const response = await nativeFetch(input, {
        ...init,
        signal: controller.signal,
      });
      self.clearTimeout(timer);
      init?.signal?.removeEventListener("abort", onParentAbort);

      if (response.status >= 500 && attempt < FETCH_MAX_ATTEMPTS) {
        await new Promise((r) => self.setTimeout(r, 700 * attempt));
        continue;
      }
      return response;
    } catch (err) {
      self.clearTimeout(timer);
      init?.signal?.removeEventListener("abort", onParentAbort);
      lastError = err;
      if (init?.signal?.aborted || attempt >= FETCH_MAX_ATTEMPTS) {
        throw err;
      }
      await new Promise((r) => self.setTimeout(r, 700 * attempt));
    }
  }
  throw lastError;
};

self.fetch = resilientFetch;
(env as unknown as { fetch?: typeof fetch }).fetch = resilientFetch;

function configureOnnxWasm(variant: "compact" | "asyncify" | "cdn"): void {
  const onnxEnv = (env.backends as { onnx?: OnnxBackendEnv } | undefined)?.onnx;
  if (!onnxEnv?.wasm) return;

  onnxEnv.wasm.numThreads = 1;
  onnxEnv.wasm.proxy = false;

  const origin = self.location?.origin;
  if (!origin || !origin.startsWith("http") || variant === "cdn") {
    return;
  }

  if (variant === "compact") {
    onnxEnv.wasm.wasmPaths = {
      mjs: `${origin}/ort/ort-wasm-simd-threaded.mjs`,
      wasm: `${origin}/ort/ort-wasm-simd-threaded.wasm`,
    };
  } else {
    onnxEnv.wasm.wasmPaths = {
      mjs: `${origin}/ort/ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${origin}/ort/ort-wasm-simd-threaded.asyncify.wasm`,
    };
  }
}

configureOnnxWasm("compact");

let cachedModelId: WhisperModelId | null = null;
let cachedPipeline: AutomaticSpeechRecognitionPipeline | null = null;
let inflightLoad: {
  modelId: WhisperModelId;
  promise: Promise<AutomaticSpeechRecognitionPipeline>;
  listeners: Set<(info: RawHfProgressEvent) => void>;
} | null = null;

async function disposeCachedPipeline(): Promise<void> {
  if (cachedPipeline && typeof cachedPipeline.dispose === "function") {
    await cachedPipeline.dispose().catch(() => {});
  }
  cachedPipeline = null;
  cachedModelId = null;
}

async function createPipelineWithWasmFallback(
  modelId: WhisperModelId,
  onRawProgress: (info: RawHfProgressEvent) => void
): Promise<AutomaticSpeechRecognitionPipeline> {
  env.allowLocalModels = modelId === SELF_HOSTED_MODEL_ID;

  const variants: Array<"compact" | "asyncify"> = ["compact", "asyncify"];
  let lastErr: unknown;

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    configureOnnxWasm(variant);
    try {
      return await pipeline("automatic-speech-recognition", modelId, {
        device: "wasm",
        dtype: {
          encoder_model: "q8",
          decoder_model_merged: "q8",
        },
        progress_callback: onRawProgress,
      });
    } catch (err) {
      lastErr = err;
      if (i === 0) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("wasm") ||
          msg.includes("ort") ||
          msg.includes("no available backend") ||
          msg.includes("asyncify") ||
          msg.includes("import")
        ) {
          continue;
        }
      }
      throw err;
    }
  }

  throw lastErr;
}

async function getOrCreatePipeline(
  modelId: WhisperModelId,
  requestId: string,
  silentStatus = false
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (cachedPipeline && cachedModelId === modelId) {
    return cachedPipeline;
  }

  const tracker = new ModelDownloadTracker(EXPECTED_MODEL_BYTES[modelId] ?? 0);
  let lastProgressSentAt = 0;
  let lastProgressPct = -1;
  let sentInitializingStatus = false;

  const listener = (info: RawHfProgressEvent) => {
    const agg = tracker.update(info);
    if (!agg) return;

    const now = Date.now();
    const shouldSend =
      agg.phase === "initializing" ||
      agg.progress === 100 ||
      agg.progress !== lastProgressPct ||
      now - lastProgressSentAt >= 200;

    if (!shouldSend) return;

    lastProgressSentAt = now;
    lastProgressPct = agg.progress;

    self.postMessage({
      type: "progress",
      requestId,
      progress: agg,
    });

    if (agg.phase === "initializing" && !sentInitializingStatus && !silentStatus) {
      sentInitializingStatus = true;
      self.postMessage({
        type: "status",
        requestId,
        stage: "loading-model",
        message: "Inicializando motor de voz IA...",
      });
    }
  };

  if (inflightLoad && inflightLoad.modelId === modelId) {
    if (!silentStatus) {
      self.postMessage({
        type: "status",
        requestId,
        stage: "loading-model",
        message: "Finalizando carga del motor de voz IA...",
      });
    }
    inflightLoad.listeners.add(listener);
    try {
      return await inflightLoad.promise;
    } finally {
      inflightLoad?.listeners.delete(listener);
    }
  }

  if (cachedPipeline && typeof cachedPipeline.dispose === "function") {
    await cachedPipeline.dispose().catch(() => {});
    cachedPipeline = null;
    cachedModelId = null;
  }

  if (!silentStatus) {
    self.postMessage({
      type: "status",
      requestId,
      stage: "loading-model",
      message: "Descargando modelo de voz IA (solo la primera vez)...",
    });
  }

  const listeners = new Set<(info: RawHfProgressEvent) => void>([listener]);
  const loadPromise = createPipelineWithWasmFallback(modelId, (info) => {
    listeners.forEach((fn) => fn(info));
  })
    .then((asr) => {
      cachedPipeline = asr;
      cachedModelId = modelId;
      return asr;
    })
    .finally(() => {
      if (inflightLoad?.promise === loadPromise) {
        inflightLoad = null;
      }
    });

  inflightLoad = { modelId, promise: loadPromise, listeners };
  return await loadPromise;
}

async function runTranscription(
  modelId: WhisperModelId,
  audio: Float32Array,
  requestId: string,
  fastTimestamps: boolean
) {
  const transcriber = await getOrCreatePipeline(modelId, requestId, false);

  self.postMessage({
    type: "status",
    requestId,
    stage: "transcribing",
    message: "Transcribiendo voz en español...",
  });

  let accumulatedPreview = "";
  let lastPreviewSentAt = 0;

  let streamer: WhisperTextStreamer | undefined;
  try {
    const tokenizer = (
      transcriber as unknown as {
        tokenizer?: ConstructorParameters<typeof WhisperTextStreamer>[0];
      }
    ).tokenizer;
    if (tokenizer) {
      streamer = new WhisperTextStreamer(tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (piece: string) => {
          if (!piece) return;
          accumulatedPreview = (accumulatedPreview + piece).slice(-220);
          const now = Date.now();
          if (now - lastPreviewSentAt >= 220) {
            lastPreviewSentAt = now;
            self.postMessage({
              type: "partial",
              requestId,
              text: accumulatedPreview.trim(),
            });
          }
        },
      });
    }
  } catch {
    streamer = undefined;
  }

  // Skip chunking/stride wrapper when audio fits inside Whisper's native 30s window (~15% faster).
  const needsInternalChunking = audio.length > SINGLE_WINDOW_SAMPLES;
  const options: Record<string, unknown> = {
    return_timestamps: fastTimestamps ? true : "word",
    language: "spanish",
    task: "transcribe",
    max_new_tokens: 224,
  };
  if (needsInternalChunking) {
    options.chunk_length_s = 30;
    options.stride_length_s = 5;
  }
  if (streamer) {
    options.streamer = streamer;
  }

  const output = await transcriber(
    audio,
    options as Parameters<AutomaticSpeechRecognitionPipeline>[1]
  );

  const single = Array.isArray(output) ? output[0] : output;
  return {
    text: single?.text ?? "",
    chunks: single?.chunks ?? [],
  };
}

self.addEventListener(
  "message",
  async (event: MessageEvent<WorkerRequestMessage>) => {
    const data = event.data;
    if (!data) return;

    if (data.type === "dispose") {
      await disposeCachedPipeline();
      self.postMessage({ type: "disposed", requestId: data.requestId });
      return;
    }

    if (data.type === "warmup") {
      try {
        await getOrCreatePipeline(data.modelId, data.requestId, true);
        self.postMessage({
          type: "warmed",
          requestId: data.requestId,
          modelId: data.modelId,
        });
      } catch (err) {
        self.postMessage({
          type: "warmup-error",
          requestId: data.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (data.type !== "transcribe") return;

    const {
      requestId,
      modelId,
      audio,
      fastTimestamps = true,
      keepAlive = false,
    } = data;
    self.postMessage({ type: "device", requestId, device: "wasm" });

    try {
      const result = await runTranscription(
        modelId,
        audio,
        requestId,
        fastTimestamps
      );
      self.postMessage({
        type: "result",
        requestId,
        device: "wasm",
        text: result.text,
        chunks: result.chunks,
      });
    } catch (err) {
      self.postMessage({
        type: "error",
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (!keepAlive) {
        // Phase 1 cleanup for mobile & temporary helper workers: release ONNX tensors immediately.
        await disposeCachedPipeline();
      }
    }
  }
);

self.postMessage({ type: "ready" });
