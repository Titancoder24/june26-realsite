export type { WalkthroughNavScene } from "./scene-navigation";
export {
  compactNormalize,
  extractNavigationTarget,
  isNavigationIntent,
  matchSceneLocally,
  normalizeText,
  resolveSceneNavigation,
  resolveRoomCategory,
  ROOM_ALIASES,
  NAVIGATE_CONFIDENCE_THRESHOLD,
  logVoiceNavigationDev,
  type RoomCategory,
  type SceneMatchResult,
  type SceneNavigationResult,
} from "./scene-navigation";
export {
  buildNavigationAck,
  estimateSpeechFallbackMs,
  logNavigationVoiceFlow,
  runNavigationVoiceFlow,
  type TtsPlaybackResult,
} from "./navigation-voice-flow";

export function parseWaitDurationMs(query: string): number | null {
  const minute = query.match(/(\d+)\s*(?:minute|min)/i);
  if (minute) return Math.min(600_000, Number(minute[1]) * 60_000);
  const second = query.match(/(\d+)\s*(?:second|sec)/i);
  if (second) return Math.min(600_000, Number(second[1]) * 1000);
  if (/wait|hold on|pause|stop for a (?:bit|moment)/i.test(query)) return 120_000;
  return null;
}

export function isWaitIntent(query: string): boolean {
  return /wait|hold on|pause the tour|stop for|give me .* (?:minute|min|second)/i.test(query);
}

export function isResumeIntent(query: string): boolean {
  return /resume|continue (?:the )?tour|keep going|play again|start again|unpause/i.test(query);
}
