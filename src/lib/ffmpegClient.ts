import {
  computeTargetExportDimensions,
  EXPORT_QUALITY_OPTIONS,
  formatExportError,
} from "@/lib/exportUtils";
import type { ExportQualityPreset } from "@/types/subtitle";

type LogCallback = (event: { type: string; message: string }) => void;
type ProgressCallback = (event: { progress: number; time: number }) => void;

interface DirEntry {
  name: string;
  isDir: boolean;
}

const CORE_CDN_BASES = [
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm",
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm",
];

/**
 * Lightweight, Turbopack-safe client bridge for @ffmpeg/ffmpeg's official Web Worker.
 */
class FFmpegBridge {
  private worker: Worker | null = null;
  private nextId = 0;
  private resolves = new Map<number, (val: unknown) => void>();
  private rejects = new Map<number, (err: unknown) => void>();
  private logCallbacks: LogCallback[] = [];
  private progressCallbacks: ProgressCallback[] = [];
  public loaded = false;

  on(event: "log", cb: LogCallback): void;
  on(event: "progress", cb: ProgressCallback): void;
  on(event: "log" | "progress", cb: LogCallback | ProgressCallback): void {
    if (event === "log") {
      this.logCallbacks.push(cb as LogCallback);
    } else {
      this.progressCallbacks.push(cb as ProgressCallback);
    }
  }

  off(event: "log", cb: LogCallback): void;
  off(event: "progress", cb: ProgressCallback): void;
  off(event: "log" | "progress", cb: LogCallback | ProgressCallback): void {
    if (event === "log") {
      this.logCallbacks = this.logCallbacks.filter((f) => f !== cb);
    } else {
      this.progressCallbacks = this.progressCallbacks.filter((f) => f !== cb);
    }
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker("/ffmpeg/worker/worker.js", { type: "module" });
      this.worker.onmessage = ({ data: { id, type, data } }) => {
        if (type === "LOG") {
          this.logCallbacks.forEach((cb) => cb(data));
          return;
        }
        if (type === "PROGRESS") {
          this.progressCallbacks.forEach((cb) => cb(data));
          return;
        }
        const resolve = this.resolves.get(id);
        const reject = this.rejects.get(id);
        this.resolves.delete(id);
        this.rejects.delete(id);

        if (type === "ERROR") {
          reject?.(new Error(typeof data === "string" ? data : "FFmpeg error"));
          return;
        }
        if (type === "LOAD") {
          this.loaded = true;
        }
        resolve?.(data);
      };
      this.worker.onerror = (err) => {
        const error = new Error(err.message || "FFmpeg worker error");
        this.rejects.forEach((rej) => rej(error));
        this.resolves.clear();
        this.rejects.clear();
        this.loaded = false;
        this.worker?.terminate();
        this.worker = null;
      };
    }
    return this.worker;
  }

  private send<T>(
    type: string,
    data?: unknown,
    transfer: Transferable[] = []
  ): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.resolves.set(id, resolve as (val: unknown) => void);
      this.rejects.set(id, reject);
      worker.postMessage({ id, type, data }, transfer);
    });
  }

  load(config: {
    coreURL: string;
    wasmURL: string;
    workerURL?: string;
  }): Promise<boolean> {
    return this.send<boolean>("LOAD", config);
  }

  exec(args: string[], timeout = -1): Promise<number> {
    return this.send<number>("EXEC", { args, timeout });
  }

  writeFile(path: string, data: Uint8Array | string): Promise<boolean> {
    const transfer: Transferable[] = [];
    if (data instanceof Uint8Array) {
      transfer.push(data.buffer);
    }
    return this.send<boolean>("WRITE_FILE", { path, data }, transfer);
  }

  readFile(path: string, encoding = "binary"): Promise<Uint8Array | string> {
    return this.send<Uint8Array | string>("READ_FILE", { path, encoding });
  }

  deleteFile(path: string): Promise<boolean> {
    return this.send<boolean>("DELETE_FILE", { path });
  }

  createDir(path: string): Promise<boolean> {
    return this.send<boolean>("CREATE_DIR", { path });
  }

  listDir(path: string): Promise<DirEntry[]> {
    return this.send<DirEntry[]>("LIST_DIR", { path });
  }

  terminate(): void {
    this.rejects.forEach((rej) => rej(new Error("Exportación cancelada.")));
    this.resolves.clear();
    this.rejects.clear();
    this.worker?.terminate();
    this.worker = null;
    this.loaded = false;
  }
}

let ffmpegInstance: FFmpegBridge | null = null;
let loadPromise: Promise<FFmpegBridge> | null = null;
let latestDownloadProgress = 0;
const downloadSubscribers = new Set<(ratio: number) => void>();

function emitDownloadProgress(ratio: number) {
  latestDownloadProgress = ratio;
  downloadSubscribers.forEach((cb) => cb(ratio));
}

export function isFFmpegLoaded(): boolean {
  return Boolean(ffmpegInstance && ffmpegInstance.loaded);
}

export function getFFmpegMode(): "st" {
  return "st";
}

export function cancelFFmpegExport(): void {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
  loadPromise = null;
  latestDownloadProgress = 0;
}

async function fetchAsBlobURLWithFallback(
  urls: string[],
  mimeType: string,
  onProgress?: (ratio: number) => void
): Promise<string> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al descargar ${url}`);
      }

      const contentLengthHeader = response.headers.get("Content-Length");
      const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;
      const reader = response.body?.getReader();

      if (!reader || !totalBytes || !Number.isFinite(totalBytes)) {
        const buffer = await response.arrayBuffer();
        onProgress?.(1);
        return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          onProgress?.(Math.min(0.99, received / totalBytes));
        }
      }

      const merged = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }

      onProgress?.(1);
      return URL.createObjectURL(new Blob([merged], { type: mimeType }));
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Failed to fetch FFmpeg core assets");
}

async function initFFmpeg(
  onDownloadProgress?: (ratio: number) => void
): Promise<FFmpegBridge> {
  const ffmpeg = new FFmpegBridge();
  const originBase = `${window.location.origin}/ffmpeg/st`;
  const candidateBases = [originBase, ...CORE_CDN_BASES];

  let coreBlobUrl: string | null = null;
  let wasmBlobUrl: string | null = null;

  try {
    coreBlobUrl = await fetchAsBlobURLWithFallback(
      candidateBases.map((b) => `${b}/ffmpeg-core.js`),
      "text/javascript",
      (r) => onDownloadProgress?.(r * 0.05)
    );

    wasmBlobUrl = await fetchAsBlobURLWithFallback(
      candidateBases.map((b) => `${b}/ffmpeg-core.wasm`),
      "application/wasm",
      (r) => onDownloadProgress?.(0.05 + r * 0.9)
    );

    await ffmpeg.load({ coreURL: coreBlobUrl, wasmURL: wasmBlobUrl });
    onDownloadProgress?.(1);
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  } catch (err) {
    ffmpeg.terminate();
    if (coreBlobUrl) URL.revokeObjectURL(coreBlobUrl);
    if (wasmBlobUrl) URL.revokeObjectURL(wasmBlobUrl);
    throw err;
  }
}

export async function getFFmpeg(
  onDownloadProgress?: (ratio: number) => void
): Promise<FFmpegBridge> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    onDownloadProgress?.(1);
    return ffmpegInstance;
  }
  if (onDownloadProgress) {
    onDownloadProgress(latestDownloadProgress);
    downloadSubscribers.add(onDownloadProgress);
  }
  if (!loadPromise) {
    latestDownloadProgress = 0;
    loadPromise = initFFmpeg(emitDownloadProgress).catch((err) => {
      loadPromise = null;
      ffmpegInstance = null;
      latestDownloadProgress = 0;
      throw err;
    });
  }
  try {
    return await loadPromise;
  } finally {
    if (onDownloadProgress) {
      downloadSubscribers.delete(onDownloadProgress);
    }
  }
}

export function preloadFFmpeg(): void {
  if (typeof window === "undefined" || isFFmpegLoaded() || loadPromise) return;
  getFFmpeg().catch(() => {
    // Silent background warmup; user-triggered export handles any visible error.
  });
}

function getSafeVideoExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mov")) return "mov";
  if (lower.endsWith(".webm")) return "webm";
  if (lower.endsWith(".m4v")) return "m4v";
  return "mp4";
}

/**
 * Fallback audio decoder via FFmpeg.wasm for MOV/QuickTime or codecs unsupported by AudioContext.
 */
export async function extractAudioPcmWithFFmpeg(
  file: File
): Promise<Float32Array> {
  const ffmpeg = await getFFmpeg();
  const ext = getSafeVideoExtension(file.name);
  const inputName = `probe_input.${ext}`;
  const outName = "audio_16k.f32";

  try {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputName, fileBytes);
    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "-y",
      outName,
    ]);

    await ffmpeg.deleteFile(inputName).catch(() => {});

    if (exitCode !== 0) {
      throw new Error("No se pudo extraer la pista de audio del video.");
    }

    const raw = await ffmpeg.readFile(outName);
    if (typeof raw === "string") {
      throw new Error("Formato de audio inesperado al decodificar.");
    }
    const aligned = raw.slice().buffer;
    return new Float32Array(aligned);
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
}

export interface BurnSubtitlesParams {
  file: File;
  assContent: string;
  fontFileName: string;
  customFontBytes?: Uint8Array;
  sourceWidth: number;
  sourceHeight: number;
  quality: ExportQualityPreset;
  convertToVertical916?: boolean;
  durationSec?: number;
  onStage?: (stage: "loading-ffmpeg" | "preparing" | "encoding") => void;
  onDownloadProgress?: (ratio: number) => void;
  onProgress?: (ratio: number) => void;
  onLog?: (line: string) => void;
}

export interface BurnSubtitlesResult {
  blob: Blob;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  mode: "st";
}

function parseFfmpegTimeToSeconds(line: string): number | null {
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) {
    return null;
  }
  return h * 3600 + m * 60 + s;
}

export async function burnSubtitlesWithFFmpeg({
  file,
  assContent,
  fontFileName,
  customFontBytes,
  sourceWidth,
  sourceHeight,
  quality,
  convertToVertical916 = false,
  durationSec,
  onStage,
  onDownloadProgress,
  onProgress,
  onLog,
}: BurnSubtitlesParams): Promise<BurnSubtitlesResult> {
  let ffmpeg: FFmpegBridge | null = null;
  const ext = getSafeVideoExtension(file.name);
  const inputName = `input.${ext}`;
  const assName = "subtitles.ass";
  const outputName = "output.mp4";
  const fontVirtualPath = `/fonts/${fontFileName}`;

  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress) && progress >= 0 && progress <= 1.05) {
      onProgress?.(Math.max(0, Math.min(0.99, progress)));
    }
  };

  const handleLog = ({ message }: { message: string }) => {
    onLog?.(message);
    if (durationSec && durationSec > 0) {
      const t = parseFfmpegTimeToSeconds(message);
      if (t !== null) {
        onProgress?.(Math.max(0, Math.min(0.99, t / durationSec)));
      }
    }
  };

  try {
    onStage?.("loading-ffmpeg");
    ffmpeg = await getFFmpeg(onDownloadProgress);

    onStage?.("preparing");
    onProgress?.(0);

    ffmpeg.on("progress", handleProgress);
    ffmpeg.on("log", handleLog);

    await ffmpeg.createDir("/fonts").catch(() => {});
    const existingFonts = await ffmpeg.listDir("/fonts").catch(() => []);
    for (const entry of existingFonts) {
      if (!entry.isDir && entry.name !== "." && entry.name !== "..") {
        await ffmpeg.deleteFile(`/fonts/${entry.name}`).catch(() => {});
      }
    }

    let fontBytes: Uint8Array;
    if (customFontBytes && customFontBytes.byteLength > 0) {
      fontBytes = new Uint8Array(customFontBytes);
    } else {
      const fontRes = await fetch(`${window.location.origin}/fonts/${fontFileName}`);
      if (!fontRes.ok) {
        throw new Error(
          `No se pudo cargar la fuente tipográfica (${fontFileName}, HTTP ${fontRes.status}).`
        );
      }
      fontBytes = new Uint8Array(await fontRes.arrayBuffer());
    }
    await ffmpeg.writeFile(fontVirtualPath, fontBytes);

    const videoBytes = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputName, videoBytes);
    await ffmpeg.writeFile(assName, new TextEncoder().encode(assContent));

    const qualityCfg = EXPORT_QUALITY_OPTIONS[quality];
    const targetDims = computeTargetExportDimensions(
      sourceWidth,
      sourceHeight,
      quality,
      convertToVertical916
    );

    // Scale/crop first (to exact even dimensions), then burn ASS at matching PlayResX/PlayResY
    // so text remains crisp at any target resolution or 9:16 vertical crop.
    const vfChain = convertToVertical916
      ? `scale=${targetDims.width}:${targetDims.height}:force_original_aspect_ratio=increase,crop=${targetDims.width}:${targetDims.height},ass=${assName}:fontsdir=/fonts`
      : targetDims.scaled
        ? `scale=${targetDims.width}:${targetDims.height}:flags=lanczos,ass=${assName}:fontsdir=/fonts`
        : `scale=trunc(iw/2)*2:trunc(ih/2)*2,ass=${assName}:fontsdir=/fonts`;

    onStage?.("encoding");

    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      vfChain,
      "-c:v",
      "libx264",
      "-preset",
      qualityCfg.preset,
      "-crf",
      qualityCfg.crf,
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-max_muxing_queue_size",
      "1024",
      "-movflags",
      "+faststart",
      "-y",
      outputName,
    ]);

    // Free input file immediately to reduce MEMFS pressure before reading output.
    await ffmpeg.deleteFile(inputName).catch(() => {});

    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg finalizó con código ${exitCode}. Verifica que el video no esté dañado.`
      );
    }

    const outputRaw = await ffmpeg.readFile(outputName);
    if (typeof outputRaw === "string") {
      throw new Error("Error inesperado leyendo el MP4 generado.");
    }

    const safeBytes = new Uint8Array(outputRaw);
    const blob = new Blob([safeBytes], { type: "video/mp4" });
    if (blob.size < 1024) {
      throw new Error("El archivo MP4 generado resultó vacío.");
    }

    onProgress?.(1);
    return {
      blob,
      url: URL.createObjectURL(blob),
      sizeBytes: blob.size,
      width: targetDims.width,
      height: targetDims.height,
      mode: "st",
    };
  } catch (err) {
    throw new Error(formatExportError(err));
  } finally {
    if (ffmpeg) {
      ffmpeg.off("progress", handleProgress);
      ffmpeg.off("log", handleLog);
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(assName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
      await ffmpeg.deleteFile(fontVirtualPath).catch(() => {});
    }
  }
}
