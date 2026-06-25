/** In-memory cache for scene images during a single poll/generation cycle. */

type CachedImage = { buffer: Buffer; mimeType: string; fetchedAt: number };

const cache = new Map<string, CachedImage>();
const TTL_MS = 5 * 60 * 1000;

export async function fetchSceneImageCached(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    return { buffer: hit.buffer, mimeType: hit.mimeType };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch scene image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  cache.set(url, { buffer, mimeType, fetchedAt: Date.now() });
  return { buffer, mimeType };
}

export function clearImageCache() {
  cache.clear();
}
