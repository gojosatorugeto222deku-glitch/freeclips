import type { ModelProgressInfo, WhisperModelId } from "@/types/subtitle";

interface FileTransferState {
  loaded: number;
  total: number;
  done: boolean;
  isWeight: boolean;
}

export interface RawHfProgressEvent {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export const EXPECTED_MODEL_BYTES: Record<WhisperModelId, number> = {
  "onnx-community/whisper-tiny_timestamped": 41_500_000,
  "onnx-community/whisper-base_timestamped": 76_000_000,
  "onnx-community/whisper-small_timestamped": 240_000_000,
};

function isWeightFile(file: string): boolean {
  return file.endsWith(".onnx") || file.endsWith(".onnx_data");
}

/**
 * Aggregates parallel model file downloads into a single smooth, monotonic
 * percentage and byte total. Prevents tiny JSON config files from prematurely
 * locking the progress bar at 100%, and never drops back to 0% on `status: "done"`.
 */
export class ModelDownloadTracker {
  private files = new Map<string, FileTransferState>();
  private maxPercent = 0;
  private readonly expectedTotalBytes: number;

  constructor(expectedTotalBytes = 0) {
    this.expectedTotalBytes = Math.max(0, expectedTotalBytes);
  }

  update(info: RawHfProgressEvent): ModelProgressInfo | null {
    const file = (info.file || "").trim();
    const status = info.status || "progress";

    if (status === "ready") {
      this.maxPercent = 100;
      const totals = this.sumBytes();
      return {
        file: "",
        progress: 100,
        loaded: totals.loaded > 0 ? totals.loaded : undefined,
        total: totals.total > 0 ? totals.total : undefined,
        status: "ready",
        phase: "initializing",
      };
    }

    if (!file) {
      return null;
    }

    const weight = isWeightFile(file);
    const prev = this.files.get(file) ?? {
      loaded: 0,
      total: 0,
      done: false,
      isWeight: weight,
    };

    let nextLoaded = prev.loaded;
    let nextTotal = prev.total;
    let nextDone = prev.done;

    if (typeof info.total === "number" && info.total > 0) {
      nextTotal = Math.max(nextTotal, info.total);
    }

    if (typeof info.loaded === "number" && info.loaded >= 0) {
      nextLoaded = Math.max(nextLoaded, info.loaded);
      if (nextTotal > 0) {
        nextLoaded = Math.min(nextLoaded, nextTotal);
      }
    } else if (
      typeof info.progress === "number" &&
      Number.isFinite(info.progress) &&
      nextTotal > 0
    ) {
      const approx = Math.round(
        (Math.min(100, Math.max(0, info.progress)) / 100) * nextTotal
      );
      nextLoaded = Math.max(nextLoaded, approx);
    }

    if (status === "done") {
      nextDone = true;
      if (nextTotal > 0) {
        nextLoaded = nextTotal;
      }
    }

    this.files.set(file, {
      loaded: nextLoaded,
      total: nextTotal,
      done: nextDone,
      isWeight: weight,
    });

    const totals = this.sumBytes();
    const denominator = Math.max(this.expectedTotalBytes, totals.total);
    const allWeightsDone = this.areAllWeightsDone();

    let computedPct = this.maxPercent;
    if (denominator > 0 && totals.loaded > 0) {
      const rawPct = (totals.loaded / denominator) * 100;
      const capped = allWeightsDone ? 100 : Math.min(99, rawPct);
      computedPct = Math.max(this.maxPercent, capped);
    }

    this.maxPercent = computedPct;

    return {
      file,
      progress: Math.round(computedPct),
      loaded: totals.loaded > 0 ? totals.loaded : undefined,
      total: denominator > 0 ? denominator : undefined,
      status,
      phase: allWeightsDone ? "initializing" : "downloading",
    };
  }

  private areAllWeightsDone(): boolean {
    let weightCount = 0;
    for (const entry of this.files.values()) {
      if (entry.isWeight) {
        weightCount += 1;
        if (!entry.done) return false;
      }
    }
    // Whisper timestamped models always have at least 2 ONNX files (encoder + decoder).
    return weightCount >= 2;
  }

  private sumBytes(): { loaded: number; total: number } {
    let loaded = 0;
    let total = 0;
    for (const entry of this.files.values()) {
      if (entry.total > 0) {
        loaded += Math.min(entry.loaded, entry.total);
        total += entry.total;
      }
    }
    return { loaded, total };
  }
}

export function formatMegabytes(bytes: number): string {
  const mb = Math.max(0, bytes) / (1024 * 1024);
  return mb >= 10 ? `${mb.toFixed(1)} MB` : `${mb.toFixed(2)} MB`;
}

export function formatTranscriptionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("cancelad") || lower.includes("abort")) {
    return "Transcripción cancelada.";
  }

  if (lower.includes("timeout") || lower.includes("tardó demasiado")) {
    return "La descarga o el análisis tardó demasiado. Prueba con el modo 'Ligero (~39 MB)' o verifica tu conexión a internet.";
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("err_network")
  ) {
    return "No se pudo descargar el modelo de voz IA. Verifica tu conexión a internet o desactiva bloqueadores e inténtalo de nuevo.";
  }

  if (
    lower.includes("memory") ||
    lower.includes("oom") ||
    lower.includes("out of bounds") ||
    lower.includes("allocation")
  ) {
    return "El navegador se quedó sin memoria para este modelo. Selecciona el modo 'Ligero (~39 MB)' o sube un clip más corto (15–60 seg).";
  }

  return raw || "No se pudo completar la transcripción automática en el navegador.";
}
