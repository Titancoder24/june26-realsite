import {
  DEFAULT_GLOBAL_LANGUAGE,
  DEFAULT_VOICE_PROFILE,
  isGlobalVoiceLanguageCode,
  isWalkthroughVoiceProfile,
  resolveIndianChatLanguage,
  resolveIndianSpeechLanguage,
  type WalkthroughVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import {
  parseElevenLabsStudioVoiceConfig,
  resolveStudioVoiceId,
  type ElevenLabsStudioVoiceConfig,
} from "@/lib/elevenlabs-studio-voice";
import {
  isNavigationIntent,
  isResumeIntent,
  isWaitIntent,
  parseWaitDurationMs,
} from "@/lib/walkthrough-inference/fast-navigation";
import {
  DEFAULT_WALKTHROUGH_LANGUAGE,
  languageSupportsSarvamTts,
  type SarvamLanguageCode,
} from "@/lib/sarvam-languages";
import { elevenLabsService } from "./elevenlabs.service";
import { sarvamService } from "./sarvam.service";
import { walkthroughAgentService } from "./walkthrough-agent.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWalkthroughFirstMessage } from "@/lib/walkthrough-voice-greeting";
import type { WalkthroughBrainProvider } from "@/lib/walkthrough-brain-provider";

export type WalkthroughVoiceResult = {
  answer: string;
  displayAnswer: string;
  transcript?: string;
  confidenceScore: number;
  command: Awaited<ReturnType<typeof walkthroughAgentService.chat>>["command"];
  speechLanguageCode: string;
  chatLanguageCode: string;
  voiceProfile: WalkthroughVoiceProfile;
  voiceProvider: "sarvam" | "elevenlabs";
  fastPath?: boolean;
};

export type WalkthroughVoiceRequest = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  activeSceneId?: string;
  sessionId?: string;
  voiceProfile?: WalkthroughVoiceProfile;
  speechLanguageCode?: string;
  chatLanguageCode?: string;
  brainProvider?: WalkthroughBrainProvider;
};

function parseProfile(value?: string): WalkthroughVoiceProfile {
  if (value && isWalkthroughVoiceProfile(value)) return value;
  return DEFAULT_VOICE_PROFILE;
}

async function toEnglishQuery(
  text: string,
  speechLanguageCode: SarvamLanguageCode,
  organizationId?: string,
): Promise<string> {
  if (speechLanguageCode === "en-IN") return text.trim();
  if (!sarvamService.isConfigured()) return text.trim();
  return sarvamService.translate(text, speechLanguageCode, "en-IN", organizationId);
}

async function toChatLanguage(
  englishAnswer: string,
  chatLanguageCode: SarvamLanguageCode,
  organizationId?: string,
): Promise<string> {
  if (chatLanguageCode === "en-IN") return englishAnswer;
  if (!sarvamService.isConfigured()) return englishAnswer;
  return sarvamService.translate(englishAnswer, "en-IN", chatLanguageCode, organizationId);
}

async function synthesizeIndian(
  text: string,
  chatLanguageCode: SarvamLanguageCode,
  organizationId?: string,
): Promise<{ buffer: ArrayBuffer; provider: "sarvam" | "elevenlabs" }> {
  if (sarvamService.isConfigured() && languageSupportsSarvamTts(chatLanguageCode)) {
    const buffer = await sarvamService.textToSpeech(text, chatLanguageCode, organizationId);
    return { buffer, provider: "sarvam" };
  }
  const buffer = await elevenLabsService.textToSpeech(text, { organizationId });
  return { buffer, provider: "elevenlabs" };
}

async function loadStudioElevenLabsVoice(experienceId: string): Promise<ElevenLabsStudioVoiceConfig> {
  const admin = createAdminClient();
  const { data } = await admin.from("experiences").select("viewer_config").eq("id", experienceId).maybeSingle();
  return parseElevenLabsStudioVoiceConfig(
    (data?.viewer_config as Record<string, unknown> | null) ?? null,
  );
}

async function synthesizeGlobal(
  text: string,
  organizationId?: string,
  studioVoice?: ElevenLabsStudioVoiceConfig,
  languageCode?: string,
): Promise<{ buffer: ArrayBuffer; provider: "elevenlabs" }> {
  const voice = studioVoice;
  const voiceId = voice
    ? resolveStudioVoiceId(voice, languageCode ?? voice.language)
    : undefined;
  const buffer = await elevenLabsService.textToSpeech(text, {
    voiceId,
    modelId: voice?.tts_model,
    voiceSettings: voice
      ? {
          stability: voice.stability,
          similarityBoost: voice.similarity_boost,
          style: voice.style,
          speed: voice.speed,
          useSpeakerBoost: voice.use_speaker_boost,
        }
      : undefined,
    organizationId,
  });
  return { buffer, provider: "elevenlabs" };
}

async function buildFastIntentResult(
  params: WalkthroughVoiceRequest,
  voiceProfile: WalkthroughVoiceProfile,
  speechLanguageCode: string,
  chatLanguageCode: string,
  query: string,
  transcript?: string,
): Promise<(WalkthroughVoiceResult & { audioBuffer: ArrayBuffer; fastPath: true }) | null> {
  if (isWaitIntent(query)) {
    const durationMs = parseWaitDurationMs(query) ?? 120_000;
    const answer = "I'll pause the tour. Say resume when you're ready, or tell me which room to show.";
    const audio = await synthesizeForProfile(
      voiceProfile,
      chatLanguageCode,
      answer,
      params.organizationId,
      params.experienceId,
    );
    return {
      answer,
      displayAnswer: answer,
      transcript,
      confidenceScore: 1,
      command: { command: "PAUSE_AUTOPLAY", durationMs },
      speechLanguageCode,
      chatLanguageCode,
      voiceProfile,
      voiceProvider: audio.provider,
      audioBuffer: audio.buffer,
      fastPath: true,
    };
  }

  if (isResumeIntent(query)) {
    const answer = "Continuing your property tour.";
    const audio = await synthesizeForProfile(
      voiceProfile,
      chatLanguageCode,
      answer,
      params.organizationId,
      params.experienceId,
    );
    return {
      answer,
      displayAnswer: answer,
      transcript,
      confidenceScore: 1,
      command: { command: "RESUME_AUTOPLAY" },
      speechLanguageCode,
      chatLanguageCode,
      voiceProfile,
      voiceProvider: audio.provider,
      audioBuffer: audio.buffer,
      fastPath: true,
    };
  }

  if (isNavigationIntent(query)) {
    const nav = await walkthroughAgentService.resolveNavigation(query, params.experienceId);
    if (nav?.clarifyMessage) {
      const answer = nav.clarifyMessage;
      const audio = await synthesizeForProfile(
        voiceProfile,
        chatLanguageCode,
        answer,
        params.organizationId,
        params.experienceId,
      );
      return {
        answer,
        displayAnswer: answer,
        transcript,
        confidenceScore: nav.confidence ?? 0.4,
        command: { command: "NONE" },
        speechLanguageCode,
        chatLanguageCode,
        voiceProfile,
        voiceProvider: audio.provider,
        audioBuffer: audio.buffer,
        fastPath: true,
      };
    }
    if (nav?.sceneId) {
      const label = nav.label ?? "that space";
      const answer = `Taking you to ${label}.`;
      const audio = await synthesizeForProfile(
        voiceProfile,
        chatLanguageCode,
        answer,
        params.organizationId,
        params.experienceId,
      );
      return {
        answer,
        displayAnswer: answer,
        transcript,
        confidenceScore: nav.confidence ?? 1,
        command: { command: "JUMP_TO_SCENE", sceneId: nav.sceneId },
        speechLanguageCode,
        chatLanguageCode,
        voiceProfile,
        voiceProvider: audio.provider,
        audioBuffer: audio.buffer,
        fastPath: true,
      };
    }
  }

  return null;
}

async function synthesizeForProfile(
  voiceProfile: WalkthroughVoiceProfile,
  chatLanguageCode: string,
  text: string,
  organizationId?: string,
  experienceId?: string,
): Promise<{ buffer: ArrayBuffer; provider: "sarvam" | "elevenlabs" }> {
  if (voiceProfile === "global-voice") {
    const studioVoice = experienceId ? await loadStudioElevenLabsVoice(experienceId) : undefined;
    return synthesizeGlobal(text, organizationId, studioVoice, chatLanguageCode);
  }
  const chatLang = resolveIndianChatLanguage(chatLanguageCode);
  return synthesizeIndian(text, chatLang, organizationId);
}

export class WalkthroughVoiceService {
  async processTextQuery(
    params: WalkthroughVoiceRequest & { query: string },
  ): Promise<WalkthroughVoiceResult & { audioBuffer: ArrayBuffer }> {
    const voiceProfile = parseProfile(params.voiceProfile);
    const speechLanguageCode =
      params.speechLanguageCode ??
      (voiceProfile === "global-voice" ? DEFAULT_GLOBAL_LANGUAGE : DEFAULT_WALKTHROUGH_LANGUAGE);
    const chatLanguageCode =
      params.chatLanguageCode ?? speechLanguageCode;

    const fastText = await buildFastIntentResult(
      params,
      voiceProfile,
      speechLanguageCode,
      chatLanguageCode,
      params.query.trim(),
    );
    if (fastText) return fastText;

    if (voiceProfile === "global-voice") {
      const englishQuery = params.query.trim();
      const [result, studioVoice] = await Promise.all([
        walkthroughAgentService.chat({
          organizationId: params.organizationId,
          propertyId: params.propertyId,
          experienceId: params.experienceId,
          query: englishQuery,
          activeSceneId: params.activeSceneId,
          sessionId: params.sessionId,
          brainProvider: params.brainProvider,
          voiceMode: true,
        }),
        loadStudioElevenLabsVoice(params.experienceId),
      ]);
      const { buffer, provider } = await synthesizeGlobal(
        result.answer,
        params.organizationId,
        studioVoice,
        chatLanguageCode,
      );
      return {
        answer: result.answer,
        displayAnswer: result.answer,
        confidenceScore: result.confidenceScore,
        command: result.command,
        speechLanguageCode,
        chatLanguageCode,
        voiceProfile,
        voiceProvider: provider,
        audioBuffer: buffer,
      };
    }

    const speechLang = resolveIndianSpeechLanguage(speechLanguageCode);
    const chatLang = resolveIndianChatLanguage(chatLanguageCode);
    const englishQuery = await toEnglishQuery(params.query, speechLang, params.organizationId);

    const result = await walkthroughAgentService.chat({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      experienceId: params.experienceId,
      query: englishQuery,
      activeSceneId: params.activeSceneId,
      sessionId: params.sessionId,
      brainProvider: params.brainProvider,
      voiceMode: true,
    });

    const displayAnswer = chatLang === "en-IN"
      ? result.answer
      : await toChatLanguage(result.answer, chatLang, params.organizationId);
    const { buffer, provider } = await synthesizeIndian(
      displayAnswer,
      chatLang,
      params.organizationId,
    );

    return {
      answer: result.answer,
      displayAnswer,
      confidenceScore: result.confidenceScore,
      command: result.command,
      speechLanguageCode: speechLang,
      chatLanguageCode: chatLang,
      voiceProfile,
      voiceProvider: provider,
      audioBuffer: buffer,
    };
  }

  async processAudioQuery(
    params: WalkthroughVoiceRequest & { audio: Blob },
  ): Promise<WalkthroughVoiceResult & { audioBuffer: ArrayBuffer }> {
    const voiceProfile = parseProfile(params.voiceProfile);
    const speechLanguageCode =
      params.speechLanguageCode ??
      (voiceProfile === "global-voice" ? DEFAULT_GLOBAL_LANGUAGE : DEFAULT_WALKTHROUGH_LANGUAGE);
    const chatLanguageCode =
      params.chatLanguageCode ?? speechLanguageCode;

    if (voiceProfile === "global-voice") {
      const transcript = await elevenLabsService.speechToText(
        params.audio,
        params.organizationId,
      );
      if (!transcript?.trim()) throw new Error("Could not transcribe audio");

      const fast = await buildFastIntentResult(
        params,
        voiceProfile,
        speechLanguageCode,
        chatLanguageCode,
        transcript.trim(),
        transcript.trim(),
      );
      if (fast) return fast;

      const [result, studioVoice] = await Promise.all([
        walkthroughAgentService.chat({
          organizationId: params.organizationId,
          propertyId: params.propertyId,
          experienceId: params.experienceId,
          query: transcript.trim(),
          activeSceneId: params.activeSceneId,
          sessionId: params.sessionId,
          brainProvider: params.brainProvider,
          voiceMode: true,
        }),
        loadStudioElevenLabsVoice(params.experienceId),
      ]);

      const { buffer, provider } = await synthesizeGlobal(
        result.answer,
        params.organizationId,
        studioVoice,
        speechLanguageCode,
      );

      return {
        answer: result.answer,
        displayAnswer: result.answer,
        transcript: transcript.trim(),
        confidenceScore: result.confidenceScore,
        command: result.command,
        speechLanguageCode,
        chatLanguageCode,
        voiceProfile,
        voiceProvider: provider,
        audioBuffer: buffer,
      };
    }

    const speechLang = resolveIndianSpeechLanguage(speechLanguageCode);
    const chatLang = resolveIndianChatLanguage(chatLanguageCode);

    if (!sarvamService.isConfigured()) {
      throw new Error("Indian Languages AI requires SARVAM_API_KEY in environment");
    }

    const stt = await sarvamService.speechToText(params.audio, {
      languageCode: speechLang,
      mode: "transcribe",
      organizationId: params.organizationId,
    });
    const transcript = stt.transcript;

    const fastAudio = await buildFastIntentResult(
      params,
      voiceProfile,
      speechLang,
      chatLang,
      transcript,
      transcript,
    );
    if (fastAudio) return fastAudio;

    const englishQuery = await toEnglishQuery(transcript, speechLang, params.organizationId);

    const result = await walkthroughAgentService.chat({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      experienceId: params.experienceId,
      query: englishQuery,
      activeSceneId: params.activeSceneId,
      sessionId: params.sessionId,
      brainProvider: params.brainProvider,
      voiceMode: true,
    });

    const displayAnswer = chatLang === "en-IN"
      ? result.answer
      : await toChatLanguage(result.answer, chatLang, params.organizationId);
    const { buffer, provider } = await synthesizeIndian(
      displayAnswer,
      chatLang,
      params.organizationId,
    );

    return {
      answer: result.answer,
      displayAnswer,
      transcript,
      confidenceScore: result.confidenceScore,
      command: result.command,
      speechLanguageCode: speechLang,
      chatLanguageCode: chatLang,
      voiceProfile,
      voiceProvider: provider,
      audioBuffer: buffer,
    };
  }

  async speakOnly(params: {
    text: string;
    organizationId?: string;
    experienceId?: string;
    voiceProfile?: WalkthroughVoiceProfile;
    speechLanguageCode?: string;
    chatLanguageCode?: string;
  }): Promise<{ audioBuffer: ArrayBuffer; voiceProvider: "sarvam" | "elevenlabs" }> {
    const voiceProfile = parseProfile(params.voiceProfile);
    const chatLanguageCode =
      params.chatLanguageCode ??
      params.speechLanguageCode ??
      (voiceProfile === "global-voice" ? DEFAULT_GLOBAL_LANGUAGE : DEFAULT_WALKTHROUGH_LANGUAGE);

    if (voiceProfile === "global-voice") {
      const studioVoice = params.experienceId
        ? await loadStudioElevenLabsVoice(params.experienceId)
        : undefined;
      const { buffer, provider } = await synthesizeGlobal(params.text, params.organizationId, studioVoice);
      return { audioBuffer: buffer, voiceProvider: provider };
    }

    const chatLang = resolveIndianChatLanguage(chatLanguageCode);
    const { buffer, provider } = await synthesizeIndian(params.text, chatLang, params.organizationId);
    return { audioBuffer: buffer, voiceProvider: provider };
  }

  async generateGreeting(
    params: WalkthroughVoiceRequest & { propertyName?: string; projectName?: string },
  ): Promise<WalkthroughVoiceResult & { audioBuffer: ArrayBuffer }> {
    const voiceProfile = parseProfile(params.voiceProfile);
    const speechLanguageCode =
      params.speechLanguageCode ??
      (voiceProfile === "global-voice" ? DEFAULT_GLOBAL_LANGUAGE : DEFAULT_WALKTHROUGH_LANGUAGE);
    const chatLanguageCode = params.chatLanguageCode ?? speechLanguageCode;

    const propertyLabel = params.propertyName?.trim() || "this property";
    const projectLabel = params.projectName?.trim();
    const greetingText = buildWalkthroughFirstMessage(
      propertyLabel,
      projectLabel,
      speechLanguageCode,
    );

    if (voiceProfile === "global-voice") {
      const studioVoice = await loadStudioElevenLabsVoice(params.experienceId);
      const { buffer, provider } = await synthesizeGlobal(
        greetingText,
        params.organizationId,
        studioVoice,
        speechLanguageCode,
      );
      return {
        answer: greetingText,
        displayAnswer: greetingText,
        confidenceScore: 1,
        command: { command: "NONE" },
        speechLanguageCode,
        chatLanguageCode,
        voiceProfile,
        voiceProvider: provider,
        audioBuffer: buffer,
      };
    }

    const speechLang = resolveIndianSpeechLanguage(speechLanguageCode);
    const chatLang = resolveIndianChatLanguage(chatLanguageCode);
    const displayAnswer = greetingText;
    const { buffer, provider } = await synthesizeIndian(displayAnswer, speechLang, params.organizationId);

    return {
      answer: greetingText,
      displayAnswer,
      confidenceScore: 1,
      command: { command: "NONE" },
      speechLanguageCode: speechLang,
      chatLanguageCode: chatLang,
      voiceProfile,
      voiceProvider: provider,
      audioBuffer: buffer,
    };
  }
}

export const walkthroughVoiceService = new WalkthroughVoiceService();
