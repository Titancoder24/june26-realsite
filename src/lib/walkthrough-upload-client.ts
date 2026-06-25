import type { WalkthroughImage } from "@/types/cinematic-walkthrough";

export type WalkthroughUploadStatus = "queued" | "uploading" | "done" | "failed";

export interface WalkthroughUploadQueueItem {
  clientId: string;
  fileName: string;
  status: WalkthroughUploadStatus;
  progress: number;
  error?: string;
}

export function uploadWalkthroughImageWithProgress(
  file: File,
  params: { experienceId: string; propertyId: string; projectId?: string },
  onProgress: (progress: number) => void,
): Promise<WalkthroughImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("experienceId", params.experienceId);
    form.append("propertyId", params.propertyId);
    if (params.projectId) form.append("projectId", params.projectId);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.addEventListener("load", () => {
      let payload: WalkthroughImage | { error?: string } = {};
      try {
        payload = JSON.parse(xhr.responseText) as WalkthroughImage | { error?: string };
      } catch {
        reject(new Error(`Upload failed for ${file.name}`));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as WalkthroughImage);
        return;
      }

      reject(new Error((payload as { error?: string }).error ?? `Upload failed for ${file.name}`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error(`Network error uploading ${file.name}`));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error(`Upload cancelled for ${file.name}`));
    });

    xhr.open("POST", "/api/walkthrough/images");
    xhr.send(form);
  });
}
