"use client";

import {
  Check,
  Crown,
  Lock,
  RotateCcw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  POSITION_LABELS,
  resolveEffectiveStyle,
  SIZE_LABELS,
  SUBTITLE_FONTS,
  SUBTITLE_STYLES,
} from "@/lib/styles";
import { hasCreatorAccess } from "@/lib/usageLimits";
import type {
  PlanTier,
  SubtitleFontId,
  SubtitlePosition,
  SubtitleSettings,
  SubtitleSize,
  SubtitleStyleId,
} from "@/types/subtitle";

interface StylePickerProps {
  settings: SubtitleSettings;
  planTier: PlanTier;
  onChange: (next: SubtitleSettings) => void;
  onMaxWordsChange: (maxWords: number) => void;
  onRequirePro: (reason: string) => void;
  hasCues: boolean;
}

const STYLE_ORDER: SubtitleStyleId[] = ["tiktok", "minimal", "neon"];
const POSITION_ORDER: SubtitlePosition[] = ["top", "center", "bottom"];
const SIZE_ORDER: SubtitleSize[] = ["sm", "md", "lg"];
const FONT_ORDER: SubtitleFontId[] = ["montserrat", "jakarta", "space"];

function TierLockBadge({ label = "CREADOR" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/35 bg-yellow-400/12 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
      <Lock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
        checked
          ? "border-yellow-400/70 bg-yellow-400"
          : "border-white/15 bg-white/10"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          checked
            ? "translate-x-[18px] bg-black"
            : "translate-x-[2px] bg-zinc-300"
        }`}
      />
    </button>
  );
}

export function StylePicker({
  settings,
  planTier,
  onChange,
  onMaxWordsChange,
  onRequirePro,
  hasCues,
}: StylePickerProps) {
  const hasCreator = hasCreatorAccess(planTier);
  const effective = resolveEffectiveStyle(settings);

  const handlePositionClick = (pos: SubtitlePosition) => {
    if (!hasCreator && pos !== "bottom") {
      onRequirePro(
        "Cambiar la posición en pantalla (Superior o Centro) está incluido desde el Plan Creador."
      );
      return;
    }
    onChange({ ...settings, position: pos });
  };

  const handleFontClick = (fontId: SubtitleFontId) => {
    if (!hasCreator) {
      onRequirePro(
        "Personalizar la tipografía está incluido en el Editor Visual Pro (Plan Creador)."
      );
      return;
    }
    onChange({ ...settings, customFontId: fontId, uploadedFont: undefined });
  };

  const handleColorUpdate = (
    field: "customBaseColorHex" | "customActiveColorHex" | "customOutlineColorHex",
    value: string
  ) => {
    if (!hasCreator) {
      onRequirePro(
        "Personalizar colores de texto, palabra activa y contorno está incluido en el Editor Visual Pro (Plan Creador)."
      );
      return;
    }
    onChange({ ...settings, [field]: value });
  };

  const handleVerticalToggle = (checked: boolean) => {
    if (!hasCreator) {
      onRequirePro(
        "La conversión automática a Vertical 9:16 forma parte del Plan Creador."
      );
      return;
    }
    onChange({ ...settings, convertToVertical916: checked });
  };

  const hasCustomOverrides = Boolean(
    settings.customFontId ||
      settings.customBaseColorHex ||
      settings.customActiveColorHex ||
      settings.customOutlineColorHex ||
      settings.convertToVertical916
  );

  return (
    <div className="space-y-5">
      {/* 3 Core Visual Styles (Free) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Estilo visual de subtítulos
          </h3>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">
            3 estilos gratis
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {STYLE_ORDER.map((styleId) => {
            const preset = SUBTITLE_STYLES[styleId];
            const selected = settings.styleId === styleId;

            return (
              <button
                key={styleId}
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    styleId,
                    uppercase: preset.defaultUppercase,
                    customFontId: undefined,
                    customBaseColorHex: undefined,
                    customActiveColorHex: undefined,
                    customOutlineColorHex: undefined,
                  })
                }
                className={`group relative flex flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition ${
                  selected
                    ? "border-yellow-400/80 bg-yellow-400/[0.08] ring-1 ring-yellow-400/35"
                    : "border-white/[0.08] bg-[#121621] hover:border-white/20 hover:bg-[#171c2a]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {preset.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {preset.description}
                    </p>
                  </div>
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? "border-yellow-400 bg-yellow-400 text-black"
                        : "border-white/15 bg-white/[0.03] text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                </div>

                {/* Live Mini Preview Strip */}
                <div
                  className={`flex h-12 items-center justify-center rounded-xl border px-3 ${preset.previewBgClass}`}
                >
                  {styleId === "tiktok" && (
                    <span
                      className="text-sm uppercase tracking-wide"
                      style={{
                        fontFamily: preset.fontFamilyCss,
                        fontWeight: preset.cssFontWeight,
                        color: "#FFE600",
                        WebkitTextStroke: "3px #000000",
                        paintOrder: "stroke fill",
                        textShadow: "0 2px 5px rgba(0,0,0,0.9)",
                      }}
                    >
                      SUBTÍTULOS{" "}
                      <span style={{ color: "#FFFFFF" }}>CLAROS</span>
                    </span>
                  )}
                  {styleId === "minimal" && (
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: preset.fontFamilyCss,
                        fontWeight: preset.cssFontWeight,
                        color: "#FFFFFF",
                        textShadow: "0 2px 8px rgba(0,0,0,0.85)",
                      }}
                    >
                      Subtítulos{" "}
                      <span className="text-zinc-400">limpios y claros</span>
                    </span>
                  )}
                  {styleId === "neon" && (
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: preset.fontFamilyCss,
                        fontWeight: preset.cssFontWeight,
                        color: "#FFFFFF",
                        WebkitTextStroke: "1px #E879F9",
                        paintOrder: "stroke fill",
                        textShadow:
                          "0 0 8px rgba(217,70,239,0.95), 0 0 16px rgba(6,182,212,0.8)",
                      }}
                    >
                      Brillo <span className="text-cyan-200">Neón</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Free Layout Basics */}
      <div className="studio-surface-subtle space-y-4 rounded-2xl border border-white/[0.08] p-4">
        <div>
          <label className="mb-2 block text-xs font-semibold text-zinc-300">
            Tamaño de letra
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SIZE_ORDER.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onChange({ ...settings, size: sz })}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  settings.size === sz
                    ? "border-yellow-400/80 bg-yellow-400/15 text-yellow-200"
                    : "border-white/10 bg-black/25 text-zinc-300 hover:bg-white/[0.07]"
                }`}
              >
                {SIZE_LABELS[sz]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <label htmlFor="words-per-cue" className="font-semibold text-zinc-300">
              Palabras por frase
            </label>
            <span className="rounded-md bg-yellow-400/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-yellow-300">
              {settings.maxWordsPerCue} palabras
            </span>
          </div>
          <input
            id="words-per-cue"
            type="range"
            min={2}
            max={6}
            step={1}
            value={settings.maxWordsPerCue}
            onChange={(e) => onMaxWordsChange(Number(e.target.value))}
            className="w-full accent-yellow-400"
          />
          {hasCues && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Reagrupa automáticamente los subtítulos manteniendo los tiempos por
              palabra.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-white/[0.07] pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-zinc-200">
              Mostrar todo en MAYÚSCULAS
            </span>
            <ToggleSwitch
              checked={settings.uppercase}
              onChange={(checked) => onChange({ ...settings, uppercase: checked })}
              ariaLabel="Mostrar todo en mayúsculas"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              Resaltar palabra activa al hablar
            </span>
            <ToggleSwitch
              checked={settings.highlightActiveWord}
              onChange={(checked) =>
                onChange({ ...settings, highlightActiveWord: checked })
              }
              ariaLabel="Resaltar palabra activa al hablar"
            />
          </div>
        </div>
      </div>

      {/* Editor Visual Pro (Plan Creador) */}
      <div className="space-y-4 rounded-2xl border border-yellow-400/25 bg-gradient-to-b from-yellow-400/[0.06] to-[#11151f] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-yellow-200">
              Editor Visual Pro
            </h4>
          </div>
          {!hasCreator ? (
            <button
              type="button"
              onClick={() =>
                onRequirePro(
                  "Desbloquea el Editor Visual Pro y conversión 9:16 desde el Plan Creador ($3 USD con descuento viral)."
                )
              }
              className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/15 px-2.5 py-0.5 text-[10px] font-bold text-yellow-200 transition hover:bg-yellow-400/25"
            >
              <Lock className="h-2.5 w-2.5" />
              Desbloquear
            </button>
          ) : (
            hasCustomOverrides && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...settings,
                    customFontId: undefined,
                    customBaseColorHex: undefined,
                    customActiveColorHex: undefined,
                    customOutlineColorHex: undefined,
                    uploadedFont: undefined,
                    convertToVertical916: false,
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                Restablecer
              </button>
            )
          )}
        </div>

        {/* 9:16 Vertical Conversion (Plan Creador) */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Smartphone className="h-4 w-4 text-yellow-400" />
            <div>
              <p className="text-xs font-semibold text-zinc-200">
                Convertir a Vertical 9:16
              </p>
              <p className="text-[10.5px] text-zinc-400">
                Adapta videos horizontales para TikTok y Reels
              </p>
            </div>
          </div>
          {hasCreator ? (
            <ToggleSwitch
              checked={Boolean(settings.convertToVertical916)}
              onChange={handleVerticalToggle}
              ariaLabel="Convertir a Vertical 9:16"
            />
          ) : (
            <button
              type="button"
              onClick={() => handleVerticalToggle(true)}
              className="inline-flex items-center gap-1 rounded-full border border-yellow-400/35 bg-yellow-400/12 px-2 py-0.5 text-[10px] font-semibold text-yellow-300"
            >
              <Lock className="h-2.5 w-2.5" />
              CREADOR
            </button>
          )}
        </div>

        {/* Position Control */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              Posición en pantalla
            </label>
            {!hasCreator && <TierLockBadge label="CREADOR" />}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {POSITION_ORDER.map((pos) => {
              const locked = !hasCreator && pos !== "bottom";
              const active = settings.position === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handlePositionClick(pos)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-yellow-400/80 bg-yellow-400/15 text-yellow-200"
                      : locked
                        ? "border-white/[0.08] bg-black/30 text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-200"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
                  }`}
                >
                  {locked && <Lock className="h-3 w-3 text-yellow-400/80" />}
                  <span>{POSITION_LABELS[pos]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Selector */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              Tipografía personalizada
            </label>
            {!hasCreator && <TierLockBadge label="CREADOR" />}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {FONT_ORDER.map((fontId) => {
              const font = SUBTITLE_FONTS[fontId];
              const active = !settings.uploadedFont && effective.fontId === fontId;
              return (
                <button
                  key={fontId}
                  type="button"
                  onClick={() => handleFontClick(fontId)}
                  className={`relative flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition ${
                    active
                      ? "border-yellow-400/80 bg-yellow-400/15 text-yellow-200"
                      : !hasCreator
                        ? "border-white/[0.08] bg-black/30 text-zinc-400 hover:border-yellow-400/40 hover:text-yellow-200"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
                  }`}
                  style={{ fontFamily: font.fontFamilyCss }}
                >
                  {!hasCreator && (
                    <Lock className="h-2.5 w-2.5 shrink-0 text-yellow-400/80" />
                  )}
                  <span className="truncate">{font.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Pickers */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              Colores personalizados
            </label>
            {!hasCreator && <TierLockBadge label="CREADOR" />}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  key: "customBaseColorHex",
                  label: "Texto base",
                  value: effective.baseColorHex,
                },
                {
                  key: "customActiveColorHex",
                  label: "Palabra activa",
                  value: effective.activeColorHex,
                },
                {
                  key: "customOutlineColorHex",
                  label: "Contorno / Brillo",
                  value: effective.outlineColorHex,
                },
              ] as const
            ).map((item) =>
              hasCreator ? (
                <label
                  key={item.key}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-black/35 p-2 text-center hover:border-white/25"
                >
                  <input
                    type="color"
                    value={item.value}
                    onChange={(e) => handleColorUpdate(item.key, e.target.value)}
                    className="h-6 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] text-zinc-300">
                    {item.label}
                  </span>
                </label>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    onRequirePro(
                      "Personalizar colores de texto, palabra activa y contorno requiere Plan Creador."
                    )
                  }
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/35 p-2 text-center transition hover:border-yellow-400/40"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-4 w-4 rounded-full border border-white/25"
                      style={{ backgroundColor: item.value }}
                    />
                    <Lock className="h-3 w-3 text-yellow-400/80" />
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {item.label}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
