import { stitchFramesToEquirectangular, type StitchResult } from "@/lib/capture/pannellum-stitch";

import type { StitchOptions } from "@/lib/capture/pannellum-stitch";

/** Run stitch off main thread via idle chunks when worker unavailable. */
export async function stitchInBackground(
  frames: { yaw: number; blob: Blob; exposure?: number; pitch?: number; roll?: number }[],
  onProgress?: (pct: number) => void,
  options?: StitchOptions,
): Promise<StitchResult> {
  return new Promise((resolve, reject) => {
    const run = () => stitchFramesToEquirectangular(frames, onProgress, options).then(resolve).catch(reject);
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(run);
    } else {
      setTimeout(run, 0);
    }
  });
}
