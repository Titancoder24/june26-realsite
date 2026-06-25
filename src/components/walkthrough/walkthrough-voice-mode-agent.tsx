"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { VoiceModeOrbShell } from "@/components/walkthrough/voice-mode-orb-shell";
import { WalkthroughBuyerLanguagePicker } from "@/components/walkthrough/walkthrough-buyer-language-picker";
import type { AgentState } from "@/components/ui/orb";
import { useContinuousVoiceCapture } from "@/hooks/use-continuous-voice-capture";
import { useElevenLabsConvaiVoice } from "@/hooks/use-elevenlabs-convai-voice";
import { useVoiceAgentOrb } from "@/hooks/use-voice-agent-orb";
import { useVoiceModeState } from "@/hooks/use-voice-mode-state";
import { readJsonResponse } from "@/lib/http-json";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { voiceModeLog } from "@/lib/voice-mode/voice-mode-log";
import { unlockVoiceAudioSync, prewarmMicrophone } from "@/lib/voice-mode/voice-audio";
import {
  greetingAlreadyPlayed,
  markGreetingPlayed,
  nextVoiceAgentMountId,
  onGreetingComplete,
  clearGreetingPending,
  getGreetingNeedsTap,
  getGreetingPendingBlob,
  getGreetingPlaybackError,
  setGreetingNeedsTap,
  setGreetingPendingBlob,
  setGreetingPlaybackError,
  subscribeGreetingPlayback,
} from "@/lib/voice-mode/greeting-session";
import type { VoiceModeTurn } from "@/lib/voice-mode/types";
import { voiceModeOrbState } from "@/lib/voice-mode/types";
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
import { WalkthroughBrainProviderToggle } from "@/components/walkthrough/walkthrough-brain-provider-toggle";
import {
  readBrainProvider,
  resolveBrainProvider,
  storeBrainProvider,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";
import { isElevenLabsConvaiConfigured } from "@/lib/elevenlabs-convai";
import {
  buyerElevenLabsVoicePreferences,
  storeVoicePreferences,
  type WalkthroughVoicePreferences,
} from "@/lib/walkthrough-voice-providers";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

const GLOBAL_VOICE_PROFILE = "global-voice" as const;

function decodeHeader(res: Response, key: string): string {
  const raw = res.headers.get(key);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function voiceRequestBody(
  prefs: WalkthroughVoicePreferences,
  brainProvider: WalkthroughBrainProvider,
  extra: Record<string, unknown>,
) {
  return {
    ...extra,
    voiceProfile: GLOBAL_VOICE_PROFILE,
    speechLanguageCode: prefs.speechLanguageCode,
    chatLanguageCode: prefs.chatLanguageCode,
    brainProvider,
  };
}

export function WalkthroughVoiceModeAgent({
  organizationId,
  propertyId,
  experienceId,
  sessionId,
  propertyName,
  projectName,
  viewerConfig,
  scenes,
  activeSceneId,
  onCommand,
  onTrack,
  preview = false,
  showDevTools = false,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  projectName?: string;
  viewerConfig?: Record<string, unknown> | null;
  scenes: WalkthroughNavScene[];
  activeSceneId?: string;
  onCommand: (cmd: WalkthroughAICommand) => void;
  onTrack?: (eventType: string, payload?: Record<string, unknown>) => void;
  preview?: boolean;
  showDevTools?: boolean;
}) {
  const [prefs, setPrefs] = useState<WalkthroughVoicePreferences>(() =>
    buyerElevenLabsVoicePreferences(experienceId, viewerConfig),
  );
  const [brainProvider, setBrainProvider] = useState<WalkthroughBrainProvider>(() =>
    resolveBrainProvider(experienceId, viewerConfig),
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const brainProviderRef = useRef(brainProvider);
  brainProviderRef.current = brainProvider;

  useEffect(() => {
    const resolved = resolveBrainProvider(experienceId, viewerConfig);
    setBrainProvider(resolved);
  }, [experienceId, viewerConfig]);

  useEffect(() => {
    const params = new URLSearchParams({
      organizationId,
      propertyId,
      experienceId,
    });
    fetch(`/api/walkthrough/voice/warmup?${params.toString()}`).catch(() => {});
  }, [organizationId, propertyId, experienceId]);

  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const activeSceneRef = useRef(activeSceneId);
  activeSceneRef.current = activeSceneId;

  const orgRef = useRef({ organizationId, propertyId, experienceId, sessionId, propertyName, projectName });
  orgRef.current = { organizationId, propertyId, experienceId, sessionId, propertyName, projectName };

  const useConvai = isElevenLabsConvaiConfigured(viewerConfig);
  const [convaiArmed, setConvaiArmed] = useState(false);
  const [convaiFailed, setConvaiFailed] = useState(false);
  const convaiArmedRef = useRef(false);
  convaiArmedRef.current = convaiArmed;
  const convaiFailedRef = useRef(false);
  convaiFailedRef.current = convaiFailed;
  /** True when ConvAI WebRTC should be active (not fallen back to REST TTS). */
  const convaiLive = useConvai && convaiArmed && !convaiFailed;
  /** REST capture + TTS pipeline (original working path). */
  const useRestPipeline = !useConvai || convaiFailed;
  const [convaiOrbState, setConvaiOrbState] = useState<AgentState>(null);
  const convaiOrbStateRef = useRef<AgentState>(null);
  convaiOrbStateRef.current = convaiOrbState;
  const suppressConvaiAgentUntilRef = useRef(0);
  const convaiGreetingPlayedRef = useRef(false);
  const sendUserTextRef = useRef<(text: string) => boolean>(() => false);
  const pendingUtteranceRef = useRef<string | null>(null);

  const { state, stateRef, transition } = useVoiceModeState();
  const [turns, setTurns] = useState<VoiceModeTurn[]>(() => [
    {
      role: "assistant",
      content: buildWalkthroughFirstMessage(
        propertyName,
        projectName,
        buyerElevenLabsVoicePreferences(experienceId, viewerConfig).speechLanguageCode,
      ),
    },
  ]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [statusHint, setStatusHint] = useState<string | undefined>();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [debugText, setDebugText] = useState("");
  const [showDebugInput, setShowDebugInput] = useState(false);
  const [listenEnabled, setListenEnabled] = useState(false);
  const [captureListening, setCaptureListening] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [needsTap, setNeedsTap] = useState(() => !greetingAlreadyPlayed(experienceId));
  const [inputVolume, setInputVolume] = useState(0);
  const [orbScale, setOrbScale] = useState(1);

  const greetingPrefetchRef = useRef(false);
  const hasPlayedGreetingRef = useRef(false);
  const listeningArmedRef = useRef(false);
  const processingRef = useRef(false);
  const agentSpeakingRef = useRef(false);
  const lastVoiceErrorRef = useRef({ message: "", at: 0 });
  const pendingGreetingBlobRef = useRef<Blob | null>(null);
  const mountIdRef = useRef(0);

  const commitPaused =
    state === "GREETING"
    || state === "THINKING"
    || state === "RESPONDING"
    || state === "NAVIGATING";
  const commitPausedRef = useRef(commitPaused);
  commitPausedRef.current = commitPaused;

  const {
    agentState,
    inputVolumeRef,
    outputVolumeRef,
    playAudioBlob,
    stopActiveAudio,
    setThinking,
    setListening,
    reset: resetOrb,
  } = useVoiceAgentOrb();

  const reportVoiceError = useCallback(
    (message: string, options?: { showFallback?: boolean }) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      if (/websocket/i.test(trimmed) && (trimmed.includes("{}") || trimmed.includes("1006"))) return;
      if (/connection aborted|closed unexpectedly|closed before session/i.test(trimmed)) return;

      const now = Date.now();
      if (lastVoiceErrorRef.current.message === trimmed && now - lastVoiceErrorRef.current.at < 12_000) {
        return;
      }
      lastVoiceErrorRef.current = { message: trimmed, at: now };

      voiceModeLog("voice_error", { message: trimmed });
      processingRef.current = false;
      agentSpeakingRef.current = false;
      setStatusHint(undefined);
      setVoiceError(trimmed);
      transition("ERROR");
      if (options?.showFallback !== false) {
        setShowDebugInput(true);
      }
      onTrack?.("ai_stt_error", { message: trimmed });

      window.setTimeout(() => {
        setVoiceError(null);
        if (listeningArmedRef.current) {
          transition("LISTENING");
          setListening();
        }
      }, 2800);
    },
    [onTrack, setListening, transition],
  );

  const releaseVoiceTurn = useCallback(() => {
    processingRef.current = false;
    agentSpeakingRef.current = false;
    setStatusHint(undefined);
    if (listeningArmedRef.current) {
      setListening();
      transition("LISTENING");
    }
  }, [setListening, transition]);

  const orbScaleFromVolume = useCallback((level: number) => {
    const scale = 1 + Math.min(0.35, level * 1.2);
    setOrbScale(scale);
  }, []);

  const syncGreetingPlaybackUi = useCallback(() => {
    const pending = getGreetingPendingBlob(orgRef.current.experienceId);
    const needsTapNow = getGreetingNeedsTap(orgRef.current.experienceId);
    const playbackError = getGreetingPlaybackError(orgRef.current.experienceId);

    if (pending) pendingGreetingBlobRef.current = pending;
    // Don't re-show tap overlay while ConvAI is connecting or live.
    if (!convaiArmedRef.current) {
      setNeedsTap(needsTapNow);
    }
    if (playbackError) {
      setVoiceError(playbackError);
      setShowDebugInput(true);
    }
  }, []);

  const pushTurn = useCallback((role: VoiceModeTurn["role"], content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setTurns((prev) => [...prev, { role, content: trimmed }].slice(-4));
  }, []);

  const dispatchNavigation = useCallback(
    (sceneId: string, meta?: { transcript?: string; source?: string }) => {
      onCommand({ command: "JUMP_TO_SCENE", sceneId });
      onTrack?.("ai_navigation_command", { sceneId, ...meta });
    },
    [onCommand, onTrack],
  );

  const applyCommand = useCallback(
    (cmd: WalkthroughAICommand, meta?: { transcript?: string; source?: string }) => {
      onCommand(cmd);
      onTrack?.("ai_command", { command: cmd.command, ...meta });
    },
    [onCommand, onTrack],
  );

  const beginListening = useCallback(() => {
    if (listeningArmedRef.current) return;
    listeningArmedRef.current = true;
    voiceModeLog("attempting_microphone_start", { mountId: mountIdRef.current });
    setCaptureFailed(false);
    setVoiceError(null);
    setStatusHint("Requesting microphone…");
    setListenEnabled(true);
  }, []);

  const finishGreetingAndListen = useCallback(() => {
    if (listeningArmedRef.current && hasPlayedGreetingRef.current) {
      voiceModeLog("finish_greeting_skipped_already_done", { mountId: mountIdRef.current });
      return;
    }
    hasPlayedGreetingRef.current = true;
    markGreetingPlayed(orgRef.current.experienceId);
    clearGreetingPending(orgRef.current.experienceId);
    setNeedsTap(false);
    voiceModeLog("greeting_playback_ended", { mountId: mountIdRef.current });
    voiceModeLog("voice_state_change", { from: stateRef.current, to: "LISTENING", mountId: mountIdRef.current });
    transition("LISTENING");
    beginListening();
  }, [beginListening, stateRef, transition]);

  const finishGreetingRef = useRef(finishGreetingAndListen);
  finishGreetingRef.current = finishGreetingAndListen;
  const beginListeningRef = useRef(beginListening);
  beginListeningRef.current = beginListening;

  const speakLocalTts = useCallback(
    async (text: string) => {
      agentSpeakingRef.current = true;
      transition("RESPONDING");
      setThinking();
      try {
        voiceModeLog("tts_request", { text: text.slice(0, 80) });
        const { organizationId: orgId, propertyId: propId, experienceId: expId } = orgRef.current;
        const res = await fetchWithTimeout("/api/walkthrough/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            voiceRequestBody(prefsRef.current, brainProviderRef.current, {
              organizationId: orgId,
              propertyId: propId,
              experienceId: expId,
              speakOnly: true,
              text,
            }),
          ),
        });
        if (!res.ok) return { started: false, completed: false };
        const blob = await res.blob();
        voiceModeLog("tts_playback_start", { bytes: blob.size });
        const result = await playAudioBlob(blob, {
          onStarted: () => logNavigationVoiceFlow("tts_started", { responseText: text }),
          onCompleted: () => {
            voiceModeLog("tts_playback_end");
            logNavigationVoiceFlow("tts_completed", { responseText: text });
          },
        });
        return result;
      } catch {
        resetOrb();
        return { started: false, completed: false };
      } finally {
        agentSpeakingRef.current = false;
        if (listenEnabled) {
          setListening();
        } else {
          resetOrb();
        }
      }
    },
    [listenEnabled, playAudioBlob, resetOrb, setListening, setThinking, transition],
  );

  const runLocalNavigation = useCallback(
    (transcript: string, match: SceneMatchResult, source: string) => {
      const ack = buildNavigationAck(match.label);
      pushTurn("user", transcript);
      pushTurn("assistant", ack);
      setStatusHint(`Taking you to ${match.label}…`);
      transition("NAVIGATING");

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

      void runNavigationVoiceFlow({
        responseText: ack,
        speak: () => speakLocalTts(ack),
        navigate: () => dispatchNavigation(match.sceneId, { transcript, source }),
      }).finally(() => {
        setStatusHint(undefined);
        if (captureListening) transition("LISTENING");
      });
    },
    [captureListening, dispatchNavigation, pushTurn, speakLocalTts, transition],
  );

  const handleConvaiLocalNavigation = useCallback(
    ({ transcript, match }: { transcript: string; match: SceneMatchResult }) => {
      suppressConvaiAgentUntilRef.current = Date.now() + 10_000;
      pushTurn("user", transcript);
      pushTurn("assistant", buildNavigationAck(match.label));
      setStatusHint(`Taking you to ${match.label}…`);
      transition("NAVIGATING");
      dispatchNavigation(match.sceneId, { transcript, source: "convai_local_fast_path" });
      window.setTimeout(() => {
        setStatusHint(undefined);
        transition("LISTENING");
      }, 800);
    },
    [dispatchNavigation, pushTurn, transition],
  );

  const convaiCapturePaused =
    convaiOrbState === "talking" || convaiOrbState === "thinking";

  const activateRestVoiceRef = useRef<(reason?: string) => void>(() => {});

  const {
    sendUserText,
    connected: convaiConnected,
    starting: convaiStarting,
  } = useElevenLabsConvaiVoice({
    enabled: convaiLive,
    paused: convaiCapturePaused,
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
      pushTurn("user", text);
      onTrack?.("ai_elevenlabs_user_transcript", {});
    },
    onAgentTranscript: (text) => {
      if (Date.now() < suppressConvaiAgentUntilRef.current) return;
      setConvaiOrbState("talking");
      setTurns((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { role: "assistant" as const, content: text }].slice(-4);
        }
        return [...prev, { role: "assistant" as const, content: text }].slice(-4);
      });
      onTrack?.("ai_elevenlabs_agent_transcript", {});
    },
    onAgentState: (orbState) => {
      setConvaiOrbState(orbState);
      if (orbState === "talking") {
        agentSpeakingRef.current = true;
        transition("RESPONDING");
      } else if (orbState === "thinking") {
        transition("THINKING");
      } else if (orbState === "listening") {
        agentSpeakingRef.current = false;
        transition("LISTENING");
      } else if (orbState === null) {
        agentSpeakingRef.current = false;
      }
    },
    onVolume: (level, source) => {
      const scaled = Math.min(1, level);
      if (source === "output" || convaiOrbStateRef.current === "talking") {
        outputVolumeRef.current = scaled;
      } else {
        inputVolumeRef.current = scaled;
        setInputVolume(scaled);
        orbScaleFromVolume(scaled);
      }
    },
    onConnected: () => {
      convaiGreetingPlayedRef.current = true;
      markGreetingPlayed(orgRef.current.experienceId);
      hasPlayedGreetingRef.current = true;
      setNeedsTap(false);
      setStatusHint(undefined);
      setVoiceError(null);
      transition("LISTENING");
      setListening();
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
      voiceModeLog("convai_error", { message });
      activateRestVoiceRef.current(message);
    },
    onLocalNavigation: handleConvaiLocalNavigation,
    onCommand: (cmd) => applyCommand(cmd, { source: "convai" }),
    onTrack,
  });

  sendUserTextRef.current = sendUserText;

  const tryLocalFastPath = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      if (isWaitIntent(trimmed)) {
        const durationMs = parseWaitDurationMs(trimmed) ?? 120_000;
        const ack = "I'll pause the tour. Say resume when you're ready, or tell me which room to show.";
        pushTurn("user", trimmed);
        pushTurn("assistant", ack);
        applyCommand({ command: "PAUSE_AUTOPLAY", durationMs }, { transcript: trimmed, source: "local_fast_path" });
        void speakLocalTts(ack).finally(() => transition("LISTENING"));
        onTrack?.("ai_local_fast_path", { intent: "pause" });
        return true;
      }

      if (isResumeIntent(trimmed)) {
        const ack = "Continuing your property tour.";
        pushTurn("user", trimmed);
        pushTurn("assistant", ack);
        applyCommand({ command: "RESUME_AUTOPLAY" }, { transcript: trimmed, source: "local_fast_path" });
        void speakLocalTts(ack).finally(() => transition("LISTENING"));
        onTrack?.("ai_local_fast_path", { intent: "resume" });
        return true;
      }

      const navResult = resolveSceneNavigation(trimmed, scenesRef.current);
      if (navResult.action === "navigate") {
        runLocalNavigation(trimmed, navResult.match, "local_fast_path");
        onTrack?.("ai_local_fast_path", {
          intent: "navigate",
          sceneId: navResult.match.sceneId,
          confidence: navResult.match.confidence,
        });
        return true;
      }

      if (navResult.action === "clarify") {
        pushTurn("user", trimmed);
        pushTurn("assistant", navResult.message);
        void speakLocalTts(navResult.message).finally(() => transition("LISTENING"));
        return true;
      }

      return false;
    },
    [applyCommand, onTrack, pushTurn, runLocalNavigation, speakLocalTts, transition],
  );

  const playVoiceResponse = useCallback(
    async (res: Response, userText?: string) => {
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        if (contentType.includes("application/json")) {
          const data = await readJsonResponse<{ error?: string }>(res).catch(
            (): { error?: string } => ({}),
          );
          throw new Error(data.error ?? "Voice request failed");
        }
        throw new Error(`Voice request failed (${res.status})`);
      }

      if (contentType.includes("application/json")) {
        const data = await readJsonResponse<{ error?: string }>(res).catch(
          (): { error?: string } => ({}),
        );
        throw new Error(data.error ?? "Voice request failed");
      }

      const answer = decodeHeader(res, "X-AI-Answer");
      const commandRaw = decodeHeader(res, "X-AI-Command");
      const transcript = decodeHeader(res, "X-AI-Transcript");

      if (userText) pushTurn("user", userText);
      else if (transcript) pushTurn("user", transcript);
      if (answer) pushTurn("assistant", answer);

      if (commandRaw) {
        try {
          const parsed = JSON.parse(commandRaw) as WalkthroughAICommand;
          if (parsed.command === "JUMP_TO_SCENE" && parsed.sceneId) {
            const sceneTitle =
              scenesRef.current.find((s) => s.id === parsed.sceneId)?.title ?? "that space";
            const responseText = answer?.trim() || buildNavigationAck(sceneTitle);
            setStatusHint(`Taking you to ${sceneTitle}…`);
            transition("NAVIGATING");

            const blob = await res.blob();
            if (blob.size < 256) {
              throw new Error("Voice audio was empty — please try again.");
            }
            await runNavigationVoiceFlow({
              responseText,
              speak: () => {
                voiceModeLog("navigation_tts_start", { sceneId: parsed.sceneId });
                return playAudioBlob(blob, {
                  onStarted: () => logNavigationVoiceFlow("tts_started", { responseText }),
                  onCompleted: () => {
                    voiceModeLog("navigation_tts_end");
                    logNavigationVoiceFlow("tts_completed", { responseText });
                  },
                });
              },
              navigate: () => {
                voiceModeLog("navigation", { sceneId: parsed.sceneId });
                dispatchNavigation(parsed.sceneId, { source: "server" });
              },
            });

            setStatusHint(undefined);
            agentSpeakingRef.current = false;
            onTrack?.("ai_fast_path", {});
            return answer;
          }
          applyCommand(parsed);
        } catch (err) {
          if (err instanceof Error && err.message.includes("empty")) throw err;
        }
      }

      transition("RESPONDING");
      agentSpeakingRef.current = true;
      const blob = await res.blob();
      if (blob.size < 256) {
        agentSpeakingRef.current = false;
        throw new Error("Voice audio was empty — please try again.");
      }
      voiceModeLog("tts_playback_start", { bytes: blob.size, source: "gemini_response" });
      await playAudioBlob(blob);
      voiceModeLog("tts_playback_end");
      agentSpeakingRef.current = false;
      if (listenEnabled) {
        voiceModeLog("return_to_listening");
        setListening();
        transition("LISTENING");
      } else {
        resetOrb();
      }

      return answer;
    },
    [applyCommand, dispatchNavigation, listenEnabled, onTrack, playAudioBlob, pushTurn, resetOrb, setListening, transition],
  );

  const handleUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || processingRef.current) return;

      if (useConvai && !convaiFailedRef.current) {
        if (!convaiConnected) {
          pendingUtteranceRef.current = trimmed;
          pushTurn("user", trimmed);
          onTrack?.("ai_elevenlabs_utterance_queued", {});
          return;
        }
        pushTurn("user", trimmed);
        transition("THINKING");
        if (sendUserTextRef.current(trimmed)) {
          onTrack?.("ai_elevenlabs_user_transcript", { source: "text" });
        }
        return;
      }

      if (tryLocalFastPath(trimmed)) return;

      processingRef.current = true;
      transition("THINKING");
      setLiveTranscript("");

      try {
        voiceModeLog("gemini_request", { query: trimmed });
        const { organizationId: orgId, propertyId: propId, experienceId: expId, sessionId: sid } = orgRef.current;
        const res = await fetchWithTimeout("/api/walkthrough/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            voiceRequestBody(prefsRef.current, brainProviderRef.current, {
              organizationId: orgId,
              propertyId: propId,
              experienceId: expId,
              sessionId: sid,
              activeSceneId: activeSceneRef.current,
              query: trimmed,
            }),
          ),
        });
        await playVoiceResponse(res, trimmed);
        voiceModeLog("backend_response_received", { query: trimmed });
        voiceModeLog("gemini_response", { query: trimmed });
        onTrack?.("ai_voice_query", { query: trimmed });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Voice request failed";
        reportVoiceError(message);
      } finally {
        releaseVoiceTurn();
      }
    },
    [convaiConnected, onTrack, playVoiceResponse, pushTurn, releaseVoiceTurn, reportVoiceError, transition, tryLocalFastPath, useConvai],
  );

  const processServerAudio = useCallback(
    async (blob: Blob) => {
      if (processingRef.current || agentSpeakingRef.current) return;
      if (commitPausedRef.current) return;

      processingRef.current = true;
      transition("THINKING");
      setLiveTranscript("");

      try {
        voiceModeLog("audio_utterance_sent", { bytes: blob.size });
        const { organizationId: orgId, propertyId: propId, experienceId: expId, sessionId: sid } = orgRef.current;
        const form = new FormData();
        form.append("audio", blob, "question.webm");
        form.append("organizationId", orgId);
        form.append("propertyId", propId);
        form.append("experienceId", expId);
        if (sid) form.append("sessionId", sid);
        if (activeSceneRef.current) form.append("activeSceneId", activeSceneRef.current);
        form.append("voiceProfile", GLOBAL_VOICE_PROFILE);
        form.append("speechLanguageCode", prefsRef.current.speechLanguageCode);
        form.append("chatLanguageCode", prefsRef.current.chatLanguageCode);
        form.append("brainProvider", brainProviderRef.current);

        const res = await fetchWithTimeout("/api/walkthrough/voice", { method: "POST", body: form });
        const transcript = decodeHeader(res, "X-AI-Transcript");
        if (transcript) {
          voiceModeLog("transcript_final", { text: transcript.slice(0, 200) });
          setLiveTranscript(transcript);
        }
        await playVoiceResponse(res, transcript || undefined);
        onTrack?.("ai_voice_query", { source: "audio" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Voice input failed";
        reportVoiceError(message);
      } finally {
        releaseVoiceTurn();
      }
    },
    [onTrack, playVoiceResponse, releaseVoiceTurn, reportVoiceError, transition],
  );

  const fetchGreetingBlob = useCallback(async (): Promise<Blob | null> => {
    const { organizationId: orgId, propertyId: propId, experienceId: expId, sessionId: sid, propertyName: pName, projectName: projName } =
      orgRef.current;

    try {
      voiceModeLog("greeting_requested", { experienceId: expId, mountId: mountIdRef.current });
      const res = await fetchWithTimeout("/api/walkthrough/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          voiceRequestBody(prefsRef.current, brainProviderRef.current, {
            organizationId: orgId,
            propertyId: propId,
            experienceId: expId,
            sessionId: sid,
            greeting: true,
            propertyName: pName,
            projectName: projName,
          }),
        ),
      });

      voiceModeLog("greeting_request_end", { ok: res.ok, mountId: mountIdRef.current });
      if (!res.ok) throw new Error("Greeting failed");

      const answer = decodeHeader(res, "X-AI-Answer");
      if (answer) {
        setTurns((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === answer) return prev;
          return [...prev.slice(0, -1), { role: "assistant" as const, content: answer }].slice(-4);
        });
      }

      const blob = await res.blob();
      if (!blob.size) throw new Error("Empty greeting audio");

      pendingGreetingBlobRef.current = blob;
      setGreetingPendingBlob(expId, blob);
      return blob;
    } catch (err) {
      voiceModeLog("greeting_failed", {
        mountId: mountIdRef.current,
        message: err instanceof Error ? err.message : "unknown",
      });
      const message = "Could not load welcome message.";
      setGreetingPlaybackError(expId, message);
      reportVoiceError(message);
      return null;
    }
  }, [reportVoiceError]);

  const prefetchGreeting = useCallback(async () => {
    const expId = orgRef.current.experienceId;
    if (greetingPrefetchRef.current || greetingAlreadyPlayed(expId)) return;
    if (pendingGreetingBlobRef.current || getGreetingPendingBlob(expId)) return;

    greetingPrefetchRef.current = true;
    setStatusHint("Preparing voice guide…");
    await fetchGreetingBlob();
    setStatusHint(undefined);
  }, [fetchGreetingBlob]);

  const prefetchGreetingRef = useRef(prefetchGreeting);
  prefetchGreetingRef.current = prefetchGreeting;

  const playGreetingFromBlob = useCallback(
    async (blob: Blob) => {
      const expId = orgRef.current.experienceId;
      stopActiveAudio();
      agentSpeakingRef.current = true;
      transition("GREETING");

      const playback = await playAudioBlob(blob, {
        onStarted: () => voiceModeLog("greeting_playback_started", { mountId: mountIdRef.current }),
        onCompleted: () => voiceModeLog("greeting_playback_ended", { mountId: mountIdRef.current, source: "onCompleted" }),
      });
      agentSpeakingRef.current = false;

      voiceModeLog("greeting_playback_settled", {
        mountId: mountIdRef.current,
        started: playback.started,
        completed: playback.completed,
      });

      if (!playback.started) {
        pendingGreetingBlobRef.current = blob;
        setGreetingPendingBlob(expId, blob);
        setNeedsTap(true);
        setGreetingNeedsTap(expId, true);
        return false;
      }

      clearGreetingPending(expId);
      onTrack?.("ai_greeting_played", {});
      finishGreetingRef.current();
      return true;
    },
    [onTrack, playAudioBlob, stopActiveAudio, transition],
  );

  const activateRestVoice = useCallback(
    (reason?: string) => {
      if (convaiFailedRef.current) return;
      convaiFailedRef.current = true;
      setConvaiFailed(true);
      voiceModeLog("convai_fallback_rest", { reason: reason ?? "unknown" });
      onTrack?.("ai_convai_fallback_rest", { reason });

      if (!listeningArmedRef.current) {
        listeningArmedRef.current = true;
        setListenEnabled(true);
      }
      setStatusHint(undefined);
      setVoiceError(null);
      transition("LISTENING");
      setListening();

      const expId = orgRef.current.experienceId;
      if (!hasPlayedGreetingRef.current && !greetingAlreadyPlayed(expId)) {
        const blob = pendingGreetingBlobRef.current ?? getGreetingPendingBlob(expId);
        if (blob) {
          void playGreetingFromBlob(blob);
        } else {
          void fetchGreetingBlob().then((b) => {
            if (b) void playGreetingFromBlob(b);
          });
        }
      }
    },
    [fetchGreetingBlob, onTrack, playGreetingFromBlob, setListening, transition],
  );

  activateRestVoiceRef.current = activateRestVoice;

  const handleTapToStart = useCallback(async () => {
    unlockVoiceAudioSync();
    setNeedsTap(false);
    setGreetingNeedsTap(orgRef.current.experienceId, false);
    voiceModeLog("tap_to_start");

    // Prewarm mic inside the user gesture for Safari/iOS.
    void prewarmMicrophone();

    if (useConvai && !convaiFailedRef.current) {
      setConvaiArmed(true);
      setStatusHint("Connecting voice guide…");
      transition("GREETING");
      if (!listeningArmedRef.current) {
        beginListeningRef.current();
      }
      return;
    }

    // REST voice path (default — Gemini brain + ElevenLabs TTS).
    if (!listeningArmedRef.current) {
      beginListeningRef.current();
    }

    const expId = orgRef.current.experienceId;

    if (hasPlayedGreetingRef.current || greetingAlreadyPlayed(expId)) {
      if (!listeningArmedRef.current) {
        transition("LISTENING");
        beginListeningRef.current();
      }
      return;
    }

    let blob = pendingGreetingBlobRef.current ?? getGreetingPendingBlob(expId);
    if (!blob) {
      setStatusHint("Loading voice guide…");
      blob = await fetchGreetingBlob();
      setStatusHint(undefined);
    }

    if (!blob) {
      setNeedsTap(true);
      setGreetingNeedsTap(expId, true);
      return;
    }

    pendingGreetingBlobRef.current = null;
    clearGreetingPending(expId);
    await playGreetingFromBlob(blob);
  }, [fetchGreetingBlob, playGreetingFromBlob, transition, useConvai]);

  const handleTapToStartRef = useRef(handleTapToStart);
  handleTapToStartRef.current = handleTapToStart;

  useEffect(() => {
    mountIdRef.current = nextVoiceAgentMountId();
    syncGreetingPlaybackUi();

    voiceModeLog("component_mounted", {
      mountId: mountIdRef.current,
      experienceId,
      greetingAlreadyPlayed: greetingAlreadyPlayed(experienceId),
      greetingInProgress: greetingAlreadyPlayed(experienceId) === false,
      needsTap: getGreetingNeedsTap(experienceId),
    });

    const armListeningAfterGreeting = () => {
      if (listeningArmedRef.current) return;
      voiceModeLog("greeting_complete_listener_arm_listen", { mountId: mountIdRef.current });
      hasPlayedGreetingRef.current = true;
      voiceModeLog("voice_state_change", { from: stateRef.current, to: "LISTENING", source: "greeting_complete_listener" });
      transition("LISTENING");
      beginListeningRef.current();
    };

    const unsubGreeting = onGreetingComplete(experienceId, armListeningAfterGreeting);
    const unsubPlayback = subscribeGreetingPlayback(experienceId, syncGreetingPlaybackUi);

    if (useConvai) {
      // Always require tap so audio unlock + mic permission happen in a user gesture.
      setNeedsTap(true);
      setGreetingNeedsTap(experienceId, true);
      void prefetchGreetingRef.current();
    } else if (greetingAlreadyPlayed(experienceId)) {
      voiceModeLog("greeting_already_played", { mountId: mountIdRef.current });
      armListeningAfterGreeting();
    } else {
      const pending = getGreetingPendingBlob(experienceId);
      if (pending) pendingGreetingBlobRef.current = pending;
      setNeedsTap(true);
      setGreetingNeedsTap(experienceId, true);
      void prefetchGreetingRef.current();
    }

    return () => {
      voiceModeLog("cleanup_unmount", { mountId: mountIdRef.current });
      unsubGreeting();
      unsubPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId, syncGreetingPlaybackUi]);

  const handleCaptureListeningChange = useCallback((listening: boolean) => {
    voiceModeLog("listening_state", { listening, mountId: mountIdRef.current });
    setCaptureListening(listening);
  }, []);

  const handleCaptureVolume = useCallback(
    (level: number) => {
      const scaled = level * 4;
      inputVolumeRef.current = scaled;
      setInputVolume(scaled);
      orbScaleFromVolume(scaled);
    },
    [inputVolumeRef, orbScaleFromVolume],
  );

  useContinuousVoiceCapture({
    enabled: useRestPipeline && listenEnabled,
    paused: commitPaused,
    silenceMs: 650,
    minSpeechMs: 250,
    onListeningChange: handleCaptureListeningChange,
    onVolume: handleCaptureVolume,
    onUtterance: processServerAudio,
  });

  const pipelineReady = convaiLive
    ? convaiConnected
    : listenEnabled && captureListening;

  // If ConvAI doesn't connect within 12s, fall back to REST TTS (the path that used to work).
  useEffect(() => {
    if (!convaiLive || convaiConnected) return;
    const timer = window.setTimeout(() => {
      if (!convaiConnected && convaiArmedRef.current && !convaiFailedRef.current) {
        activateRestVoiceRef.current("connect_timeout");
      }
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [convaiLive, convaiConnected]);

  useEffect(() => {
    if (!convaiLive || !convaiConnected) return;
    const id = window.setInterval(() => {
      const inVol = inputVolumeRef.current;
      const outVol = outputVolumeRef.current;
      const level = convaiOrbStateRef.current === "talking" ? outVol : inVol;
      setInputVolume(level);
      orbScaleFromVolume(level);
    }, 50);
    return () => window.clearInterval(id);
  }, [convaiConnected, orbScaleFromVolume, convaiLive, inputVolumeRef, outputVolumeRef]);

  useEffect(() => {
    if (convaiLive && convaiStarting && !convaiConnected) {
      setStatusHint("Connecting voice guide…");
    }
  }, [convaiConnected, convaiStarting, convaiLive]);

  useEffect(() => {
    if (!listenEnabled) return;
    if (captureFailed) {
      setStatusHint(undefined);
      return;
    }
    if (!pipelineReady) {
      setStatusHint("Requesting microphone…");
      return;
    }
    if (commitPaused) {
      setStatusHint(undefined);
      return;
    }
    setStatusHint(undefined);
  }, [captureFailed, commitPaused, listenEnabled, pipelineReady]);

  useEffect(() => {
    if (convaiLive || !listenEnabled || pipelineReady || captureFailed) return;
    const timer = window.setTimeout(() => {
      setCaptureFailed(true);
      setVoiceError("Could not access microphone. Allow mic permission to use voice guide.");
      setShowDebugInput(true);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [captureFailed, listenEnabled, pipelineReady, convaiLive]);

  useEffect(() => {
    if (pipelineReady && useRestPipeline) {
      setListening();
    }
  }, [pipelineReady, setListening, useRestPipeline]);

  useEffect(() => {
    voiceModeLog("voice_state", { state, mountId: mountIdRef.current });
  }, [state]);

  const orbAgentState = voiceModeOrbState(state);
  const displayOrbState =
    convaiLive && (convaiConnected || convaiStarting)
      ? (convaiOrbState ?? (convaiStarting ? "thinking" : "listening"))
      : agentState ?? (pipelineReady ? "listening" : orbAgentState);

  const showWaveform = convaiLive
    ? convaiConnected && convaiOrbState !== "thinking"
    : pipelineReady && (state === "LISTENING" || state === "TRANSCRIBING");

  const waveformBars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) =>
        Math.max(0.08, inputVolume * (0.55 + Math.sin(i * 0.65) * 0.35)),
      ),
    [inputVolume],
  );

  const statusError =
    voiceError
    ?? (captureFailed ? "Could not access microphone. Allow mic permission to use voice guide." : null);

  const displayVoiceState =
    convaiLive
      ? convaiStarting && !convaiConnected
        ? "GREETING"
        : convaiOrbState === "talking"
          ? "RESPONDING"
          : convaiOrbState === "thinking"
            ? "THINKING"
            : convaiConnected
              ? "LISTENING"
              : convaiArmed
                ? "GREETING"
                : "IDLE"
      : state === "GREETING"
    || state === "THINKING"
    || state === "RESPONDING"
    || state === "NAVIGATING"
    || state === "ERROR"
      ? state
      : pipelineReady && (state === "LISTENING" || state === "TRANSCRIBING")
        ? state
        : listenEnabled && (state === "LISTENING" || state === "TRANSCRIBING")
          ? "IDLE"
          : state;

  const showTextFallback = showDebugInput || captureFailed;

  return (
    <>
      {needsTap && (
        <button
          type="button"
          className="wt-voice-mode-start-overlay"
          onClick={() => void handleTapToStartRef.current()}
        >
          <span>Tap to start Voice Guide<br /><small className="text-xs font-normal opacity-80">Allow microphone when prompted</small></span>
        </button>
      )}

      <VoiceModeOrbShell
        voiceState={displayVoiceState}
        statusHint={statusHint}
        orbAgentState={displayOrbState}
        inputVolumeRef={inputVolumeRef}
        outputVolumeRef={outputVolumeRef}
        inputVolume={inputVolume}
        orbScale={orbScale}
        turns={turns}
        liveTranscript={liveTranscript}
        showWaveform={showWaveform}
        waveformBars={waveformBars}
        errorMessage={statusError}
        orbInteractive={needsTap}
        onOrbClick={needsTap ? () => void handleTapToStartRef.current() : undefined}
      />

      <div className="wt-voice-mode-buyer-bar">
        <WalkthroughBuyerLanguagePicker
          experienceId={experienceId}
          viewerConfig={viewerConfig}
          prefs={prefs}
          disabled={processingRef.current}
          compact
          onChange={(next) => {
            setPrefs(next);
            storeVoicePreferences(experienceId, next);
          }}
        />
      </div>

      {(showDevTools || preview || process.env.NODE_ENV === "development") && (
      <div className="wt-voice-mode-debug">
        <WalkthroughBrainProviderToggle
          experienceId={experienceId}
          disabled={processingRef.current}
          onChange={(next) => {
            setBrainProvider(next);
            storeBrainProvider(experienceId, next);
          }}
        />

        <WalkthroughBuyerLanguagePicker
          experienceId={experienceId}
          viewerConfig={viewerConfig}
          prefs={prefs}
          disabled={processingRef.current}
          onChange={(next) => {
            setPrefs(next);
            storeVoicePreferences(experienceId, next);
          }}
        />

        <button
          type="button"
          className="wt-voice-mode-debug-toggle"
          onClick={() => setShowDebugInput((v) => !v)}
          aria-expanded={showTextFallback}
        >
          {showTextFallback ? "Hide text fallback" : "Text fallback"}
        </button>

        {showTextFallback && (
          <form
            className="wt-voice-mode-debug-form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = debugText.trim();
              if (!trimmed) return;
              setDebugText("");
              void handleUserText(trimmed);
            }}
          >
            <Input
              value={debugText}
              onChange={(e) => setDebugText(e.target.value)}
              placeholder="Debug text input…"
              className="wt-voice-mode-debug-input"
              disabled={processingRef.current}
            />
            <Button type="submit" size="icon" variant="secondary" disabled={processingRef.current}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
      )}
    </>
  );
}
