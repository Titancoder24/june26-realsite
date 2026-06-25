"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationAgent,
  BrowserAudioInterface,
  InteractionType,
  AgentState as SdkAgentState,
  type InteractionConfig,
  type ServerTranscriptMsg,
  type ServerEventBase,
} from "sarvam-conv-ai-sdk/browser";
import type { AgentState } from "@/components/ui/orb";
import type { WalkthroughVoicePreferences } from "@/lib/walkthrough-voice-providers";
import type { SamvaadSessionBundle } from "@/lib/sarvam-samvaad";

export type SamvaadVoiceContext = {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  projectName?: string;
  activeSceneId?: string;
  viewerConfig?: Record<string, unknown> | null;
  prefs: WalkthroughVoicePreferences;
};

function mapSdkState(state: SdkAgentState): AgentState {
  switch (state) {
    case SdkAgentState.LISTENING:
      return "listening";
    case SdkAgentState.SPEAKING:
      return "talking";
    case SdkAgentState.CONNECTING:
      return "thinking";
    case SdkAgentState.CONNECTED:
      return "listening";
    case SdkAgentState.ERROR:
      return "thinking";
    default:
      return null;
  }
}

export function useSamvaadVoice({
  enabled,
  paused,
  context,
  onUserTranscript,
  onBotTranscript,
  onAgentState,
  onListeningChange,
  onVolume,
  onConnected,
  onError,
}: {
  enabled: boolean;
  paused: boolean;
  context: SamvaadVoiceContext;
  onUserTranscript?: (text: string) => void;
  onBotTranscript?: (text: string) => void;
  onAgentState?: (state: AgentState) => void;
  onListeningChange?: (listening: boolean) => void;
  onVolume?: (level: number) => void;
  onConnected?: () => void;
  onError?: (message: string) => void;
}) {
  const agentRef = useRef<ConversationAgent | null>(null);
  const audioInterfaceRef = useRef<BrowserAudioInterface | null>(null);
  const [connected, setConnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const contextRef = useRef(context);
  contextRef.current = context;

  const stop = useCallback(async () => {
    const agent = agentRef.current;
    agentRef.current = null;
    audioInterfaceRef.current = null;
    setConnected(false);
    onListeningChange?.(false);
    onAgentState?.(null);
    if (agent) {
      try {
        await agent.stop();
      } catch {
        // ignore cleanup errors
      }
    }
  }, [onAgentState, onListeningChange]);

  const start = useCallback(async () => {
    if (!enabled || agentRef.current || starting) return;
    setStarting(true);
    try {
      const ctx = contextRef.current;
      const res = await fetch("/api/walkthrough/samvaad/session", {
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
        }),
      });
      const data = (await res.json()) as SamvaadSessionBundle & { error?: string; available?: boolean };
      if (!res.ok || !data.config) {
        throw new Error(data.error ?? "Samvaad session unavailable");
      }

      const audioInterface = new BrowserAudioInterface(16000, {
        outputLevelCallback: (level) => {
          onVolume?.(Math.min(1, level.rms * 4));
        },
        outputGain: 1.4,
      });
      audioInterfaceRef.current = audioInterface;

      const agent = new ConversationAgent({
        apiKey: data.apiKey,
        platform: "browser",
        baseUrl: data.baseUrl,
        config: {
          ...data.config,
          interaction_type: InteractionType.CALL,
        } as InteractionConfig,
        audioInterface,
        transcriptCallback: async (msg: ServerTranscriptMsg) => {
          const text = msg.content?.trim();
          if (!text) return;
          if (msg.role === "user") {
            onUserTranscript?.(text);
          } else {
            onBotTranscript?.(text);
          }
        },
        eventCallback: async (event: ServerEventBase) => {
          if (event.type === "server.event.user_speech_start") {
            onListeningChange?.(true);
          }
          if (event.type === "server.event.user_speech_end") {
            onListeningChange?.(false);
          }
        },
        stateCallback: (newState) => {
          const mapped = mapSdkState(newState);
          onAgentState?.(mapped);
          if (newState === SdkAgentState.LISTENING) {
            onListeningChange?.(true);
          }
          if (newState === SdkAgentState.SPEAKING) {
            onListeningChange?.(false);
          }
        },
        startCallback: async () => {
          setConnected(true);
          onConnected?.();
        },
        endCallback: async () => {
          setConnected(false);
          onListeningChange?.(false);
          onAgentState?.(null);
        },
      });

      agentRef.current = agent;
      await agent.start();
      const ok = await agent.waitForConnect(15);
      if (!ok) throw new Error("Samvaad connection timed out");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Samvaad failed to start";
      onError?.(message);
      await stop();
    } finally {
      setStarting(false);
    }
  }, [
    enabled,
    starting,
    onUserTranscript,
    onBotTranscript,
    onAgentState,
    onListeningChange,
    onVolume,
    onConnected,
    onError,
    stop,
  ]);

  useEffect(() => {
    if (!enabled) {
      void stop();
      return;
    }
    void start();
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const agent = agentRef.current;
    if (!agent || !connected) return;
    if (paused) {
      agent.mute();
      onListeningChange?.(false);
    } else {
      agent.unmute();
    }
  }, [paused, connected, onListeningChange]);

  return {
    connected,
    starting,
    stop,
    restart: async () => {
      await stop();
      await start();
    },
  };
}
