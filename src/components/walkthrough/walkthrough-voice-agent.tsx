"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { Input } from "@/components/ui/input";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Waveform } from "@/components/ui/waveform";
import { Message, MessageContent } from "@/components/ui/message";
import { Orb } from "@/components/ui/orb";
import { Response } from "@/components/ui/response";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { useContinuousVoiceCapture } from "@/hooks/use-continuous-voice-capture";
import { useElevenLabsConvaiVoice } from "@/hooks/use-elevenlabs-convai-voice";
import { useSamvaadVoice } from "@/hooks/use-samvaad-voice";
import { useSarvamRealtimeVoice } from "@/hooks/use-sarvam-realtime-voice";
import { useWalkthroughRealtimeStt } from "@/hooks/use-walkthrough-realtime-stt";
import { useVoiceAgentOrb } from "@/hooks/use-voice-agent-orb";
import { buildWalkthroughFirstMessage } from "@/lib/walkthrough-voice-greeting";
import {
  buildNavigationAck,
  compactNormalize,
  isResumeIntent,
  isWaitIntent,
  logNavigationVoiceFlow,
  logVoiceNavigationDev,
  parseWaitDurationMs,
  resolveSceneNavigation,
  runNavigationVoiceFlow,
  type SceneMatchResult,
  type WalkthroughNavScene,
} from "@/lib/walkthrough-inference/fast-navigation";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { readJsonResponse } from "@/lib/http-json";
import {
  buyerVoicePreferences,
  type WalkthroughVoicePreferences,
  type WalkthroughVoiceProfile,
} from "@/lib/walkthrough-voice-providers";
import { isSamvaadConfigured } from "@/lib/sarvam-samvaad";
import { isElevenLabsConvaiConfigured } from "@/lib/elevenlabs-convai";
import { Loader2, Mic, MicOff, Send } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

type VoiceMicState =
  | "idle"
  | "requesting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "paused";

function micStateLabel(state: VoiceMicState): string {
  switch (state) {
    case "requesting":
      return "Requesting microphone…";
    case "listening":
      return "Listening…";
    case "thinking":
      return "Processing…";
    case "speaking":
      return "Speaking…";
    case "error":
      return "Voice error";
    case "paused":
      return "Mic paused";
    default:
      return "Voice guide ready";
  }
}

function decodeHeader(res: Response, key: string): string {
  const raw = res.headers.get(key);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function voiceRequestBody(prefs: WalkthroughVoicePreferences, extra: Record<string, unknown>) {
  return {
    ...extra,
    voiceProfile: prefs.voiceProfile,
    speechLanguageCode: prefs.speechLanguageCode,
    chatLanguageCode: prefs.chatLanguageCode,
  };
}

export function WalkthroughVoiceAgent({
  organizationId,
  propertyId,
  experienceId,
  sessionId,
  propertyName,
  projectName,
  voiceProfile,
  viewerConfig,
  scenes,
  activeSceneId,
  onCommand,
  onTrack,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  projectName?: string;
  voiceProfile: WalkthroughVoiceProfile;
  viewerConfig?: Record<string, unknown> | null;
  scenes: WalkthroughNavScene[];
  activeSceneId?: string;
  onCommand: (cmd: WalkthroughAICommand) => void;
  onTrack?: (eventType: string, payload?: Record<string, unknown>) => void;
}) {
  const [prefs, setPrefs] = useState<WalkthroughVoicePreferences>(() =>
    buyerVoicePreferences(voiceProfile, experienceId, viewerConfig),
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    setPrefs(buyerVoicePreferences(voiceProfile, experienceId, viewerConfig));
  }, [voiceProfile, experienceId, viewerConfig]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(() => Array(24).fill(0.08));

  const agentSpeakingRef = useRef(false);
  const greetStartedRef = useRef(false);
  const convaiGreetingPlayedRef = useRef(false);
  const convaiDuplexRef = useRef(false);
  const pendingUtteranceRef = useRef<string | null>(null);
  const suppressConvaiAgentUntilRef = useRef(0);
  const lastVoiceErrorRef = useRef({ message: "", at: 0 });
  const activeSceneRef = useRef(activeSceneId);
  const scenesRef = useRef(scenes);
  activeSceneRef.current = activeSceneId;
  scenesRef.current = scenes;

  const {
    agentState,
    inputVolumeRef,
    outputVolumeRef,
    playAudioBlob,
    setThinking,
    reset,
  } = useVoiceAgentOrb();

  const orbColors: [string, string] =
    voiceProfile === "indian-languages" ? ["#f97316", "#fdba74"] : ["#6366f1", "#a5b4fc"];

  const dispatchNavigation = useCallback(
    (sceneId: string, meta?: { transcript?: string; source?: string }) => {
      const scene = scenesRef.current.find((s) => s.id === sceneId);
      setStatusHint(`Navigating to ${scene?.title ?? "room"}…`);
      logVoiceNavigationDev({
        transcript: meta?.transcript ?? "",
        intent: "navigate",
        targetRoom: scene?.room_type ?? scene?.title,
        sceneId,
        sceneTitle: scene?.title,
        success: true,
        action: "navigation_dispatched",
      });
      onCommand({ command: "JUMP_TO_SCENE", sceneId });
      onTrack?.("ai_navigation_command", { command: "JUMP_TO_SCENE" });
    },
    [onCommand, onTrack],
  );

  const applyCommand = useCallback(
    (commandRaw: WalkthroughAICommand | string | undefined, meta?: { transcript?: string; source?: string }) => {
      if (!commandRaw || typeof commandRaw === "string") return;
      if (commandRaw.command && commandRaw.command !== "NONE") {
        if (commandRaw.command === "JUMP_TO_SCENE") {
          dispatchNavigation(commandRaw.sceneId, meta);
          return;
        }
        onCommand(commandRaw);
        onTrack?.("ai_navigation_command", { command: commandRaw.command });
      }
    },
    [dispatchNavigation, onCommand, onTrack],
  );

  const speakLocalTts = useCallback(
    async (text: string) => {
      agentSpeakingRef.current = true;
      setThinking();
      try {
        const res = await fetch("/api/walkthrough/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            voiceRequestBody(prefsRef.current, {
              organizationId,
              propertyId,
              experienceId,
              speakOnly: true,
              text,
            }),
          ),
        });
        if (!res.ok) return { started: false, completed: false };
        const blob = await res.blob();
        return await playAudioBlob(blob, {
          onStarted: () => logNavigationVoiceFlow("tts_started", { responseText: text }),
          onCompleted: () => logNavigationVoiceFlow("tts_completed", { responseText: text }),
        });
      } catch {
        reset();
        return { started: false, completed: false };
      } finally {
        agentSpeakingRef.current = false;
        reset();
      }
    },
    [organizationId, propertyId, experienceId, playAudioBlob, reset, setThinking],
  );

  const speakOnly = useCallback(
    async (text: string) => {
      await speakLocalTts(text);
    },
    [speakLocalTts],
  );

  const runLocalNavigation = useCallback(
    (transcript: string, match: SceneMatchResult, source: string) => {
      const ack = buildNavigationAck(match.label);
      suppressConvaiAgentUntilRef.current = Date.now() + 10_000;

      logVoiceNavigationDev({
        transcript,
        intent: "navigate",
        normalizedInput: compactNormalize(transcript),
        targetRoom: match.targetRoom,
        match,
        confidence: match.confidence,
        sceneId: match.sceneId,
        sceneTitle: match.label,
        responseText: ack,
        success: true,
        action: source,
      });
      logNavigationVoiceFlow("scene_matched", {
        rawInput: transcript,
        normalizedInput: compactNormalize(transcript),
        sceneId: match.sceneId,
        sceneTitle: match.label,
        confidence: match.confidence,
      });

      void runNavigationVoiceFlow({
        responseText: ack,
        speak: () => speakLocalTts(ack),
        navigate: () => dispatchNavigation(match.sceneId, { transcript, source }),
      });
    },
    [dispatchNavigation, speakLocalTts],
  );

  const reportVoiceError = useCallback(
    (message: string, eventType: string) => {
      const trimmed = message.trim();
      if (!trimmed || trimmed.includes("not-allowed")) return;

      const now = Date.now();
      if (
        lastVoiceErrorRef.current.message === trimmed
        && now - lastVoiceErrorRef.current.at < 12_000
      ) {
        return;
      }
      lastVoiceErrorRef.current = { message: trimmed, at: now };

      setVoiceError(trimmed);
      setMessages((m) => [...m, { role: "assistant", content: trimmed }]);
      onTrack?.(eventType, { message: trimmed });
    },
    [onTrack],
  );

  const playVoiceResponse = useCallback(
    async (res: Response, appendAssistant = true) => {
      if (!res.ok) {
        const data = await readJsonResponse<{ error?: string }>(res).catch(
          (): { error?: string } => ({}),
        );
        throw new Error(data.error ?? "Voice request failed");
      }
      const answer = decodeHeader(res, "X-AI-Answer");
      const commandRaw = decodeHeader(res, "X-AI-Command");
      const transcript = decodeHeader(res, "X-AI-Transcript");
      const fastPath = res.headers.get("X-AI-Fast-Path") === "1";

      if (transcript) {
        setMessages((m) => [...m, { role: "user", content: transcript }]);
      }

      if (answer && appendAssistant) {
        setMessages((m) => [...m, { role: "assistant", content: answer }]);
      }

      if (commandRaw) {
        try {
          const parsed = JSON.parse(commandRaw) as WalkthroughAICommand;
          if (parsed.command === "JUMP_TO_SCENE" && parsed.sceneId) {
            suppressConvaiAgentUntilRef.current = Date.now() + 10_000;
            const responseText = answer?.trim() || buildNavigationAck(
              scenesRef.current.find((s) => s.id === parsed.sceneId)?.title ?? "that space",
            );
            logNavigationVoiceFlow("scene_matched", {
              sceneId: parsed.sceneId,
              responseText,
              source: "server_fast_path",
            });
            agentSpeakingRef.current = true;
            const blob = await res.blob();
            await runNavigationVoiceFlow({
              responseText,
              speak: () => playAudioBlob(blob, {
                onStarted: () => logNavigationVoiceFlow("tts_started", { responseText }),
                onCompleted: () => logNavigationVoiceFlow("tts_completed", { responseText }),
              }),
              navigate: () => dispatchNavigation(parsed.sceneId, { source: "server_fast_path" }),
            });
            agentSpeakingRef.current = false;
            reset();
            if (fastPath) onTrack?.("ai_fast_path", {});
            return answer;
          }
          applyCommand(parsed);
        } catch {
          // ignore
        }
      }

      if (fastPath) onTrack?.("ai_fast_path", {});

      if (convaiDuplexRef.current) {
        return answer;
      }

      agentSpeakingRef.current = true;
      const blob = await res.blob();
      await playAudioBlob(blob);
      agentSpeakingRef.current = false;

      return answer;
    },
    [applyCommand, dispatchNavigation, onTrack, playAudioBlob, reset],
  );

  const sendUserTextRef = useRef<(text: string) => boolean>(() => false);
  const lastUtteranceRef = useRef({ text: "", at: 0 });

  const tryLocalFastPath = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      if (isWaitIntent(trimmed)) {
        const durationMs = parseWaitDurationMs(trimmed) ?? 120_000;
        const ack = "I'll pause the tour. Say resume when you're ready, or tell me which room to show.";
        setMessages((m) => [...m, { role: "user", content: trimmed }, { role: "assistant", content: ack }]);
        applyCommand({ command: "PAUSE_AUTOPLAY", durationMs }, { transcript: trimmed, source: "local_fast_path" });
        if (!convaiDuplexRef.current) void speakOnly(ack);
        onTrack?.("ai_local_fast_path", { intent: "pause" });
        return true;
      }

      if (isResumeIntent(trimmed)) {
        const ack = "Continuing your property tour.";
        setMessages((m) => [...m, { role: "user", content: trimmed }, { role: "assistant", content: ack }]);
        applyCommand({ command: "RESUME_AUTOPLAY" }, { transcript: trimmed, source: "local_fast_path" });
        if (!convaiDuplexRef.current) void speakOnly(ack);
        onTrack?.("ai_local_fast_path", { intent: "resume" });
        return true;
      }

      const navResult = resolveSceneNavigation(trimmed, scenesRef.current);
      if (navResult.action === "navigate") {
        setMessages((m) => [...m, { role: "user", content: trimmed }, { role: "assistant", content: buildNavigationAck(navResult.match.label) }]);
        runLocalNavigation(trimmed, navResult.match, "local_fast_path");
        onTrack?.("ai_local_fast_path", {
          intent: "navigate",
          sceneId: navResult.match.sceneId,
          confidence: navResult.match.confidence,
        });
        return true;
      }

      if (navResult.action === "clarify") {
        setMessages((m) => [...m, { role: "user", content: trimmed }, { role: "assistant", content: navResult.message }]);
        if (!convaiDuplexRef.current) void speakOnly(navResult.message);
        logVoiceNavigationDev({
          transcript: trimmed,
          intent: "navigate",
          targetRoom: navResult.candidates[0]?.targetRoom,
          match: navResult.candidates[0] ?? null,
          confidence: navResult.candidates[0]?.confidence,
          success: false,
          action: "clarify",
        });
        return true;
      }

      return false;
    },
    [applyCommand, onTrack, runLocalNavigation, speakOnly],
  );

  const processServerAudio = useCallback(
    async (blob: Blob) => {
      setProcessing(true);
      setThinking();
      try {
        const form = new FormData();
        form.append("audio", blob, "question.webm");
        form.append("organizationId", organizationId);
        form.append("propertyId", propertyId);
        form.append("experienceId", experienceId);
        if (sessionId) form.append("sessionId", sessionId);
        if (activeSceneRef.current) form.append("activeSceneId", activeSceneRef.current);
        form.append("voiceProfile", prefsRef.current.voiceProfile);
        form.append("speechLanguageCode", prefsRef.current.speechLanguageCode);
        form.append("chatLanguageCode", prefsRef.current.chatLanguageCode);
        const res = await fetch("/api/walkthrough/voice", { method: "POST", body: form });
        await playVoiceResponse(res);
        onTrack?.("ai_voice_response", {});
      } catch (e) {
        reset();
        const msg = e instanceof Error ? e.message : "Voice input failed";
        setMessages((m) => [...m, { role: "assistant", content: msg }]);
      } finally {
        setProcessing(false);
        reset();
      }
    },
    [
      organizationId,
      propertyId,
      experienceId,
      sessionId,
      playVoiceResponse,
      reset,
      setThinking,
      onTrack,
    ],
  );

  const handleUserText = useCallback(
    async (text: string) => {
      if (!text.trim() || processing) return;
      const trimmed = text.trim();
      setExpanded(true);

      if (tryLocalFastPath(trimmed)) return;

      if (
        voiceProfile === "global-voice"
        && isElevenLabsConvaiConfigured(viewerConfig)
        && sendUserTextRef.current(trimmed)
      ) {
        setMessages((m) => [...m, { role: "user", content: trimmed }]);
        setInput("");
        setElevenLabsOrbState("thinking");
        onTrack?.("ai_elevenlabs_user_transcript", { source: "text" });
        return;
      }

      if (
        voiceProfile === "global-voice"
        && isElevenLabsConvaiConfigured(viewerConfig)
      ) {
        pendingUtteranceRef.current = trimmed;
        setMessages((m) => [...m, { role: "user", content: trimmed }]);
        setInput("");
        return;
      }

      setMessages((m) => [...m, { role: "user", content: trimmed }]);
      setInput("");
      setProcessing(true);
      setThinking();
      try {
        const res = await fetch("/api/walkthrough/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            voiceRequestBody(prefsRef.current, {
              organizationId,
              propertyId,
              experienceId,
              sessionId,
              activeSceneId: activeSceneRef.current,
              query: trimmed,
            }),
          ),
        });
        await playVoiceResponse(res);
        onTrack?.("ai_text_query", { query: trimmed });
      } catch (e) {
        reset();
        const msg = e instanceof Error ? e.message : "Request failed";
        setMessages((m) => [...m, { role: "assistant", content: msg }]);
      } finally {
        setProcessing(false);
        reset();
      }
    },
    [
      processing,
      tryLocalFastPath,
      voiceProfile,
      viewerConfig,
      organizationId,
      propertyId,
      experienceId,
      sessionId,
      playVoiceResponse,
      reset,
      setThinking,
      onTrack,
    ],
  );

  const runGreeting = useCallback(async () => {
    if (greetStartedRef.current) return;
    greetStartedRef.current = true;
    setExpanded(true);
    setProcessing(true);
    setThinking();
    try {
      const res = await fetch("/api/walkthrough/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          voiceRequestBody(prefsRef.current, {
            organizationId,
            propertyId,
            experienceId,
            sessionId,
            greeting: true,
            propertyName,
            projectName,
          }),
        ),
      });
      const answer = await playVoiceResponse(res);
      if (answer) setGreeted(true);
      onTrack?.("ai_greeting_played", {});
    } catch {
      reset();
      const fallback = buildWalkthroughFirstMessage(
        propertyName,
        projectName,
        prefsRef.current.speechLanguageCode,
      );
      setMessages((m) => [...m, { role: "assistant", content: fallback }]);
      void speakOnly(fallback);
      setGreeted(true);
    } finally {
      setProcessing(false);
      reset();
    }
  }, [
    organizationId,
    propertyId,
    experienceId,
    sessionId,
    propertyName,
    projectName,
    playVoiceResponse,
    reset,
    setThinking,
    speakOnly,
    onTrack,
  ]);

  const useSamvaad =
    voiceProfile === "indian-languages" && isSamvaadConfigured(viewerConfig);
  const useSarvamRealtime = voiceProfile === "indian-languages" && !useSamvaad;
  const useElevenLabsConvai =
    voiceProfile === "global-voice" && isElevenLabsConvaiConfigured(viewerConfig);
  /** ConvAI agent uses Scribe realtime ASR server-side; browser Scribe only when ConvAI is off. */
  const useGlobalElevenLabsStt =
    voiceProfile === "global-voice" && micEnabled && !useElevenLabsConvai;

  const [samvaadOrbState, setSamvaadOrbState] = useState<typeof agentState>(null);
  const [samvaadConnected, setSamvaadConnected] = useState(false);
  const [elevenLabsOrbState, setElevenLabsOrbState] = useState<typeof agentState>(null);
  const [elevenLabsConnected, setElevenLabsConnected] = useState(false);
  const samvaadOrbStateRef = useRef(samvaadOrbState);
  samvaadOrbStateRef.current = samvaadOrbState;
  const elevenLabsOrbStateRef = useRef(elevenLabsOrbState);
  elevenLabsOrbStateRef.current = elevenLabsOrbState;

  const processCommittedUtterance = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processing) return;
      if (!useElevenLabsConvai && agentSpeakingRef.current) return;

      const now = Date.now();
      if (
        lastUtteranceRef.current.text === trimmed
        && now - lastUtteranceRef.current.at < 4000
      ) {
        return;
      }
      lastUtteranceRef.current = { text: trimmed, at: now };
      setLiveTranscript("");

      if (tryLocalFastPath(trimmed)) return;

      if (useElevenLabsConvai && !elevenLabsConnected) {
        pendingUtteranceRef.current = trimmed;
        setMessages((m) => [...m, { role: "user", content: trimmed }]);
        onTrack?.("ai_elevenlabs_utterance_queued", {});
        return;
      }

      if (useElevenLabsConvai && sendUserTextRef.current(trimmed)) {
        setMessages((m) => [...m, { role: "user", content: trimmed }]);
        setElevenLabsOrbState("thinking");
        onTrack?.("ai_elevenlabs_user_transcript", { source: "scribe" });
        return;
      }

      if (useElevenLabsConvai) return;

      void handleUserText(trimmed);
    },
    [
      processing,
      tryLocalFastPath,
      useElevenLabsConvai,
      elevenLabsConnected,
      handleUserText,
      onTrack,
    ],
  );

  useWalkthroughRealtimeStt({
    enabled: useGlobalElevenLabsStt,
    languageCode: prefs.speechLanguageCode,
    organizationId,
    onCommitted: processCommittedUtterance,
    onPartial: setLiveTranscript,
    onListeningChange: setListening,
    onError: (message) => reportVoiceError(message, "ai_stt_error"),
  });

  const capturePaused =
    useElevenLabsConvai
      ? elevenLabsOrbState === "talking"
      : useSamvaad
        ? samvaadOrbState === "talking"
        : processing ||
          agentState === "talking" ||
          agentState === "thinking" ||
          samvaadOrbState === "talking" ||
          elevenLabsOrbState === "talking" ||
          elevenLabsOrbState === "thinking";

  useSamvaadVoice({
    enabled: useSamvaad && micEnabled,
    paused: capturePaused,
    context: {
      organizationId,
      propertyId,
      experienceId,
      sessionId,
      propertyName,
      projectName,
      activeSceneId: activeSceneRef.current,
      viewerConfig,
      prefs,
    },
    onUserTranscript: (text) => {
      if (tryLocalFastPath(text)) return;
      setMessages((m) => [...m, { role: "user", content: text }]);
      onTrack?.("ai_samvaad_user_transcript", {});
    },
    onBotTranscript: (text) => {
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      onTrack?.("ai_samvaad_bot_transcript", {});
    },
    onAgentState: (state) => {
      setSamvaadOrbState(state);
      if (state === "talking") agentSpeakingRef.current = true;
      if (state === "listening" || state === null) agentSpeakingRef.current = false;
    },
    onVolume: (level) => {
      if (samvaadOrbStateRef.current === "talking") {
        outputVolumeRef.current = level;
      } else {
        inputVolumeRef.current = level;
      }
    },
    onConnected: () => {
      setSamvaadConnected(true);
      setGreeted(true);
      setExpanded(true);
      onTrack?.("ai_samvaad_connected", {});
    },
    onError: (message) => reportVoiceError(message, "ai_samvaad_error"),
  });

  const handleConvaiLocalNavigation = useCallback(
    ({ transcript, match }: { transcript: string; match: SceneMatchResult }) => {
      setMessages((m) => [...m, { role: "assistant", content: buildNavigationAck(match.label) }]);
      runLocalNavigation(transcript, match, "convai_local_fast_path");
    },
    [runLocalNavigation],
  );

  const { sendUserText, connected: elevenLabsConvaiConnected, starting: elevenLabsStarting } = useElevenLabsConvaiVoice({
    enabled: useElevenLabsConvai,
    paused: capturePaused,
    muteInput: !micEnabled,
    context: {
      organizationId,
      propertyId,
      experienceId,
      sessionId,
      propertyName,
      projectName,
      activeSceneId: activeSceneRef.current,
      viewerConfig,
      prefs,
      scenes: scenesRef.current,
      skipGreeting: convaiGreetingPlayedRef.current,
    },
    onUserTranscript: (text) => {
      setLiveTranscript(text);
      setVoiceError(null);
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last?.role === "user" && last.content === text) return m;
        return [...m, { role: "user", content: text }];
      });
      onTrack?.("ai_elevenlabs_user_transcript", {});
    },
    onAgentTranscript: (text) => {
      if (Date.now() < suppressConvaiAgentUntilRef.current) return;
      setElevenLabsOrbState("talking");
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last?.role === "assistant") {
          return [...m.slice(0, -1), { role: "assistant", content: text }];
        }
        return [...m, { role: "assistant", content: text }];
      });
      onTrack?.("ai_elevenlabs_agent_transcript", {});
    },
    onAgentState: (state) => {
      setElevenLabsOrbState(state);
      if (state === "talking") agentSpeakingRef.current = true;
      if (state === "listening") agentSpeakingRef.current = false;
      if (state === null) agentSpeakingRef.current = false;
    },
    onVolume: (level, source) => {
      if (source === "output" || elevenLabsOrbStateRef.current === "talking") {
        outputVolumeRef.current = level;
      } else {
        inputVolumeRef.current = level;
      }
    },
    onConnected: () => {
      convaiGreetingPlayedRef.current = true;
      setElevenLabsConnected(true);
      setGreeted(true);
      setExpanded(true);
      setVoiceError(null);
      setElevenLabsOrbState("listening");
      onTrack?.("ai_elevenlabs_convai_connected", {});

      const pending = pendingUtteranceRef.current;
      if (pending) {
        pendingUtteranceRef.current = null;
        window.setTimeout(() => {
          if (sendUserTextRef.current(pending)) {
            onTrack?.("ai_elevenlabs_user_transcript", { source: "queued" });
          }
        }, 600);
      }
    },
    onError: (message) => {
      reportVoiceError(message, "ai_elevenlabs_convai_error");
      if (!greeted && !greetStartedRef.current) {
        void runGreeting();
      }
    },
    onLocalNavigation: handleConvaiLocalNavigation,
    onCommand: (cmd) => applyCommand(cmd, { source: "convai" }),
    onTrack,
  });

  sendUserTextRef.current = sendUserText;

  useEffect(() => {
    setElevenLabsConnected(elevenLabsConvaiConnected);
    convaiDuplexRef.current = useElevenLabsConvai && elevenLabsConvaiConnected;
  }, [elevenLabsConvaiConnected, useElevenLabsConvai]);

  const processRealtimeUtterance = useCallback(
    async (transcript: string) => {
      if (tryLocalFastPath(transcript)) return;
      setMessages((m) => [...m, { role: "user", content: transcript }]);
      setProcessing(true);
      setThinking();
      try {
        const res = await fetch("/api/walkthrough/voice/realtime/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            propertyId,
            experienceId,
            sessionId,
            activeSceneId: activeSceneRef.current,
            transcript,
            voiceProfile: prefsRef.current.voiceProfile,
            speechLanguageCode: prefsRef.current.speechLanguageCode,
            chatLanguageCode: prefsRef.current.chatLanguageCode,
          }),
        });
        await playVoiceResponse(res);
        onTrack?.("ai_sarvam_realtime_response", {});
      } catch (e) {
        reset();
        const msg = e instanceof Error ? e.message : "Realtime voice failed";
        setMessages((m) => [...m, { role: "assistant", content: msg }]);
      } finally {
        setProcessing(false);
        reset();
      }
    },
    [
      tryLocalFastPath,
      organizationId,
      propertyId,
      experienceId,
      sessionId,
      playVoiceResponse,
      reset,
      setThinking,
      onTrack,
    ],
  );

  useSarvamRealtimeVoice({
    enabled: useSarvamRealtime && micEnabled,
    paused: capturePaused,
    prefs,
    context: {
      organizationId,
      propertyId,
      experienceId,
      sessionId,
      activeSceneId,
      prefs,
    },
    onUtteranceReady: processRealtimeUtterance,
    onListeningChange: setListening,
    onVolume: (level) => {
      inputVolumeRef.current = level * 4;
    },
  });

  useContinuousVoiceCapture({
    enabled:
      !useSarvamRealtime
      && !useElevenLabsConvai
      && !useGlobalElevenLabsStt
      && micEnabled,
    paused: capturePaused,
    onListeningChange: setListening,
    onVolume: (level) => {
      inputVolumeRef.current = level * 4;
    },
    onUtterance: async (blob) => {
      if (agentSpeakingRef.current || processing) return;
      await processServerAudio(blob);
    },
    silenceMs: 650,
    minSpeechMs: 250,
  });

  useEffect(() => {
    if (useSamvaad || useElevenLabsConvai) return;
    const timer = window.setTimeout(() => runGreeting(), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSamvaad, useElevenLabsConvai]);

  useEffect(() => {
    if (!useElevenLabsConvai || !elevenLabsConvaiConnected) return;
    const id = window.setInterval(() => {
      const inVol = inputVolumeRef.current;
      const outVol = outputVolumeRef.current;
      const level = elevenLabsOrbStateRef.current === "talking" ? outVol : inVol;
      setWaveformBars((prev) => {
        const next = prev.slice(1);
        next.push(Math.max(0.06, Math.min(1, level)));
        return next;
      });
    }, 80);
    return () => window.clearInterval(id);
  }, [useElevenLabsConvai, elevenLabsConvaiConnected, inputVolumeRef, outputVolumeRef]);

  useEffect(() => {
    if (elevenLabsConvaiConnected || messages.length > 0) {
      setExpanded(true);
    }
  }, [elevenLabsConvaiConnected, messages.length]);

  const toggleMic = () => {
    setMicEnabled((v) => {
      const next = !v;
      if (next) {
        setVoiceError(null);
        onTrack?.("ai_listening_started", {});
      }
      return next;
    });
  };

  const micState: VoiceMicState = (() => {
    if (voiceError) return "error";
    if (!micEnabled) return "paused";
    if (useElevenLabsConvai) {
      if (elevenLabsStarting || (!elevenLabsConnected && !voiceError)) return "requesting";
      if (elevenLabsOrbState === "talking") return "speaking";
      if (elevenLabsOrbState === "thinking" || processing) return "thinking";
      if (elevenLabsConnected) return "listening";
    }
    if (useSamvaad) {
      if (!samvaadConnected) return "requesting";
      if (samvaadOrbState === "talking") return "speaking";
      if (samvaadOrbState === "thinking") return "thinking";
      if (samvaadOrbState === "listening") return "listening";
    }
    if (processing || agentState === "thinking" || elevenLabsOrbState === "thinking") return "thinking";
    if (agentState === "talking" || elevenLabsOrbState === "talking" || samvaadOrbState === "talking") return "speaking";
    if (listening || agentState === "listening") return "listening";
    return greeted ? "idle" : "requesting";
  })();

  const displayAgentState =
    micState === "speaking"
      ? "talking"
      : micState === "listening"
        ? "listening"
        : micState === "thinking" || micState === "requesting"
          ? "thinking"
          : useSamvaad || useElevenLabsConvai
            ? (useSamvaad ? samvaadOrbState : elevenLabsOrbState) ?? (processing ? "thinking" : null)
            : processing && agentState === null
              ? "thinking"
              : agentState;

  const statusLabel = (() => {
    if (statusHint) return statusHint;
    if (voiceError) return voiceError;
    const base = micStateLabel(micState);
    if (micState === "listening" && liveTranscript.trim()) {
      return `${base} — "${liveTranscript.trim()}"`;
    }
    if (micState === "listening") return `${base} — speak naturally`;
    if (useElevenLabsConvai && micState === "requesting") {
      return "Connecting ElevenLabs voice guide…";
    }
    if (useSamvaad && !samvaadConnected) return "Connecting Samvaad voice guide…";
    if (greeted && micEnabled) return base;
    if (!greeted) return "Starting your tour guide…";
    return base;
  })();

  const showVolumeWaveform =
    useElevenLabsConvai && elevenLabsConvaiConnected && micEnabled && micState !== "paused";

  const showMicWaveform =
    !showVolumeWaveform
    && micEnabled
    && (listening
      || agentState === "talking"
      || samvaadOrbState === "listening"
      || samvaadOrbState === "talking"
      || elevenLabsOrbState === "listening"
      || elevenLabsOrbState === "talking");

  return (
    <div className="wt-voice-agent" aria-label="Property voice guide">
      <div className="wt-voice-agent-inner">
        <button
          type="button"
          className="wt-voice-agent-orb-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="Toggle voice guide panel"
        >
          <div className="wt-voice-agent-orb-wrap">
            <Orb
              agentState={displayAgentState}
              volumeMode="manual"
              manualInput={inputVolumeRef.current}
              manualOutput={outputVolumeRef.current}
              inputVolumeRef={inputVolumeRef}
              outputVolumeRef={outputVolumeRef}
              colors={orbColors}
              className="h-full w-full"
            />
          </div>
          <div className="wt-voice-agent-status min-w-0">
            {processing && agentState !== "talking" ? (
              <ShimmeringText text={statusLabel} className="text-sm font-medium text-white" />
            ) : (
              <p className="text-sm font-medium text-white">{statusLabel}</p>
            )}
            {messages.length > 0 && !liveTranscript && (
              <p className="truncate text-xs text-white/75">
                {messages[messages.length - 1]?.content}
              </p>
            )}
            {liveTranscript && micState === "listening" && (
              <p className="truncate text-xs text-emerald-200/90">You: {liveTranscript}</p>
            )}
          </div>
        </button>

        {(showVolumeWaveform || showMicWaveform) && (
          <div className="wt-voice-agent-wave">
            {showVolumeWaveform ? (
              <Waveform
                data={waveformBars}
                active={micState === "listening" || micState === "speaking" || micState === "thinking"}
                height={36}
                barColor="rgb(255 255 255 / 0.9)"
                className="w-full"
              />
            ) : (
              <LiveWaveform
                active={
                  (listening || samvaadOrbState === "listening") &&
                  displayAgentState !== "talking"
                }
                processing={displayAgentState === "talking" || micState === "thinking"}
                height={36}
                barColor="rgb(255 255 255 / 0.9)"
                className="w-full"
              />
            )}
          </div>
        )}

        {(expanded || messages.length > 0 || liveTranscript) && (
          <div className="wt-voice-agent-panel">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/70">
                {micStateLabel(micState)}
              </span>
              {voiceError && (
                <span className="text-xs text-red-300">{voiceError}</span>
              )}
            </div>
            <Conversation className="h-44">
              <ConversationContent className="flex min-w-0 flex-col gap-2 p-3">
                {messages.length === 0 && !liveTranscript && (
                  <p className="text-xs text-white/50">Say a room name or try “go to kitchen”.</p>
                )}
                {messages.map((message, index) => (
                  <Message key={`${message.role}-${index}-${message.content.slice(0, 24)}`} from={message.role}>
                    <MessageContent
                      className={`max-w-[90%] min-w-0 text-white ${
                        message.role === "user" ? "bg-white/15" : "bg-white/10"
                      }`}
                    >
                      <Response className="w-auto [overflow-wrap:anywhere] whitespace-pre-wrap text-xs">
                        {message.content}
                      </Response>
                    </MessageContent>
                  </Message>
                ))}
                {liveTranscript && micState === "listening" && (
                  <Message from="user">
                    <MessageContent className="max-w-[90%] min-w-0 border border-dashed border-white/25 bg-white/5 text-white">
                      <Response className="w-auto [overflow-wrap:anywhere] whitespace-pre-wrap text-xs italic text-white/80">
                        {liveTranscript}
                      </Response>
                    </MessageContent>
                  </Message>
                )}
                {((processing && !useElevenLabsConvai) ||
                  (useElevenLabsConvai && elevenLabsOrbState === "thinking")) &&
                  agentState !== "talking" &&
                  messages.length > 0 && (
                  <div className="flex items-center gap-2 px-2 text-xs text-white/70">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <ShimmeringText text="Thinking…" />
                  </div>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="flex items-center gap-2 border-t border-white/10 p-3">
              <Input
                placeholder="Ask or say go to kitchen…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !processing) handleUserText(input);
                }}
                disabled={processing}
                className="min-h-[40px] border-white/20 bg-black/40 text-white placeholder:text-white/50"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="min-h-[40px] min-w-[40px] shrink-0"
                disabled={processing || !input.trim()}
                onClick={() => handleUserText(input)}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={micEnabled ? "secondary" : "destructive"}
                size="icon"
                className="min-h-[40px] min-w-[40px] shrink-0"
                onClick={toggleMic}
                aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
