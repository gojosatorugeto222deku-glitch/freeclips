"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Crown,
  FileVideo,
  Flame,
  Lock,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";

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

const STEPS = [
  {
    num: "01",
    title: "Sube tu clip MP4 o MOV",
    description:
      "Compatible con videos verticales de TikTok/Reels, cuadrados o horizontales de YouTube. Sin esperar cargas a servidores.",
  },
  {
    num: "02",
    title: "IA transcribe y sincroniza",
    description:
      "Genera subtítulos en español palabra por palabra en segundos, edita cualquier frase y elige tu estilo visual.",
  },
  {
    num: "03",
    title: "Exporta MP4 sin marca de agua",
    description:
      "Descarga tu video listo para publicar en alta calidad (y archivos .SRT o .ASS si los editas en otra herramienta).",
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
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      {/* Hero header */}
      <div className="mb-8 max-w-2xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3.5 py-1 text-xs font-medium text-yellow-300 shadow-sm shadow-yellow-500/10">
          <Lock className="h-3.5 w-3.5" />
          <span>Editor web privado · Sin subir tus videos a servidores</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
          Subtítulos dinámicos para tus videos cortos,{" "}
          <span className="bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
            sin marca de agua
          </span>
          .
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Transcribe voz en español palabra por palabra, edita el texto al
          instante, elige entre 3 estilos virales y descarga tu MP4 listo para
          publicar. Incluye{" "}
          <span className="font-medium text-zinc-200">
            5 videos gratis al día
          </span>{" "}
          (hasta 15 sin pagar).
        </p>
      </div>

      {/* Dropzone card with subtle studio glow */}
      <div className="relative w-full max-w-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-yellow-400/15 via-amber-500/10 to-cyan-400/15 opacity-75 blur-xl"
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
          className={`group relative w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center backdrop-blur-sm transition-all sm:p-11 ${
            isDragging
              ? "border-yellow-400 bg-yellow-400/[0.08] shadow-2xl shadow-yellow-500/15"
              : "border-white/15 bg-[#0f1117]/95 hover:border-yellow-400/55 hover:bg-[#131620]"
          }`}
        >
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

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-yellow-400 shadow-inner transition-transform duration-200 group-hover:scale-105 group-hover:border-yellow-400/40">
            <UploadCloud className="h-8 w-8" />
          </div>

          <p className="text-lg font-semibold text-white sm:text-xl">
            Arrastra tu video aquí o haz clic para seleccionarlo
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Compatible con{" "}
            <span className="font-mono text-zinc-200">.MP4</span> y{" "}
            <span className="font-mono text-zinc-200">.MOV</span> (Reels,
            TikTok, Shorts o YouTube)
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-yellow-500/20 transition group-hover:bg-yellow-300">
            <FileVideo className="h-4 w-4" />
            <span>Elegir video del dispositivo</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-400">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
              Listo en segundos
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
              Audio 100% privado
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
              Exporta MP4 + .SRT + .ASS
            </span>
          </div>
        </div>
      </div>

      {activeError && (
        <div className="mt-4 flex w-full max-w-2xl items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Style showcase */}
      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#0f1117]/85 p-4 transition hover:border-white/15">
          <div className="mb-3 flex h-14 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 to-black">
            <span
              className="text-base uppercase tracking-wide"
              style={{
                fontFamily: "'SubLimpioTikTok', sans-serif",
                fontWeight: 800,
                color: "#FFE600",
                WebkitTextStroke: "3px #000000",
                paintOrder: "stroke fill",
                textShadow: "0 2px 6px rgba(0,0,0,0.9)",
              }}
            >
              ¡ESTO ES <span className="text-white">VIRAL!</span>
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-100">
            Estilo TikTok Amarillo / Negro
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Alto contraste y resaltado palabra por palabra.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#0f1117]/85 p-4 transition hover:border-white/15">
          <div className="mb-3 flex h-14 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800/80 to-zinc-950">
            <span
              className="text-base text-white"
              style={{
                fontFamily: "'SubLimpioMinimal', sans-serif",
                fontWeight: 600,
                textShadow: "0 2px 10px rgba(0,0,0,0.85)",
              }}
            >
              Claridad <span className="text-zinc-400">editorial</span>
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-100">
            Estilo Minimalista Blanco
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Limpio, discreto y elegante para reels y tutoriales.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#0f1117]/85 p-4 transition hover:border-white/15">
          <div className="mb-3 flex h-14 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-950/60 via-zinc-950 to-fuchsia-950/50">
            <span
              className="text-base font-bold"
              style={{
                fontFamily: "'SubLimpioNeon', sans-serif",
                color: "#FFFFFF",
                textShadow:
                  "0 0 8px rgba(217,70,239,0.95), 0 0 18px rgba(6,182,212,0.85)",
              }}
            >
              Brillo Neón <span className="text-cyan-200">Pro</span>
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-100">
            Estilo Neón Eléctrico
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Doble halo luminoso cian y magenta para destacar.
          </p>
        </div>
      </div>

      {/* Trust row */}
      <div className="mt-6 grid w-full max-w-4xl grid-cols-1 gap-3 text-xs text-zinc-300 sm:grid-cols-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
          <Zap className="h-4 w-4 shrink-0 text-yellow-400" />
          <span>IA de voz palabra por palabra en español</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
          <Wand2 className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>Edición en vivo sincronizada con tu clip</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>Exportación MP4 HD sin marca de agua</span>
        </div>
      </div>

      {/* How it works */}
      <section
        id="como-funciona"
        className="mt-20 w-full max-w-4xl scroll-mt-24 border-t border-white/[0.07] pt-14"
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Flujo en 3 pasos
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            De video crudo a clip subtitulado en minutos
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-2xl border border-white/[0.08] bg-[#0f1117]/85 p-5"
            >
              <span className="inline-flex h-8 items-center rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2.5 font-mono text-xs font-bold text-yellow-300">
                {step.num}
              </span>
              <h3 className="mt-3 text-sm font-bold text-white">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans overview */}
      <section
        id="planes"
        className="mt-20 w-full max-w-4xl scroll-mt-24 border-t border-white/[0.07] pt-14"
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Precios transparentes
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Empieza gratis hoy, escala cuando publiques más
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-white/[0.09] bg-[#0f1117]/90 p-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Plan Gratuito
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-white">$0</span>
                <span className="text-xs text-zinc-400">USD / mes</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Ideal para creadores que suben clips diarios sin costo.
              </p>
              <ul className="mt-5 space-y-2.5 text-xs text-zinc-300">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>5 videos diarios (hasta 15 con 2 recargas gratis)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Videos de hasta 90 segundos (1:30)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>3 estilos virales + descarga MP4 sin marca de agua</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Subir mi primer video gratis
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border-2 border-yellow-400/75 bg-gradient-to-br from-yellow-500/[0.11] via-[#131620] to-emerald-500/[0.07] p-6 shadow-xl shadow-yellow-500/10">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  <Flame className="h-3 w-3" />
                  Plan Creador · -40% posible
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-2">
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
              <ul className="mt-5 space-y-2.5 text-xs text-zinc-200">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Hasta 20 videos diarios de hasta 15 minutos</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Editor Visual Pro (fuentes, colores, posición y tiempos)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Conversión automática a Vertical 9:16 lista para Reels/TikTok</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={onOpenProModal}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-yellow-500/20 transition hover:bg-yellow-300"
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
        className="mt-20 w-full max-w-3xl scroll-mt-24 border-t border-white/[0.07] pt-14"
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Dudas comunes
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Preguntas frecuentes
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-white/[0.08] bg-[#0f1117]/85 px-5 py-4 text-left"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-yellow-400/25 bg-gradient-to-r from-yellow-400/[0.08] via-[#12151f] to-transparent px-6 py-5 sm:flex-row">
          <div>
            <p className="text-sm font-bold text-white">
              ¿Listo para subtitular tu próximo clip?
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Sube un MP4 o MOV y ten tu video exportado en minutos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-yellow-300"
          >
            <Sparkles className="h-4 w-4" />
            <span>Comenzar ahora</span>
          </button>
        </div>
      </section>
    </div>
  );
}
