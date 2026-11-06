export type WhisperModelKey = "accurate" | "fast";

export interface WhisperModelDefinition {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly downloadSize: string;
  readonly description: string;
}

export const WHISPER_MODELS: Record<WhisperModelKey, WhisperModelDefinition> = {
  // ZoneScene ships one model: whisper-small q4 ≈ faster-whisper large-v3 on French speech
  // (docs/ZONESCENE.md). Large V3 Turbo (760 MB, WebGPU) was too heavy for most laptops.
  accurate: {
    id: "onnx-community/whisper-small",
    label: "Whisper Small",
    shortLabel: "Sous-titres automatiques",
    downloadSize: "Environ 300 Mo",
    description: "Sous-titres en local, sur votre ordinateur",
  },
  fast: {
    id: "onnx-community/whisper-tiny",
    label: "Fast · Whisper Tiny",
    shortLabel: "Whisper Tiny",
    downloadSize: "About 100 MB",
    description: "Fastest option for drafts and lower-memory devices",
  },
};

export const DEFAULT_WHISPER_MODEL: WhisperModelKey = "accurate";

/** Where the model files are fetched from (scripts/build-studio.mjs): the host's storage or /studio/models/. */
export const WHISPER_MODELS_BASE_URL =
  import.meta.env.VITE_STUDIO_MODELS_URL || `${import.meta.env.BASE_URL}models/`;

export function isWhisperModelKey(value: unknown): value is WhisperModelKey {
  return value === "accurate" || value === "fast";
}
