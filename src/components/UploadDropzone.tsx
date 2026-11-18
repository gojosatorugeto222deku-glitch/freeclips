"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Cpu,
  FileVideo,
  Lock,
  Sparkles,
  UploadCloud,
  Wand2,
} from "lucide-react";

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  errorMessage?: string | null;
}

const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];

export function isSupportedVideoFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return true;
  }
  return file.type === "video/mp4" || file.type === "video/quicktime";
}

export function UploadDropzone({
  onFileSelected,
  errorMessage,
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
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {/* Hero header */}
      <div className="mb-8 max-w-2xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/25 bg-yellow-400/10 px-3.5 py-1 text-xs font-medium text-yellow-300">
          <Lock className="h-3.5 w-3.5" />
          <span>Privado · Whisper AI + FFmpeg.wasm en tu navegador</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
          Subtítulos dinámicos para tus videos cortos,{" "}
          <span className="bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
            sin marca de agua
          </span>
          .
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Transcribe audio en español palabra por palabra, edita el texto al
          instante, elige entre 3 estilos virales y descarga tu MP4 sin marca de
          agua. Incluye <span className="text-zinc-200 font-medium">5 videos gratis al día</span> (hasta 90s, ampliables a 15).
        </p>
      </div>

      {/* Dropzone card */}
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
        className={`group relative w-full max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${
          isDragging
            ? "border-yellow-400 bg-yellow-400/[0.07] shadow-2xl shadow-yellow-500/10"
            : "border-white/15 bg-[#0f1117]/90 hover:border-yellow-400/50 hover:bg-[#131620]"
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

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-yellow-400 transition-transform duration-200 group-hover:scale-105 group-hover:border-yellow-400/40">
          <UploadCloud className="h-8 w-8" />
        </div>

        <p className="text-lg font-semibold text-white sm:text-xl">
          Arrastra tu video aquí o haz clic para seleccionarlo
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Compatible con <span className="font-mono text-zinc-200">.MP4</span>{" "}
          y <span className="font-mono text-zinc-200">.MOV</span> (vertical,
          cuadrado o horizontal)
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-yellow-500/15 transition group-hover:bg-yellow-300">
          <FileVideo className="h-4 w-4" />
          <span>Elegir video del dispositivo</span>
        </div>
      </div>

      {activeError && (
        <div className="mt-4 flex w-full max-w-2xl items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Style showcase + capability strip */}
      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#0f1117]/80 p-4">
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
              ¡ESTO ES{" "}
              <span className="text-white">VIRAL!</span>
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-100">
            Estilo TikTok Amarillo / Negro
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Alto contraste y resaltado palabra por palabra.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#0f1117]/80 p-4">
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

        <div className="rounded-xl border border-white/[0.08] bg-[#0f1117]/80 p-4">
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
      <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-xs text-zinc-400 sm:grid-cols-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <Cpu className="h-4 w-4 shrink-0 text-yellow-400" />
          <span>Whisper con marcas de tiempo por palabra en español</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <Wand2 className="h-4 w-4 shrink-0 text-cyan-400" />
          <span>Edición en tiempo real sincronizada con tu video</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>Renderizado final en MP4 directo con FFmpeg.wasm</span>
        </div>
      </div>
    </div>
  );
}
