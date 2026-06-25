import { NextResponse } from "next/server";
import { aiService } from "@/services/ai.service";
import { elevenLabsService } from "@/services/elevenlabs.service";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as Blob | null;
    const organizationId = formData.get("organizationId") as string;
    const propertyId = formData.get("propertyId") as string;
    const sessionId = formData.get("sessionId") as string | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const transcript = await elevenLabsService.speechToText(audio);
    const response = await aiService.answer({
      organizationId,
      propertyId,
      query: transcript,
      sessionId: sessionId ?? undefined,
    });

    const audioBuffer = await elevenLabsService.textToSpeech(response.answer);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-AI-Answer": encodeURIComponent(response.answer),
        "X-AI-Confidence": String(response.confidenceScore),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice pipeline failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
