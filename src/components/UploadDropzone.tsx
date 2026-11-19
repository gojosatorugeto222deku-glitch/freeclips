"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  Download,
  FileVideo,
  Flame,
  Heart,
  Lock,
  MessageCircle,
  Play,
  Share2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";
import type { SubtitleStyleId } from "@/types/subtitle";

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  errorMessage?: string | null;
  onOpenProModal?: () => void;
}

const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];

export function isSupportedVideoFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return true;
  }
  return file.type === "video/mp4" || file.type === "video/quicktime";
}

const DEMO_WORDS = ["SUBTÍTULOS", "VIRALES", "SIN", "MARCA"];

const DEMO_STYLES: Array<{
  id: SubtitleStyleId;
  label: string;
  tagline: string;
  pillAccent: string;
}> = [
  {
    id: "tiktok",
    label: "TikTok",
    tagline: "Alto contraste amarillo",
    pillAccent: "border-yellow-400/70 bg-yellow-400/15 text-yellow-200",
  },
  {
    id: "minimal",
    label: "Minimalista",
    tagline: "Editorial blanco limpio",
    pillAccent: "border-zinc-300/60 bg-white/12 text-white",
  },
  {
    id: "neon",
    label: "Neón Pro",
    tagline: "Halo cian + magenta",
    pillAccent: "border-cyan-400/70 bg-cyan-400/15 text-cyan-200",
  },
];

const STEPS = [
  {
    num: "01",
    icon: UploadCloud,
    title: "Sube tu clip MP4 o MOV",
    description:
      "Arrastra un video vertical de Reels/TikTok o uno horizontal de YouTube. Todo se abre al instante sin subir archivos a servidores.",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "IA transcribe en segundos",
    description:
      "Detectamos cada palabra en español con tiempos exactos. Edita el texto, cambia el estilo y mira la vista previa en tiempo real.",
  },
  {
    num: "03",
    icon: Download,
    title: "Exporta MP4 sin marca de agua",
    description:
      "Descarga tu video listo para publicar en alta calidad (más archivos .SRT y .ASS incluidos desde el plan gratuito).",
  },
];

const FAQS = [
  {
    q: "¿Mis videos se suben a algún servidor?",
    a: "No. Tanto el análisis de audio como el renderizado del video final ocurren directamente en tu dispositivo. Tus clips nunca salen de tu navegador.",
  },
  {
    q: "¿El plan gratuito deja marca de agua?",
    a: "Nunca. Todos los videos exportados en FreeClips salen limpios, sin logotipos ni marcas de agua, desde el primer clip gratuito.",
  },
  {
    q: "¿Qué incluye exactamente el Plan Gratuito vs Plan Creador?",
    a: "Gratis tienes 5 videos diarios de hasta 90 segundos (ampliables a 15 con dos recargas rápidas dentro de la app). Plan Creador te da 20 videos diarios de hasta 15 minutos, Editor Visual Pro (fuentes, colores y posición) y conversión automática a Vertical 9:16.",
  },
  {
    q: "¿Cómo funciona el descuento a $3 USD/mes y puedo cancelar?",
    a: "Al conectar tu cuenta de Google y compartir FreeClips en redes desde el panel de planes, el Plan Creador baja permanentemente de $5 a $3 USD/mes. Puedes gestionar o cancelar tu suscripción antes del siguiente cobro.",
  },
];

export function UploadDropzone({
  onFileSelected,
  errorMessage,
  onOpenProModal,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewStyle, setPreviewStyle] = useState<SubtitleStyleId>("tiktok");
  const [activeWordIdx, setActiveWordIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % DEMO_WORDS.length);
    }, 680);
    return () => window.clearInterval(timer);
  }, []);

  const handleCandidate = (file: File | undefined | null) => {
    if (!file) return;
    if (!isSupportedVideoFile(file)) {
      setLocalError(
        `Formato no compatible (${file.name}). Sube un video MP4 o MOV.`
      );
      return;
    }
    setLocalError(null);
    onFileSelected(file);
  };

  const activeError = localError || errorMessage;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-2 pb-20 pt-6 sm:px-4 sm:pt-12">
      {/* Hidden shared file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.mov,video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => {
          handleCandidate(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* Asymmetric 2-Column Studio Hero */}
      <section className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.18fr)_minmax(310px,0.82fr)] lg:gap-12">
        {/* Left: Editorial Headline + Dropzone */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/[0.08] px-3.5 py-1.5 text-xs font-medium text-yellow-200 shadow-sm shadow-yellow-500/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>IA privada en tu navegador · 0 archivos en la nube</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[52px] lg:leading-[1.05]">
            Subtítulos dinámicos para tus clips,{" "}
            <span className="bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              sin marca de agua
            </span>
            .
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Transcribe voz en español palabra por palabra, elige tu estilo
            viral y descarga tu MP4 HD listo para TikTok, Reels y Shorts.
            Empieza con{" "}
            <span className="font-semibold text-zinc-100">
              5 videos gratis al día
            </span>{" "}
            (ampliables hasta 15 sin pagar).
          </p>

          {/* Elevated Dropzone Card */}
          <div className="relative mt-7 w-full max-w-xl">
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-1 rounded-[26px] bg-gradient-to-r from-yellow-400/25 via-amber-500/15 to-cyan-400/20 blur-xl transition-opacity duration-300 ${
                isDragging ? "opacity-100" : "opacity-60"
              }`}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleCandidate(e.dataTransfer.files?.[0]);
              }}
              className={`studio-surface group relative w-full cursor-pointer rounded-3xl border-2 border-dashed p-6 text-center transition-all duration-200 sm:p-8 ${
                isDragging
                  ? "scale-[1.01] border-yellow-400 bg-yellow-400/[0.08]"
                  : "border-white/15 hover:border-yellow-400/60"
              }`}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-400/25 bg-gradient-to-br from-yellow-400/15 to-amber-500/5 text-yellow-300 shadow-inner transition-transform duration-200 group-hover:scale-105 group-hover:border-yellow-400/50">
                <UploadCloud className="h-7 w-7" />
              </div>

              <p className="text-base font-bold text-white sm:text-lg">
                Arrastra tu video aquí o haz clic para subirlo
              </p>
              <p className="mt-1.5 text-xs text-zinc-400 sm:text-sm">
                Soporta{" "}
                <span className="font-mono font-medium text-zinc-200">.MP4</span>{" "}
                y{" "}
                <span className="font-mono font-medium text-zinc-200">.MOV</span>{" "}
                · Vertical 9:16, cuadrado o horizontal
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-yellow-500/25 transition group-hover:brightness-105">
                <FileVideo className="h-4 w-4" />
                <span>Elegir video del dispositivo</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                  <Lock className="h-3 w-3 text-emerald-400" />
                  100% local y privado
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                  <Zap className="h-3 w-3 text-yellow-400" />
                  Transcripción rápida
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                  MP4 + .SRT + .ASS
                </span>
              </div>
            </div>
          </div>

          {activeError && (
            <div className="mt-4 flex w-full max-w-xl items-center gap-2.5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-left text-xs text-red-200 sm:text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{activeError}</span>
            </div>
          )}
        </div>

        {/* Right: Live Interactive 9:16 Reels Studio Preview */}
        <div className="flex flex-col items-center">
          <div className="relative w-full max-w-[292px]">
            {/* Ambient studio aura behind phone */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute -inset-6 rounded-[44px] blur-3xl transition-all duration-500 ${
                previewStyle === "neon"
                  ? "bg-gradient-to-tr from-cyan-500/25 via-fuchsia-500/20 to-transparent"
                  : previewStyle === "minimal"
                    ? "bg-gradient-to-tr from-zinc-400/15 via-white/10 to-transparent"
                    : "bg-gradient-to-tr from-yellow-400/25 via-amber-500/15 to-transparent"
              }`}
            />

            {/* Titanium Phone Frame */}
            <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-[#0b0d13] p-2.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.06]">
              {/* Top speaker notch */}
              <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-white/10" />

              {/* 9:16 Video Screen */}
              <div className="relative aspect-[9/15.2] w-full overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-[#1a1f30] via-[#0f1320] to-[#08090e]">
                {/* Stylized cinematic creator bokeh backdrop */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      previewStyle === "neon"
                        ? "radial-gradient(circle at 25% 24%, rgba(6,182,212,0.34), transparent 52%), radial-gradient(circle at 78% 65%, rgba(217,70,239,0.28), transparent 55%)"
                        : previewStyle === "minimal"
                          ? "radial-gradient(circle at 50% 25%, rgba(255,255,255,0.16), transparent 55%), radial-gradient(circle at 30% 75%, rgba(161,161,170,0.14), transparent 52%)"
                          : "radial-gradient(circle at 28% 22%, rgba(250,204,21,0.28), transparent 50%), radial-gradient(circle at 78% 70%, rgba(245,158,11,0.2), transparent 55%)",
                  }}
                />

                {/* Top status overlay */}
                <div className="relative z-10 flex items-center justify-between px-3.5 pt-3 text-[10px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-zinc-100 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Vista previa 9:16
                  </span>
                  <span className="rounded-full bg-black/50 px-2 py-1 font-mono text-zinc-300 backdrop-blur-md">
                    1080p
                  </span>
                </div>

                {/* Stylized audio waveform visual in upper center */}
                <div className="relative z-10 mt-10 flex flex-col items-center px-5">
                  <div className="flex h-12 items-end gap-1.5">
                    {[0.45, 0.85, 0.6, 1, 0.75, 0.95, 0.5, 0.88, 0.65, 0.92, 0.55].map(
                      (h, idx) => (
                        <span
                          key={idx}
                          className={`animate-eq-bar w-1.5 rounded-full ${
                            previewStyle === "neon"
                              ? "bg-gradient-to-t from-cyan-400 to-fuchsia-400"
                              : previewStyle === "minimal"
                                ? "bg-white/75"
                                : "bg-gradient-to-t from-amber-500 to-yellow-300"
                          }`}
                          style={{
                            height: `${Math.round(h * 40)}px`,
                            animationDelay: `${idx * 0.11}s`,
                          }}
                        />
                      )
                    )}
                  </div>
                  <span className="mt-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 font-mono text-[10px] text-zinc-300 backdrop-blur-sm">
                    IA sincronizando palabra a palabra
                  </span>
                </div>

                {/* Right-side Reels UI silhouette */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-40 right-2.5 z-10 flex flex-col items-center gap-2.5 text-white/60"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
                    <Heart className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm">
                    <Share2 className="h-3.5 w-3.5" />
                  </div>
                </div>

                {/* Live Animated Subtitle Preview */}
                <div className="absolute inset-x-4 bottom-16 z-20 flex min-h-[72px] items-center justify-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center leading-tight">
                    {DEMO_WORDS.map((word, idx) => {
                      const isActive = idx === activeWordIdx;
                      const isSpoken = idx < activeWordIdx;

                      if (previewStyle === "tiktok") {
                        return (
                          <span
                            key={word}
                            className="inline-block text-[19px] uppercase tracking-wide transition-transform duration-150"
                            style={{
                              fontFamily: "'SubLimpioTikTok', sans-serif",
                              fontWeight: 800,
                              color: isActive || isSpoken ? "#FFE600" : "#FFFFFF",
                              transform: isActive ? "scale(1.1)" : "scale(1)",
                              WebkitTextStroke: "3.5px #000000",
                              paintOrder: "stroke fill",
                              textShadow: "0 3px 8px rgba(0,0,0,0.95)",
                            }}
                          >
                            {word}
                          </span>
                        );
                      }

                      if (previewStyle === "minimal") {
                        const label =
                          idx === 0
                            ? "Subtítulos"
                            : idx === 1
                              ? "virales"
                              : idx === 2
                                ? "sin"
                                : "marca";
                        return (
                          <span
                            key={word}
                            className="inline-block text-[20px] transition-opacity duration-150"
                            style={{
                              fontFamily: "'SubLimpioMinimal', sans-serif",
                              fontWeight: 600,
                              color: "#FFFFFF",
                              opacity: isActive || isSpoken ? 1 : 0.58,
                              textShadow: "0 2px 12px rgba(0,0,0,0.95)",
                            }}
                          >
                            {label}
                          </span>
                        );
                      }

                      const neonLabel =
                        idx === 0
                          ? "Brillo"
                          : idx === 1
                            ? "Neón"
                            : idx === 2
                              ? "en"
                              : "vivo";
                      return (
                        <span
                          key={word}
                          className="inline-block text-[21px] font-bold transition-transform duration-150"
                          style={{
                            fontFamily: "'SubLimpioNeon', sans-serif",
                            color: isActive ? "#FFFFFF" : "#CFFAFE",
                            transform: isActive ? "scale(1.08)" : "scale(1)",
                            WebkitTextStroke: `1px ${isActive ? "#E879F9" : "#06B6D4"}`,
                            paintOrder: "stroke fill",
                            textShadow: isActive
                              ? "0 0 10px rgba(217,70,239,0.95), 0 0 22px rgba(232,121,249,0.9)"
                              : "0 0 10px rgba(6,182,212,0.85)",
                          }}
                        >
                          {neonLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Mini Player Scrubber Bar */}
                <div className="absolute inset-x-3 bottom-3.5 z-20 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-black">
                      <Play className="ml-0.5 h-2.5 w-2.5 fill-current" />
                    </span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                        style={{
                          width: `${((activeWordIdx + 1) / DEMO_WORDS.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[9.5px] text-zinc-300">
                      00:0{activeWordIdx + 2}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Style Switcher Pills */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-zinc-400">
                Prueba los 3 estilos incluidos gratis:
              </span>
              <div className="grid w-full grid-cols-3 gap-1.5">
                {DEMO_STYLES.map((st) => {
                  const selected = previewStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setPreviewStyle(st.id)}
                      className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold transition ${
                        selected
                          ? st.pillAccent
                          : "border-white/[0.09] bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-100"
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capability Trust Strip */}
      <div className="mt-14 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="studio-surface-subtle flex items-center gap-3.5 rounded-2xl border border-white/[0.07] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-400/25 bg-yellow-400/10 text-yellow-300">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              Transcripción palabra por palabra
            </p>
            <p className="mt-0.5 text-[11.5px] text-zinc-400">
              Optimizada en español con carga ligera (~39 MB).
            </p>
          </div>
        </div>

        <div className="studio-surface-subtle flex items-center gap-3.5 rounded-2xl border border-white/[0.07] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              Edición visual en tiempo real
            </p>
            <p className="mt-0.5 text-[11.5px] text-zinc-400">
              Corrige frases y ajusta el estilo viendo cada cuadro.
            </p>
          </div>
        </div>

        <div className="studio-surface-subtle flex items-center gap-3.5 rounded-2xl border border-white/[0.07] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              MP4 HD sin marca de agua
            </p>
            <p className="mt-0.5 text-[11.5px] text-zinc-400">
              Privacidad total: tu video jamás abandona tu equipo.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section
        id="como-funciona"
        className="mt-20 w-full scroll-mt-24 border-t border-white/[0.07] pt-16"
      >
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Flujo en 3 pasos
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            De video crudo a clip subtitulado en minutos
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="studio-surface relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 transition hover:border-yellow-400/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-400/25 bg-yellow-400/10 text-yellow-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-2xl font-extrabold text-white/[0.08]">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans overview */}
      <section
        id="planes"
        className="mt-20 w-full max-w-4xl scroll-mt-24 border-t border-white/[0.07] pt-16"
      >
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Precios transparentes
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Empieza gratis hoy, escala cuando publiques más
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="studio-surface flex flex-col justify-between rounded-2xl border border-white/[0.09] p-6 sm:p-7">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Plan Gratuito
              </span>
              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="text-xs text-zinc-400">USD / mes</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Ideal para creadores que publican clips diarios sin costo.
              </p>
              <ul className="mt-6 space-y-3 text-xs text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>5 videos diarios (hasta 15 con 2 recargas gratis)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Videos de hasta 90 segundos (1:30)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>3 estilos virales + descarga MP4 sin marca de agua</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-7 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-xs font-bold text-white transition hover:border-white/25 hover:bg-white/[0.1]"
            >
              Subir mi primer video gratis
            </button>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-yellow-400/75 bg-gradient-to-br from-yellow-500/[0.12] via-[#131724] to-emerald-500/[0.08] p-6 shadow-2xl shadow-yellow-500/10 sm:p-7">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
                  <Flame className="h-3 w-3" />
                  Plan Creador · -40% posible
                </span>
              </div>
              <div className="mt-3.5 flex flex-wrap items-baseline gap-2">
                <span className="text-base font-semibold text-zinc-400 line-through">
                  $5 USD
                </span>
                <span className="text-4xl font-extrabold text-yellow-300">
                  $3
                </span>
                <span className="text-xs text-zinc-300">
                  USD / mes con descuento viral
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-300">
                Para publicar todos los días sin topes cortos ni formato limitado.
              </p>
              <ul className="mt-6 space-y-3 text-xs text-zinc-200">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Hasta 20 videos diarios de hasta 15 minutos</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Editor Visual Pro (fuentes, colores, posición y tiempos)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Conversión automática a Vertical 9:16 lista para Reels/TikTok</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={onOpenProModal}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 px-4 py-3 text-xs font-extrabold text-black shadow-lg shadow-yellow-500/20 transition hover:brightness-105"
            >
              <Crown className="h-4 w-4" />
              <span>Desbloquear $3 USD o suscribirme ($5 USD)</span>
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="mt-20 w-full max-w-3xl scroll-mt-24 border-t border-white/[0.07] pt-16"
      >
        <div className="mb-9 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Dudas comunes
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Preguntas frecuentes
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="studio-surface-subtle group rounded-2xl border border-white/[0.08] px-5 py-4 text-left transition hover:border-white/15"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180 group-open:text-yellow-400" />
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-yellow-400/25 bg-gradient-to-r from-yellow-400/[0.1] via-[#121622] to-cyan-400/[0.05] px-6 py-5 shadow-xl sm:flex-row">
          <div>
            <p className="text-sm font-bold text-white">
              ¿Listo para subtitular tu próximo clip?
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Sube un MP4 o MOV y ten tu video exportado sin marca de agua.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400 px-5 py-2.5 text-xs font-extrabold text-black shadow-lg shadow-yellow-500/20 transition hover:brightness-105"
          >
            <Sparkles className="h-4 w-4" />
            <span>Comenzar ahora</span>
          </button>
        </div>
      </section>
    </div>
  );
}
