"use client";

import {
  Building2,
  Crown,
  Download,
  Film,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { formatTimeShort } from "@/lib/subtitles";
import { PLAN_CONFIGS, type QuotaSummary } from "@/lib/usageLimits";
import type { PlanTier, VideoMetadata } from "@/types/subtitle";

interface HeaderProps {
  videoMeta: VideoMetadata | null;
  hasCues: boolean;
  isBusy: boolean;
  planTier: PlanTier;
  quota: QuotaSummary;
  onChangeVideoClick: () => void;
  onQuickExportClick: () => void;
  onOpenQuotaModal: () => void;
  onOpenProModal: () => void;
}

export function Header({
  videoMeta,
  hasCues,
  isBusy,
  planTier,
  quota,
  onChangeVideoClick,
  onQuickExportClick,
  onOpenQuotaModal,
  onOpenProModal,
}: HeaderProps) {
  const planLabel = PLAN_CONFIGS[planTier].label;

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#07080b]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={36} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">
                FreeClips
              </span>
              <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 sm:inline-flex">
                Sin marca de agua
              </span>
            </div>
            <p className="hidden text-xs text-zinc-400 md:block">
              Subtítulos automáticos para Reels, TikTok y Shorts
            </p>
          </div>
        </div>

        {!videoMeta && (
          <nav
            aria-label="Navegación principal"
            className="hidden items-center gap-5 text-xs font-medium text-zinc-400 lg:flex"
          >
            <a href="#como-funciona" className="transition hover:text-white">
              Cómo funciona
            </a>
            <a href="#planes" className="transition hover:text-white">
              Planes
            </a>
            <a href="#faq" className="transition hover:text-white">
              Preguntas
            </a>
          </nav>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onOpenQuotaModal}
            title={`Videos disponibles hoy (${planLabel})`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
              quota.remaining === 0
                ? "border-amber-400/50 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25"
                : "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08]"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-yellow-400" />
            <span className="font-mono">
              {quota.remaining}/{quota.totalAllowed}
            </span>
            <span className="hidden sm:inline">hoy</span>
          </button>

          {planTier === "free" ? (
            <button
              type="button"
              onClick={onOpenProModal}
              className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-400/20"
            >
              <Crown className="h-3.5 w-3.5 text-yellow-400" />
              <span>Planes Pro</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenProModal}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                planTier === "agency"
                  ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25"
                  : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
              }`}
            >
              {planTier === "agency" ? (
                <Building2 className="h-3.5 w-3.5" />
              ) : (
                <Crown className="h-3.5 w-3.5" />
              )}
              <span>{planLabel}</span>
            </button>
          )}

          {!videoMeta && (
            <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Privacidad total · Sin registro</span>
            </div>
          )}

          {videoMeta && (
            <>
              <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 xl:flex">
                <Film className="h-3.5 w-3.5 text-zinc-400" />
                <span className="max-w-[160px] truncate font-medium text-zinc-100">
                  {videoMeta.name}
                </span>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-zinc-400">
                  {videoMeta.width}×{videoMeta.height}
                </span>
                <span className="text-zinc-500">·</span>
                <span className="font-mono text-zinc-400">
                  {formatTimeShort(videoMeta.duration)}
                </span>
              </div>

              <button
                type="button"
                onClick={onChangeVideoClick}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cambiar video</span>
              </button>

              <button
                type="button"
                onClick={onQuickExportClick}
                disabled={!hasCues || isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-semibold text-black shadow-md shadow-yellow-500/15 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
              >
                <Download className="h-3.5 w-3.5 stroke-[2.4]" />
                <span className="hidden sm:inline">Exportar MP4</span>
                <span className="sm:hidden">MP4</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
