"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode2,
  FileText,
  Film,
  Gauge,
  Loader2,
  Lock,
  ShieldCheck,
  Terminal,
  XCircle,
} from "lucide-react";
import { generateAssSubtitles } from "@/lib/assGenerator";
import {
  computeTargetExportDimensions,
  EXPORT_QUALITY_OPTIONS,
  shouldUseSafe720pExport,
} from "@/lib/exportUtils";
import { POSITION_LABELS, SIZE_LABELS, SUBTITLE_STYLES } from "@/lib/styles";
import { cuesToSrt } from "@/lib/subtitles";
import { PLAN_CONFIGS } from "@/lib/usageLimits";
import type {
  ExportQualityPreset,
  ExportStage,
  PlanTier,
  SubtitleCue,
  SubtitleSettings,
  VideoMetadata,
} from "@/types/subtitle";

interface ExportPanelProps {
  videoMeta: VideoMetadata;
  cues: SubtitleCue[];
  cueCount: number;
  planTier: PlanTier;
  settings: SubtitleSettings;
  quality: ExportQualityPreset;
  onQualityChange: (quality: ExportQualityPreset) => void;
  stage: ExportStage;
  downloadProgress: number;
  progress: number;
  isFfmpegWarm: boolean;
  isMobile: boolean;
  logs: string[];
  errorMessage: string | null;
  exportedVideoUrl: string | null;
  exportedSizeBytes: number | null;
  exportedDims: { width: number; height: number } | null;
  isExportStale: boolean;
  isDurationBlocked: boolean;
  onStartExport: () => void;
  onCancelExport: () => void;
  onRequirePro: (reason: string) => void;
}

const QUALITY_ORDER: ExportQualityPreset[] = ["fast", "balanced", "high"];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDurationClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ExportPanel({
  videoMeta,
  cues,
  cueCount,
  planTier,
  settings,
  quality,
  onQualityChange,
  stage,
  downloadProgress,
  progress,
  isFfmpegWarm,
  isMobile,
  logs,
  errorMessage,
  exportedVideoUrl,
  exportedSizeBytes,
  exportedDims,
  isExportStale,
  isDurationBlocked,
  onStartExport,
  onCancelExport,
  onRequirePro,
}: ExportPanelProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const preset = SUBTITLE_STYLES[settings.styleId];
  const isBusy =
    stage === "loading-ffmpeg" ||
    stage === "preparing" ||
    stage === "encoding";

  useEffect(() => {
    if (!isBusy) {
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => {
      window.clearInterval(timer);
      setElapsedSec(0);
    };
  }, [isBusy]);

  const safe720pActive = shouldUseSafe720pExport(
    videoMeta.width,
    videoMeta.height,
    isMobile
  );
  const targetDims = computeTargetExportDimensions(
    videoMeta.width,
    videoMeta.height,
    quality,
    Boolean(settings.convertToVertical916),
    safe720pActive
  );
  const maxDurationLabel = PLAN_CONFIGS[planTier].maxDurationLabel;

  const downloadPct = Math.round(
    Math.max(0, Math.min(100, downloadProgress * 100))
  );
  const encodePct = Math.round(Math.max(0, Math.min(100, progress * 100)));

  const displayPct =
    stage === "loading-ffmpeg"
      ? downloadPct
      : stage === "preparing"
        ? 4
        : Math.max(4, encodePct);

  const etaSec =
    stage === "encoding" && progress > 0.08 && progress < 0.99 && elapsedSec >= 2
      ? Math.max(1, Math.round((elapsedSec / progress) * (1 - progress)))
      : null;

  const baseName = videoMeta.name.replace(/\.[^.]+$/, "");
  const outputFileName = `${baseName}-freeclips.mp4`;

  const handleDownloadSrt = () => {
    const srt = cuesToSrt(cues, settings.uppercase);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}-freeclips.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAss = () => {
    const ass = generateAssSubtitles(cues, {
      width: targetDims.width,
      height: targetDims.height,
      settings,
    });
    const blob = new Blob([ass], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}-freeclips.ass`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Export Summary & Quality Selector */}
      <div className="rounded-xl border border-white/[0.08] bg-[#12151d] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Film className="h-4 w-4 text-yellow-400" />
              Exportar MP4 con subtítulos quemados
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Exportación directa en MP4 (H.264 + AAC) compatible con TikTok,
              Reels y Shorts.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              isFfmpegWarm
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/[0.04] text-zinc-400"
            }`}
          >
            {isFfmpegWarm ? "Motor listo" : "Listo"}
          </span>
        </div>

        {/* Quality / Speed Presets */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-zinc-300">
              <Gauge className="h-3.5 w-3.5 text-yellow-400" />
              Velocidad y calidad
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              Salida: {targetDims.width}×{targetDims.height}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {QUALITY_ORDER.map((id) => {
              const cfg = EXPORT_QUALITY_OPTIONS[id];
              const active = quality === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onQualityChange(id)}
                  title={cfg.description}
                  className={`rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-50 ${
                    active
                      ? "border-yellow-400/70 bg-yellow-400/12 text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="block truncate text-xs font-semibold">
                    {cfg.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-yellow-300/90">
                    {cfg.badge}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {EXPORT_QUALITY_OPTIONS[quality].description}
          </p>
          {safe720pActive && (
            <p className="mt-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1.5 text-[11px] text-emerald-200">
              Optimización RAM activa: se exportará a máximo 720p con compresión
              rápida de 1 hilo para evitar cierres por memoria.
            </p>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
            <dt className="text-zinc-500">Estilo</dt>
            <dd className="mt-0.5 font-medium text-zinc-100">
              {preset.shortLabel}
            </dd>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
            <dt className="text-zinc-500">Resolución</dt>
            <dd className="mt-0.5 font-mono font-medium text-zinc-100">
              {targetDims.width}×{targetDims.height}
              {targetDims.scaled && (
                <span className="ml-1 text-[10px] text-zinc-400">
                  (de {videoMeta.width}×{videoMeta.height})
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
            <dt className="text-zinc-500">Subtítulos</dt>
            <dd className="mt-0.5 font-medium text-zinc-100">
              {cueCount} frases · {POSITION_LABELS[settings.position]} ·{" "}
              {SIZE_LABELS[settings.size]}
            </dd>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2">
            <dt className="text-zinc-500">Marca de agua</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ninguna
            </dd>
          </div>
        </dl>

        {/* Primary Action / Cancel Row */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={
              isDurationBlocked
                ? () =>
                    onRequirePro(
                      `Exportar videos que superen ${maxDurationLabel} requiere actualizar de plan.`
                    )
                : onStartExport
            }
            disabled={isBusy || (!isDurationBlocked && cueCount === 0)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isDurationBlocked
                ? "border border-yellow-400/45 bg-yellow-400/15 text-yellow-200 hover:bg-yellow-400/25"
                : "bg-yellow-400 text-black shadow-yellow-500/15 hover:bg-yellow-300"
            }`}
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {stage === "loading-ffmpeg"
                    ? `Cargando motor (${downloadPct}%)...`
                    : stage === "preparing"
                      ? "Preparando archivos..."
                      : `Renderizando MP4 (${encodePct}%)...`}
                </span>
              </>
            ) : isDurationBlocked ? (
              <>
                <Lock className="h-4 w-4" />
                <span>Supera {maxDurationLabel} · Actualizar</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 stroke-[2.4]" />
                <span>
                  {exportedVideoUrl
                    ? "Volver a generar MP4"
                    : "Quemar subtítulos y generar MP4"}
                </span>
              </>
            )}
          </button>

          {isBusy && (
            <button
              type="button"
              onClick={onCancelExport}
              title="Cancelar exportación"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-3 text-xs font-semibold text-zinc-200 transition hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancelar</span>
            </button>
          )}
        </div>

        {cueCount === 0 && (
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            Primero transcribe el audio o añade al menos una frase en la pestaña
            &ldquo;Subtítulos&rdquo;.
          </p>
        )}

        {/* Secondary Subtitle File Downloads */}
        {cueCount > 0 && (
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleDownloadSrt}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
            >
              <FileText className="h-3 w-3" />
              Descargar .SRT
            </button>
            <button
              type="button"
              onClick={handleDownloadAss}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
            >
              <FileCode2 className="h-3 w-3" />
              Descargar .ASS
            </button>
          </div>
        )}

        {/* Progress Bar */}
        {isBusy && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-zinc-200">
                {stage === "loading-ffmpeg"
                  ? "Preparando motor de exportación (solo la primera vez)..."
                  : stage === "preparing"
                    ? "Preparando pistas de video y subtítulos..."
                    : "Renderizando MP4 en alta calidad..."}
              </span>
              <span className="shrink-0 font-mono text-yellow-300">
                {displayPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-150"
                style={{ width: `${Math.max(3, displayPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Transcurrido: {formatDurationClock(elapsedSec)}</span>
              <span>
                {etaSec !== null
                  ? `Restante aprox.: ~${etaSec}s`
                  : "Procesamiento seguro en tu dispositivo"}
              </span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Rendered Result */}
      {exportedVideoUrl && stage === "done" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">
                  ¡Tu video está listo!
                </p>
                <p className="mt-0.5 text-xs text-zinc-300">
                  {outputFileName}
                  {exportedDims
                    ? ` · ${exportedDims.width}×${exportedDims.height}`
                    : ""}
                  {exportedSizeBytes
                    ? ` · ${formatBytes(exportedSizeBytes)}`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          {isExportStale && (
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              Editaste los subtítulos, estilo o calidad después de renderizar.
              Pulsa &ldquo;Volver a generar MP4&rdquo; para aplicar los cambios.
            </div>
          )}

          <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
            <video
              src={exportedVideoUrl}
              controls
              playsInline
              className="max-h-[240px] w-full object-contain"
            />
          </div>

          <a
            href={exportedVideoUrl}
            download={outputFileName}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black shadow-md shadow-emerald-500/15 transition hover:bg-emerald-300"
          >
            <Download className="h-4 w-4 stroke-[2.4]" />
            <span>Descargar MP4 sin marca de agua</span>
          </a>
        </div>
      )}

      {/* Collapsible FFmpeg Log */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0c0e14]">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              Detalles de exportación ({logs.length})
            </span>
            {showLogs ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showLogs && (
            <div className="max-h-36 overflow-y-auto border-t border-white/[0.06] bg-black/50 p-3 font-mono text-[10px] leading-relaxed text-zinc-400">
              {logs.slice(-40).map((line, idx) => (
                <div key={idx} className="break-all">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
