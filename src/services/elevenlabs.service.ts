import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { VoiceSettings } from "@elevenlabs/elevenlabs-js/api/types";
import { env, requireServerKey } from "@/lib/env";
import { logApiUsage } from "@/lib/api-usage-logger";

let client: ElevenLabsClient | undefined;

export function getElevenLabsClient(): ElevenLabsClient {
  return getClient();
}

function getClient(): ElevenLabsClient {
  if (!client) {
    client = new ElevenLabsClient({
      apiKey: requireServerKey("ELEVENLABS_API_KEY", "ElevenLabs"),
    });
  }
  return client;
}

async function readableStreamToArrayBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.length) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

export class ElevenLabsService {
  isConfigured(): boolean {
    return Boolean(env.server.ELEVENLABS_API_KEY?.trim());
  }

  private get defaultVoiceId() {
    return env.server.ELEVENLABS_VOICE_ID;
  }

  private get defaultTtsModel() {
    return env.server.ELEVENLABS_TTS_MODEL;
  }

  private get sttModel() {
    return env.server.ELEVENLABS_STT_MODEL;
  }

  async textToSpeech(
    text: string,
    options?: {
      voiceId?: string;
      modelId?: string;
      voiceSettings?: VoiceSettings;
      organizationId?: string;
    },
  ): Promise<ArrayBuffer> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("No text provided for speech synthesis");

    const id = options?.voiceId ?? this.defaultVoiceId;
    const model = options?.modelId ?? this.defaultTtsModel;

    try {
      const stream = await getClient().textToSpeech.convert(id, {
        text: trimmed,
        modelId: model,
        outputFormat: "mp3_44100_128",
        voiceSettings: options?.voiceSettings,
      });
      const buffer = await readableStreamToArrayBuffer(stream);
      await logApiUsage({
        provider: "elevenlabs",
        operation: "text_to_speech",
        model,
        organizationId: options?.organizationId,
        status: "success",
        metadata: { voice_id: id, chars: trimmed.length },
      });
      return buffer;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ElevenLabs TTS failed";
      await logApiUsage({
        provider: "elevenlabs",
        operation: "text_to_speech",
        model,
        organizationId: options?.organizationId,
        status: "failed",
        metadata: { error: msg },
      });
      throw new Error(msg);
    }
  }

  async createScribeRealtimeToken(organizationId?: string): Promise<string> {
    try {
      const response = await getClient().tokens.singleUse.create("realtime_scribe");
      const token = response.token?.trim();
      if (!token) throw new Error("Empty Scribe token");
      await logApiUsage({
        provider: "elevenlabs",
        operation: "scribe_realtime_token",
        model: "scribe_v2_realtime",
        organizationId,
        status: "success",
      });
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scribe token failed";
      await logApiUsage({
        provider: "elevenlabs",
        operation: "scribe_realtime_token",
        model: "scribe_v2_realtime",
        organizationId,
        status: "failed",
        metadata: { error: msg },
      });
      throw new Error(msg);
    }
  }

  async speechToText(audioBlob: Blob, organizationId?: string): Promise<string> {
    const model = this.sttModel;
    const buffer = Buffer.from(await audioBlob.arrayBuffer());

    try {
      const result = await getClient().speechToText.convert({
        modelId: model as "scribe_v2",
        file: new Blob([buffer], { type: audioBlob.type || "audio/webm" }),
      });

      const text =
        (result as { text?: string }).text
        ?? (result as { transcripts?: { text?: string }[] }).transcripts?.[0]?.text
        ?? "";

      await logApiUsage({
        provider: "elevenlabs",
        operation: "speech_to_text",
        model,
        organizationId,
        status: "success",
      });
      return text.trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ElevenLabs STT failed";
      await logApiUsage({
        provider: "elevenlabs",
        operation: "speech_to_text",
        model,
        organizationId,
        status: "failed",
        metadata: { error: msg },
      });
      throw new Error(msg);
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
