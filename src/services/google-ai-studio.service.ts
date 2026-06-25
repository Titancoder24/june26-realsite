import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { GEMINI_BRAIN_MODEL } from "@/lib/walkthrough-brain-provider";
import type { VertexChatMessage } from "./vertex-ai.service";

const MODEL_FALLBACKS = [GEMINI_BRAIN_MODEL, "gemini-2.5-flash", "gemini-3-flash-preview"];

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveApiKey(): string {
  const key = trimEnv(process.env.GEMINI_API_KEY) ?? env.server.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to .env.local from Google AI Studio, then restart `npm run dev`.",
    );
  }
  return key;
}

function resolveModel(): string {
  return trimEnv(process.env.GEMINI_BRAIN_MODEL) ?? env.server.GEMINI_BRAIN_MODEL ?? GEMINI_BRAIN_MODEL;
}

/** Models that returned a 404/NOT_FOUND this process — skip to avoid re-paying latency. */
const deadModels = new Set<string>();

function uniqueModels(primary: string, fallbacks: string[]): string[] {
  const all = [...new Set([primary, ...fallbacks].filter(Boolean))];
  const live = all.filter((m) => !deadModels.has(m));
  return live.length ? live : all;
}

function isModelNotFound(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes("not found") || msg.includes("404") || msg.includes("not supported");
}

function toGeminiContents(messages: VertexChatMessage[]) {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const conversation = messages.filter((m) => m.role !== "system");
  const contents = conversation.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));
  return { systemParts, contents };
}

export class GoogleAIStudioService {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: resolveApiKey() });
    }
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(trimEnv(process.env.GEMINI_API_KEY) ?? env.server.GEMINI_API_KEY);
  }

  async chat(
    messages: VertexChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxOutputTokens?: number;
      /** Disable Gemini "thinking" for low latency (default true). */
      disableThinking?: boolean;
    },
  ): Promise<string> {
    const ai = this.getClient();
    const models = uniqueModels(options?.model ?? resolveModel(), MODEL_FALLBACKS);
    const { systemParts, contents } = toGeminiContents(messages);
    const disableThinking = options?.disableThinking !== false;

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
            // Gemini 2.5/3 Flash run multi-second "thinking" by default, which
            // makes chat feel 10-20s slow. A zero budget keeps replies snappy.
            ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        });
        const text = response.text;
        if (!text?.trim()) throw new Error("Gemini returned empty chat response");
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isModelNotFound(err) && models.length > 1) deadModels.add(model);
      }
    }
    throw lastError ?? new Error("Google AI Studio chat failed");
  }

  /** Streaming variant — yields text chunks as Gemini produces them. */
  async *chatStream(
    messages: VertexChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxOutputTokens?: number;
      disableThinking?: boolean;
    },
  ): AsyncGenerator<string, void, unknown> {
    const ai = this.getClient();
    const model = uniqueModels(options?.model ?? resolveModel(), MODEL_FALLBACKS)[0];
    const { systemParts, contents } = toGeminiContents(messages);
    const disableThinking = options?.disableThinking !== false;

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: systemParts || undefined,
        maxOutputTokens: options?.maxOutputTokens ?? 1024,
        temperature: options?.temperature ?? 0.15,
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield text;
    }
  }
}

export const googleAIStudioService = new GoogleAIStudioService();
