/** Fetch with timeout — prevents voice UI stuck in "thinking" forever. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 28000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Voice request timed out — please try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}
