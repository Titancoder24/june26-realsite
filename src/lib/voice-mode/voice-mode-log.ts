/** Dev-only voice mode pipeline logging. */
export function voiceModeLog(step: string, payload: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[voice-mode] ${step}`, payload);
}
