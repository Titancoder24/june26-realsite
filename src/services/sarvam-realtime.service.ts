import { randomUUID } from "crypto";
import { SarvamAIClient } from "sarvamai";
import { env, requireServerKey } from "@/lib/env";
import type { SarvamLanguageCode } from "@/lib/sarvam-languages";
import { resolveIndianChatLanguage } from "@/lib/walkthrough-voice-providers";
import { sarvamService } from "./sarvam.service";

const SESSION_TTL_MS = 10 * 60 * 1000;

type RealtimeSession = {
  id: string;
  languageCode: SarvamLanguageCode;
  sttSocket: Awaited<
    ReturnType<SarvamAIClient["speechToTextTranslateStreaming"]["connect"]>
  >;
  lastTranscript: string;
  utteranceReady: boolean;
  readyTranscript: string | null;
  createdAt: number;
  events: RealtimeEvent[];
};

export type RealtimeEvent = {
  type: "partial" | "speech_start" | "speech_end" | "error";
  transcript?: string;
  message?: string;
  at: number;
};

function apiKey(): string {
  return requireServerKey("SARVAM_API_KEY", "Sarvam");
}

function createClient(): SarvamAIClient {
  return new SarvamAIClient({ apiSubscriptionKey: apiKey() });
}

function isTranscriptData(
  data: unknown,
): data is { transcript: string; language_code?: string } {
  return Boolean(data && typeof data === "object" && "transcript" in data);
}

function isEventData(data: unknown): data is { signal_type?: string; event_type?: string } {
  return Boolean(data && typeof data === "object");
}

export class SarvamRealtimeService {
  private sessions = new Map<string, RealtimeSession>();

  isConfigured(): boolean {
    return Boolean(env.server.SARVAM_API_KEY?.trim());
  }

  async createSession(languageCode: SarvamLanguageCode): Promise<{ sessionId: string }> {
    const client = createClient();
    const socket = await client.speechToTextTranslateStreaming.connect({
      sample_rate: "16000",
      high_vad_sensitivity: "true",
      vad_signals: "true",
      flush_signal: "true",
      "Api-Subscription-Key": apiKey(),
    });

    const sessionId = randomUUID();
    const session: RealtimeSession = {
      id: sessionId,
      languageCode,
      sttSocket: socket,
      lastTranscript: "",
      utteranceReady: false,
      readyTranscript: null,
      createdAt: Date.now(),
      events: [],
    };

    socket.on("message", (message) => {
      if (message.type === "data" && isTranscriptData(message.data)) {
        const transcript = message.data.transcript?.trim() ?? "";
        if (transcript) {
          session.lastTranscript = transcript;
          session.events.push({ type: "partial", transcript, at: Date.now() });
        }
      }
      if (message.type === "events" && isEventData(message.data)) {
        const signal = message.data.signal_type ?? message.data.event_type;
        if (signal === "START_SPEECH") {
          session.events.push({ type: "speech_start", at: Date.now() });
        }
        if (signal === "END_SPEECH") {
          const transcript = session.lastTranscript.trim();
          if (transcript) {
            session.utteranceReady = true;
            session.readyTranscript = transcript;
            session.events.push({ type: "speech_end", transcript, at: Date.now() });
          }
          session.lastTranscript = "";
        }
      }
      if (message.type === "error") {
        session.events.push({
          type: "error",
          message: JSON.stringify(message.data),
          at: Date.now(),
        });
      }
    });

    socket.on("error", (error) => {
      session.events.push({ type: "error", message: error.message, at: Date.now() });
    });

    socket.connect();
    await socket.waitForOpen();

    this.sessions.set(sessionId, session);
    this.pruneStaleSessions();
    return { sessionId };
  }

  pushAudio(
    sessionId: string,
    pcmBase64: string,
  ): {
    events: RealtimeEvent[];
    utteranceReady: boolean;
    transcript?: string;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Realtime session not found");

    session.sttSocket.translate({
      audio: pcmBase64,
      sample_rate: 16000,
      encoding: "pcm_s16le",
    });

    const events = [...session.events];
    session.events = [];

    const utteranceReady = session.utteranceReady;
    const transcript = session.readyTranscript ?? undefined;
    if (utteranceReady) {
      session.utteranceReady = false;
      session.readyTranscript = null;
    }

    return { events, utteranceReady, transcript };
  }

  consumeUtterance(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session?.readyTranscript) return null;
    const transcript = session.readyTranscript;
    session.readyTranscript = null;
    session.utteranceReady = false;
    return transcript;
  }

  async streamSpeech(
    text: string,
    languageCode: SarvamLanguageCode,
    organizationId?: string,
  ): Promise<ArrayBuffer> {
    const chatLang = resolveIndianChatLanguage(languageCode);
    return sarvamService.textToSpeech(text, chatLang, organizationId);
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    try {
      session.sttSocket.close();
    } catch {
      // ignore
    }
    this.sessions.delete(sessionId);
  }

  private pruneStaleSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.closeSession(id);
      }
    }
  }
}

export const sarvamRealtimeService = new SarvamRealtimeService();
