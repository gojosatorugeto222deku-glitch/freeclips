"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Flame,
  Loader2,
  Lock,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import {
  isFirebaseConfigured,
  signInWithGooglePopup,
  signOutFirebase,
} from "@/lib/firebaseClient";
import { resolveStripeCheckoutLink } from "@/lib/stripeLinks";
import {
  hasCreatorAccess,
  isViralDiscountUnlocked,
  SOCIAL_VERIFY_SECONDS,
} from "@/lib/usageLimits";
import type { ProDiscountState } from "@/types/subtitle";

interface ProSubscriptionModalProps {
  isOpen: boolean;
  reasonMessage?: string | null;
  discountState: ProDiscountState;
  onUpdateDiscountState: (next: ProDiscountState) => void;
  onClose: () => void;
}

export function ProSubscriptionModal({
  isOpen,
  reasonMessage,
  discountState,
  onUpdateDiscountState,
  onClose,
}: ProSubscriptionModalProps) {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [shareVerifyingLeft, setShareVerifyingLeft] = useState<number | null>(
    null
  );
  const [checkoutLoadingTier, setCheckoutLoadingTier] = useState<
    "5usd" | "3usd" | null
  >(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState(
    discountState.stripeCustomerEmail || discountState.googleEmail || ""
  );
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const firebaseReady = isFirebaseConfigured();
  const discountUnlocked = isViralDiscountUnlocked(discountState);
  const isAlreadyCreator = hasCreatorAccess(discountState.planTier);
  const isVerifyingShare = shareVerifyingLeft !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isVerifyingShare) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const next = Math.max(0, SOCIAL_VERIFY_SECONDS - elapsed);
      if (next <= 0) {
        window.clearInterval(timer);
        setShareVerifyingLeft(null);
        onUpdateDiscountState({
          ...discountState,
          socialShared: true,
        });
      } else {
        setShareVerifyingLeft(next);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [isVerifyingShare, discountState, onUpdateDiscountState]);

  if (!isOpen) return null;

  const handleGoogleConnect = () => {
    setAuthError(null);
    setCheckoutNotice(null);

    if (!firebaseReady) {
      setAuthError(
        "El acceso con Google está terminando de activarse. Puedes usar 'Simular conexión demo' mientras se habilita."
      );
      return;
    }

    setAuthLoading(true);
    signInWithGooglePopup()
      .then((user) => {
        onUpdateDiscountState({
          ...discountState,
          googleConnected: true,
          googleEmail: user.email,
          googleDisplayName: user.displayName,
          googlePhotoUrl: user.photoURL,
        });
      })
      .catch((err) => {
        setAuthError(
          err instanceof Error
            ? err.message
            : "Error al iniciar sesión con Google."
        );
      })
      .finally(() => {
        setAuthLoading(false);
      });
  };

  const handleSimulatedGoogleDemo = () => {
    setAuthError(null);
    onUpdateDiscountState({
      ...discountState,
      googleConnected: true,
      googleEmail: "demo@freeclips.local",
      googleDisplayName: "Cuenta Google (Demo local)",
    });
  };

  const handleGoogleDisconnect = () => {
    signOutFirebase().catch(() => {});
    onUpdateDiscountState({
      ...discountState,
      googleConnected: false,
      googleEmail: undefined,
      googleDisplayName: undefined,
      googlePhotoUrl: undefined,
    });
  };

  const handleSocialShare = (network: "x" | "whatsapp" | "facebook") => {
    setCheckoutNotice(null);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (typeof window !== "undefined"
        ? window.location.origin
        : "https://freeclips.up.railway.app");
    const shareText =
      "Estoy creando subtítulos automáticos sin marca de agua directo en el navegador con FreeClips";

    let intentUrl = "";
    if (network === "x") {
      intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(appUrl)}`;
    } else if (network === "whatsapp") {
      intentUrl = `https://wa.me/?text=${encodeURIComponent(
        `${shareText} ${appUrl}`
      )}`;
    } else {
      intentUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        appUrl
      )}`;
    }

    window.open(intentUrl, "_blank", "noopener,noreferrer");

    if (!discountState.socialShared && shareVerifyingLeft === null) {
      setShareVerifyingLeft(SOCIAL_VERIFY_SECONDS);
    }
  };

  const handleStripeCheckout = async (tier: "5usd" | "3usd") => {
    setCheckoutNotice(null);
    setRestoreSuccess(null);

    const resolved = resolveStripeCheckoutLink(
      tier,
      discountState.googleEmail
    );
    if (resolved.configured && resolved.url) {
      window.open(resolved.url, "_blank", "noopener,noreferrer");
      return;
    }

    setCheckoutLoadingTier(tier);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          email: discountState.googleEmail,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setCheckoutNotice(
        data.error ||
          "La pasarela de Stripe aún está completando su activación. Si ya realizaste un pago, puedes validarlo abajo con tu correo."
      );
    } catch {
      setCheckoutNotice(
        "No se pudo conectar con la pasarela de pago. Intenta de nuevo en unos segundos."
      );
    } finally {
      setCheckoutLoadingTier(null);
    }
  };

  const handleRestoreSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutNotice(null);
    setRestoreSuccess(null);

    const emailToCheck = (
      restoreEmail ||
      discountState.googleEmail ||
      ""
    ).trim();
    if (!emailToCheck) {
      setCheckoutNotice("Ingresa el correo con el que pagaste en Stripe.");
      return;
    }

    setRestoreLoading(true);
    try {
      const response = await fetch("/api/stripe/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        active?: boolean;
        customerEmail?: string;
        subscriptionId?: string;
        error?: string;
      };

      if (!response.ok || !data.active) {
        setCheckoutNotice(
          data.error || "No encontramos una suscripción activa para ese correo."
        );
        return;
      }

      onUpdateDiscountState({
        ...discountState,
        planTier: "creator",
        stripeCustomerEmail: data.customerEmail || emailToCheck,
        stripeSubscriptionId: data.subscriptionId,
      });
      setRestoreSuccess("¡Listo! Plan Creador verificado y activado.");
    } catch {
      setCheckoutNotice(
        "No se pudo verificar tu suscripción en este momento."
      );
    } finally {
      setRestoreLoading(false);
    }
  };

  const completedSteps =
    (discountState.googleConnected ? 1 : 0) +
    (discountState.socialShared ? 1 : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#0f1117] p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal de planes"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.1] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Heading */}
        <div className="pr-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/35 bg-yellow-400/12 px-3 py-1 text-[11px] font-semibold text-yellow-300">
            <Crown className="h-3.5 w-3.5" />
            <span>FreeClips Planes · Sin marca de agua</span>
          </div>
          <h2
            id="pro-modal-title"
            className="mt-2.5 text-xl font-bold text-white sm:text-2xl"
          >
            Elige el plan ideal para tus videos
          </h2>
          {reasonMessage && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>{reasonMessage}</span>
            </div>
          )}
        </div>

        {/* 2-Column Plans Grid: Plan Gratuito | Plan Creador (Destacado) */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card 1: Plan Gratuito */}
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#131620] p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Plan Gratuito
                </span>
                {discountState.planTier === "free" && (
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold text-zinc-200">
                    Plan actual
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">$0</span>
                <span className="text-xs font-medium text-zinc-400">
                  USD / mes
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                Para probar FreeClips y crear clips cortos sin registro.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>
                    5 videos diarios (hasta 15 con 2 recargas de anuncios de
                    15s)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Videos de hasta 90 segundos (1:30)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>3 estilos base y edición libre de texto</span>
                </li>
                <li className="flex items-start gap-2 text-zinc-500">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span>Sin Editor Visual Pro ni conversión 9:16</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.1]"
            >
              {discountState.planTier === "free"
                ? "Seguir con el Plan Gratuito"
                : "Cerrar"}
            </button>
          </div>

          {/* Card 2: Plan Creador (Highlighted + Viral Discount $5 -> $3 USD/mes) */}
          <div className="relative flex flex-col justify-between rounded-xl border-2 border-yellow-400/80 bg-gradient-to-br from-yellow-500/[0.13] via-[#151822] to-emerald-500/[0.09] p-4 shadow-xl shadow-yellow-500/10">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  <Flame className="h-3 w-3" />
                  Destacado · -40% Descuento
                </span>
                <span className="font-mono text-[11px] font-semibold text-emerald-300">
                  {completedSteps}/2 pasos
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">
                  Plan Creador
                </span>
                {discountState.planTier === "creator" && (
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Activo
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-zinc-400 line-through">
                  $5 USD
                </span>
                <span className="text-3xl font-extrabold text-yellow-300">
                  {discountUnlocked ? "$3" : "$5"}
                </span>
                <span className="text-xs font-medium text-zinc-300">
                  USD / mes
                </span>
                <span className="rounded-md bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">
                  {discountUnlocked
                    ? "¡$3 USD activado!"
                    : "Baja a $3 USD abajo"}
                </span>
              </div>

              <ul className="mt-3.5 space-y-1.5 text-xs text-zinc-200">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>
                    Hasta <strong>20 videos diarios</strong> sin esperas ni
                    anuncios
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>
                    Videos de hasta <strong>15 minutos</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Editor Visual Pro (fuentes, colores, posición, tiempos)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Conversión automática a Vertical 9:16</span>
                </li>
              </ul>

              {/* Viral Discount Box inside Plan Creador */}
              <div className="mt-3.5 space-y-2 rounded-xl border border-yellow-400/35 bg-black/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">
                    DESCUENTO VIRAL · $3 USD/MES
                  </span>
                  <span className="text-[10px] text-zinc-400">2 pasos</span>
                </div>

                {/* Step 1: Google Auth */}
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {discountState.googleConnected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
                          1
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-white">
                        Conectar Google
                      </span>
                    </div>
                    {discountState.googleConnected && (
                      <button
                        type="button"
                        onClick={handleGoogleDisconnect}
                        className="text-[10px] text-zinc-400 underline hover:text-zinc-200"
                      >
                        Cambiar
                      </button>
                    )}
                  </div>

                  {discountState.googleConnected ? (
                    <p className="mt-1 truncate pl-5 text-[10px] text-emerald-300">
                      {discountState.googleEmail}
                    </p>
                  ) : (
                    <div className="mt-1.5 space-y-1 pl-5">
                      <button
                        type="button"
                        onClick={handleGoogleConnect}
                        disabled={authLoading}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60"
                      >
                        {authLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="font-bold text-blue-600">G</span>
                        )}
                        <span>Conectar con Google</span>
                      </button>
                      {!firebaseReady && (
                        <div className="text-[10px] text-amber-200/90">
                          <button
                            type="button"
                            onClick={handleSimulatedGoogleDemo}
                            className="font-semibold text-yellow-300 underline hover:text-yellow-200"
                          >
                            Simular conexión demo
                          </button>
                        </div>
                      )}
                      {authError && (
                        <p className="text-[10px] text-red-300">{authError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 2: Social Share (5s verification) */}
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center gap-1.5">
                    {discountState.socialShared ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
                        2
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-white">
                      Compartir en redes (5s)
                    </span>
                  </div>

                  {discountState.socialShared ? (
                    <p className="mt-1 pl-5 text-[10px] text-emerald-300">
                      Compartido verificado.
                    </p>
                  ) : shareVerifyingLeft !== null ? (
                    <div className="mt-1.5 flex items-center gap-1.5 pl-5 text-[11px] text-yellow-200">
                      <Clock className="h-3 w-3 animate-spin text-yellow-400" />
                      <span>
                        Verificando...{" "}
                        <strong className="font-mono">
                          {shareVerifyingLeft}s
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
                      <button
                        type="button"
                        onClick={() => handleSocialShare("x")}
                        className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-white hover:bg-white/[0.14]"
                      >
                        <Share2 className="h-2.5 w-2.5" />
                        X
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSocialShare("whatsapp")}
                        className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/25"
                      >
                        <Share2 className="h-2.5 w-2.5" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSocialShare("facebook")}
                        className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/15 px-2 py-1 text-[10px] font-medium text-blue-200 hover:bg-blue-500/25"
                      >
                        <Share2 className="h-2.5 w-2.5" />
                        Facebook
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {isAlreadyCreator ? (
                <div className="rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-3 text-center text-xs font-semibold text-emerald-200">
                  Plan Creador activo
                  {discountState.stripeCustomerEmail
                    ? ` · ${discountState.stripeCustomerEmail}`
                    : ""}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!discountUnlocked || checkoutLoadingTier !== null}
                    onClick={() => handleStripeCheckout("3usd")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-yellow-500/20 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                  >
                    {checkoutLoadingTier === "3usd" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Abriendo pago seguro...</span>
                      </>
                    ) : discountUnlocked ? (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Pagar Creador · $3 USD/mes</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Completa 2 pasos para $3 USD</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={checkoutLoadingTier !== null}
                    onClick={() => handleStripeCheckout("5usd")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.12] disabled:opacity-60"
                  >
                    {checkoutLoadingTier === "5usd" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Abriendo pago seguro...</span>
                      </>
                    ) : (
                      <>
                        <span>Suscribirse sin pasos · $5 USD/mes</span>
                        <ExternalLink className="h-3 w-3" />
                      </>
                    )}
                  </button>
                </>
              )}

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setRestoreOpen((prev) => !prev)}
                  className="text-[11px] text-zinc-400 underline hover:text-zinc-200"
                >
                  ¿Ya pagaste? Activar o restaurar Plan Creador
                </button>
              </div>

              {restoreOpen && (
                <form
                  onSubmit={handleRestoreSubscription}
                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5 sm:flex-row"
                >
                  <input
                    type="email"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    placeholder="tu-correo@ejemplo.com"
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0f1117] px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:border-yellow-400/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={restoreLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {restoreLoading && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    <span>Verificar</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {restoreSuccess && (
          <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-3.5 py-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{restoreSuccess}</span>
          </div>
        )}

        {checkoutNotice && (
          <div className="mt-4 flex min-w-0 items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {checkoutNotice}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
