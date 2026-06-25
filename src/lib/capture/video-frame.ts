import { analyzeFrame, type FrameQuality } from "@/lib/capture/frame-quality";

export async function captureVideoFrame(video: HTMLVideoElement): Promise<{ blob: Blob; quality: FrameQuality } | null> {
  if (!video.videoWidth) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const track = video.srcObject instanceof MediaStream ? video.srcObject.getVideoTracks()[0] : null;

  if (track && "ImageCapture" in window) {
    try {
      const ic = new (window as Window & { ImageCapture: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture(track);
      const blob = await ic.takePhoto();
      const img = await createImageBitmap(blob);
      ctx.drawImage(img, 0, 0);
      img.close();
      const quality = analyzeFrame(canvas);
      return { blob, quality };
    } catch {
      /* fall through to canvas capture */
    }
  }

  ctx.drawImage(video, 0, 0);
  const quality = analyzeFrame(canvas);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return null;
  return { blob, quality };
}
