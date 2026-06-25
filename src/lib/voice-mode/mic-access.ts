import { voiceModeLog } from "@/lib/voice-mode/voice-mode-log";

export type MicAccessResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: "unsupported" | "not_found" | "denied" | "error"; message: string };

export async function requestMicAccess(): Promise<MicAccessResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Microphone is not available in this browser.",
    };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === "audioinput");
    voiceModeLog("audio_input_devices_found", { count: audioInputs.length });

    // Labels are often hidden until permission is granted — only skip when
    // devices are enumerated and explicitly empty after a prior grant.
    const labelledInputs = audioInputs.filter((d) => d.label.trim().length > 0);
    if (labelledInputs.length === 0 && audioInputs.length === 0) {
      voiceModeLog("audio_input_devices_empty_will_try_gum");
    }
  } catch (err) {
    voiceModeLog("enumerate_devices_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  voiceModeLog("attempting_microphone_start");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    voiceModeLog("microphone_permission", { granted: true });
    return { ok: true, stream };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const raw = err instanceof Error ? err.message : String(err);
    voiceModeLog("microphone_permission", { granted: false, name, raw });

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        ok: false,
        reason: "denied",
        message: "Microphone access is blocked. Allow mic permission to use voice guide.",
      };
    }

    if (name === "NotFoundError" || /device not found/i.test(raw)) {
      return {
        ok: false,
        reason: "not_found",
        message: "No microphone found. Please connect or enable a microphone.",
      };
    }

    return {
      ok: false,
      reason: "error",
      message: raw || "Could not access microphone.",
    };
  }
}
