import { voiceModeLog } from "@/lib/voice-mode/voice-mode-log";

/** Single shared HTMLAudioElement so duplicate calls never overlap. */
let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

type PlaybackEndReason = "completed" | "interrupted" | "error" | "autoplay_blocked" | "timeout";

let endPlayback: ((reason: PlaybackEndReason) => void) | null = null;

/** Browsers block audio until a user gesture unlocks playback. */
let audioUnlocked = false;

function normalizeAudioBlob(blob: Blob): Blob {
  if (blob.type && blob.type !== "application/json" && blob.type !== "text/plain") {
    return blob;
  }
  return new Blob([blob], { type: "audio/mpeg" });
}

export function stopVoiceAudio(): boolean {
  const hadActive = Boolean(activeAudio);
  if (activeAudio) {
    voiceModeLog("audio_stop", { hadActive: true });
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
    endPlayback?.("interrupted");
    endPlayback = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  return hadActive;
}

/** Call synchronously inside a click/tap handler before any await. */
export function unlockVoiceAudioSync(): void {
  if (audioUnlocked || typeof window === "undefined") return;
  try {
    const audio = new Audio();
    audio.volume = 0.001;
    audio.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    const playPromise = audio.play();
    if (playPromise) {
      void playPromise
        .then(() => {
          audioUnlocked = true;
          audio.pause();
          voiceModeLog("audio_unlocked");
        })
        .catch(() => {
          // Gesture may still allow subsequent play() in same handler chain.
        });
    }
  } catch {
    // ignore
  }
}

export function isVoiceAudioUnlocked(): boolean {
  return audioUnlocked;
}

let micPermissionGranted = false;

/**
 * Request microphone permission. MUST be invoked from inside a user gesture
 * (tap/click) so Safari/iOS grants access — otherwise the later WebRTC
 * getUserMedia call (several async hops away) is silently blocked and the
 * agent never hears the user.
 *
 * We grab the stream to trigger the permission prompt, then stop the tracks
 * immediately; the granted permission persists for the SDK's own capture.
 */
export async function prewarmMicrophone(): Promise<boolean> {
  if (micPermissionGranted) return true;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    micPermissionGranted = true;
    voiceModeLog("mic_permission_granted");
    // Release immediately — the voice SDK opens its own capture stream.
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch (err) {
    voiceModeLog("mic_permission_denied", {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function isMicPermissionGranted(): boolean {
  return micPermissionGranted;
}

export async function playVoiceAudioBlob(
  blob: Blob,
  hooks?: { onStarted?: () => void; onCompleted?: () => void },
): Promise<{ started: boolean; completed: boolean; reason: PlaybackEndReason }> {
  stopVoiceAudio();

  const audioBlob = normalizeAudioBlob(blob);
  voiceModeLog("greeting_audio_received", { bytes: audioBlob.size, type: audioBlob.type });

  if (audioBlob.size < 256) {
    voiceModeLog("greeting_playback_settled", { started: false, completed: false, reason: "error" });
    return { started: false, completed: false, reason: "error" };
  }

  const url = URL.createObjectURL(audioBlob);
  activeObjectUrl = url;
  const audio = new Audio(url);
  audio.preload = "auto";
  activeAudio = audio;

  let started = false;
  let completed = false;
  let reason: PlaybackEndReason = "autoplay_blocked";

  try {
    await audio.play();
    started = true;
    audioUnlocked = true;
    reason = "completed";
    voiceModeLog("greeting_playback_started", { duration: audio.duration });
    hooks?.onStarted?.();

    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration * 1000 + 2500
      : 45000;
    const maxWaitMs = Math.min(Math.max(durationMs, 8000), 90000);

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (endReason: PlaybackEndReason) => {
        if (settled) return;
        settled = true;
        reason = endReason;
        resolve();
      };

      endPlayback = finish;
      audio.onended = () => {
        voiceModeLog("greeting_playback_ended", { reason: "onended" });
        finish("completed");
      };
      audio.onerror = () => {
        voiceModeLog("greeting_playback_ended", { reason: "onerror" });
        finish("error");
      };

      window.setTimeout(() => {
        voiceModeLog("greeting_playback_ended", { reason: "timeout", maxWaitMs });
        finish("timeout");
      }, maxWaitMs);
    });

    completed = reason === "completed" || reason === "timeout";
    if (completed) {
      hooks?.onCompleted?.();
    }
  } catch (err) {
    reason = "autoplay_blocked";
    voiceModeLog("greeting_playback_autoplay_blocked", {
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    if (activeAudio === audio) {
      stopVoiceAudio();
    }
    endPlayback = null;
  }

  voiceModeLog("greeting_playback_settled", { started, completed, reason });
  return { started, completed, reason };
}
