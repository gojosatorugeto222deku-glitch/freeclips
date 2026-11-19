"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  Check,
  Clock,
  Cpu,
  FileText,
  Loader2,
  Lock,
  Merge,
  Play,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { WHISPER_MODELS } from "@/lib/styles";
import {
  cuesToSrt,
  formatTimecode,
  parseTimecode,
} from "@/lib/subtitles";
import { formatMegabytes } from "@/lib/transcriptionProgress";
import { hasCreatorAccess, PLAN_CONFIGS } from "@/lib/usageLimits";
import type {
  ModelProgressInfo,
  PlanTier,
  SubtitleCue,
  TranscriptionStage,
  WhisperModelId,
} from "@/types/subtitle";

interface SubtitleEditorProps {
  cues: SubtitleCue[];
  currentTime: number;
  planTier: PlanTier;
  isDurationBlocked: boolean;
  selectedModel: WhisperModelId;
  onSelectModel: (model: WhisperModelId) => void;
  stage: TranscriptionStage;
  statusMessage: string;
  modelProgress: ModelProgressInfo | null;
  livePreviewText: string;
  activeDevice: "webgpu" | "wasm" | null;
  errorMessage: string | null;
  videoName: string;
  onStartTranscription: () => void;
  onCancelTranscription: () => void;
  onRequirePro: (reason: string) => void;
  onSeekTo: (timeSec: number) => void;
  onUpdateCueText: (cueId: string, nextText: string) => void;
  onUpdateCueTiming: (cueId: string, startSec: number, endSec: number) => void;
  onSplitCue: (cueId: string) => void;
  onMergeWithNext: (cueId: string) => void;
  onDeleteCue: (cueId: string) => void;
  onAddCue: () => void;
  onShiftAll: (deltaSec: number) => void;
}

function formatElapsedClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SubtitleEditor({
  cues,
  currentTime,
  planTier,
  isDurationBlocked,
  selectedModel,
  onSelectModel,
  stage,
  statusMessage,
  modelProgress,
  livePreviewText,
  activeDevice,
  errorMessage,
  videoName,
  onStartTranscription,
  onCancelTranscription,
  onRequirePro,
  onSeekTo,
  onUpdateCueText,
  onUpdateCueTiming,
  onSplitCue,
  onMergeWithNext,
  onDeleteCue,
  onAddCue,
  onShiftAll,
}: SubtitleEditorProps) {
  const [editingTime, setEditingTime] = useState<{
    cueId: string;
    field: "start" | "end";
    value: string;
  } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const isPro = hasCreatorAccess(planTier);
  const maxDurationLabel = PLAN_CONFIGS[planTier].maxDurationLabel;
  const isBusy =
    stage === "extracting-audio" ||
    stage === "loading-model" ||
    stage === "transcribing";

  useEffect(() => {
    if (!isBusy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => {
      window.clearInterval(timer);
      setElapsedSec(0);
    };
  }, [isBusy]);

  const handleDownloadSrt = () => {
    const srt = cuesToSrt(cues, false);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const base = videoName.replace(/\.[^.]+$/, "");
    link.href = url;
    link.download = `${base}-freeclips.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const commitTimeEdit = (cue: SubtitleCue) => {
    if (!editingTime || editingTime.cueId !== cue.id) return;
    const parsed = parseTimecode(editingTime.value);
    if (parsed !== null) {
      if (editingTime.field === "start") {
        onUpdateCueTiming(
          cue.id,
          parsed,
          Math.max(parsed + 0.2, cue.end)
        );
      } else {
        onUpdateCueTiming(
          cue.id,
          Math.min(cue.start, Math.max(0, parsed - 0.2)),
          Math.max(cue.start + 0.15, parsed)
        );
      }
    }
    setEditingTime(null);
  };

  const hasDeterminateProgress =
    (stage === "loading-model" || stage === "extracting-audio") &&
    modelProgress !== null &&
    Number.isFinite(modelProgress.progress) &&
    modelProgress.phase !== "initializing";

  const pct = hasDeterminateProgress
    ? Math.round(Math.max(0, Math.min(100, modelProgress!.progress)))
    : null;

  const isInitializingModel =
    stage === "loading-model" && modelProgress?.phase === "initializing";

  const downloadedBytesLabel =
    hasDeterminateProgress &&
    modelProgress?.loaded &&
    modelProgress?.total &&
    modelProgress.total > 0
      ? `${formatMegabytes(modelProgress.loaded)} / ${formatMegabytes(modelProgress.total)}`
      : null;

  return (
    <div className="space-y-4">
      {/* AI Transcription Box */}
      <div className="studio-surface-subtle rounded-2xl border border-white/[0.08] p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-yellow-400/30 bg-yellow-400/12 text-yellow-300">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              Transcripción automática con IA
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Detecta voz en español palabra por palabra directo en tu equipo.
            </p>
          </div>
          {activeDevice && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">
              <Cpu className="h-3 w-3" />
              {activeDevice === "webgpu" ? "GPU rápida" : "Motor local"}
            </span>
          )}
        </div>

        {/* Model Selector */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {WHISPER_MODELS.map((m) => {
            const active = selectedModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={isBusy}
                onClick={() => onSelectModel(m.id)}
                title={m.description}
                className={`relative rounded-xl border px-2.5 py-2.5 text-left transition disabled:opacity-50 ${
                  active
                    ? "border-yellow-400/75 bg-yellow-400/[0.11] text-white shadow-sm shadow-yellow-500/10"
                    : "border-white/[0.08] bg-black/25 text-zinc-300 hover:border-white/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-bold">{m.label}</span>
                  {active && (
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <span className="mt-0.5 block truncate text-[10px] font-medium text-yellow-300/90">
                  {m.badge}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-zinc-400">
                  {m.sizeHint}
                </span>
              </button>
            );
          })}
        </div>

        {/* Trigger + Cancel Row */}
        <div className="mt-3.5 flex items-center gap-2">
          <button
            type="button"
            onClick={
              isDurationBlocked
                ? () =>
                    onRequirePro(
                      `Tu plan actual admite hasta ${maxDurationLabel}. Actualiza a Plan Creador (hasta 15 min).`
                    )
                : onStartTranscription
            }
            disabled={isBusy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-70 ${
              isDurationBlocked
                ? "border border-yellow-400/45 bg-yellow-400/15 text-yellow-200 hover:bg-yellow-400/25"
                : "bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 text-black shadow-yellow-500/20 hover:brightness-105"
            }`}
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {stage === "extracting-audio"
                    ? "Extrayendo audio..."
                    : stage === "transcribing"
                      ? "Transcribiendo..."
                      : isInitializingModel
                        ? "Iniciando motor IA..."
                        : pct !== null
                          ? `Descargando (${pct}%)...`
                          : "Preparando IA..."}
                </span>
              </>
            ) : isDurationBlocked ? (
              <>
                <Lock className="h-4 w-4" />
                <span>Supera {maxDurationLabel} · Desbloquear</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>
                  {cues.length > 0
                    ? "Volver a transcribir audio"
                    : "Transcribir audio en español"}
                </span>
              </>
            )}
          </button>

          {isBusy && (
            <button
              type="button"
              onClick={onCancelTranscription}
              title="Cancelar transcripción"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:border-red-400/45 hover:bg-red-500/15 hover:text-red-200"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancelar</span>
            </button>
          )}
        </div>

        {/* Smooth Progress Indicator */}
        {isBusy && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/[0.08] bg-black/40 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-zinc-200">
                {statusMessage}
              </span>
              {pct !== null ? (
                <span className="shrink-0 font-mono font-semibold text-yellow-300">
                  {pct}%
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[11px] text-yellow-300/90">
                  {formatElapsedClock(elapsedSec)}
                </span>
              )}
            </div>

            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
              {pct !== null ? (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 transition-all duration-200"
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              ) : (
                <div className="animate-progress-shimmer h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent" />
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[10.5px] text-zinc-400">
              <span>Transcurrido: {formatElapsedClock(elapsedSec)}</span>
              <span className="truncate font-mono text-zinc-400">
                {downloadedBytesLabel
                  ? downloadedBytesLabel
                  : isInitializingModel
                    ? "Compilando en memoria local"
                    : stage === "transcribing"
                      ? "Analizando voz en español"
                      : "Solo se descarga la primera vez"}
              </span>
            </div>

            {stage === "transcribing" && livePreviewText && (
              <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/[0.05] px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-300/80">
                  Detectando en vivo
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs italic text-zinc-200">
                  &ldquo;{livePreviewText}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Cue Editing Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">Texto y tiempos</h3>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[11px] text-zinc-300">
            {cues.length} {cues.length === 1 ? "frase" : "frases"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {cues.length > 0 && (
            <>
              <button
                type="button"
                onClick={() =>
                  isPro
                    ? onShiftAll(-0.1)
                    : onRequirePro(
                        "Desplazar tiempos exactos (±0.1s) es una función Pro."
                      )
                }
                title={
                  isPro
                    ? "Adelantar todos los subtítulos 0.1s"
                    : "Función Pro: ajustar tiempos exactos"
                }
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
              >
                {!isPro ? (
                  <Lock className="h-2.5 w-2.5 text-yellow-400/80" />
                ) : (
                  <ArrowDownUp className="h-3 w-3" />
                )}
                -0.1s
              </button>
              <button
                type="button"
                onClick={() =>
                  isPro
                    ? onShiftAll(0.1)
                    : onRequirePro(
                        "Desplazar tiempos exactos (±0.1s) es una función Pro."
                      )
                }
                title={
                  isPro
                    ? "Retrasar todos los subtítulos 0.1s"
                    : "Función Pro: ajustar tiempos exactos"
                }
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
              >
                {!isPro && <Lock className="h-2.5 w-2.5 text-yellow-400/80" />}
                +0.1s
              </button>
              <button
                type="button"
                onClick={handleDownloadSrt}
                title="Descargar archivo .SRT"
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.08]"
              >
                <FileText className="h-3 w-3" />
                SRT
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() =>
              isPro
                ? onAddCue()
                : onRequirePro(
                    "Añadir bloques con tiempos manuales es una función Pro."
                  )
            }
            className="inline-flex items-center gap-1 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-300 transition hover:bg-yellow-400/20"
          >
            {!isPro ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Añadir
          </button>
        </div>
      </div>

      {/* Cue List */}
      {cues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-black/20 px-5 py-9 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-zinc-200">
            Aún no hay subtítulos generados
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
            Presiona &ldquo;Transcribir audio en español&rdquo; para detectar
            automáticamente cada palabra y sincronizarla con tu video.
          </p>
        </div>
      ) : (
        <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1 lg:max-h-[500px]">
          {cues.map((cue, index) => {
            const isActive =
              currentTime >= cue.start && currentTime <= cue.end;
            const startVal =
              editingTime?.cueId === cue.id && editingTime.field === "start"
                ? editingTime.value
                : formatTimecode(cue.start);
            const endVal =
              editingTime?.cueId === cue.id && editingTime.field === "end"
                ? editingTime.value
                : formatTimecode(cue.end);

            return (
              <div
                key={cue.id}
                className={`rounded-xl border p-3 transition ${
                  isActive
                    ? "border-yellow-400/70 bg-yellow-400/[0.07] shadow-md shadow-yellow-500/5"
                    : "border-white/[0.08] bg-[#11151f] hover:border-white/15"
                }`}
              >
                {/* Header Row: Index + Timecodes + Actions */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        isActive ? "text-yellow-300" : "text-zinc-500"
                      }`}
                    >
                      #{String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSeekTo(cue.start)}
                      title="Reproducir desde esta frase"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.07] text-zinc-200 transition hover:bg-yellow-400 hover:text-black"
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </button>

                    {isPro ? (
                      <>
                        <input
                          type="text"
                          aria-label={`Inicio de frase ${index + 1}`}
                          value={startVal}
                          onFocus={() =>
                            setEditingTime({
                              cueId: cue.id,
                              field: "start",
                              value: formatTimecode(cue.start),
                            })
                          }
                          onChange={(e) =>
                            setEditingTime({
                              cueId: cue.id,
                              field: "start",
                              value: e.target.value,
                            })
                          }
                          onBlur={() => commitTimeEdit(cue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-[68px] rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-center font-mono text-[11px] text-zinc-200 focus:border-yellow-400 focus:outline-none"
                        />
                        <span className="text-[11px] text-zinc-500">→</span>
                        <input
                          type="text"
                          aria-label={`Fin de frase ${index + 1}`}
                          value={endVal}
                          onFocus={() =>
                            setEditingTime({
                              cueId: cue.id,
                              field: "end",
                              value: formatTimecode(cue.end),
                            })
                          }
                          onChange={(e) =>
                            setEditingTime({
                              cueId: cue.id,
                              field: "end",
                              value: e.target.value,
                            })
                          }
                          onBlur={() => commitTimeEdit(cue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-[68px] rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-center font-mono text-[11px] text-zinc-200 focus:border-yellow-400 focus:outline-none"
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onRequirePro(
                            "Editar tiempos exactos de inicio y fin requiere Plan Pro."
                          )
                        }
                        title="Edición exacta de tiempos bloqueada (Plan Pro)"
                        className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-black/35 px-2 py-0.5 font-mono text-[11px] text-zinc-400 transition hover:border-yellow-400/40 hover:text-yellow-200"
                      >
                        <Lock className="h-2.5 w-2.5 text-yellow-400/80" />
                        <span>
                          {formatTimecode(cue.start)} → {formatTimecode(cue.end)}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {cue.words.length >= 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          isPro
                            ? onSplitCue(cue.id)
                            : onRequirePro(
                                "Dividir frases manualmente en tiempos exactos es una función Pro."
                              )
                        }
                        title={
                          isPro
                            ? "Dividir frase en dos"
                            : "Dividir frase (Plan Pro)"
                        }
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-100"
                      >
                        <Scissors className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {index < cues.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          isPro
                            ? onMergeWithNext(cue.id)
                            : onRequirePro(
                                "Unir frases con ajuste de tiempos es una función Pro."
                              )
                        }
                        title={
                          isPro
                            ? "Unir con la frase siguiente"
                            : "Unir frases (Plan Pro)"
                        }
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-100"
                      >
                        <Merge className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteCue(cue.id)}
                      title="Eliminar frase"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-500/15 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Free Basic Text Editor */}
                <textarea
                  rows={2}
                  aria-label={`Texto de frase ${index + 1}`}
                  value={cue.text}
                  onChange={(e) => onUpdateCueText(cue.id, e.target.value)}
                  placeholder="Escribe el subtítulo..."
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-sm leading-snug text-white placeholder:text-zinc-600 focus:border-yellow-400/70 focus:outline-none"
                />

                {/* Word-Level Timestamp Pills */}
                {cue.words.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cue.words.map((word) => {
                      const wordActive =
                        currentTime >= word.start && currentTime <= word.end;
                      return (
                        <button
                          key={word.id}
                          type="button"
                          onClick={() => onSeekTo(word.start)}
                          title={`Ir a ${word.start.toFixed(2)}s – ${word.end.toFixed(2)}s`}
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition ${
                            wordActive
                              ? "border-yellow-400/70 bg-yellow-400/20 text-yellow-200"
                              : "border-white/[0.07] bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          <span>{word.text}</span>
                          <span className="font-mono text-[9px] text-zinc-500">
                            {word.start.toFixed(1)}s
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
