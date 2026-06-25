// Register (or update) an ElevenLabs Speech Engine instance.
//
// The Speech Engine is the voice layer that sits in front of YOUR agent
// (here: Gemini 3.5 Flash). ElevenLabs handles STT + TTS and calls back into
// our WebSocket server, which streams Gemini responses for synthesis.
//
// Speech Engine needs a PUBLIC WebSocket URL it can reach — localhost will not
// work. For local dev use ngrok; in production use your real host.
//
// Usage (Node 20+, loads .env.local automatically):
//   PUBLIC_WS_URL="wss://<your-ngrok-id>.ngrok-free.app/ws" \
//     node --env-file=.env.local scripts/register-speech-engine.mjs
//
// Save the printed engineId into .env.local as ELEVENLABS_SPEECH_ENGINE_ID.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const wsUrl = process.env.PUBLIC_WS_URL?.trim();
const existingId = process.env.ELEVENLABS_SPEECH_ENGINE_ID?.trim();
const firstMessage = process.env.SPEECH_ENGINE_FIRST_MESSAGE?.trim()
  || "Hi! I'm your property guide. Ask me anything about this home.";

if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is required. Add it to .env.local.");
  process.exit(1);
}
if (!wsUrl) {
  console.error(
    "PUBLIC_WS_URL is required, e.g. wss://<id>.ngrok-free.app/ws (must end in your WS path).",
  );
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey });

const request = {
  name: "Realsite Property Voice (Gemini)",
  speechEngine: { wsUrl },
  tags: ["realsite", "property-tour", "gemini-brain"],
  // Allow the browser to set a first message when starting the session.
  overrides: {
    conversationConfigOverride: {
      agent: { firstMessage: true },
    },
  },
};

try {
  let engine;
  if (existingId) {
    engine = await client.speechEngine.update(existingId, request);
    console.log("Updated existing Speech Engine.");
  } else {
    engine = await client.speechEngine.create(request);
    console.log("Created new Speech Engine.");
  }

  console.log("\nengineId:", engine.engineId);
  console.log("wsUrl:", wsUrl);
  console.log("firstMessage:", firstMessage);
  console.log(
    "\nNext: add this to .env.local ->\n  ELEVENLABS_SPEECH_ENGINE_ID=" + engine.engineId,
  );
} catch (err) {
  console.error("Failed to register Speech Engine:", err?.message ?? err);
  process.exit(1);
}
