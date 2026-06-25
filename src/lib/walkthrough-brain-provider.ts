/** Property walkthrough LLM backend — Vertex GCP vs Google AI Studio (Gemini native). */
export type WalkthroughBrainProvider = "vertex" | "google-ai-studio";

export const WALKTHROUGH_BRAIN_PROVIDERS: {
  id: WalkthroughBrainProvider;
  label: string;
  description: string;
  model: string;
}[] = [
  {
    id: "vertex",
    label: "Vertex Cloud",
    description: "Google Cloud Vertex AI (enterprise routing)",
    model: "gemini-2.5-flash",
  },
  {
    id: "google-ai-studio",
    label: "Gemini Native",
    description: "Google AI Studio — Gemini 3.5 Flash",
    model: "gemini-3.5-flash",
  },
];

export const DEFAULT_BRAIN_PROVIDER: WalkthroughBrainProvider = "google-ai-studio";

export const GEMINI_BRAIN_MODEL = "gemini-3.5-flash";

export function isWalkthroughBrainProvider(value: string): value is WalkthroughBrainProvider {
  return value === "vertex" || value === "google-ai-studio";
}

export function brainProviderStorageKey(experienceId: string) {
  return `walkthrough-brain-provider-${experienceId}`;
}

export function readBrainProvider(experienceId: string): WalkthroughBrainProvider {
  if (typeof window === "undefined") return DEFAULT_BRAIN_PROVIDER;
  try {
    const raw = localStorage.getItem(brainProviderStorageKey(experienceId));
    if (raw && isWalkthroughBrainProvider(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_BRAIN_PROVIDER;
}

export function storeBrainProvider(experienceId: string, provider: WalkthroughBrainProvider) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(brainProviderStorageKey(experienceId), provider);
  } catch {
    // ignore
  }
}

export function brainProviderMeta(id: WalkthroughBrainProvider) {
  return WALKTHROUGH_BRAIN_PROVIDERS.find((p) => p.id === id) ?? WALKTHROUGH_BRAIN_PROVIDERS[1];
}

export function parseBrainProviderFromViewerConfig(
  viewerConfig?: Record<string, unknown> | null,
): WalkthroughBrainProvider | null {
  const raw = viewerConfig?.brain_provider;
  return typeof raw === "string" && isWalkthroughBrainProvider(raw) ? raw : null;
}

/** Studio saves to Supabase viewer_config; buyers fall back to localStorage. */
export function resolveBrainProvider(
  experienceId: string,
  viewerConfig?: Record<string, unknown> | null,
): WalkthroughBrainProvider {
  return parseBrainProviderFromViewerConfig(viewerConfig) ?? readBrainProvider(experienceId);
}
