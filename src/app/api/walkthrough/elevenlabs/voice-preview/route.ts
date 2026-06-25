import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { previewPhraseForLanguage } from "@/lib/elevenlabs-languages";
import {
  parseElevenLabsStudioVoiceConfig,
  type ElevenLabsStudioVoiceConfig,
} from "@/lib/elevenlabs-studio-voice";
import { elevenLabsVoicesService } from "@/services/elevenlabs-voices.service";

const schema = z.object({
  text: z.string().min(1).max(500).optional(),
  organizationId: z.string().optional(),
  voiceId: z.string().optional(),
  languageCode: z.string().optional(),
  voice: z
    .object({
      voice_id: z.string().optional(),
      language: z.string().optional(),
      convai_model: z.string().optional(),
      tts_model: z.string().optional(),
      stability: z.number().optional(),
      similarity_boost: z.number().optional(),
      style: z.number().optional(),
      speed: z.number().optional(),
      use_speaker_boost: z.boolean().optional(),
    })
    .optional(),
});

/** Generate a studio voice preview clip with selected voice + tone settings. */
export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!elevenLabsVoicesService.isConfigured()) {
      return jsonError("ELEVENLABS_API_KEY is not configured", 503);
    }

    try {
      const body = schema.parse(await req.json());
      const defaults = parseElevenLabsStudioVoiceConfig(
        body.voice ? { elevenlabs_voice: body.voice } : null,
      );
      const config: ElevenLabsStudioVoiceConfig = {
        ...defaults,
        ...body.voice,
        language: defaults.language,
        voice_id: body.voiceId ?? body.voice?.voice_id ?? defaults.voice_id,
      };

      const text =
        body.text?.trim()
        ?? (body.languageCode ? previewPhraseForLanguage(body.languageCode) : previewPhraseForLanguage(config.language));

      const organizationId = body.organizationId ?? profile.organization_id ?? undefined;
      const buffer = await elevenLabsVoicesService.previewVoice({
        text,
        config,
        organizationId,
        voiceId: config.voice_id,
        languageCode: body.languageCode,
      });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Voice-Id": config.voice_id,
          "X-TTS-Model": config.tts_model,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice preview failed";
      return jsonError(message, 500);
    }
  });
}
