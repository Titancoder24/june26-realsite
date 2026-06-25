"use client";

/**
 * Deterministic navigation voice responses — speak first, then jump to clip.
 */

export type NavigationAckTemplate = "taking" | "opening" | "here";

export type TtsPlaybackResult = {
  started: boolean;
  completed: boolean;
};

export function buildNavigationAck(sceneName: string, template: NavigationAckTemplate = "taking"): string {
  const name = sceneName.trim();
  if (!name) return "Taking you there.";
  switch (template) {
    case "opening":
      return `Opening ${name}.`;
    case "here":
      return `Here is ${name}.`;
    default:
      return `Taking you to ${name}.`;
  }
}

/** Rough speech duration for fallback when playback completion is unavailable. */
export function estimateSpeechFallbackMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.trim().length;
  return Math.min(6000, Math.max(600, 350 + words * 320 + chars * 6));
}

export function logNavigationVoiceFlow(step: string, payload: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[walkthrough-nav-voice] ${step}`, payload);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

/**
 * Speak the short navigation ack first. Only dispatch navigation after TTS completes,
 * or after a length-based fallback delay if playback never starts/finishes.
 */
export async function runNavigationVoiceFlow(options: {
  responseText: string;
  speak: () => Promise<TtsPlaybackResult>;
  navigate: () => void;
}): Promise<void> {
  logNavigationVoiceFlow("response_text_created", { responseText: options.responseText });

  let playback: TtsPlaybackResult = { started: false, completed: false };
  try {
    playback = await options.speak();
  } catch {
    logNavigationVoiceFlow("tts_failed");
  }

  if (!playback.completed) {
    const fallbackMs = estimateSpeechFallbackMs(options.responseText);
    logNavigationVoiceFlow("fallback_delay_used", {
      delayMs: fallbackMs,
      started: playback.started,
      completed: playback.completed,
    });
    await sleep(fallbackMs);
  }

  options.navigate();
  logNavigationVoiceFlow("navigation_dispatched");
}
