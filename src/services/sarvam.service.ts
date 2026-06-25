import { env, requireServerKey } from "@/lib/env";
import { logApiUsage } from "@/lib/api-usage-logger";
import type { SarvamLanguageCode } from "@/lib/sarvam-languages";

const DEFAULT_BASE = "https://api.sarvam.ai";

type SttMode = "transcribe" | "translate" | "verbatim" | "translit" | "codemix";

function getApiKey(): string {
  return requireServerKey("SARVAM_API_KEY", "Sarvam");
}

function getBaseUrl(): string {
  return env.server.SARVAM_API_BASE_URL ?? DEFAULT_BASE;
}

async function sarvamJson<T>(
  path: string,
  body: Record<string, unknown>,
  operation: string,
  organizationId?: string,
): Promise<T> {
  const model = typeof body.model === "string" ? body.model : undefined;
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "api-subscription-key": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `Sarvam ${operation} failed (${res.status})`);
    }
    const payload = JSON.parse(text) as T;
    await logApiUsage({
      provider: "sarvam",
      operation,
      model,
      organizationId,
      status: "success",
    });
    return payload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : `Sarvam ${operation} failed`;
    await logApiUsage({
      provider: "sarvam",
      operation,
      model,
      organizationId,
      status: "failed",
      metadata: { error: msg },
    });
    throw new Error(msg);
  }
}

export class SarvamService {
  isConfigured(): boolean {
    return Boolean(env.server.SARVAM_API_KEY?.trim());
  }

  async speechToText(
    audio: Blob,
    options?: {
      languageCode?: SarvamLanguageCode | "unknown";
      mode?: SttMode;
      organizationId?: string;
    },
  ): Promise<{ transcript: string; languageCode?: string }> {
    const languageCode = options?.languageCode ?? "unknown";
    const mode = options?.mode ?? "transcribe";
    const form = new FormData();
    form.append("file", audio, "audio.webm");
    form.append("model", "saaras:v3");
    form.append("language_code", languageCode);
    form.append("mode", mode);
    form.append("with_timestamps", "false");

    try {
      const res = await fetch(`${getBaseUrl()}/speech-to-text`, {
        method: "POST",
        headers: { "api-subscription-key": getApiKey() },
        body: form,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Sarvam STT failed (${res.status})`);
      const payload = JSON.parse(text) as { transcript?: string; language_code?: string };
      const transcript = payload.transcript?.trim() ?? "";
      if (!transcript) throw new Error("Sarvam returned an empty transcript");
      await logApiUsage({
        provider: "sarvam",
        operation: "speech_to_text",
        model: "saaras:v3",
        organizationId: options?.organizationId,
        status: "success",
        metadata: { language_code: languageCode, mode },
      });
      return { transcript, languageCode: payload.language_code };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sarvam STT failed";
      await logApiUsage({
        provider: "sarvam",
        operation: "speech_to_text",
        model: "saaras:v3",
        organizationId: options?.organizationId,
        status: "failed",
        metadata: { error: msg },
      });
      throw new Error(msg);
    }
  }

  async translate(
    input: string,
    sourceLanguageCode: SarvamLanguageCode | "auto",
    targetLanguageCode: SarvamLanguageCode,
    organizationId?: string,
  ): Promise<string> {
    if (sourceLanguageCode === targetLanguageCode) return input.trim();
    const payload = await sarvamJson<{ translated_text?: string; translation?: string }>(
      "/translate",
      {
        input: input.trim(),
        source_language_code: sourceLanguageCode,
        target_language_code: targetLanguageCode,
        model: "sarvam-translate:v1",
      },
      "translate",
      organizationId,
    );
    const out = payload.translated_text ?? payload.translation ?? "";
    if (!out.trim()) throw new Error("Sarvam translate returned empty text");
    return out.trim();
  }

  async textToSpeech(
    text: string,
    targetLanguageCode: SarvamLanguageCode,
    organizationId?: string,
    speaker = "priya",
  ): Promise<ArrayBuffer> {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("No text provided for Sarvam TTS");

    const payload = await sarvamJson<{ audios?: string[] }>(
      "/text-to-speech",
      {
        inputs: [trimmed],
        target_language_code: targetLanguageCode,
        speaker,
        model: "bulbul:v3",
        speech_sample_rate: 24000,
        enable_preprocessing: true,
      },
      "text_to_speech",
      organizationId,
    );

    const b64 = payload.audios?.[0];
    if (!b64) throw new Error("Sarvam TTS returned no audio");
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
}

export const sarvamService = new SarvamService();
