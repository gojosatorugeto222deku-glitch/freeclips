import {
  SubtitleFontId,
  SubtitlePosition,
  SubtitleSettings,
  SubtitleSize,
  SubtitleStyleId,
  WhisperModelOption,
} from "@/types/subtitle";

export interface SubtitleFontOption {
  id: SubtitleFontId;
  label: string;
  fontFamilyCss: string;
  cssFontWeight: number;
  assFontName: string;
  fontFileName: string;
  assBold: boolean;
}

export const SUBTITLE_FONTS: Record<SubtitleFontId, SubtitleFontOption> = {
  montserrat: {
    id: "montserrat",
    label: "Montserrat Bold",
    fontFamilyCss: "'SubLimpioTikTok', sans-serif",
    cssFontWeight: 800,
    assFontName: "Montserrat ExtraBold",
    fontFileName: "Montserrat-ExtraBold.ttf",
    assBold: false,
  },
  jakarta: {
    id: "jakarta",
    label: "Jakarta Editorial",
    fontFamilyCss: "'SubLimpioMinimal', sans-serif",
    cssFontWeight: 600,
    assFontName: "Plus Jakarta Sans SemiBold",
    fontFileName: "PlusJakartaSans-SemiBold.ttf",
    assBold: false,
  },
  space: {
    id: "space",
    label: "Space Grotesk",
    fontFamilyCss: "'SubLimpioNeon', sans-serif",
    cssFontWeight: 700,
    assFontName: "Space Grotesk",
    fontFileName: "SpaceGrotesk-Bold.ttf",
    assBold: true,
  },
};

export interface SubtitleStylePreset {
  id: SubtitleStyleId;
  name: string;
  shortLabel: string;
  description: string;
  defaultFontId: SubtitleFontId;
  fontFamilyCss: string;
  cssFontWeight: number;
  assFontName: string;
  fontFileName: string;
  assBold: boolean;
  defaultUppercase: boolean;
  baseColorHex: string;
  activeColorHex: string;
  spokenColorHex: string;
  outlineColorHex: string;
  glowColorHex?: string;
  previewBgClass: string;
}

export const SUBTITLE_STYLES: Record<SubtitleStyleId, SubtitleStylePreset> = {
  tiktok: {
    id: "tiktok",
    name: "TikTok Amarillo / Negro",
    shortLabel: "TikTok",
    description:
      "Tipografía gruesa con contorno negro sólido y palabra activa en amarillo vibrante.",
    defaultFontId: "montserrat",
    fontFamilyCss: SUBTITLE_FONTS.montserrat.fontFamilyCss,
    cssFontWeight: SUBTITLE_FONTS.montserrat.cssFontWeight,
    assFontName: SUBTITLE_FONTS.montserrat.assFontName,
    fontFileName: SUBTITLE_FONTS.montserrat.fontFileName,
    assBold: SUBTITLE_FONTS.montserrat.assBold,
    defaultUppercase: true,
    baseColorHex: "#FFFFFF",
    activeColorHex: "#FFE600",
    spokenColorHex: "#FFE600",
    outlineColorHex: "#000000",
    previewBgClass:
      "bg-gradient-to-br from-amber-500/20 via-zinc-900 to-black border-amber-400/30",
  },
  minimal: {
    id: "minimal",
    name: "Minimalista Blanco",
    shortLabel: "Minimalista",
    description:
      "Texto blanco limpio, lectura editorial y sombra suave ideal para reels y vlogs.",
    defaultFontId: "jakarta",
    fontFamilyCss: SUBTITLE_FONTS.jakarta.fontFamilyCss,
    cssFontWeight: SUBTITLE_FONTS.jakarta.cssFontWeight,
    assFontName: SUBTITLE_FONTS.jakarta.assFontName,
    fontFileName: SUBTITLE_FONTS.jakarta.fontFileName,
    assBold: SUBTITLE_FONTS.jakarta.assBold,
    defaultUppercase: false,
    baseColorHex: "#E4E4E7",
    activeColorHex: "#FFFFFF",
    spokenColorHex: "#FFFFFF",
    outlineColorHex: "#09090B",
    previewBgClass:
      "bg-gradient-to-br from-zinc-700/30 via-zinc-900 to-zinc-950 border-zinc-600/30",
  },
  neon: {
    id: "neon",
    name: "Neón Eléctrico",
    shortLabel: "Neón",
    description:
      "Brillo luminoso cian y magenta con halo doble para contenido tech y gaming.",
    defaultFontId: "space",
    fontFamilyCss: SUBTITLE_FONTS.space.fontFamilyCss,
    cssFontWeight: SUBTITLE_FONTS.space.cssFontWeight,
    assFontName: SUBTITLE_FONTS.space.assFontName,
    fontFileName: SUBTITLE_FONTS.space.fontFileName,
    assBold: SUBTITLE_FONTS.space.assBold,
    defaultUppercase: false,
    baseColorHex: "#CFFAFE",
    activeColorHex: "#E879F9",
    spokenColorHex: "#ECFEFF",
    outlineColorHex: "#06B6D4",
    glowColorHex: "#D946EF",
    previewBgClass:
      "bg-gradient-to-br from-cyan-500/20 via-fuchsia-950/40 to-zinc-950 border-cyan-400/30",
  },
};

export interface ResolvedSubtitleStyle {
  preset: SubtitleStylePreset;
  fontId: SubtitleFontId;
  fontFamilyCss: string;
  cssFontWeight: number;
  assFontName: string;
  fontFileName: string;
  assBold: boolean;
  baseColorHex: string;
  activeColorHex: string;
  outlineColorHex: string;
  glowColorHex: string;
}

/**
 * Resolves base style preset merged with any custom Pro typography/color overrides.
 */
export function resolveEffectiveStyle(
  settings: SubtitleSettings
): ResolvedSubtitleStyle {
  const preset = SUBTITLE_STYLES[settings.styleId];
  const fontId = settings.customFontId ?? preset.defaultFontId;
  const font = SUBTITLE_FONTS[fontId];
  const uploaded = settings.uploadedFont;

  return {
    preset,
    fontId,
    fontFamilyCss: uploaded ? `'${uploaded.cssFamily}', sans-serif` : font.fontFamilyCss,
    cssFontWeight: uploaded ? (uploaded.assBold ? 700 : 600) : font.cssFontWeight,
    assFontName: uploaded ? uploaded.assFontName : font.assFontName,
    fontFileName: uploaded ? uploaded.fileName : font.fontFileName,
    assBold: uploaded ? uploaded.assBold : font.assBold,
    baseColorHex: settings.customBaseColorHex || preset.baseColorHex,
    activeColorHex: settings.customActiveColorHex || preset.activeColorHex,
    outlineColorHex: settings.customOutlineColorHex || preset.outlineColorHex,
    glowColorHex: settings.customActiveColorHex || preset.glowColorHex || "#D946EF",
  };
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  styleId: "tiktok",
  position: "bottom",
  size: "md",
  uppercase: true,
  maxWordsPerCue: 4,
  highlightActiveWord: true,
};

export const WHISPER_MODELS: WhisperModelOption[] = [
  {
    id: "onnx-community/whisper-tiny_timestamped",
    label: "Whisper Tiny",
    badge: "Rápido",
    sizeHint: "~45 MB",
    description: "Descarga veloz e ideal para pruebas rápidas o equipos modestos.",
  },
  {
    id: "onnx-community/whisper-base_timestamped",
    label: "Whisper Base",
    badge: "Recomendado",
    sizeHint: "~80 MB",
    description: "Mejor balance entre velocidad en el navegador y precisión en español.",
  },
  {
    id: "onnx-community/whisper-small_timestamped",
    label: "Whisper Small",
    badge: "Alta precisión",
    sizeHint: "~250 MB",
    description: "Mayor exactitud para acentos complejos o ruido ambiental (requiere más RAM).",
  },
];

export const SIZE_MULTIPLIERS: Record<SubtitleSize, number> = {
  sm: 0.82,
  md: 1.0,
  lg: 1.22,
};

export const POSITION_LABELS: Record<SubtitlePosition, string> = {
  top: "Superior",
  center: "Centro",
  bottom: "Inferior",
};

export const SIZE_LABELS: Record<SubtitleSize, string> = {
  sm: "Pequeño",
  md: "Mediano",
  lg: "Grande",
};
