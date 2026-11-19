"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Crown,
  Download,
  Lock,
  Palette,
  Subtitles,
  X,
} from "lucide-react";
import { AdUnlockModal } from "@/components/AdUnlockModal";
import { ExportPanel } from "@/components/ExportPanel";
import { Header } from "@/components/Header";
import { ProSubscriptionModal } from "@/components/ProSubscriptionModal";
import { SiteFooter } from "@/components/SiteFooter";
import { StylePicker } from "@/components/StylePicker";
import { SubtitleEditor } from "@/components/SubtitleEditor";
import {
  isSupportedVideoFile,
  UploadDropzone,
} from "@/components/UploadDropzone";
import { VideoStage } from "@/components/VideoStage";
import { generateAssSubtitles } from "@/lib/assGenerator";
import { extractAudio16kMono } from "@/lib/audioExtractor";
import {
  formatFileSizeMb,
  isMobileBrowser,
  MOBILE_WARNING_BYTES,
} from "@/lib/device";
import {
  computeTargetExportDimensions,
  shouldUseSafe720pExport,
} from "@/lib/exportUtils";
import {
  burnSubtitlesWithFFmpeg,
  cancelFFmpegExport,
  disposeFFmpeg,
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
import {
  cancelTranscription,
  disposeWhisperWorker,
  transcribeAudioInBrowser,
} from "@/lib/whisperClient";
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
  const transcriptionAbortRef = useRef<AbortController | null>(null);

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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(false);
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

  // AI transcription state (default to Ligero ~39 MB for fast, reliable load on desktop & mobile)
  const [selectedModel, setSelectedModel] = useState<WhisperModelId>(
    "onnx-community/whisper-tiny_timestamped"
  );
  const [transcriptionStage, setTranscriptionStage] =
    useState<TranscriptionStage>("idle");
  const [transcriptionMessage, setTranscriptionMessage] = useState("");
  const [modelProgress, setModelProgress] = useState<ModelProgressInfo | null>(
    null
  );
  const [livePreviewText, setLivePreviewText] = useState("");
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
    Promise.resolve().then(() => {
      setIsMobile(isMobileBrowser());
    });
  }, []);

  useEffect(() => {
    if (activeTab === "export" && !isMobile) {
      let cancelled = false;
      void disposeWhisperWorker().then(() => {
        if (!cancelled) {
          preloadFFmpeg();
        }
      });
      const id = window.setInterval(() => {
        setIsFfmpegWarm(isFFmpegLoaded());
      }, 600);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }
  }, [activeTab, isMobile]);

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

      if (transcriptionAbortRef.current) {
        transcriptionAbortRef.current.abort();
        transcriptionAbortRef.current = null;
        cancelTranscription();
      }

      const mobileNow = isMobileBrowser();
      setIsMobile(mobileNow);
      setMobileWarningDismissed(false);
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
      setLivePreviewText("");
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

  const handleCancelTranscription = useCallback(() => {
    if (transcriptionAbortRef.current) {
      transcriptionAbortRef.current.abort();
      transcriptionAbortRef.current = null;
    }
    cancelTranscription();
    disposeFFmpeg();
    setIsFfmpegWarm(false);
    setTranscriptionStage("idle");
    setTranscriptionMessage("");
    setModelProgress(null);
    setLivePreviewText("");
    setTranscriptionError("Transcripción cancelada.");
  }, []);

  const handleStartTranscription = async () => {
    if (!videoFile) return;
    if (!checkCanProcessVideo()) return;

    // Phase 1 separation: guarantee FFmpeg WASM heap is unloaded before loading AI tensors.
    disposeFFmpeg();
    setIsFfmpegWarm(false);

    const abortController = new AbortController();
    transcriptionAbortRef.current = abortController;

    setTranscriptionError(null);
    setModelProgress(null);
    setLivePreviewText("");
    setTranscriptionStage("extracting-audio");
    setTranscriptionMessage("Decodificando pista de audio a 16 kHz...");

    try {
      const pcm = await extractAudio16kMono(videoFile, {
        signal: abortController.signal,
        onFallbackToFFmpeg: () => {
          setTranscriptionMessage(
            "Preparando extractor de audio compatible..."
          );
        },
        onFfmpegDownloadProgress: (ratio) => {
          setModelProgress({
            file: "audio-extractor",
            progress: Math.round(Math.max(0, Math.min(100, ratio * 100))),
            status: "progress",
            phase: ratio >= 1 ? "initializing" : "downloading",
          });
        },
      });

      if (abortController.signal.aborted) return;

      setModelProgress(null);
      setTranscriptionStage("loading-model");
      setTranscriptionMessage("Preparando modelo de voz IA...");

      const result = await transcribeAudioInBrowser({
        audio: pcm,
        modelId: selectedModel,
        durationSec: videoMeta?.duration || undefined,
        signal: abortController.signal,
        onDeviceDetected: (dev) => setActiveDevice(dev),
        onStatus: (stage, msg) => {
          setTranscriptionStage(stage);
          setTranscriptionMessage(msg);
        },
        onModelProgress: (progress) => setModelProgress(progress),
        onLiveText: (text) => setLivePreviewText(text),
      });

      if (abortController.signal.aborted) return;

      const grouped = groupWordsIntoCues(
        result.words,
        settings.maxWordsPerCue
      );
      if (grouped.length === 0) {
        setTranscriptionStage("error");
        setTranscriptionError(
          "No se detectaron palabras claras en español. Prueba el modo Balanceado o verifica que el video tenga voz audible."
        );
        return;
      }

      setCues(grouped);
      setTranscriptionStage("ready");
      setTranscriptionMessage("");
      setModelProgress(null);
      setLivePreviewText("");
      markVideoCreditConsumed();
      markExportStaleIfNeeded();
    } catch (err) {
      if (abortController.signal.aborted) return;
      setTranscriptionStage("error");
      setTranscriptionError(
        err instanceof Error
          ? err.message
          : "No se pudo completar la transcripción en el navegador."
      );
    } finally {
      if (transcriptionAbortRef.current === abortController) {
        transcriptionAbortRef.current = null;
      }
      // Phase 1 cleanup: completely destroy/release Transformers.js pipeline & worker RAM
      // before the user triggers Phase 2 (FFmpeg export).
      await disposeWhisperWorker();
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
      // Sequential Phase 2 guard: release any lingering AI worker/tensors and yield briefly
      // so mobile browsers reclaim RAM before allocating FFmpeg WASM.
      await disposeWhisperWorker();
      await new Promise((resolve) => setTimeout(resolve, 60));

      const effectiveStyle = resolveEffectiveStyle(settings);
      const convertVertical = Boolean(settings.convertToVertical916);
      const safe720p = shouldUseSafe720pExport(
        videoMeta.width,
        videoMeta.height,
        isMobile
      );
      const targetDims = computeTargetExportDimensions(
        videoMeta.width,
        videoMeta.height,
        exportQuality,
        convertVertical,
        safe720p
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
        isMobile,
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
      setIsFfmpegWarm(!isMobile);
      setExportStage("done");
      setIsExportStale(false);
      markVideoCreditConsumed();
    } catch (err) {
      if (cancelRequestedRef.current) return;
      setIsFfmpegWarm(false);
      setExportStage("error");
      setExportError(
        err instanceof Error
          ? err.message
          : "No se pudo exportar el video en este dispositivo."
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
  const hasExported = Boolean(exportedVideoUrl && exportStage === "done");

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
            {/* Guided 3-Step Studio Workflow Bar */}
            <div className="studio-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.08] px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("subtitles")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "subtitles"
                      ? "bg-yellow-400/15 text-yellow-200 ring-1 ring-yellow-400/40"
                      : validCueCount > 0
                        ? "text-emerald-300 hover:bg-white/[0.05]"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      validCueCount > 0
                        ? "bg-emerald-400 text-black"
                        : activeTab === "subtitles"
                          ? "bg-yellow-400 text-black"
                          : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {validCueCount > 0 ? <Check className="h-3 w-3 stroke-[3]" /> : "1"}
                  </span>
                  <span>Transcribir</span>
                </button>

                <ChevronRight className="hidden h-3.5 w-3.5 text-zinc-600 sm:block" />

                <button
                  type="button"
                  onClick={() => setActiveTab("style")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "style"
                      ? "bg-yellow-400/15 text-yellow-200 ring-1 ring-yellow-400/40"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      activeTab === "style"
                        ? "bg-yellow-400 text-black"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    2
                  </span>
                  <span>Personalizar estilo</span>
                </button>

                <ChevronRight className="hidden h-3.5 w-3.5 text-zinc-600 sm:block" />

                <button
                  type="button"
                  onClick={() => setActiveTab("export")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "export"
                      ? "bg-yellow-400/15 text-yellow-200 ring-1 ring-yellow-400/40"
                      : hasExported
                        ? "text-emerald-300 hover:bg-white/[0.05]"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      hasExported
                        ? "bg-emerald-400 text-black"
                        : activeTab === "export"
                          ? "bg-yellow-400 text-black"
                          : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {hasExported ? <Check className="h-3 w-3 stroke-[3]" /> : "3"}
                  </span>
                  <span>Exportar MP4</span>
                </button>
              </div>

              <div className="hidden items-center gap-2 text-[11px] text-zinc-400 md:flex">
                <span className="truncate max-w-[200px] font-medium text-zinc-200">
                  {videoMeta.name}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="font-mono">
                  {formatFileSizeMb(videoMeta.sizeBytes)} MB
                </span>
              </div>
            </div>

            {isMobile &&
              videoMeta.sizeBytes > MOBILE_WARNING_BYTES &&
              !mobileWarningDismissed && (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-200">
                        Archivo pesado para celular (
                        {formatFileSizeMb(videoMeta.sizeBytes)} MB)
                      </p>
                      <p className="mt-0.5 text-amber-100/90">
                        En celulares Android o iPhone, videos mayores a 60 MB
                        pueden saturar la memoria del navegador. Recomendamos
                        subir clips cortos (15–60 seg) para máxima velocidad; al
                        exportar aplicaremos escala automática a máximo 720p.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileWarningDismissed(true)}
                    aria-label="Cerrar aviso de tamaño móvil"
                    className="rounded p-1 text-amber-300 hover:bg-amber-400/20 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

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

            <div className="grid flex-1 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.18fr)_448px]">
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
              <section className="studio-surface flex flex-col rounded-2xl border border-white/[0.08]">
                {/* Tab Bar */}
                <div className="grid grid-cols-3 gap-1.5 border-b border-white/[0.08] p-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("subtitles")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      activeTab === "subtitles"
                        ? "bg-white/[0.1] text-white shadow-sm ring-1 ring-white/10"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Subtitles className="h-3.5 w-3.5" />
                    <span>Subtítulos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("style")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      activeTab === "style"
                        ? "bg-white/[0.1] text-white shadow-sm ring-1 ring-white/10"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Palette className="h-3.5 w-3.5" />
                    <span>Estilo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("export")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      activeTab === "export"
                        ? "bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 text-black shadow-sm"
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
                      livePreviewText={livePreviewText}
                      activeDevice={activeDevice}
                      errorMessage={transcriptionError}
                      videoName={videoMeta.name}
                      onStartTranscription={handleStartTranscription}
                      onCancelTranscription={handleCancelTranscription}
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
                      isMobile={isMobile}
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

      <SiteFooter onOpenProModal={() => openProModal()} />
    </div>
  );
}
