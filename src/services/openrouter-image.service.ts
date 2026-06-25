import { GEMINI_IMAGE_MODEL, sendChatCompletion } from "@/lib/openrouter";
import { createAdminClient } from "@/lib/supabase/admin";

const ENHANCEMENT_PROMPT = `Enhance this real estate property photo for a premium listing walkthrough.
Improve lighting, exposure, noise reduction, color balance, and sharpness.
Upscale clarity while preserving exact room layout, materials, furniture, windows, and views.
Do NOT add, remove, or alter any structural elements, furniture, flooring, walls, or scenery.
Return only the enhanced image — no text overlays or watermarks.`;

export class OpenRouterImageService {
  private get imageModel() {
    return process.env.OPENROUTER_IMAGE_MODEL ?? GEMINI_IMAGE_MODEL;
  }

  async enhanceImage(imageUrl: string, customPrompt?: string): Promise<{ dataUrl: string; model: string; prompt: string }> {
    const prompt = customPrompt ?? ENHANCEMENT_PROMPT;

    const result = await sendChatCompletion({
      model: this.imageModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", imageUrl: { url: imageUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    });

    const message = result.choices?.[0]?.message as {
      images?: { imageUrl?: { url?: string }; image_url?: { url?: string } }[];
      content?: { type?: string; image_url?: { url?: string } }[] | string;
    };

    const images = message?.images ?? (Array.isArray(message?.content)
      ? message.content.filter((c) => c.type === "image_url")
      : undefined);

    let dataUrl: string | undefined;
    if (Array.isArray(message?.images) && message.images[0]) {
      dataUrl = message.images[0].imageUrl?.url ?? message.images[0].image_url?.url;
    }
    if (!dataUrl && Array.isArray(images) && images[0]) {
      const first = images[0] as { image_url?: { url?: string }; imageUrl?: { url?: string } };
      dataUrl = first.image_url?.url ?? first.imageUrl?.url;
    }

    if (!dataUrl) {
      throw new Error("OpenRouter returned no enhanced image");
    }

    return { dataUrl, model: this.imageModel, prompt };
  }

  async uploadDataUrlToStorage(
    dataUrl: string,
    organizationId: string,
    propertyId: string,
    suffix: string,
  ): Promise<string> {
    const admin = createAdminClient();
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL");

    const mime = match[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(match[2], "base64");
    const path = `${organizationId}/${propertyId}/walkthrough/enhanced-${Date.now()}-${suffix}.${ext}`;

    const { error } = await admin.storage.from("media").upload(path, buffer, { contentType: mime, upsert: false });
    if (error) throw error;

    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
    return publicUrl;
  }
}

export const openRouterImageService = new OpenRouterImageService();
