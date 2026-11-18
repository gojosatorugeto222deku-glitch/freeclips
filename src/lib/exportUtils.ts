import type { ExportQualityPreset } from "@/types/subtitle";

export interface ExportQualityConfig {
  id: ExportQualityPreset;
  label: string;
  badge: string;
  description: string;
  maxSide: number | null;
  preset: "ultrafast" | "veryfast";
  crf: string;
}

export const EXPORT_QUALITY_OPTIONS: Record<
  ExportQualityPreset,
  ExportQualityConfig
> = {
  fast: {
    id: "fast",
    label: "Rápida",
    badge: "Recomendado · 720p",
    description: "Hasta 3× más rápida. Ideal para TikTok, Reels y WhatsApp.",
    maxSide: 1280,
    preset: "ultrafast",
    crf: "22",
  },
  balanced: {
    id: "balanced",
    label: "Equilibrada",
    badge: "Hasta 1080p",
    description: "Conserva resolución hasta Full HD con compresión veloz.",
    maxSide: 1920,
    preset: "ultrafast",
    crf: "20",
  },
  high: {
    id: "high",
    label: "Alta calidad",
    badge: "Original",
    description: "Resolución exacta del video original con detalle máximo (CRF 18).",
    maxSide: null,
    preset: "veryfast",
    crf: "18",
  },
};

/**
 * Computes even (divisible-by-2) target dimensions respecting aspect ratio,
 * optional 9:16 vertical conversion, and quality preset maxSide cap.
 */
export function computeTargetExportDimensions(
  width: number,
  height: number,
  quality: ExportQualityPreset,
  convertToVertical916 = false
): { width: number; height: number; scaled: boolean; verticalCropped: boolean } {
  const safeW = Math.max(2, Math.floor(width / 2) * 2);
  const safeH = Math.max(2, Math.floor(height / 2) * 2);
  const maxSide = EXPORT_QUALITY_OPTIONS[quality].maxSide;

  if (convertToVertical916) {
    const targetW = quality === "fast" ? 720 : 1080;
    const targetH = quality === "fast" ? 1280 : 1920;
    return {
      width: targetW,
      height: targetH,
      scaled: targetW !== safeW || targetH !== safeH,
      verticalCropped: Math.abs(safeW / safeH - 9 / 16) > 0.02,
    };
  }

  if (!maxSide) {
    return { width: safeW, height: safeH, scaled: false, verticalCropped: false };
  }

  const longest = Math.max(safeW, safeH);
  if (longest <= maxSide) {
    return { width: safeW, height: safeH, scaled: false, verticalCropped: false };
  }

  const ratio = maxSide / longest;
  const nextW = Math.max(2, Math.round((safeW * ratio) / 2) * 2);
  const nextH = Math.max(2, Math.round((safeH * ratio) / 2) * 2);
  return {
    width: nextW,
    height: nextH,
    scaled: nextW !== safeW || nextH !== safeH,
    verticalCropped: false,
  };
}

/**
 * Translates low-level browser/WASM/network errors into clear, actionable Spanish messages.
 */
export function formatExportError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("cancelad") || lower.includes("abort")) {
    return "Exportación cancelada por el usuario.";
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network error") ||
    lower.includes("load failed")
  ) {
    return "No se pudo descargar el motor FFmpeg.wasm o la tipografía desde el servidor. Verifica que la aplicación siga ejecutándose o tu conexión a internet e inténtalo de nuevo.";
  }

  if (lower.includes("memory") || lower.includes("oom") || lower.includes("out of bounds")) {
    return "El navegador se quedó sin memoria WASM para esta resolución. Selecciona la calidad 'Rápida (720p)' e inténtalo de nuevo.";
  }

  return raw || "No se pudo completar la exportación en el navegador.";
}
