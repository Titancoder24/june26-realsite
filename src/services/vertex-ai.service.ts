import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVertexAIConfig, resolveVertexCredentials, VERTEX_DEFAULTS } from "@/lib/platform-settings";
import { assertAllowedVeoModel } from "@/lib/veo-video-models";

export const VERTEX_PLANNER_MODEL = VERTEX_DEFAULTS.planner_model;
export const VERTEX_IMAGE_MODEL = VERTEX_DEFAULTS.image_model;
export const VERTEX_VIDEO_MODEL = VERTEX_DEFAULTS.video_model;
export const VERTEX_EMBEDDING_MODEL = VERTEX_DEFAULTS.embedding_model;

export type VideoAspectRatio = "16:9" | "9:16";

export type VertexChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export const ENHANCEMENT_PROMPT = `Enhance this property photo for a professional real-estate listing. Improve lighting, exposure, sharpness, and color balance. Preserve the exact room layout, architecture, furniture, walls, flooring, and proportions. Do not add, remove, or alter structural elements or scenery. Output a clean polished listing photo.`;

const IMAGE_MODEL_FALLBACKS: string[] = [];

const PLANNER_MODEL_FALLBACKS = [
  VERTEX_DEFAULTS.planner_model,
  "gemini-2.0-flash-001",
];

async function getClient() {
  const { apiKey, projectId, location } = await resolveVertexCredentials();

  if (apiKey) {
    // API keys use Gemini/Vertex express routing (no project/location in constructor).
    return new GoogleGenAI({ vertexai: true, apiKey });
  }

  // Service-account / ADC auth for full Vertex AI Platform.
  const cfg = await getVertexAIConfig();
  return new GoogleGenAI({
    vertexai: true,
    project: cfg.project_id ?? projectId,
    location: cfg.location ?? location,
  });
}

async function apiKeyHeader(): Promise<Record<string, string>> {
  const { apiKey } = await resolveVertexCredentials();
  return { "x-goog-api-key": apiKey };
}

function isVertexExpressKey(apiKey: string): boolean {
  return apiKey.startsWith("AQ.");
}

function isRetryableVertexError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("503");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Vertex express REST — avoids SDK prepending regional project paths that break express keys. */
async function vertexExpressGenerateContent(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Vertex express request failed (${res.status})`);
  return JSON.parse(text) as unknown;
}

function vertexRegionalBase(projectId: string, location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}`;
}

/** Vertex express Veo submit — SDK generateVideos fails with express AQ keys. */
async function vertexExpressSubmitVideo(
  apiKey: string,
  projectId: string,
  location: string,
  model: string,
  prompt: string,
  imagePart?: { imageBytes: string; mimeType: string },
  aspectRatio: VideoAspectRatio = "16:9",
): Promise<string> {
  const url = `${vertexRegionalBase(projectId, location)}/publishers/google/models/${encodeURIComponent(model)}:predictLongRunning?key=${encodeURIComponent(apiKey)}`;
  const instance: Record<string, unknown> = { prompt };
  if (imagePart) {
    instance.image = {
      bytesBase64Encoded: imagePart.imageBytes,
      mimeType: imagePart.mimeType,
    };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [instance],
      parameters: { aspectRatio, sampleCount: 1, durationSeconds: 6 },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Vertex Veo submit failed (${res.status})`);
  const data = JSON.parse(text) as { name?: string };
  if (!data.name) throw new Error("Vertex Veo did not return an operation name");
  return data.name;
}

type VertexExpressVideoPoll = {
  status: "processing" | "completed" | "failed";
  videoBuffer?: Buffer;
  mimeType?: string;
  error?: string;
};

async function vertexExpressFetchVideo(
  apiKey: string,
  projectId: string,
  location: string,
  model: string,
  operationName: string,
): Promise<VertexExpressVideoPoll> {
  const url = `${vertexRegionalBase(projectId, location)}/publishers/google/models/${encodeURIComponent(model)}:fetchPredictOperation?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationName }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Vertex Veo poll failed (${res.status})`);
  const data = JSON.parse(text) as {
    done?: boolean;
    error?: { message?: string };
    response?: { videos?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
  };
  if (!data.done) return { status: "processing" };
  if (data.error) return { status: "failed", error: data.error.message ?? "Vertex Veo failed" };
  const video = data.response?.videos?.[0];
  if (!video?.bytesBase64Encoded) {
    return { status: "failed", error: "Vertex Veo returned no video bytes" };
  }
  return {
    status: "completed",
    videoBuffer: Buffer.from(video.bytesBase64Encoded, "base64"),
    mimeType: video.mimeType ?? "video/mp4",
  };
}

function formatVertexAuthError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("API_KEY_SERVICE_BLOCKED")) {
    return new Error(
      "Your Google API key has Generative Language API blocked. In Google Cloud Console → APIs & Services → Credentials, enable Vertex AI API or create a Vertex express API key (starts with AQ.).",
    );
  }
  if (msg.includes("API keys are not supported") || msg.includes("UNAUTHENTICATED")) {
    return new Error(
      "Vertex AI rejected the API key. Use a Vertex express key from Google Cloud → Vertex AI → Settings → API keys (starts with AQ.), or remove the AIza key from .env.local to use Admin-saved credentials.",
    );
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return new Error("Vertex AI rate limit hit — wait a minute and click Regenerate on this image.");
  }
  return err instanceof Error ? err : new Error(msg);
}

function uniqueModels(preferred: string | undefined, fallbacks: string[]): string[] {
  const list = preferred ? [preferred, ...fallbacks] : fallbacks;
  return [...new Set(list)];
}

function extractImageFromResponse(response: unknown): { data: string; mimeType: string } | null {
  const r = response as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  for (const part of r.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }
  return null;
}

export class VertexAIService {
  async enhanceImage(
    imageUrl: string,
    customPrompt?: string,
  ): Promise<{ buffer: Buffer; mimeType: string; model: string; prompt: string }> {
    const cfg = await getVertexAIConfig();
    const { apiKey } = await resolveVertexCredentials();
    const ai = isVertexExpressKey(apiKey) ? null : await getClient();
    const prompt = customPrompt ?? ENHANCEMENT_PROMPT;

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image for enhancement: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";

    const models = uniqueModels(cfg.image_model ?? VERTEX_IMAGE_MODEL, IMAGE_MODEL_FALLBACKS);
    const requestBody = {
      contents: [{
        role: "user",
        parts: [
          { inlineData: { data: buf.toString("base64"), mimeType } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    let lastError: Error | null = null;
    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = isVertexExpressKey(apiKey)
            ? await vertexExpressGenerateContent(apiKey, model, requestBody)
            : await ai!.models.generateContent({
                model,
                contents: requestBody.contents,
                config: { responseModalities: ["TEXT", "IMAGE"] },
              });

          const image = extractImageFromResponse(response);
          if (!image) throw new Error("Vertex AI returned no enhanced image");

          return {
            buffer: Buffer.from(image.data, "base64"),
            mimeType: image.mimeType,
            model,
            prompt,
          };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (isRetryableVertexError(err) && attempt < 2) {
            await sleep(5000 * (attempt + 1));
            continue;
          }
          break;
        }
      }
    }
    throw formatVertexAuthError(lastError ?? new Error("Vertex image enhancement failed"));
  }

  async uploadImageBuffer(
    buffer: Buffer,
    mimeType: string,
    organizationId: string,
    propertyId: string,
    suffix: string,
  ): Promise<string> {
    const admin = createAdminClient();
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const path = `${organizationId}/${propertyId}/walkthrough/images/enhanced-${Date.now()}-${suffix}.${ext}`;
    const { error } = await admin.storage.from("media").upload(path, buffer, { contentType: mimeType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
    return publicUrl;
  }

  async generateJSON(
    prompt: string,
    options?: { model?: string; temperature?: number; maxOutputTokens?: number },
  ): Promise<string> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();
    const models = uniqueModels(options?.model ?? cfg.planner_model, PLANNER_MODEL_FALLBACKS);

    let lastError: Error | null = null;
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: options?.maxOutputTokens ?? 8192,
            temperature: options?.temperature ?? 0.2,
          },
        });
        const text = response.text;
        if (!text?.trim()) throw new Error("Vertex AI returned empty JSON response");
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error("Vertex AI JSON generation failed");
  }

  async chat(
    messages: VertexChatMessage[],
    options?: { model?: string; temperature?: number; maxOutputTokens?: number },
  ): Promise<string> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();
    const models = uniqueModels(options?.model ?? cfg.planner_model, PLANNER_MODEL_FALLBACKS);

    const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const conversation = messages.filter((m) => m.role !== "system");

    const contents = conversation.map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    let lastError: Error | null = null;
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemParts || undefined,
            maxOutputTokens: options?.maxOutputTokens ?? 1024,
            temperature: options?.temperature ?? 0.15,
          },
        });
        const text = response.text;
        if (!text?.trim()) throw new Error("Vertex AI returned empty chat response");
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error("Vertex AI chat failed");
  }

  async embedText(text: string, dimensions = 1536): Promise<number[]> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();
    const model = cfg.embedding_model ?? VERTEX_EMBEDDING_MODEL;

    const response = await ai.models.embedContent({
      model,
      contents: [{ role: "user", parts: [{ text: text.slice(0, 8000) }] }],
      config: {
        outputDimensionality: dimensions,
      },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values?.length) throw new Error("Vertex AI returned empty embedding");

    if (values.length === dimensions) return values;
    if (values.length > dimensions) return values.slice(0, dimensions);
    return [...values, ...new Array(dimensions - values.length).fill(0)];
  }

  async planScenes(
    images: { id: string; url: string; file_name: string }[],
    options?: { propertyType?: string; propertyName?: string; promptText?: string },
  ): Promise<string> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();

    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [
      { text: options?.promptText ?? "Analyze property images and return walkthrough plan JSON." },
    ];

    for (const img of images.slice(0, 24)) {
      try {
        const res = await fetch(img.url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        parts.push({
          inlineData: {
            data: buf.toString("base64"),
            mimeType: res.headers.get("content-type") ?? "image/jpeg",
          },
        });
      } catch {
        parts.push({ text: `Image ${img.file_name} (id=${img.id})` });
      }
    }

    const models = uniqueModels(cfg.planner_model, PLANNER_MODEL_FALLBACKS);
    let lastError: Error | null = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            temperature: 0.2,
          },
        });

        const text = response.text;
        if (!text?.trim()) throw new Error("Vertex AI returned empty planner response");
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError ?? new Error("Vertex AI planner failed");
  }

  async validateVideoFidelity(
    sourceImage: { buffer: Buffer; mimeType: string },
    video: { buffer: Buffer; mimeType: string },
    prompt: string,
  ): Promise<string> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();
    const model = cfg.planner_model ?? VERTEX_PLANNER_MODEL;

    const parts = [
      { text: prompt },
      { text: "SOURCE IMAGE (ground truth):" },
      {
        inlineData: {
          data: sourceImage.buffer.toString("base64"),
          mimeType: sourceImage.mimeType,
        },
      },
      { text: "GENERATED VIDEO (validate fidelity):" },
      {
        inlineData: {
          data: video.buffer.toString("base64"),
          mimeType: video.mimeType,
        },
      },
    ];

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text?.trim()) throw new Error("Vertex AI returned empty validation response");
    return text;
  }

  async submitVideoJob(
    prompt: string,
    options: { aspectRatio?: VideoAspectRatio; model: string },
    imageUrl?: string,
    imageFetcher?: (url: string) => Promise<{ buffer: Buffer; mimeType: string }>,
  ): Promise<{ operationName: string; model: string }> {
    const { apiKey, projectId, location } = await resolveVertexCredentials();
    const aspectRatio = options.aspectRatio ?? "16:9";
    const model = options.model?.trim();
    if (!model) {
      throw new Error("Video model is required — select Fast (Veo 3.1 Fast) or Quality (Veo 3.1 Lite)");
    }
    assertAllowedVeoModel(model);

    let imagePart: { imageBytes: string; mimeType: string } | undefined;
    if (imageUrl) {
      const fetchFn = imageFetcher ?? (async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch scene image: ${res.status}`);
        return {
          buffer: Buffer.from(await res.arrayBuffer()),
          mimeType: res.headers.get("content-type") ?? "image/jpeg",
        };
      });
      const { buffer, mimeType } = await fetchFn(imageUrl);
      imagePart = {
        imageBytes: buffer.toString("base64"),
        mimeType,
      };
    }

    if (isVertexExpressKey(apiKey)) {
      const operationName = await vertexExpressSubmitVideo(
        apiKey,
        projectId,
        location,
        model,
        prompt,
        imagePart,
        aspectRatio,
      );
      return { operationName, model };
    }

    const ai = await getClient();
    const operation = await ai.models.generateVideos({
      model,
      source: {
        prompt,
        ...(imagePart ? { image: imagePart } : {}),
      },
      config: {
        numberOfVideos: 1,
        aspectRatio,
        durationSeconds: 6,
        resolution: "720p",
      },
    });

    const name = operation.name ?? (operation as { operation?: { name?: string } }).operation?.name;
    if (!name) throw new Error("Vertex Veo did not return an operation name");
    return { operationName: name, model };
  }

  async pollVideoOperation(
    operationName: string,
    model: string,
  ): Promise<{
    status: "processing" | "completed" | "failed";
    videoUri?: string;
    videoBuffer?: Buffer;
    mimeType?: string;
    error?: string;
  }> {
    const { apiKey, projectId, location } = await resolveVertexCredentials();
    if (!model?.trim()) {
      throw new Error("Video model is required to poll the Veo operation");
    }

    if (isVertexExpressKey(apiKey)) {
      return vertexExpressFetchVideo(apiKey, projectId, location, model, operationName);
    }

    const ai = await getClient();
    const operation = await ai.operations.getVideosOperation({
      operation: { name: operationName } as Parameters<typeof ai.operations.getVideosOperation>[0]["operation"],
    });

    if (!operation.done) {
      return { status: "processing" };
    }

    if (operation.error) {
      return { status: "failed", error: String(operation.error.message ?? operation.error) };
    }

    const video = operation.response?.generatedVideos?.[0]?.video as { uri?: string } | undefined;
    const uri = video?.uri;

    if (!uri) return { status: "failed", error: "No video URI in Vertex response" };
    return { status: "completed", videoUri: uri };
  }

  async downloadVideo(uri: string): Promise<Buffer> {
    if (uri.startsWith("gs://")) {
      throw new Error("GCS video URIs require bucket access — configure Vertex output to HTTPS URI");
    }

    const res = await fetch(uri, { headers: await apiKeyHeader() });
    if (!res.ok) throw new Error(`Failed to download Vertex video: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

export const vertexAIService = new VertexAIService();
