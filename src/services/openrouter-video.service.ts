import { requireServerKey } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const VEO_MODEL = "google/veo-3.1-lite";

export class OpenRouterVideoService {
  private get apiKey() {
    return requireServerKey("OPENROUTER_API_KEY", "OpenRouter");
  }

  private get model() {
    return process.env.OPENROUTER_VIDEO_MODEL ?? VEO_MODEL;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "RealSite Property Walkthrough",
    };
  }

  async submitVideoJob(
    prompt: string,
    imageUrl?: string,
    options?: { aspectRatio?: "16:9" | "9:16" },
  ): Promise<{ jobId: string; pollingUrl: string }> {
    const body: Record<string, unknown> = {
      model: this.model,
      prompt,
    };
    if (imageUrl) {
      body.image_url = imageUrl;
    }
    if (options?.aspectRatio) {
      body.aspect_ratio = options.aspectRatio;
    }

    const res = await fetch("https://openrouter.ai/api/v1/videos", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Veo submit failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    return {
      jobId: String(json.id ?? ""),
      pollingUrl: String(json.polling_url ?? ""),
    };
  }

  async pollOnce(pollingUrl: string): Promise<{
    status: string;
    unsignedUrls: string[];
    error?: string;
  }> {
    const res = await fetch(pollingUrl, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    if (!res.ok) {
      throw new Error(`Veo poll failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const status = String(data.status ?? "processing");

    if (status === "completed") {
      return {
        status,
        unsignedUrls: Array.isArray(data.unsigned_urls) ? data.unsigned_urls.map(String) : [],
      };
    }
    if (status === "failed") {
      return { status, unsignedUrls: [], error: String(data.error ?? "Video generation failed") };
    }
    return { status, unsignedUrls: [] };
  }

  async pollUntilComplete(pollingUrl: string, maxAttempts = 60, intervalMs = 5000): Promise<{
    status: string;
    unsignedUrls: string[];
    error?: string;
  }> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(pollingUrl, { headers: { Authorization: `Bearer ${this.apiKey}` } });
      if (!res.ok) {
        throw new Error(`Veo poll failed: ${res.status} ${await res.text()}`);
      }
      const data = await res.json();
      const status = String(data.status ?? "processing");

      if (status === "completed") {
        return {
          status,
          unsignedUrls: Array.isArray(data.unsigned_urls) ? data.unsigned_urls.map(String) : [],
        };
      }
      if (status === "failed") {
        return { status, unsignedUrls: [], error: String(data.error ?? "Video generation failed") };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Video generation timed out");
  }

  async downloadAndStore(
    sourceUrl: string,
    organizationId: string,
    propertyId: string,
    sceneId: string,
  ): Promise<string> {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "video/mp4";
    const ext = contentType.includes("webm") ? "webm" : "mp4";
    const path = `${organizationId}/${propertyId}/walkthrough/motion-${sceneId.slice(0, 8)}-${Date.now()}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage.from("media").upload(path, buffer, { contentType, upsert: true });
    if (error) throw error;

    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
    return publicUrl;
  }
}

export const openRouterVideoService = new OpenRouterVideoService();
