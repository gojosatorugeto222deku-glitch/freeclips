"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SubtitlePreviewOverlay } from "@/components/SubtitlePreviewOverlay";
import { findActiveCueAndWord, formatTimecode } from "@/lib/subtitles";
import type {
  SubtitleCue,
  SubtitleSettings,
  VideoMetadata,
} from "@/types/subtitle";

interface VideoStageProps {
  videoUrl: string;
  videoMeta: VideoMetadata;
  cues: SubtitleCue[];
  settings: SubtitleSettings;
  currentTime: number;
  onTimeUpdate: (timeSec: number) => void;
  onVideoLoadedMetadata?: (width: number, height: number, duration: number) => void;
  seekRequest: { time: number; seq: number } | null;
}

export function VideoStage({
  videoUrl,
  videoMeta,
  cues,
  settings,
  currentTime,
  onTimeUpdate,
  onVideoLoadedMetadata,
  seekRequest,
}: VideoStageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameBoxRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = frameBoxRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setRenderedSize({
        width: rect.width,
        height: rect.height,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [videoUrl, videoMeta.width, videoMeta.height]);

  useEffect(() => {
    if (!seekRequest || !videoRef.current) return;
    const clamped = Math.max(
      0,
      Math.min(videoMeta.duration || 9999, seekRequest.time)
    );
    videoRef.current.currentTime = clamped;
    onTimeUpdate(clamped);
  }, [seekRequest, videoMeta.duration, onTimeUpdate]);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      if (videoRef.current && !videoRef.current.paused) {
        onTimeUpdate(videoRef.current.currentTime);
        rafId = requestAnimationFrame(tick);
      }
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(tick);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying, onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { cue: activeCue, activeWordIndex } = useMemo(
    () => findActiveCueAndWord(cues, currentTime),
    [cues, currentTime]
  );

  const duration = Math.max(0.1, videoMeta.duration || 1);
  const progressPct = Math.min(100, Math.max(0, (currentTime / duration) * 100));
  const isVerticalPreview = Boolean(settings.convertToVertical916);
  const previewVideoWidth = isVerticalPreview ? 1080 : videoMeta.width;
  const previewVideoHeight = isVerticalPreview ? 1920 : videoMeta.height;

  return (
    <div className="studio-surface flex flex-col rounded-2xl border border-white/[0.08] p-3 sm:p-4">
      {/* Stage Canvas */}
      <div className="relative flex min-h-[310px] w-full items-center justify-center overflow-hidden rounded-xl border border-white/[0.06] bg-[#050609] p-2.5 sm:min-h-[440px] sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(250,204,21,0.06),transparent_60%)]"
        />

        {isVerticalPreview && (
          <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-yellow-400/35 bg-black/70 px-2.5 py-1 text-[10.5px] font-semibold text-yellow-200 backdrop-blur-md">
            <Smartphone className="h-3 w-3 text-yellow-400" />
            Recorte 9:16 activo
          </div>
        )}

        <div
          ref={frameBoxRef}
          onClick={togglePlay}
          className={`relative z-10 inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-black shadow-[0_24px_60px_-15px_rgba(0,0,0,0.95)] ring-1 ring-white/12 ${
            isVerticalPreview ? "aspect-[9/16] h-[54vh] sm:h-[60vh]" : ""
          }`}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted={isMuted}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              onVideoLoadedMetadata?.(
                v.videoWidth || 1080,
                v.videoHeight || 1920,
                v.duration || 0
              );
              if (frameBoxRef.current) {
                const rect = frameBoxRef.current.getBoundingClientRect();
                setRenderedSize({ width: rect.width, height: rect.height });
              }
            }}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            onSeeked={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className={
              isVerticalPreview
                ? "block h-full w-full select-none object-cover"
                : "block max-h-[54vh] w-auto max-w-full select-none object-contain sm:max-h-[60vh]"
            }
          />

          <SubtitlePreviewOverlay
            cue={activeCue}
            activeWordIndex={activeWordIndex}
            settings={settings}
            videoWidth={previewVideoWidth}
            videoHeight={previewVideoHeight}
            renderedWidth={renderedSize.width}
            renderedHeight={renderedSize.height}
          />

          {!isPlaying && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-xl backdrop-blur-md">
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls & Cue Timeline */}
      <div className="mt-3.5 space-y-2.5 px-1">
        {/* Scrub track with subtitle cue markers + playhead dot */}
        <div className="group relative flex h-6 items-center">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
            {cues.map((c) => {
              const leftPct = Math.min(100, (c.start / duration) * 100);
              const widthPct = Math.max(
                0.7,
                Math.min(100 - leftPct, ((c.end - c.start) / duration) * 100)
              );
              return (
                <div
                  key={c.id}
                  className="absolute top-0 bottom-0 bg-yellow-400/35"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                />
              );
            })}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-black bg-yellow-300 shadow-md transition-transform group-hover:scale-125"
            style={{ left: `${progressPct}%` }}
          />
          <input
            type="range"
            aria-label="Línea de tiempo del video"
            min={0}
            max={duration}
            step={0.02}
            value={Math.min(duration, currentTime)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (videoRef.current) {
                videoRef.current.currentTime = next;
              }
              onTimeUpdate(next);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pausar video" : "Reproducir video"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/12 text-yellow-200 transition hover:bg-yellow-400 hover:text-black"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                }
                onTimeUpdate(0);
              }}
              aria-label="Reiniciar al principio"
              title="Volver al inicio"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.1] hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              aria-label={isMuted ? "Activar sonido" : "Silenciar"}
              title={isMuted ? "Activar sonido" : "Silenciar"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.1] hover:text-white"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-zinc-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>

            <div className="ml-1 font-mono text-xs text-zinc-300">
              <span className="font-semibold text-white">
                {formatTimecode(currentTime)}
              </span>
              <span className="mx-1 text-zinc-600">/</span>
              <span className="text-zinc-400">{formatTimecode(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-zinc-300">
              {videoMeta.width}×{videoMeta.height}
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <kbd className="rounded-md border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                Espacio
              </kbd>
              <span>Reproducir</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
