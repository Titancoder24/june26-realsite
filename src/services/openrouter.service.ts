import { GEMINI_35_FLASH_MODEL, sendChatCompletion, streamChatCompletion } from "@/lib/openrouter";
import type { ChatResult } from "@openrouter/sdk/models";
import type { RAGContext } from "@/types/domain";
import {
  buildGroundedMessages,
  computeConfidence,
  isSensitiveQuery,
  shouldFallback,
} from "@/lib/grounded-ai";

/** Legacy OpenRouter chat — walkthrough buyer chat uses Vertex AI via vertexAIService. */
export class OpenRouterService {
  private get model() {
    return process.env.OPENROUTER_PRIMARY_MODEL ?? GEMINI_35_FLASH_MODEL;
  }

  async chat(params: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    stream?: false;
  }): Promise<ChatResult>;
  async chat(params: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    stream: true;
  }): ReturnType<typeof streamChatCompletion>;
  async chat(params: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    stream?: boolean;
  }) {
    if (params.stream) {
      return streamChatCompletion({
        model: this.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.15,
      });
    }

    return sendChatCompletion({
      model: this.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.15,
    });
  }

  buildGroundedMessages(query: string, contexts: RAGContext[], sceneContext?: string) {
    return buildGroundedMessages(query, contexts, sceneContext);
  }

  isSensitiveQuery(query: string): boolean {
    return isSensitiveQuery(query);
  }

  computeConfidence(contexts: RAGContext[], query: string): number {
    return computeConfidence(contexts, query);
  }

  shouldFallback(contexts: RAGContext[], query: string): boolean {
    return shouldFallback(contexts, query);
  }
}

export const openRouterService = new OpenRouterService();
