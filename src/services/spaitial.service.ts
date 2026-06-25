import { requireServerKey } from "@/lib/env";

const BASE = "https://api.spaitial.ai";

export interface SpAItialWorldResult {
  requestId: string;
  worldId?: string;
  title?: string;
  splatProxyUrl?: string;
  splatFormat?: string;
  thumbnailUrl?: string;
  panoramaProxyUrl?: string;
  viewerUrl?: string;
}

export interface SpAItialStatus {
  requestId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress?: number;
  error?: string;
}

function authHeaders(extra?: Record<string, string>) {
  const key = requireServerKey("SPAITIAL_API_KEY", "SpAItial API key");
  return { Authorization: `Bearer ${key}`, ...extra };
}

async function parseError(res: Response) {
  const body = await res.json().catch(() => ({}));
  const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText;
  throw new Error(msg || `SpAItial API error ${res.status}`);
}

export class SpAItialService {
  async listModels() {
    const res = await fetch(`${BASE}/v1/models`, { headers: authHeaders() });
    if (!res.ok) await parseError(res);
    return res.json();
  }

  /** Upload image buffer — returns file_id (24h TTL). */
  async uploadFile(buffer: ArrayBuffer, filename: string, mimeType: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), filename);
    const res = await fetch(`${BASE}/v1/files`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { file_id: string };
    return data.file_id;
  }

  /** Resolve model for API body — never send alias "default" (returns MODEL_FORBIDDEN). */
  private modelField(model?: string): Record<string, string> {
    if (!model || model === "default") return {};
    return { model };
  }

  /** Download image and upload to SpAItial — most reliable path for Supabase-hosted photos. */
  async createWorldFromMediaUrl(params: {
    imageUrl: string;
    title?: string;
    model?: string;
    isPano?: boolean;
  }): Promise<{ requestId: string; status: string }> {
    const res = await fetch(params.imageUrl);
    if (!res.ok) throw new Error(`Could not fetch property image (${res.status})`);
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buffer = await res.arrayBuffer();
    const fileId = await this.uploadFile(buffer, `property.${ext}`, mime);
    return this.createWorldFromFileId({
      fileId,
      title: params.title,
      model: params.model,
      isPano: params.isPano,
    });
  }

  /** Create world from a public HTTPS image URL. */
  async createWorldFromImageUrl(params: {
    imageUrl: string;
    title?: string;
    prompt?: string;
    model?: string;
    isPano?: boolean;
  }): Promise<{ requestId: string; status: string }> {
    const body: Record<string, unknown> = {
      input: {
        type: "url",
        image_url: params.imageUrl,
        ...(params.isPano ? { is_pano: true } : {}),
      },
      ...this.modelField(params.model),
      title: params.title ?? "Property immersive world",
      output_format: "spz",
      validation: { skip: true },
      visibility: { is_public: false, is_listed: false },
    };
    const res = await fetch(`${BASE}/v1/worlds`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { request_id: string; status: string };
    return { requestId: data.request_id, status: data.status };
  }

  async createWorldFromText(params: {
    prompt: string;
    title?: string;
    model?: string;
  }): Promise<{ requestId: string; status: string }> {
    const res = await fetch(`${BASE}/v1/worlds`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        input: { type: "text", prompt: params.prompt },
        ...this.modelField(params.model),
        title: params.title ?? params.prompt.slice(0, 80),
        output_format: "spz",
        validation: { skip: true },
        visibility: { is_public: false, is_listed: false },
      }),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { request_id: string; status: string };
    return { requestId: data.request_id, status: data.status };
  }

  async createWorldFromFileId(params: {
    fileId: string;
    title?: string;
    model?: string;
    isPano?: boolean;
  }): Promise<{ requestId: string; status: string }> {
    const res = await fetch(`${BASE}/v1/worlds`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        input: { type: "file_id", file_id: params.fileId, ...(params.isPano ? { is_pano: true } : {}) },
        ...this.modelField(params.model),
        title: params.title ?? "Property immersive world",
        output_format: "spz",
        validation: { skip: true },
        visibility: { is_public: false, is_listed: false },
      }),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { request_id: string; status: string };
    return { requestId: data.request_id, status: data.status };
  }

  async getStatus(requestId: string): Promise<SpAItialStatus> {
    const res = await fetch(`${BASE}/v1/worlds/requests/${requestId}/status`, {
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as {
      request_id: string;
      status: SpAItialStatus["status"];
      progress?: number;
      error?: { message?: string } | string;
    };
    const errMsg = typeof data.error === "string" ? data.error : data.error?.message;
    return {
      requestId: data.request_id,
      status: data.status,
      progress: data.progress,
      error: errMsg,
    };
  }

  async getResult(requestId: string): Promise<SpAItialWorldResult> {
    const res = await fetch(`${BASE}/v1/worlds/requests/${requestId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as {
      request_id: string;
      world?: {
        id?: string;
        title?: string;
        splat_url?: string;
        splat_format?: string;
        thumbnail_url?: string;
        panorama_url?: string;
        viewer_url?: string;
      };
      splat_url?: string;
      thumbnail_url?: string;
      panorama_url?: string;
      viewer_url?: string;
      world_id?: string;
      title?: string;
    };
    const w = data.world;
    return {
      requestId: data.request_id,
      worldId: w?.id ?? data.world_id,
      title: w?.title ?? data.title,
      splatProxyUrl: w?.splat_url ?? data.splat_url,
      splatFormat: w?.splat_format,
      thumbnailUrl: w?.thumbnail_url ?? data.thumbnail_url,
      panoramaProxyUrl: w?.panorama_url ?? data.panorama_url,
      viewerUrl: w?.viewer_url ?? data.viewer_url,
    };
  }

  /** Follow 302 redirect to get a signed download URL for the splat file. */
  async resolveSplatDownloadUrl(requestId: string): Promise<string> {
    const res = await fetch(`${BASE}/v1/worlds/requests/${requestId}/splat`, {
      headers: authHeaders(),
      redirect: "manual",
    });
    if (res.status === 302 || res.status === 301) {
      const loc = res.headers.get("location");
      if (loc) return loc;
    }
    if (!res.ok) await parseError(res);
    throw new Error("No splat redirect URL");
  }

  isTerminal(status: SpAItialStatus["status"]) {
    return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
  }
}

export const spaitialService = new SpAItialService();
