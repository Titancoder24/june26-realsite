"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Conversation } from "@elevenlabs/client";
import type { TextConversation, VoiceConversation } from "@elevenlabs/client";
import type { AgentState } from "@/components/ui/orb";
import type { ElevenLabsConvaiSessionBundle } from "@/lib/elevenlabs-convai";
import type { WalkthroughVoicePreferences } from "@/lib/walkthrough-voice-providers";
import {
  isResumeIntent,
  isWaitIntent,
  logVoiceNavigationDev,
  parseWaitDurationMs,
  resolveSceneNavigation,
  type SceneMatchResult,
  type WalkthroughNavScene,
} from "@/lib/walkthrough-inference/fast-navigation";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { readJsonResponse } from "@/lib/http-json";

export type ElevenLabsConvaiContext = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  projectName?: string;
  activeSceneId?: string;
  viewerConfig?: Record<string, unknown> | null;
  prefs: WalkthroughVoicePreferences;
  scenes: WalkthroughNavScene[];
  /** Skip spoken greeting when reconnecting (language change, remount). */
  skipGreeting?: boolean;
};

function mapModeToOrb(mode: "speaking" | "listening" | null): AgentState {
  if (mode === "speaking") return "talking";
  if (mode === "listening") return "listening";
  return null;
}

type ConvaiClientMessage = {
  role?: string;
  message?: string;
  source?: string;
};

function parseConvaiClientMessage(message: unknown): { role: "user" | "agent"; text: string } | null {
  const m = message as ConvaiClientMessage;
  const text = typeof m.message === "string" ? m.message.trim() : "";
  if (!text) return null;

  const role = m.role === "user" || m.source === "user" ? "user" : "agent";
  return { role, text };
}

export function useElevenLabsConvaiVoice({
  enabled,
  paused,
  context,
  onUserTranscript,
  onAgentTranscript,
  onAgentState,
  onVolume,
  onConnected,
  onError,
  onCommand,
  onLocalNavigation,
  onTrack,
  muteInput = false,
}: {
  enabled: boolean;
  paused: boolean;
  muteInput?: boolean;
  context: ElevenLabsConvaiContext;
  onUserTranscript?: (text: string) => void;
  onAgentTranscript?: (text: string) => void;
  onAgentState?: (state: AgentState) => void;
  onVolume?: (level: number, source: "input" | "output") => void;
  onConnected?: () => void;
  onError?: (message: string) => void;
  onCommand?: (cmd: WalkthroughAICommand) => void;
  onLocalNavigation?: (payload: { transcript: string; match: SceneMatchResult }) => void;
  onTrack?: (eventType: string, payload?: Record<string, unknown>) => void;
}) {
  const conversationRef = useRef<TextConversation | VoiceConversation | null>(null);
  const startingRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const stopPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const [connected, setConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const contextRef = useRef(context);
  contextRef.current = context;
  const scenesRef = useRef(context.scenes);
  scenesRef.current = context.scenes;

  const streamingAgentTextRef = useRef("");

  const tryLocalCommand = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      if (isWaitIntent(trimmed)) {
        const durationMs = parseWaitDurationMs(trimmed) ?? 120_000;
        onCommand?.({ command: "PAUSE_AUTOPLAY", durationMs });
        onTrack?.("ai_local_fast_path", { intent: "pause" });
        return true;
      }
      if (isResumeIntent(trimmed)) {
        onCommand?.({ command: "RESUME_AUTOPLAY" });
        onTrack?.("ai_local_fast_path", { intent: "resume" });
        return true;
      }

      const navResult = resolveSceneNavigation(trimmed, scenesRef.current);
      if (navResult.action === "navigate") {
        if (onLocalNavigation) {
          onLocalNavigation({ transcript: trimmed, match: navResult.match });
        } else {
          onCommand?.({ command: "JUMP_TO_SCENE", sceneId: navResult.match.sceneId });
        }
        onTrack?.("ai_local_fast_path", {
          intent: "navigate",
          sceneId: navResult.match.sceneId,
          confidence: navResult.match.confidence,
        });
        logVoiceNavigationDev({
          transcript: trimmed,
          intent: "navigate",
          targetRoom: navResult.match.targetRoom,
          match: navResult.match,
          confidence: navResult.match.confidence,
          sceneId: navResult.match.sceneId,
          sceneTitle: navResult.match.label,
          success: true,
          action: "convai_local_fast_path",
        });
        return true;
      }
      if (navResult.action === "clarify") {
        onTrack?.("ai_local_fast_path", { intent: "clarify" });
        logVoiceNavigationDev({
          transcript: trimmed,
          intent: "navigate",
          targetRoom: navResult.candidates[0]?.targetRoom,
          match: navResult.candidates[0] ?? null,
          confidence: navResult.candidates[0]?.confidence,
          success: false,
          action: "clarify",
        });
        return false;
      }
      return false;
    },
    [onCommand, onLocalNavigation, onTrack],
  );

  const stop = useCallback(async () => {
    const conv = conversationRef.current;
    conversationRef.current = null;
    setConnected(false);
    onAgentState?.(null);
    if (conv) {
      try {
        await conv.endSession();
      } catch {
        // ignore cleanup errors
      }
    }
  }, [onAgentState]);

  const stopAndWait = useCallback(async () => {
    const chained = stopPromiseRef.current.then(() => stop(), () => stop());
    stopPromiseRef.current = chained;
    await chained;
  }, [stop]);

  const start = useCallback(async () => {
    if (!enabled || conversationRef.current || startingRef.current) return;
    const myGeneration = sessionGenerationRef.current;
    startingRef.current = true;
    setStarting(true);
    onAgentState?.("thinking");

    try {
      await stopAndWait();
      if (!enabled || sessionGenerationRef.current !== myGeneration) {
        onAgentState?.(null);
        return;
      }

      const ctx = contextRef.current;
      const res = await fetch("/api/walkthrough/elevenlabs/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: ctx.organizationId,
          propertyId: ctx.propertyId,
          experienceId: ctx.experienceId,
          sessionId: ctx.sessionId,
          propertyName: ctx.propertyName,
          projectName: ctx.projectName,
          activeSceneId: ctx.activeSceneId,
          speechLanguageCode: ctx.prefs.speechLanguageCode,
          voiceProfile: ctx.prefs.voiceProfile,
          viewerConfig: ctx.viewerConfig ?? undefined,
          skipGreeting: ctx.skipGreeting ?? false,
        }),
      });
      const data = await readJsonResponse<ElevenLabsConvaiSessionBundle & { error?: string }>(res);
      if (!res.ok || !data.conversationToken) {
        throw new Error(data.error ?? "ElevenLabs ConvAI session unavailable");
      }

      const conversation = await Conversation.startSession({
        conversationToken: data.conversationToken,
        connectionType: "webrtc",
        dynamicVariables: data.dynamicVariables,
        overrides: data.overrides as Parameters<typeof Conversation.startSession>[0]["overrides"],
        clientTools: {
          jump_to_scene: async (params: { scene_name?: string }) => {
            const name = params?.scene_name?.trim() ?? "";
            const query = /^(go|show|open|take|visit|move)/i.test(name) ? name : `show ${name}`;
            const navResult = resolveSceneNavigation(query, scenesRef.current);
            if (navResult.action === "navigate") {
              if (onLocalNavigation) {
                onLocalNavigation({ transcript: name, match: navResult.match });
              } else {
                onCommand?.({ command: "JUMP_TO_SCENE", sceneId: navResult.match.sceneId });
              }
              logVoiceNavigationDev({
                transcript: name,
                intent: "jump_to_scene",
                targetRoom: navResult.match.targetRoom,
                match: navResult.match,
                confidence: navResult.match.confidence,
                sceneId: navResult.match.sceneId,
                sceneTitle: navResult.match.label,
                success: true,
                action: "client_tool",
              });
              return `Navigating to ${navResult.match.label}.`;
            }
            if (navResult.action === "clarify") {
              return navResult.message;
            }
            return "I could not find that room in this tour.";
          },
          pause_tour: async (params: { minutes?: number }) => {
            const durationMs = (params?.minutes ?? 2) * 60_000;
            onCommand?.({ command: "PAUSE_AUTOPLAY", durationMs });
            return "Tour paused.";
          },
          resume_tour: async () => {
            onCommand?.({ command: "RESUME_AUTOPLAY" });
            return "Continuing the tour.";
          },
        },
        onConnect: () => {
          setConnected(true);
          onConnected?.();
          onAgentState?.("listening");
        },
        onStatusChange: ({ status }) => {
          if (status === "connected") {
            setConnected(true);
          } else if (status === "disconnected" || status === "disconnecting") {
            setConnected(false);
          }
        },
        onDisconnect: () => {
          setConnected(false);
          onAgentState?.(null);
        },
        onError: (message) => {
          const text = typeof message === "string" ? message : "ElevenLabs voice error";
          onError?.(text);
        },
        onModeChange: ({ mode }) => {
          onAgentState?.(mapModeToOrb(mode));
        },
        onAgentTyping: () => {
          onAgentState?.("thinking");
        },
        onAgentChatResponsePart: (part) => {
          if (!part?.text) return;
          if (part.type === "start") {
            streamingAgentTextRef.current = part.text;
          } else if (part.type === "delta") {
            streamingAgentTextRef.current += part.text;
          } else {
            streamingAgentTextRef.current += part.text;
          }
          const text = streamingAgentTextRef.current.trim();
          if (text) onAgentTranscript?.(text);
        },
        onMessage: (message) => {
          const parsed = parseConvaiClientMessage(message);
          if (!parsed) return;
          if (parsed.role === "user") {
            onUserTranscript?.(parsed.text);
            tryLocalCommand(parsed.text);
            return;
          }
          streamingAgentTextRef.current = "";
          onAgentTranscript?.(parsed.text);
        },
      });

      if (sessionGenerationRef.current !== myGeneration) {
        try {
          await conversation.endSession();
        } catch {
          // superseded session — discard
        }
        onAgentState?.(null);
        return;
      }

      conversationRef.current = conversation;
      if (muteInput && conversation.type !== "text") {
        (conversation as VoiceConversation).setMicMuted(true);
      }
      setConnected(true);
      onTrack?.("ai_elevenlabs_convai_connected", { agentId: data.agentId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ElevenLabs ConvAI failed to start";
      onError?.(message);
      await stopAndWait();
    } finally {
      startingRef.current = false;
      setStarting(false);
      if (!conversationRef.current) {
        onAgentState?.(null);
      }
    }
  }, [
    enabled,
    onAgentState,
    onConnected,
    onError,
    onUserTranscript,
    onAgentTranscript,
    onCommand,
    onLocalNavigation,
    onTrack,
    tryLocalCommand,
    stopAndWait,
    muteInput,
  ]);

  const languageCodeRef = useRef(context.prefs.speechLanguageCode);
  languageCodeRef.current = context.prefs.speechLanguageCode;

  useEffect(() => {
    if (!enabled) {
      sessionGenerationRef.current += 1;
      void stopAndWait();
      return;
    }

    const languageAtStart = languageCodeRef.current;
    sessionGenerationRef.current += 1;
    const timer = window.setTimeout(() => {
      void start();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      // Restart only when language changes — avoid tearing down live sessions on React remounts.
      if (languageCodeRef.current !== languageAtStart) {
        sessionGenerationRef.current += 1;
        void stopAndWait();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, context.prefs.speechLanguageCode]);

  useEffect(() => {
    return () => {
      sessionGenerationRef.current += 1;
      void stopAndWait();
    };
  }, [stopAndWait]);

  useEffect(() => {
    const conv = conversationRef.current;
    if (!conv || !connected || conv.type === "text") return;
    (conv as VoiceConversation).setMicMuted(muteInput || paused);
  }, [paused, connected, muteInput]);

  const sendUserText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !conversationRef.current || !connected) return false;
      onAgentState?.("thinking");
      conversationRef.current.sendUserMessage(trimmed);
      return true;
    },
    [connected, onAgentState],
  );

  useEffect(() => {
    if (!connected || !conversationRef.current) return;
    const interval = window.setInterval(() => {
      const conv = conversationRef.current;
      if (!conv) return;
      const inVol = conv.getInputVolume();
      const outVol = conv.getOutputVolume();
      onVolume?.(Math.min(1, inVol * 4), "input");
      onVolume?.(Math.min(1, outVol * 4), "output");
    }, 50);
    return () => window.clearInterval(interval);
  }, [connected, onVolume]);

  return {
    connected,
    starting,
    stop: stopAndWait,
    restart: async () => {
      await stopAndWait();
      await start();
    },
    sendUserText,
  };
}
