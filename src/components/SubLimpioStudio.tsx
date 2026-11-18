"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Download,
  Lock,
  Palette,
  Subtitles,
  X,
} from "lucide-react";
import { AdUnlockModal } from "@/components/AdUnlockModal";
import { BrandLogo } from "@/components/BrandLogo";
import { ExportPanel } from "@/components/ExportPanel";
import { Header } from "@/components/Header";
import { ProSubscriptionModal } from "@/components/ProSubscriptionModal";
import { StylePicker } from "@/components/StylePicker";
import { SubtitleEditor } from "@/components/SubtitleEditor";
import {
  isSupportedVideoFile,
  UploadDropzone,
} from "@/components/UploadDropzone";
import { VideoStage } from "@/components/VideoStage";
import { generateAssSubtitles } from "@/lib/assGenerator";
import { extractAudio16kMono } from "@/lib/audioExtractor";
import { computeTargetExportDimensions } from "@/lib/exportUtils";
import {
  burnSubtitlesWithFFmpeg,
  cancelFFmpegExport,
  isFFmpegLoaded,
  preloadFFmpeg,
} from "@/lib/ffmpegClient";
import {
  DEFAULT_SUBTITLE_SETTINGS,
  resolveEffectiveStyle,
} from "@/lib/styles";
import {
  createEmptyCueAt,
  extractWordsFromCues,
  formatTimeShort,
  groupWordsIntoCues,
  mergeTwoCues,
  shiftAllCues,
  splitCueInMiddle,
  updateCueText,
  updateCueTiming,
} from "@/lib/subtitles";
import {
  claimExtraVideoPack,
  consumeVideoCredit,
  getDiscountSnapshot,
  getQuotaSummary,
  getServerDiscountSnapshot,
  getServerUsageSnapshot,
  getUsageSnapshot,
  hasCreatorAccess,
  isVideoDurationBlocked,
  loadDiscountState,
  loadUsageState,
  PLAN_CONFIGS,
  saveDiscountState,
  saveUsageState,
  subscribeLocalStorage,
} from "@/lib/usageLimits";
import { transcribeAudioInBrowser } from "@/lib/whisperClient";
import type {
  ExportQualityPreset,
  ExportStage,
  ModelProgressInfo,
  ProDiscountState,
  SubtitleCue,
  SubtitleSettings,
  TranscriptionStage,
  VideoMetadata,
  WhisperModelId,
} from "@/types/subtitle";

type StudioTab = "subtitles" | "style" | "export";

export function SubLimpioStudio() {
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRequestedRef = useRef(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [creditedForCurrentVideo, setCreditedForCurrentVideo] = useState(false);

  const usageState = useSyncExternalStore(
    subscribeLocalStorage,
    getUsageSnapshot,
    getServerUsageSnapshot
  );
  const discountState = useSyncExternalStore(
    subscribeLocalStorage,
    getDiscountSnapshot,
    getServerDiscountSnapshot
  );
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proModalReason, setProModalReason] = useState<string | null>(null);
  const [checkoutBanner, setCheckoutBanner] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<StudioTab>("subtitles");
  const [currentTime, setCurrentTime] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{
    time: number;
    seq: number;
  } | null>(null);

  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [settings, setSettings] = useState<SubtitleSettings>(
    DEFAULT_SUBTITLE_SETTINGS
  );

  // Whisper transcription state
  const [selectedModel, setSelectedModel] = useState<WhisperModelId>(
    "onnx-community/whisper-base_timestamped"
  );
  const [transcriptionStage, setTranscriptionStage] =
    useState<TranscriptionStage>("idle");
  const [transcriptionMessage, setTranscriptionMessage] = useState("");
  const [modelProgress, setModelProgress] = useState<ModelProgressInfo | null>(
    null
  );
  const [activeDevice, setActiveDevice] = useState<"webgpu" | "wasm" | null>(
    null
  );
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );

  // FFmpeg export state
  const [exportQuality, setExportQuality] =
    useState<ExportQualityPreset>("fast");
  const [exportStage, setExportStage] = useState<ExportStage>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [isFfmpegWarm, setIsFfmpegWarm] = useState(false);
  const [ffmpegLogs, setFfmpegLogs] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedSizeBytes, setExportedSizeBytes] = useState<number | null>(
    null
  );
  const [exportedDims, setExportedDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isExportStale, setIsExportStale] = useState(false);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    };
  }, [exportedVideoUrl]);

  useEffect(() => {
    if (activeTab === "export") {
      preloadFFmpeg();
      const id = window.setInterval(() => {
        setIsFfmpegWarm(isFFmpegLoaded());
      }, 600);
      return () => window.clearInterval(id);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("checkout_session_id")?.trim() || "";
    const canceled = params.get("checkout_canceled") === "1";

    if (!sessionId && !canceled) return;

    window.history.replaceState({}, "", window.location.pathname);

    if (canceled) {
      Promise.resolve().then(() => {
        setCheckoutBanner({
          type: "info",
          text: "El pago fue cancelado. Puedes seguir usando FreeClips gratis o intentarlo cuando quieras.",
        });
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          verified?: boolean;
          customerEmail?: string;
          subscriptionId?: string;
          error?: string;
        };
        if (cancelled) return;
        if (res.ok && data.verified) {
          const current = loadDiscountState();
          saveDiscountState({
            ...current,
            planTier: "creator",
            stripeCustomerEmail:
              data.customerEmail || current.stripeCustomerEmail,
            stripeSubscriptionId:
              data.subscriptionId || current.stripeSubscriptionId,
          });
          setCheckoutBanner({
            type: "success",
            text: "¡Pago verificado! Plan Creador activado (20 videos/día, hasta 15 min, Editor Pro y Vertical 9:16).",
          });
        } else {
          setCheckoutBanner({
            type: "error",
            text:
              data.error ||
              "No pudimos confirmar el pago en Stripe todavía. Si ya te cobraron, usa 'Restaurar Plan Creador' con tu correo.",
          });
        }
      } catch {
        if (!cancelled) {
          setCheckoutBanner({
            type: "error",
            text: "Error de red al verificar tu pago. Abre Planes Pro → '¿Ya pagaste? Activar o restaurar Plan Creador'.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const planTier = discountState.planTier;
  const hasCreator = hasCreatorAccess(planTier);
  const quota = useMemo(
    () => getQuotaSummary(usageState, planTier),
    [usageState, planTier]
  );
  const durationBlocked = Boolean(
    videoMeta && isVideoDurationBlocked(videoMeta.duration, planTier)
  );
  const planCfg = PLAN_CONFIGS[planTier];

  const openProModal = useCallback((reason?: string) => {
    setProModalReason(reason ?? null);
    setProModalOpen(true);
  }, []);

  const handleUpdateDiscountState = useCallback((next: ProDiscountState) => {
    saveDiscountState(next);
  }, []);

  const handleClaimExtraPack = useCallback(() => {
    const fresh = loadUsageState("free");
    saveUsageState(claimExtraVideoPack(fresh));
    setAdModalOpen(false);
  }, []);

  const markVideoCreditConsumed = useCallback(() => {
    if (creditedForCurrentVideo) return;
    const fresh = loadUsageState(planTier);
    saveUsageState(consumeVideoCredit(fresh, planTier));
    setCreditedForCurrentVideo(true);
  }, [planTier, creditedForCurrentVideo]);

  const checkCanProcessVideo = useCallback((): boolean => {
    if (videoMeta && isVideoDurationBlocked(videoMeta.duration, planTier)) {
      openProModal(
        `Tu video dura ${formatTimeShort(
          videoMeta.duration
        )}. Tu ${planCfg.label} admite hasta ${planCfg.maxDurationLabel}.`
      );
      return false;
    }
    if (!creditedForCurrentVideo) {
      const current = loadUsageState(planTier);
      if (getQuotaSummary(current, planTier).remaining <= 0) {
        setAdModalOpen(true);
        return false;
      }
    }
    return true;
  }, [planTier, planCfg, videoMeta, creditedForCurrentVideo, openProModal]);

  const markExportStaleIfNeeded = useCallback(() => {
    setIsExportStale((prev) => (exportedVideoUrl ? true : prev));
  }, [exportedVideoUrl]);

  const loadSelectedVideo = useCallback(
    (file: File) => {
      if (!isSupportedVideoFile(file)) {
        setUploadError(
          `Formato no compatible (${file.name}). Sube un archivo MP4 o MOV.`
        );
        return;
      }

      setUploadError(null);
      if (exportedVideoUrl) {
        URL.revokeObjectURL(exportedVideoUrl);
      }

      const nextUrl = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(nextUrl);
      setVideoMeta({
        name: file.name,
        sizeBytes: file.size,
        duration: 0,
        width: 1080,
        height: 1920,
        mimeType: file.type || "video/mp4",
      });
      setCreditedForCurrentVideo(false);
      setCues([]);
      setCurrentTime(0);
      setActiveTab("subtitles");
      setTranscriptionStage("idle");
      setTranscriptionError(null);
      setModelProgress(null);
      setExportStage("idle");
      setDownloadProgress(0);
      setExportProgress(0);
      setExportError(null);
      setExportedVideoUrl(null);
      setExportedSizeBytes(null);
      setExportedDims(null);
      setIsExportStale(false);
      setFfmpegLogs([]);
    },
    [exportedVideoUrl]
  );

  const handleVideoMetadata = useCallback(
    (width: number, height: number, duration: number) => {
      setVideoMeta((prev) =>
        prev
          ? {
              ...prev,
              width: width || prev.width,
              height: height || prev.height,
              duration: duration || prev.duration,
            }
          : prev
      );
    },
    []
  );

  const handleSeekTo = useCallback((timeSec: number) => {
    setSeekRequest((prev) => ({
      time: timeSec,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  const handleStartTranscription = async () => {
    if (!videoFile) return;
    if (!checkCanProcessVideo()) return;

    setTranscriptionError(null);
    setModelProgress(null);
    setTranscriptionStage("extracting-audio");
    setTranscriptionMessage("Decodificando pista de audio a 16 kHz...");

    try {
      const pcm = await extractAudio16kMono(videoFile, () => {
        setTranscriptionMessage("Extrayendo pista de audio del video...");
      });

      setTranscriptionStage("loading-model");
      setTranscriptionMessage("Cargando modelo de voz en español...");

      const result = await transcribeAudioInBrowser({
        audio: pcm,
        modelId: selectedModel,
        durationSec: videoMeta?.duration || undefined,
        onDeviceDetected: (dev) => setActiveDevice(dev),
        onStatus: (stage, msg) => {
          setTranscriptionStage(stage);
          setTranscriptionMessage(msg);
        },
        onModelProgress: (progress) => setModelProgress(progress),
      });

      const grouped = groupWordsIntoCues(
        result.words,
        settings.maxWordsPerCue
      );
      if (grouped.length === 0) {
        setTranscriptionStage("error");
        setTranscriptionError(
          "No se detectaron palabras claras en español. Prueba el modo Preciso o añade subtítulos manualmente."
        );
        return;
      }

      setCues(grouped);
      setTranscriptionStage("ready");
      setTranscriptionMessage("");
      markVideoCreditConsumed();
      markExportStaleIfNeeded();
    } catch (err) {
      setTranscriptionStage("error");
      setTranscriptionError(
        err instanceof Error
          ? err.message
          : "No se pudo completar la transcripción en el navegador."
      );
    }
  };

  const handleSettingsChange = (next: SubtitleSettings) => {
    setSettings(next);
    markExportStaleIfNeeded();
  };

  const handleQualityChange = (nextQuality: ExportQualityPreset) => {
    setExportQuality(nextQuality);
    markExportStaleIfNeeded();
  };

  const handleMaxWordsChange = (maxWords: number) => {
    setSettings((prev) => ({ ...prev, maxWordsPerCue: maxWords }));
    setCues((prev) => {
      if (prev.length === 0) return prev;
      const words = extractWordsFromCues(prev);
      return groupWordsIntoCues(words, maxWords);
    });
    markExportStaleIfNeeded();
  };

  const handleUpdateCueText = (cueId: string, nextText: string) => {
    setCues((prev) =>
      prev.map((c) => (c.id === cueId ? updateCueText(c, nextText) : c))
    );
    markExportStaleIfNeeded();
  };

  const handleUpdateCueTiming = (
    cueId: string,
    startSec: number,
    endSec: number
  ) => {
    if (!hasCreator) return;
    setCues((prev) =>
      prev.map((c) =>
        c.id === cueId ? updateCueTiming(c, startSec, endSec) : c
      )
    );
    markExportStaleIfNeeded();
  };

  const handleSplitCue = (cueId: string) => {
    if (!hasCreator) return;
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === cueId);
      if (idx === -1) return prev;
      const split = splitCueInMiddle(prev[idx]);
      if (!split) return prev;
      const copy = [...prev];
      copy.splice(idx, 1, split[0], split[1]);
      return copy;
    });
    markExportStaleIfNeeded();
  };

  const handleMergeWithNext = (cueId: string) => {
    if (!hasCreator) return;
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === cueId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const merged = mergeTwoCues(prev[idx], prev[idx + 1]);
      const copy = [...prev];
      copy.splice(idx, 2, merged);
      return copy;
    });
    markExportStaleIfNeeded();
  };

  const handleDeleteCue = (cueId: string) => {
    setCues((prev) => prev.filter((c) => c.id !== cueId));
    markExportStaleIfNeeded();
  };

  const handleAddCue = () => {
    if (!hasCreator) return;
    const newCue = createEmptyCueAt(
      currentTime,
      videoMeta?.duration || undefined
    );
    setCues((prev) =>
      [...prev, newCue].sort((a, b) => a.start - b.start)
    );
    markExportStaleIfNeeded();
  };

  const handleShiftAll = (deltaSec: number) => {
    if (!hasCreator) return;
    setCues((prev) =>
      shiftAllCues(prev, deltaSec, videoMeta?.duration || undefined)
    );
    markExportStaleIfNeeded();
  };

  const handleCancelExport = () => {
    cancelRequestedRef.current = true;
    cancelFFmpegExport();
    setIsFfmpegWarm(false);
    setExportStage("idle");
    setDownloadProgress(0);
    setExportProgress(0);
    setExportError("Exportación cancelada.");
  };

  const handleStartExport = async () => {
    if (!videoFile || !videoMeta || cues.length === 0) return;
    if (!checkCanProcessVideo()) return;

    cancelRequestedRef.current = false;
    setActiveTab("export");
    setExportError(null);
    setFfmpegLogs([]);
    setDownloadProgress(isFFmpegLoaded() ? 1 : 0);
    setExportProgress(0);
    setExportStage("loading-ffmpeg");

    try {
      const effectiveStyle = resolveEffectiveStyle(settings);
      const convertVertical = Boolean(settings.convertToVertical916);
      const targetDims = computeTargetExportDimensions(
        videoMeta.width,
        videoMeta.height,
        exportQuality,
        convertVertical
      );
      const assContent = generateAssSubtitles(cues, {
        width: targetDims.width,
        height: targetDims.height,
        settings,
      });

      const result = await burnSubtitlesWithFFmpeg({
        file: videoFile,
        assContent,
        fontFileName: effectiveStyle.fontFileName,
        customFontBytes: settings.uploadedFont?.bytes,
        sourceWidth: videoMeta.width,
        sourceHeight: videoMeta.height,
        quality: exportQuality,
        convertToVertical916: convertVertical,
        durationSec: videoMeta.duration || undefined,
        onStage: (stage) => {
          setExportStage(stage);
          if (stage !== "loading-ffmpeg") {
            setIsFfmpegWarm(true);
          }
        },
        onDownloadProgress: (ratio) => setDownloadProgress(ratio),
        onProgress: (ratio) => setExportProgress(ratio),
        onLog: (line) =>
          setFfmpegLogs((prev) => [...prev.slice(-120), line]),
      });

      if (cancelRequestedRef.current) return;

      if (exportedVideoUrl) {
        URL.revokeObjectURL(exportedVideoUrl);
      }

      setExportedVideoUrl(result.url);
      setExportedSizeBytes(result.sizeBytes);
      setExportedDims({ width: result.width, height: result.height });
      setIsFfmpegWarm(true);
      setExportStage("done");
      setIsExportStale(false);
      markVideoCreditConsumed();
    } catch (err) {
      if (cancelRequestedRef.current) return;
      setExportStage("error");
      setExportError(
        err instanceof Error
          ? err.message
          : "No se pudo exportar el video con FFmpeg.wasm."
      );
    }
  };

  const isTranscribing =
    transcriptionStage === "extracting-audio" ||
    transcriptionStage === "loading-model" ||
    transcriptionStage === "transcribing";
  const isExporting =
    exportStage === "loading-ffmpeg" ||
    exportStage === "preparing" ||
    exportStage === "encoding";
  const isBusy = isTranscribing || isExporting;

  const validCueCount = cues.filter((c) => c.text.trim().length > 0).length;

  return (
    <div className="studio-grid-bg flex min-h-screen flex-col">
      <input
        ref={replaceInputRef}
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadSelectedVideo(f);
          e.target.value = "";
        }}
      />

      <Header
        videoMeta={videoMeta}
        hasCues={validCueCount > 0}
        isBusy={isBusy}
        planTier={planTier}
        quota={quota}
        onChangeVideoClick={() => replaceInputRef.current?.click()}
        onQuickExportClick={handleStartExport}
        onOpenQuotaModal={() => setAdModalOpen(true)}
        onOpenProModal={() => openProModal()}
      />

      <AdUnlockModal
        isOpen={adModalOpen}
        quota={quota}
        onClose={() => setAdModalOpen(false)}
        onClaimExtraPack={handleClaimExtraPack}
        onOpenProModal={() => openProModal()}
      />

      <ProSubscriptionModal
        isOpen={proModalOpen}
        reasonMessage={proModalReason}
        discountState={discountState}
        onUpdateDiscountState={handleUpdateDiscountState}
        onClose={() => setProModalOpen(false)}
      />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-5 sm:px-6">
        {checkoutBanner && (
          <div
            className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
              checkoutBanner.type === "success"
                ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-100"
                : checkoutBanner.type === "error"
                  ? "border-amber-400/40 bg-amber-400/12 text-amber-100"
                  : "border-white/15 bg-white/[0.05] text-zinc-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {checkoutBanner.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              )}
              <span>{checkoutBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutBanner(null)}
              aria-label="Cerrar aviso de pago"
              className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {!videoUrl || !videoMeta ? (
          <UploadDropzone
            onFileSelected={loadSelectedVideo}
            errorMessage={uploadError}
            onOpenProModal={() => openProModal()}
          />
        ) : (
          <div className="space-y-4">
            {durationBlocked && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    Este video dura{" "}
                    <strong className="font-mono">
                      {formatTimeShort(videoMeta.duration)}
                    </strong>
                    . Tu {planCfg.label} admite videos de hasta{" "}
                    <strong>{planCfg.maxDurationLabel}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openProModal(
                      `Los videos que superan ${planCfg.maxDurationLabel} requieren actualizar tu plan.`
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-1.5 font-bold text-black transition hover:bg-yellow-300"
                >
                  <Crown className="h-3.5 w-3.5" />
                  <span>Ampliar plan</span>
                </button>
              </div>
            )}

            <div className="grid flex-1 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.18fr)_440px]">
              {/* Left Stage: Video + Live Synced Subtitles */}
              <div className="lg:sticky lg:top-20">
                <VideoStage
                  videoUrl={videoUrl}
                  videoMeta={videoMeta}
                  cues={cues}
                  settings={settings}
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  onVideoLoadedMetadata={handleVideoMetadata}
                  seekRequest={seekRequest}
                />
              </div>

              {/* Right Studio Sidebar */}
              <section className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0f1117]">
                {/* Tab Bar */}
                <div className="grid grid-cols-3 gap-1 border-b border-white/[0.08] p-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("subtitles")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === "subtitles"
                        ? "bg-white/[0.09] text-white shadow-sm"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Subtitles className="h-3.5 w-3.5" />
                    <span>Subtítulos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("style")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === "style"
                        ? "bg-white/[0.09] text-white shadow-sm"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Palette className="h-3.5 w-3.5" />
                    <span>Estilo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("export")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === "export"
                        ? "bg-yellow-400 text-black shadow-sm"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Exportar</span>
                  </button>
                </div>

                {/* Active Panel Body */}
                <div className="p-4">
                  {activeTab === "subtitles" && (
                    <SubtitleEditor
                      cues={cues}
                      currentTime={currentTime}
                      planTier={planTier}
                      isDurationBlocked={durationBlocked}
                      selectedModel={selectedModel}
                      onSelectModel={setSelectedModel}
                      stage={transcriptionStage}
                      statusMessage={transcriptionMessage}
                      modelProgress={modelProgress}
                      activeDevice={activeDevice}
                      errorMessage={transcriptionError}
                      videoName={videoMeta.name}
                      onStartTranscription={handleStartTranscription}
                      onRequirePro={openProModal}
                      onSeekTo={handleSeekTo}
                      onUpdateCueText={handleUpdateCueText}
                      onUpdateCueTiming={handleUpdateCueTiming}
                      onSplitCue={handleSplitCue}
                      onMergeWithNext={handleMergeWithNext}
                      onDeleteCue={handleDeleteCue}
                      onAddCue={handleAddCue}
                      onShiftAll={handleShiftAll}
                    />
                  )}

                  {activeTab === "style" && (
                    <StylePicker
                      settings={settings}
                      planTier={planTier}
                      onChange={handleSettingsChange}
                      onMaxWordsChange={handleMaxWordsChange}
                      onRequirePro={openProModal}
                      hasCues={cues.length > 0}
                    />
                  )}

                  {activeTab === "export" && (
                    <ExportPanel
                      videoMeta={videoMeta}
                      cues={cues}
                      cueCount={validCueCount}
                      planTier={planTier}
                      settings={settings}
                      quality={exportQuality}
                      onQualityChange={handleQualityChange}
                      stage={exportStage}
                      downloadProgress={downloadProgress}
                      progress={exportProgress}
                      isFfmpegWarm={isFfmpegWarm}
                      logs={ffmpegLogs}
                      errorMessage={exportError}
                      exportedVideoUrl={exportedVideoUrl}
                      exportedSizeBytes={exportedSizeBytes}
                      exportedDims={exportedDims}
                      isExportStale={isExportStale}
                      isDurationBlocked={durationBlocked}
                      onStartExport={handleStartExport}
                      onCancelExport={handleCancelExport}
                      onRequirePro={openProModal}
                    />
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.06] bg-[#07080b]/80 py-6 text-xs text-zinc-400">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandLogo size={24} />
            <span className="font-semibold text-zinc-200">FreeClips</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">
              Subtítulos automáticos sin marca de agua
            </span>
          </div>

          <nav
            aria-label="Enlaces legales y soporte"
            className="flex flex-wrap items-center justify-center gap-4 text-zinc-400"
          >
            <button
              type="button"
              onClick={() => openProModal()}
              className="transition hover:text-white"
            >
              Planes Pro
            </button>
            <Link href="/privacidad" className="transition hover:text-white">
              Privacidad
            </Link>
            <Link href="/terminos" className="transition hover:text-white">
              Términos
            </Link>
            <a
              href="mailto:seinendeku222@gmail.com"
              className="transition hover:text-white"
            >
              Soporte
            </a>
            <span className="text-zinc-600">© 2026</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
