import { OpenRouter } from "@openrouter/sdk";
import type { ChatRequest, ChatResult } from "@openrouter/sdk/models";
import { env, requireServerKey } from "@/lib/env";

export const GEMINI_35_FLASH_MODEL = "google/gemini-3.5-flash";
export const GEMINI_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

/** Gemini 3.5 Flash defaults to medium reasoning; keep planner/chat responses fast. */
export const GEMINI_FLASH_REASONING = {
  effort: "minimal" as const,
};

let client: OpenRouter | null = null;

export function getOpenRouterClient(): OpenRouter {
  if (!client) {
    client = new OpenRouter({
      apiKey: requireServerKey("OPENROUTER_API_KEY", "OpenRouter"),
      httpReferer: env.NEXT_PUBLIC_APP_URL,
      appTitle: "RealSite",
    });
  }
  return client;
}

export function withGeminiFlashReasoning(request: ChatRequest): ChatRequest {
  const model = request.model ?? "";
  if (!model.includes("gemini-3.5-flash") && !model.includes("gemini-3-flash")) {
    return request;
  }
  return {
    ...request,
    reasoning: { ...GEMINI_FLASH_REASONING, ...request.reasoning },
  };
}

type NonStreamingChatRequest = Omit<ChatRequest, "stream"> & { stream?: false | undefined };

export async function sendChatCompletion(request: NonStreamingChatRequest): Promise<ChatResult> {
  return getOpenRouterClient().chat.send({
    chatRequest: withGeminiFlashReasoning({ ...request, stream: false }),
  }) as Promise<ChatResult>;
}

export async function streamChatCompletion(request: Omit<ChatRequest, "stream">) {
  return getOpenRouterClient().chat.send({
    chatRequest: withGeminiFlashReasoning({ ...request, stream: true }),
  });
}
