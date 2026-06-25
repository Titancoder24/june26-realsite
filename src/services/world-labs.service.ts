import { requireServerKey } from "@/lib/env";
import type { WorldLabsJobStatus } from "@/types/domain";

const BASE = () => process.env.WORLD_LABS_API_BASE ?? "https://api.worldlabs.ai";

function headers() {
  return {
    "Content-Type": "application/json",
    "WLT-Api-Key": requireServerKey("WORLD_LABS_API_KEY", "World Labs API"),
  };
}

export interface WorldLabsOperation {
  name: string;
  done: boolean;
  metadata?: Record<string, unknown>;
  response?: WorldLabsWorld;
  error?: { code: number; message: string; details?: unknown[] };
}

export interface WorldLabsWorld {
  world_id: string;
  world_marble_url?: string;
  assets?: {
    caption?: string;
    thumbnail_url?: string;
    splats?: { spz_urls?: Record<string, string> };
    mesh?: { collider_mesh_url?: string };
    imagery?: { pano_url?: string };
  };
}

export interface PrepareUploadResponse {
  media_asset_id: string;
  upload_url: string;
  upload_headers?: Record<string, string>;
}

export class WorldLabsService {
  async prepareMediaUpload(fileName: string, contentType: string): Promise<PrepareUploadResponse> {
    const res = await fetch(`${BASE()}/marble/v1/media-assets:prepare_upload`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ file_name: fileName, content_type: contentType }),
    });
    if (!res.ok) throw new Error(`World Labs prepare_upload failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async uploadToSignedUrl(uploadUrl: string, file: ArrayBuffer | Blob, contentType: string, uploadHeaders?: Record<string, string>) {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType, ...uploadHeaders },
      body: file instanceof Blob ? file : new Uint8Array(file),
    });
    if (!res.ok) throw new Error(`World Labs media upload failed: ${res.status}`);
  }

  async generateWorld(params: {
    mediaAssetIds?: string[];
    prompt?: string;
    model?: string;
  }): Promise<{ operationId: string; operation: WorldLabsOperation }> {
    const body: Record<string, unknown> = {};
    if (params.mediaAssetIds?.length) body.media_asset_ids = params.mediaAssetIds;
    if (params.prompt) body.prompt = params.prompt;
    if (params.model) body.model = params.model;

    const res = await fetch(`${BASE()}/marble/v1/worlds:generate`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`World Labs worlds:generate failed: ${res.status} ${await res.text()}`);
    const operation: WorldLabsOperation = await res.json();
    const operationId = operation.name.split("/").pop() ?? operation.name;
    return { operationId, operation };
  }

  async getOperation(operationId: string): Promise<WorldLabsOperation> {
    const res = await fetch(`${BASE()}/marble/v1/operations/${operationId}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`World Labs operation poll failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async pollUntilDone(operationId: string, opts?: { intervalMs?: number; maxAttempts?: number }) {
    const intervalMs = opts?.intervalMs ?? 20000;
    const maxAttempts = opts?.maxAttempts ?? 30;
    for (let i = 0; i < maxAttempts; i++) {
      const op = await this.getOperation(operationId);
      if (op.done) return op;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("World Labs polling timeout");
  }

  extractSplatUrls(world: WorldLabsWorld) {
    const spz = world.assets?.splats?.spz_urls ?? {};
    return {
      worldId: world.world_id,
      worldMarbleUrl: world.world_marble_url,
      thumbnailUrl: world.assets?.thumbnail_url,
      caption: world.assets?.caption,
      spz100kUrl: spz["100k"] ?? spz["100K"],
      spz500kUrl: spz["500k"] ?? spz["500K"],
      spzFullResUrl: spz["full_res"] ?? spz["full"],
      colliderMeshUrl: world.assets?.mesh?.collider_mesh_url,
      panoUrl: world.assets?.imagery?.pano_url,
    };
  }

  getDeveloperStatus(internal: WorldLabsJobStatus): string {
    const map: Partial<Record<WorldLabsJobStatus, string>> = {
      draft: "Draft",
      media_uploaded: "Preparing your 3D walkthrough",
      validating_media: "Preparing your 3D walkthrough",
      preparing_worldlabs_upload: "Preparing your 3D walkthrough",
      worldlabs_upload_ready: "Preparing your 3D walkthrough",
      worldlabs_media_uploaded: "Preparing your 3D walkthrough",
      worldlabs_generation_requested: "Generating 3D world",
      worldlabs_processing: "Generating 3D world",
      worldlabs_succeeded: "Optimizing viewer",
      downloading_assets: "Optimizing viewer",
      optimizing_viewer_assets: "Optimizing viewer",
      ready_for_review: "Ready for review",
      published: "Published",
    };
    return map[internal] ?? "Processing";
  }
}

export const worldLabsService = new WorldLabsService();
