export function parseImageDimensions(buffer: ArrayBuffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType.includes("png")) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 24) return null;
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    const bytes = new Uint8Array(buffer);
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + len;
    }
  }

  return null;
}

export function aspectRatioFromDimensions(width?: number | null, height?: number | null): "16:9" | "9:16" {
  if (width && height && height > width * 1.05) return "9:16";
  return "16:9";
}

export async function fetchImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    return parseImageDimensions(buffer, mime);
  } catch {
    return null;
  }
}
