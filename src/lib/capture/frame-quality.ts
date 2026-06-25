/** Client-side frame quality checks (blur, lighting). */

export interface FrameQuality {
  sharpness: number;
  brightness: number;
  ok: boolean;
  issue?: string;
}

export function analyzeFrame(canvas: HTMLCanvasElement): FrameQuality {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { sharpness: 0, brightness: 0, ok: false, issue: "Canvas error" };

  const sampleW = Math.min(320, canvas.width);
  const sampleH = Math.min(180, canvas.height);
  const small = document.createElement("canvas");
  small.width = sampleW;
  small.height = sampleH;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const { data } = sctx.getImageData(0, 0, sampleW, sampleH);

  let lumSum = 0;
  const gray = new Float32Array(sampleW * sampleH);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = lum;
    lumSum += lum;
  }
  const brightness = lumSum / (gray.length * 255);

  let laplacian = 0;
  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const i = y * sampleW + x;
      const v = Math.abs(
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - sampleW] - gray[i + sampleW],
      );
      laplacian += v;
    }
  }
  const sharpness = laplacian / ((sampleW - 2) * (sampleH - 2) * 255);

  if (brightness < 0.12) return { sharpness, brightness, ok: false, issue: "Too dark — turn on lights" };
  if (brightness > 0.92) return { sharpness, brightness, ok: false, issue: "Too bright — avoid direct window glare" };
  if (sharpness < 0.018) return { sharpness, brightness, ok: false, issue: "Hold steady — image is blurry" };

  return { sharpness, brightness, ok: true };
}
