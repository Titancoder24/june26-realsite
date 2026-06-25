import {
  DEFAULT_BRAIN_PROVIDER,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";
import { googleAIStudioService } from "./google-ai-studio.service";
import type { VertexChatMessage } from "./vertex-ai.service";
import { vertexAIService } from "./vertex-ai.service";

export type WalkthroughBrainChatOptions = {
  provider?: WalkthroughBrainProvider;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export function isVertexBrainAvailable(): boolean {
  return Boolean(
    process.env.GOOGLE_VERTEX_API_KEY?.trim()
    || process.env.GOOGLE_CLOUD_PROJECT?.trim(),
  );
}

export function isGeminiNativeBrainAvailable(): boolean {
  return googleAIStudioService.isConfigured();
}

export async function walkthroughBrainChat(
  messages: VertexChatMessage[],
  options?: WalkthroughBrainChatOptions,
): Promise<{ text: string; provider: WalkthroughBrainProvider; model: string }> {
  const provider = options?.provider ?? DEFAULT_BRAIN_PROVIDER;

  if (provider === "google-ai-studio") {
    if (!isGeminiNativeBrainAvailable()) {
      throw new Error("Gemini Native is not configured. Set GEMINI_API_KEY in .env.local.");
    }
    const model = options?.model ?? process.env.GEMINI_BRAIN_MODEL?.trim() ?? "gemini-3.5-flash";
    const text = await googleAIStudioService.chat(messages, options);
    return { text, provider, model };
  }

  const text = await vertexAIService.chat(messages, options);
  return { text, provider: "vertex", model: options?.model ?? "gemini-2.5-flash" };
}
