// ZoneScene studio scope (owner, 2026-11-05): cut, captions (Whisper + caption editor), text,
// music + Beat Sync, 9:16 export; added the same day: picture-in-picture, speed curves, keyframes,
// auto-reframe, audio effects, noise reduction, auto-cut silence, transitions.
// Stabilization stays hidden: it downloads a vidstab ffmpeg build from mediashares.openreel.video.
// Everything else stays in the code but is not shown.
// One place to widen the studio later: remove an id from these lists.
// Full build for the owner's own work (`pnpm dev:full`, `.env.full`): everything upstream is shown.

/** True in the owner's full build: every hidden feature below comes back. */
export const STUDIO_FULL: boolean = import.meta.env.VITE_STUDIO_FULL === "1";

/** Inspector sections hidden by `sectionId`. */
const HIDDEN_SECTION_IDS = new Set([
  "multicam",
  "transform-3d",
  "color-grading",
  "particle-effects",
  "motion-tracking",
  "video-effects",
  "green-screen",
  "masking",
  "background-removal",
  "text-behind-subject",
  "stabilization",
  "motion-path",
  "motion-presets",
  "emphasis-animation",
  "applied-effects",
  "ai-highlights",
  "auto-edit",
  "audio-ducking",
  "voice-over",
  "shape-properties",
]);

/** Inspector sections that have no `sectionId` upstream, hidden by title. */
const HIDDEN_SECTION_TITLES = new Set([
  "Chroma Key (Green Screen)",
  "Nested Sequences",
  "Adjustment Layers",
  "Stabilization",
]);

export function isStudioSectionHidden(sectionId: string | undefined, title: string): boolean {
  if (STUDIO_FULL) return false;
  return (sectionId !== undefined && HIDDEN_SECTION_IDS.has(sectionId)) || HIDDEN_SECTION_TITLES.has(title);
}

/** Left rail tabs shown in the studio (graphics, effects, AI, recipes, templates hidden). */
export const STUDIO_ASSET_TABS: { has(tab: string): boolean } = STUDIO_FULL ? { has: () => true } : new Set(["media", "text", "transitions"]);

/** Cloud AI (KieAI image generation…): its hosts are blocked by the studio CSP anyway. */
export const STUDIO_CLOUD_AI_ENABLED = STUDIO_FULL;

/** Microphone / camera / screen recording: blocked by the site's Permissions-Policy anyway. */
export const STUDIO_RECORDING_ENABLED = STUDIO_FULL;

/** « ← Retour » target and label; the brand comes from the build env, never hardcoded. */
export const STUDIO_BACK_URL: string = import.meta.env.VITE_STUDIO_BACK_URL || "/socials";
export const STUDIO_BACK_LABEL: string = import.meta.env.VITE_BRAND_NAME
  ? `← Retour à ${import.meta.env.VITE_BRAND_NAME}`
  : "← Retour";

/** Projects open vertical (9:16): the studio exports reels and stories. */
export const STUDIO_DEFAULT_SIZE = { width: 1080, height: 1920 } as const;

/** Welcome « Parcourir les modèles »: upstream templates are 16:9 promos, off scope. */
export const STUDIO_TEMPLATES_ENABLED = STUDIO_FULL;

/**
 * Reel / story safe zone on a 1080×1920 frame: x 60-940, y 220-1480. IG/TikTok buttons,
 * username and caption cover the rest. Shown by default on 9:16 projects.
 */
export const STUDIO_REEL_SAFE_ZONE = {
  left: `${(60 / 1080) * 100}%`,
  right: `${(140 / 1080) * 100}%`,
  top: `${(220 / 1920) * 100}%`,
  bottom: `${(440 / 1920) * 100}%`,
} as const;

/** « IA » chat editor (bring-your-own model): off scope, and its hosts are blocked by the CSP. */
export const STUDIO_AI_CHAT_ENABLED = STUDIO_FULL;
