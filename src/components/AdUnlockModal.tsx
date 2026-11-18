"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Crown,
  Gift,
  Megaphone,
  Sparkles,
  X,
} from "lucide-react";
import {
  AD_UNLOCK_WAIT_SECONDS,
  EXTRA_PACK_VIDEOS,
  PLAN_CONFIGS,
} from "@/lib/usageLimits";
import type { QuotaSummary } from "@/lib/usageLimits";

interface AdUnlockModalProps {
  isOpen: boolean;
  quota: QuotaSummary;
  onClose: () => void;
  onClaimExtraPack: () => void;
  onOpenProModal: () => void;
}

export function AdUnlockModal({
  isOpen,
  quota,
  onClose,
  onClaimExtraPack,
  onOpenProModal,
}: AdUnlockModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(AD_UNLOCK_WAIT_SECONDS);

  useEffect(() => {
    if (!isOpen || !quota.allowsAdExtras || !quota.canClaimExtraPack) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const next = Math.max(0, AD_UNLOCK_WAIT_SECONDS - elapsed);
      setSecondsLeft(next);
      if (next === 0) {
        window.clearInterval(timer);
      }
    }, 250);

    return () => {
      window.clearInterval(timer);
      setSecondsLeft(AD_UNLOCK_WAIT_SECONDS);
    };
  }, [isOpen, quota.allowsAdExtras, quota.canClaimExtraPack, quota.extraPacksClaimed]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const waitPct = Math.round(
    ((AD_UNLOCK_WAIT_SECONDS - secondsLeft) / AD_UNLOCK_WAIT_SECONDS) * 100
  );
  const packNumber = quota.extraPacksClaimed + 1;
  const readyToClaim = secondsLeft === 0;
  const planCfg = PLAN_CONFIGS[quota.planTier];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-unlock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#0f1117] p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.1] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {quota.allowsAdExtras && quota.canClaimExtraPack ? (
          <>
            <div className="pr-8">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-[11px] font-semibold text-yellow-300">
                <Gift className="h-3.5 w-3.5" />
                <span>
                  Paquete extra {packNumber} de 2 · +{EXTRA_PACK_VIDEOS} videos
                  gratis
                </span>
              </div>
              <h2
                id="ad-unlock-title"
                className="mt-3 text-xl font-bold text-white"
              >
                Desbloquea +{EXTRA_PACK_VIDEOS} videos gratis hoy
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Alcanzaste tus videos disponibles ({quota.usedCount}/
                {quota.totalAllowed}). Espera{" "}
                <strong className="text-zinc-200">
                  {AD_UNLOCK_WAIT_SECONDS} segundos
                </strong>{" "}
                para activar un paquete extra gratuito (máximo{" "}
                {quota.maxDailyLimit} videos diarios).
              </p>
            </div>

            {/* 2 Reserved Ad Banner Slots */}
            <div className="mt-4 space-y-3">
              <div
                data-ad-slot="unlock-banner-1"
                className="flex min-h-[90px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-amber-400/30 bg-gradient-to-r from-zinc-900 via-[#151822] to-zinc-900 px-4 py-3 text-center"
              >
                <span className="inline-flex items-center gap-1.5 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  <Megaphone className="h-3 w-3 text-amber-400" />
                  Espacio reservado · Anuncio 1 (728×90 / Adaptable)
                </span>
                <p className="mt-1.5 text-xs text-zinc-500">
                  Banner publicitario patrocinado · Carga sin interrumpir tu
                  edición
                </p>
              </div>

              <div
                data-ad-slot="unlock-banner-2"
                className="flex min-h-[128px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-cyan-400/30 bg-gradient-to-br from-zinc-900 via-[#131924] to-zinc-950 px-4 py-4 text-center"
              >
                <span className="inline-flex items-center gap-1.5 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  <Megaphone className="h-3 w-3 text-cyan-400" />
                  Espacio reservado · Anuncio 2 (300×250 / Display)
                </span>
                <p className="mt-1.5 text-xs text-zinc-500">
                  Bloque reservado para red de anuncios o patrocinador oficial
                </p>
              </div>
            </div>

            {/* 15-Second Countdown Progress */}
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/35 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-zinc-200">
                  {readyToClaim ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>¡Listo! Ya puedes reclamar tus +5 videos</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-400" />
                      <span>
                        Desbloqueando paquete en{" "}
                        <strong className="font-mono text-yellow-300">
                          {secondsLeft}s
                        </strong>
                        ...
                      </span>
                    </>
                  )}
                </span>
                <span className="font-mono text-xs text-zinc-400">
                  {waitPct}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    readyToClaim ? "bg-emerald-400" : "bg-yellow-400"
                  }`}
                  style={{ width: `${Math.max(4, waitPct)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!readyToClaim}
                onClick={onClaimExtraPack}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-500/15 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {readyToClaim
                    ? `Reclamar +${EXTRA_PACK_VIDEOS} videos gratis`
                    : `Espera ${secondsLeft}s...`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProModal();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-yellow-400/35 bg-yellow-400/10 px-4 py-3 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-400/20"
              >
                <Crown className="h-4 w-4 text-yellow-400" />
                <span>Plan Creador ($3 USD)</span>
              </button>
            </div>
          </>
        ) : (
          <div className="py-3 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10 text-yellow-400">
              <Crown className="h-6 w-6" />
            </div>
            <h2
              id="ad-unlock-title"
              className="text-xl font-bold text-white"
            >
              Límite diario de {quota.maxDailyLimit} videos alcanzado (
              {planCfg.label})
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-400">
              {quota.planTier === "free"
                ? `Ya usaste tus 5 videos base y los 2 paquetes extra gratuitos de hoy (${quota.usedCount}/${quota.maxDailyLimit}). Tu cuota gratuita se reinicia mañana o puedes pasar al Plan Creador (20 videos diarios).`
                : `Ya utilizaste los ${quota.totalAllowed} videos incluidos hoy en tu ${planCfg.label}. Tu cuota se reinicia automáticamente a medianoche.`}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {quota.planTier === "free" && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProModal();
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-yellow-500/15 transition hover:bg-yellow-300"
                >
                  <Crown className="h-4 w-4" />
                  <span>Pasar a Plan Creador ($3 USD/mes)</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
