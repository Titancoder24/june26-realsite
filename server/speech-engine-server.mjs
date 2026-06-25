// Standalone ElevenLabs Speech Engine server.
//
// This is the single callback in the middle of the Speech Engine loop:
//   user speaks -> ElevenLabs STT -> our server (this file) -> Gemini ->
//   stream tokens back -> ElevenLabs TTS -> browser.
//
// Your agent stays yours: the brain here is Gemini 3.5 Flash. ElevenLabs only
// handles the audio (listening + speaking) and interruptions.
//
// IMPORTANT: This is a long-lived WebSocket server. It cannot run on Vercel
// serverless. Run it on a host that accepts inbound WebSocket connections
// (a VM, Render, Railway, Fly.io) or locally behind ngrok for development.
//
// Local dev:
//   1) node --env-file=.env.local server/speech-engine-server.mjs
//   2) ngrok http 3001
//   3) PUBLIC_WS_URL="wss://<ngrok-id>.ngrok-free.app/ws" \
//        node --env-file=.env.local scripts/register-speech-engine.mjs
//   4) Put the printed engineId into .env.local as ELEVENLABS_SPEECH_ENGINE_ID

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const engineId = process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim();
const geminiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_BRAIN_MODEL?.trim() || "gemini-3.5-flash";
const port = Number(process.env.SPEECH_ENGINE_PORT || 3001);
const wsPath = process.env.SPEECH_ENGINE_WS_PATH || "/ws";

if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is required.");
  process.exit(1);
}
if (!engineId) {
  console.error(
    "ELEVENLABS_SPEECH_ENGINE_ID is required. Run scripts/register-speech-engine.mjs first.",
  );
  process.exit(1);
}
if (!geminiKey) {
  console.error("GEMINI_API_KEY is required for the Gemini brain.");
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a warm, knowledgeable real-estate sales guide on a live voice call.
Speak naturally and concisely (1-3 short sentences), like a friendly human agent.
Answer questions about the property using what you know; if you are unsure of a
specific detail, say a team member can confirm and offer to help further.
Never read out raw data or say you have "no property knowledge".`;

const genai = new GoogleGenAI({ apiKey: geminiKey });
const elevenlabs = new ElevenLabsClient({ apiKey });

function toGeminiContents(transcript) {
  // transcript: [{ role: "user" | "agent", content }]
  return transcript
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role === "agent" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

async function startServer() {
  const engine = await elevenlabs.speechEngine.get(engineId);
  console.log(`Speech Engine ready: ${engine.engineId}`);

  const { SpeechEngine } = await import("@elevenlabs/elevenlabs-js");

  const server = new SpeechEngine.Server({
    port,
    apiKey,
    engineId,
    debug: process.env.SPEECH_ENGINE_DEBUG === "1",
    onInit(conversationId) {
      console.log("conversation started:", conversationId);
    },
    async onTranscript(transcript, signal, session) {
      try {
        const contents = toGeminiContents(transcript);
        if (!contents.length) return;

        // Stream Gemini tokens straight into ElevenLabs for synthesis.
        // The SDK auto-extracts text from Gemini stream chunks.
        const stream = await genai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.3,
            maxOutputTokens: 256,
            abortSignal: signal,
          },
        });

        await session.sendResponse(stream);
      } catch (err) {
        if (err?.name === "AbortError") return; // user interrupted — expected
        console.error("Gemini brain error:", err?.message ?? err);
        try {
          session.sendResponse(
            "Sorry, I had trouble with that. Could you say it again?",
          );
        } catch {
          // session may be closed
        }
      }
    },
    onClose() {
      console.log("conversation closed");
    },
    onDisconnect() {
      console.log("conversation disconnected");
    },
    onError(error) {
      console.error("speech engine error:", error?.message ?? error);
    },
  });

  server.start();
  console.log(`Listening for ElevenLabs on :${port}${wsPath} (Gemini: ${model})`);
}

startServer().catch((err) => {
  console.error("Failed to start Speech Engine server:", err?.message ?? err);
  process.exit(1);
});
