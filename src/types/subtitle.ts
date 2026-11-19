export interface WordToken {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
  words: WordToken[];
}

export type SubtitleStyleId = "tiktok" | "minimal" | "neon";

export type SubtitleFontId = "montserrat" | "jakarta" | "space";

export type SubtitlePosition = "bottom" | "center" | "top";

export type SubtitleSize = "sm" | "md" | "lg";

export interface UploadedFontData {
  fileName: string;
  assFontName: string;
  assBold: boolean;
  cssFamily: string;
  bytes: Uint8Array;
}

export interface SubtitleSettings {
  styleId: SubtitleStyleId;
  position: SubtitlePosition;
  size: SubtitleSize;
  uppercase: boolean;
  maxWordsPerCue: number;
  highlightActiveWord: boolean;
  // Plan Creador+ visual overrides
  convertToVertical916?: boolean;
  customFontId?: SubtitleFontId;
  customBaseColorHex?: string;
  customActiveColorHex?: string;
  customOutlineColorHex?: string;
  // Plan Agencia custom uploaded TTF/OTF font
  uploadedFont?: UploadedFontData;
}

export type WhisperModelId =
  | "onnx-community/whisper-tiny_timestamped"
  | "onnx-community/whisper-base_timestamped"
  | "onnx-community/whisper-small_timestamped";

export interface WhisperModelOption {
  id: WhisperModelId;
  label: string;
  badge: string;
  sizeHint: string;
  description: string;
}

export type TranscriptionStage =
  | "idle"
  | "extracting-audio"
  | "loading-model"
  | "transcribing"
  | "ready"
  | "error";

export interface ModelProgressInfo {
  file: string;
  progress: number;
  loaded?: number;
  total?: number;
  status: string;
  phase?: "downloading" | "initializing";
}

export type ExportQualityPreset = "fast" | "balanced" | "high";

export type ExportStage =
  | "idle"
  | "loading-ffmpeg"
  | "preparing"
  | "encoding"
  | "done"
  | "error";

export interface VideoMetadata {
  name: string;
  sizeBytes: number;
  duration: number;
  width: number;
  height: number;
  mimeType: string;
}

export type PlanTier = "free" | "creator" | "agency";

export interface DailyUsageState {
  date: string;
  usedCount: number;
  extraPacksClaimed: number;
}

export interface ProDiscountState {
  planTier: PlanTier;
  googleConnected: boolean;
  googleEmail?: string;
  googleDisplayName?: string;
  googlePhotoUrl?: string;
  socialShared: boolean;
  stripeCustomerEmail?: string;
  stripeSubscriptionId?: string;
  /** @deprecated kept for backwards compatibility with older localStorage payloads */
  isPro?: boolean;
}
