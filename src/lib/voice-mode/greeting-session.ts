import { voiceModeLog } from "@/lib/voice-mode/voice-mode-log";

/** Survives React Strict Mode remounts — one greeting per experience per page load. */
const greetingPlayed = new Set<string>();
const greetingPromises = new Map<string, Promise<void>>();
const greetingCompleteListeners = new Map<string, Set<() => void>>();

type GreetingPlaybackState = {
  pendingBlob: Blob | null;
  needsTap: boolean;
  error: string | null;
};

const greetingPlaybackState = new Map<string, GreetingPlaybackState>();
const greetingPlaybackListeners = new Map<string, Set<() => void>>();

function defaultPlaybackState(): GreetingPlaybackState {
  return { pendingBlob: null, needsTap: false, error: null };
}

function playbackState(experienceId: string): GreetingPlaybackState {
  return greetingPlaybackState.get(experienceId) ?? defaultPlaybackState();
}

function notifyPlaybackState(experienceId: string) {
  const listeners = greetingPlaybackListeners.get(experienceId);
  if (!listeners) return;
  for (const cb of listeners) cb();
}

export function getGreetingPendingBlob(experienceId: string): Blob | null {
  return playbackState(experienceId).pendingBlob;
}

export function getGreetingNeedsTap(experienceId: string): boolean {
  return playbackState(experienceId).needsTap;
}

export function getGreetingPlaybackError(experienceId: string): string | null {
  return playbackState(experienceId).error;
}

export function setGreetingPendingBlob(experienceId: string, blob: Blob | null) {
  const current = playbackState(experienceId);
  greetingPlaybackState.set(experienceId, {
    ...current,
    pendingBlob: blob,
    needsTap: blob != null ? true : current.needsTap,
    error: null,
  });
  voiceModeLog("greeting_pending_blob_set", { experienceId, bytes: blob?.size ?? 0 });
  notifyPlaybackState(experienceId);
}

export function setGreetingNeedsTap(experienceId: string, needsTap: boolean) {
  const current = playbackState(experienceId);
  greetingPlaybackState.set(experienceId, { ...current, needsTap });
  notifyPlaybackState(experienceId);
}

export function setGreetingPlaybackError(experienceId: string, error: string | null) {
  const current = playbackState(experienceId);
  greetingPlaybackState.set(experienceId, { ...current, error, needsTap: error ? current.needsTap : current.needsTap });
  notifyPlaybackState(experienceId);
}

export function clearGreetingPending(experienceId: string) {
  greetingPlaybackState.set(experienceId, defaultPlaybackState());
  notifyPlaybackState(experienceId);
}

export function subscribeGreetingPlayback(experienceId: string, cb: () => void): () => void {
  const set = greetingPlaybackListeners.get(experienceId) ?? new Set();
  set.add(cb);
  greetingPlaybackListeners.set(experienceId, set);
  return () => {
    set.delete(cb);
  };
}

let voiceAgentMountCount = 0;

export function nextVoiceAgentMountId(): number {
  voiceAgentMountCount += 1;
  voiceModeLog("voice_agent_mounted", { mountId: voiceAgentMountCount, totalMounts: voiceAgentMountCount });
  return voiceAgentMountCount;
}

export function getVoiceAgentMountCount(): number {
  return voiceAgentMountCount;
}

export function greetingAlreadyPlayed(experienceId: string): boolean {
  return greetingPlayed.has(experienceId);
}

export function greetingInProgress(experienceId: string): boolean {
  return greetingPromises.has(experienceId) && !greetingPlayed.has(experienceId);
}

export function markGreetingPlayed(experienceId: string): void {
  if (greetingPlayed.has(experienceId)) return;
  greetingPlayed.add(experienceId);
  voiceModeLog("greeting_marked_played", { experienceId });
  const listeners = greetingCompleteListeners.get(experienceId);
  if (listeners) {
    for (const cb of listeners) cb();
    greetingCompleteListeners.delete(experienceId);
  }
}

export function onGreetingComplete(experienceId: string, cb: () => void): () => void {
  if (greetingAlreadyPlayed(experienceId)) {
    queueMicrotask(cb);
    return () => {};
  }
  const set = greetingCompleteListeners.get(experienceId) ?? new Set();
  set.add(cb);
  greetingCompleteListeners.set(experienceId, set);
  return () => {
    set.delete(cb);
  };
}

/**
 * Returns a shared promise so Strict Mode remounts never start duplicate greetings.
 * Only call markGreetingPlayed after greeting audio actually finishes.
 */
export function runGreetingOnce(
  experienceId: string,
  factory: () => Promise<void>,
): Promise<void> {
  const existing = greetingPromises.get(experienceId);
  if (existing) {
    voiceModeLog("greeting_reusing_inflight_promise", { experienceId });
    return existing;
  }

  voiceModeLog("greeting_requested", { experienceId });
  const promise = factory().finally(() => {
    greetingPromises.delete(experienceId);
    voiceModeLog("greeting_promise_settled", { experienceId, played: greetingAlreadyPlayed(experienceId) });
  });

  greetingPromises.set(experienceId, promise);
  return promise;
}

export function resetGreetingSession(experienceId: string): void {
  greetingPlayed.delete(experienceId);
  greetingPromises.delete(experienceId);
  greetingCompleteListeners.delete(experienceId);
  greetingPlaybackState.delete(experienceId);
  greetingPlaybackListeners.delete(experienceId);
}
