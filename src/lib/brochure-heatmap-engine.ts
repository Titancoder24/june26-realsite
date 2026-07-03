/** Canvas heatmap renderer — Hotjar-style gradient overlay on brochure pages. */

export type HeatmapSample = {
  x: number;
  y: number;
  weight?: number;
};

const PALETTE_STOPS: Array<[number, [number, number, number]]> = [
  [0, [0, 0, 255]],
  [0.25, [0, 255, 255]],
  [0.5, [0, 255, 0]],
  [0.75, [255, 255, 0]],
  [1, [255, 0, 0]],
];

function buildPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    let lower = PALETTE_STOPS[0];
    let upper = PALETTE_STOPS[PALETTE_STOPS.length - 1];
    for (let j = 0; j < PALETTE_STOPS.length - 1; j += 1) {
      if (t >= PALETTE_STOPS[j][0] && t <= PALETTE_STOPS[j + 1][0]) {
        lower = PALETTE_STOPS[j];
        upper = PALETTE_STOPS[j + 1];
        break;
      }
    }
    const span = upper[0] - lower[0] || 1;
    const mix = (t - lower[0]) / span;
    const r = Math.round(lower[1][0] + (upper[1][0] - lower[1][0]) * mix);
    const g = Math.round(lower[1][1] + (upper[1][1] - lower[1][1]) * mix);
    const b = Math.round(lower[1][2] + (upper[1][2] - lower[1][2]) * mix);
    palette[i * 4] = r;
    palette[i * 4 + 1] = g;
    palette[i * 4 + 2] = b;
    palette[i * 4 + 3] = 255;
  }
  return palette;
}

const COLOR_PALETTE = buildPalette();

export function drawHeatmapOverlay(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  points: HeatmapSample[],
  options?: { radius?: number; maxOpacity?: number },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  if (points.length === 0) return;

  const radius = options?.radius ?? Math.max(28, Math.min(width, height) * 0.12);
  const maxOpacity = options?.maxOpacity ?? 0.55;

  const intensity = document.createElement("canvas");
  intensity.width = width;
  intensity.height = height;
  const iCtx = intensity.getContext("2d");
  if (!iCtx) return;

  iCtx.clearRect(0, 0, width, height);

  for (const pt of points) {
    const x = Math.min(1, Math.max(0, pt.x)) * width;
    const y = Math.min(1, Math.max(0, pt.y)) * height;
    const weight = Math.max(0.15, pt.weight ?? 1);
    const gradient = iCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${Math.min(1, weight * 0.22)})`);
    gradient.addColorStop(0.55, `rgba(0, 0, 0, ${Math.min(0.65, weight * 0.1)})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    iCtx.globalCompositeOperation = "lighter";
    iCtx.fillStyle = gradient;
    iCtx.beginPath();
    iCtx.arc(x, y, radius, 0, Math.PI * 2);
    iCtx.fill();
  }

  const pixels = iCtx.getImageData(0, 0, width, height);
  const colored = ctx.createImageData(width, height);

  for (let i = 0; i < pixels.data.length; i += 4) {
    const alpha = pixels.data[i + 3];
    if (alpha === 0) continue;
    const idx = Math.min(255, alpha) * 4;
    colored.data[i] = COLOR_PALETTE[idx];
    colored.data[i + 1] = COLOR_PALETTE[idx + 1];
    colored.data[i + 2] = COLOR_PALETTE[idx + 2];
    colored.data[i + 3] = Math.round(alpha * maxOpacity);
  }

  ctx.putImageData(colored, 0, 0);
}

export function clickPointsToSamples(
  points: Array<{ x: number; y: number; event_type?: string }>,
): HeatmapSample[] {
  return points.map((p) => ({
    x: Number(p.x),
    y: Number(p.y),
    weight: p.event_type === "attention" ? 0.85 : 1.2,
  }));
}

export function sectionDwellToSamples(
  sections: Array<{ page_number: number; section_id: string; x: number; y: number; width: number; height: number }>,
  sectionDwell: Array<{ page_number: number; section_id: string; visible_seconds: number }>,
  pageNumber: number,
): HeatmapSample[] {
  const samples: HeatmapSample[] = [];
  for (const dwell of sectionDwell.filter((s) => s.page_number === pageNumber)) {
    const section = sections.find((s) => s.section_id === dwell.section_id && s.page_number === pageNumber);
    if (!section) continue;
    const cx = section.x + section.width / 2;
    const cy = section.y + section.height / 2;
    const count = Math.min(24, Math.max(1, Math.ceil(dwell.visible_seconds / 2)));
    for (let i = 0; i < count; i += 1) {
      const jitterX = (Math.random() - 0.5) * section.width * 0.35;
      const jitterY = (Math.random() - 0.5) * section.height * 0.35;
      samples.push({
        x: Math.min(1, Math.max(0, cx + jitterX)),
        y: Math.min(1, Math.max(0, cy + jitterY)),
        weight: dwell.visible_seconds / count,
      });
    }
  }
  return samples;
}

const SCROLL_BUCKET_CENTER: Record<string, number> = {
  "0-25": 0.12,
  "25-50": 0.37,
  "50-75": 0.62,
  "75-100": 0.87,
};

export function scrollDepthToSamples(
  scrollDepth: Array<{ page_number: number; scroll_bucket: string; seconds: number }>,
  pageNumber: number,
): HeatmapSample[] {
  const samples: HeatmapSample[] = [];
  for (const row of scrollDepth.filter((r) => r.page_number === pageNumber)) {
    const cy = SCROLL_BUCKET_CENTER[row.scroll_bucket] ?? 0.5;
    const count = Math.min(20, Math.max(1, Math.ceil(row.seconds / 2)));
    for (let i = 0; i < count; i += 1) {
      samples.push({
        x: 0.15 + ((i % 7) / 6) * 0.7,
        y: cy + (Math.random() - 0.5) * 0.06,
        weight: row.seconds / count,
      });
    }
  }
  return samples;
}

export function mergeHeatmapSamples(...groups: HeatmapSample[][]): HeatmapSample[] {
  return groups.flat();
}
