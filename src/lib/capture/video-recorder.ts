import { VIDEO_CAPTURE } from "@/lib/capture/capture-protocol";

/** Orientation timeline sample — t is ms since recording start. */
export interface OrientationSample {
  t: number;
  yaw: number;
  pitch: number;
  roll?: number;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  samples: OrientationSample[];
  durationMs: number;
}

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/**
 * MediaRecorder wrapper that logs an orientation timeline alongside the video,
 * so extraction can map each yaw bucket to exact timestamps.
 */
export class VideoCaptureRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private samples: OrientationSample[] = [];
  private startedAt = 0;
  private mimeType = "";

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  get elapsedMs() {
    return this.startedAt ? performance.now() - this.startedAt : 0;
  }

  start(stream: MediaStream) {
    const mime = pickRecorderMimeType();
    if (mime == null) throw new Error("Video recording not supported on this browser");

    this.chunks = [];
    this.samples = [];
    this.mimeType = mime;

    this.recorder = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: VIDEO_CAPTURE.videoBitsPerSecond,
    });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    // Timeslice keeps chunks flowing so a crash mid-capture loses little
    this.recorder.start(1000);
    this.startedAt = performance.now();
  }

  /** Call on every device-orientation tick while recording. */
  addSample(yaw: number, pitch: number, roll?: number) {
    if (!this.isRecording) return;
    this.samples.push({ t: performance.now() - this.startedAt, yaw, pitch, roll });
  }

  stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === "inactive") {
        reject(new Error("Recorder not running"));
        return;
      }
      const durationMs = this.elapsedMs;
      recorder.onstop = () => {
        const type = this.mimeType || this.chunks[0]?.type || "video/webm";
        resolve({
          blob: new Blob(this.chunks, { type }),
          mimeType: type,
          samples: this.samples,
          durationMs,
        });
        this.recorder = null;
        this.startedAt = 0;
      };
      recorder.onerror = () => reject(new Error("Recording failed"));
      recorder.stop();
    });
  }

  cancel() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.chunks = [];
    this.samples = [];
    this.startedAt = 0;
  }
}
