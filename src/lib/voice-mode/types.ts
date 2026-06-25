export type VoiceModeState =
  | "IDLE"
  | "GREETING"
  | "LISTENING"
  | "TRANSCRIBING"
  | "THINKING"
  | "RESPONDING"
  | "NAVIGATING"
  | "ERROR";

export type VoiceModeTurn = {
  role: "user" | "assistant";
  content: string;
};

export function voiceModeStateLabel(state: VoiceModeState, hint?: string): string {
  if (hint?.trim()) return hint.trim();
  switch (state) {
    case "GREETING":
      return "Welcome…";
    case "LISTENING":
      return "Listening…";
    case "TRANSCRIBING":
      return "Listening…";
    case "THINKING":
      return "Thinking…";
    case "RESPONDING":
      return "Speaking…";
    case "NAVIGATING":
      return "Navigating…";
    case "ERROR":
      return "Voice unavailable";
    default:
      return "Starting guide…";
  }
}

export function voiceModeOrbState(
  state: VoiceModeState,
): "thinking" | "listening" | "talking" | null {
  switch (state) {
    case "GREETING":
    case "RESPONDING":
    case "NAVIGATING":
      return "talking";
    case "LISTENING":
    case "TRANSCRIBING":
      return "listening";
    case "THINKING":
      return "thinking";
    default:
      return null;
  }
}
