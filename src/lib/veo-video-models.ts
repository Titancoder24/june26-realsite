/** Property Walkthrough — Veo 3.1 video generation modes (no Veo 2, no fallbacks). */

export type VeoGenerationMode = "fast" | "quality";

export const DEFAULT_VEO_GENERATION_MODE: VeoGenerationMode = "fast";

export const VEO_GENERATION_MODES: Record<
  VeoGenerationMode,
  { label: string; tagline: string; description: string; modelId: string; recommended?: boolean }
> = {
  fast: {
    label: "Fast generation",
    tagline: "Recommended — quicker preview",
    description: "Veo 3.1 Fast",
    modelId: "veo-3.1-fast-generate-001",
    recommended: true,
  },
  quality: {
    label: "Slow generation",
    tagline: "Higher quality — takes longer",
    description: "Veo 3.1 Lite",
    modelId: "veo-3.1-lite-generate-001",
  },
};

/** Enforced model allowlist — no fallbacks, no third-party video models. */
export const ALLOWED_VEO_MODEL_IDS = new Set(
  Object.values(VEO_GENERATION_MODES).map((m) => m.modelId),
);

export function assertAllowedVeoModel(modelId: string): void {
  if (!ALLOWED_VEO_MODEL_IDS.has(modelId)) {
    throw new Error(
      `Model "${modelId}" is not allowed. Use Veo 3.1 Fast or Veo 3.1 Lite only.`,
    );
  }
}

export function resolveVeoModelId(mode: VeoGenerationMode): string {
  return VEO_GENERATION_MODES[mode].modelId;
}

export function parseVeoGenerationMode(value: unknown): VeoGenerationMode {
  return value === "quality" ? "quality" : "fast";
}
