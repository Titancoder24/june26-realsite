import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { elevenLabsService } from "@/services/elevenlabs.service";
import { salesTrainingService } from "@/services/sales-training.service";

export const runtime = "nodejs";

const schema = z.object({
  text: z.string().min(1).max(900),
});

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const audio = form.get("audio") as Blob | null;
      const sessionId = (form.get("sessionId") as string | null)?.trim();
      if (!audio) return jsonError("No audio provided", 400);
      if (!sessionId) return jsonError("sessionId is required", 400);
      if (!elevenLabsService.isConfigured()) return jsonError("ElevenLabs is not configured", 501);
      const transcript = await elevenLabsService.speechToText(audio, profile.organization_id ?? undefined);
      await salesTrainingService.logVoiceCall(profile, { sessionId, transcript, status: "completed" });
      return NextResponse.json({
        transcript,
        provider: "elevenlabs",
        sttModel: process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2",
      });
    }

    const { text } = schema.parse(await req.json());
    if (!elevenLabsService.isConfigured()) {
      return jsonError("ElevenLabs is not configured", 501);
    }
    const audio = await elevenLabsService.textToSpeech(text, {
      organizationId: profile.organization_id ?? undefined,
    });
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Voice-Provider": "elevenlabs",
      },
    });
  }, "sales_agent");
}
