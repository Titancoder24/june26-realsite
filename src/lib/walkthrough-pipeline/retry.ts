import { VEO_PIPELINE } from "./config";

const RETRYABLE_PATTERNS = [
  "429",
  "RESOURCE_EXHAUSTED",
  "503",
  "502",
  "504",
  "timeout",
  "ECONNRESET",
  "ETIMEDOUT",
  "rate limit",
  "temporarily unavailable",
  "internal error",
] as const;

export function isRetryableVeoError(message: string): boolean {
  const lower = message.toLowerCase();
  return RETRYABLE_PATTERNS.some((p) => lower.includes(p.toLowerCase()) || message.includes(p));
}

export function retryDelayMs(retryCount: number): number {
  const delays = VEO_PIPELINE.retryDelaysMs;
  return delays[Math.min(retryCount, delays.length - 1)] ?? delays[delays.length - 1];
}

export async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function withVeoRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; label?: string } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? VEO_PIPELINE.maxRetries;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(msg);
      if (attempt >= maxRetries || !isRetryableVeoError(msg)) throw lastError;
      const delay = retryDelayMs(attempt);
      console.warn(`[veo-pipeline] ${options.label ?? "retry"} attempt ${attempt + 1}/${maxRetries} in ${delay}ms: ${msg}`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("VEO retry exhausted");
}
