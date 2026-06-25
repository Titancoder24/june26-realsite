"use client";

import type { RefObject } from "react";
import { Orb } from "@/components/ui/orb";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Waveform } from "@/components/ui/waveform";
import type { AgentState } from "@/components/ui/orb";
import type { VoiceModeState, VoiceModeTurn } from "@/lib/voice-mode/types";
import { voiceModeStateLabel } from "@/lib/voice-mode/types";

type VoiceModeOrbShellProps = {
  voiceState: VoiceModeState;
  statusHint?: string;
  orbAgentState: AgentState;
  inputVolumeRef: RefObject<number>;
  outputVolumeRef: RefObject<number>;
  inputVolume?: number;
  orbScale?: number;
  turns: VoiceModeTurn[];
  liveTranscript: string;
  showWaveform: boolean;
  waveformBars: number[];
  errorMessage?: string | null;
  onOrbClick?: () => void;
  orbInteractive?: boolean;
};

export function VoiceModeOrbShell({
  voiceState,
  statusHint,
  orbAgentState,
  inputVolumeRef,
  outputVolumeRef,
  inputVolume = 0,
  orbScale = 1,
  turns,
  liveTranscript,
  showWaveform,
  waveformBars,
  errorMessage,
  onOrbClick,
  orbInteractive = false,
}: VoiceModeOrbShellProps) {
  const status = errorMessage?.trim() || voiceModeStateLabel(voiceState, statusHint);
  const recentTurns = turns.slice(-2);

  return (
    <div className="wt-voice-mode" aria-label="Property voice guide">
      {(recentTurns.length > 0 || liveTranscript.trim()) && (
        <div className="wt-voice-mode-transcript" aria-live="polite">
          {recentTurns.map((turn, index) => (
            <p key={`${turn.role}-${index}-${turn.content.slice(0, 24)}`} className="wt-voice-mode-turn">
              <span className="wt-voice-mode-turn-label">{turn.role === "user" ? "You" : "Guide"}</span>
              <span className="wt-voice-mode-turn-text">{turn.content}</span>
            </p>
          ))}
          {liveTranscript.trim() && (voiceState === "TRANSCRIBING" || voiceState === "LISTENING") && (
            <p className="wt-voice-mode-turn wt-voice-mode-turn-live">
              <span className="wt-voice-mode-turn-label">You</span>
              <span className="wt-voice-mode-turn-text">{liveTranscript.trim()}</span>
            </p>
          )}
        </div>
      )}

      <div className="wt-voice-mode-orb-block">
        {showWaveform && (
          <div className="wt-voice-mode-wave" aria-hidden>
            <Waveform
              data={waveformBars}
              height={28}
              barWidth={3}
              barGap={2}
              barRadius={2}
              fadeEdges
              className="text-indigo-300/90"
            />
          </div>
        )}

        {orbInteractive && onOrbClick ? (
          <button
            type="button"
            className="wt-voice-mode-orb-btn"
            onClick={onOrbClick}
            aria-label="Tap to start voice guide"
          >
            <div
              className="wt-voice-mode-orb-wrap"
              style={{
                transform: `scale(${orbScale})`,
                transition: "transform 0.12s ease-out",
              }}
            >
              <Orb
                agentState={orbAgentState}
                volumeMode={
                  orbAgentState === "talking" || orbAgentState === "thinking" ? "auto" : "manual"
                }
                manualInput={inputVolume}
                inputVolumeRef={inputVolumeRef}
                outputVolumeRef={outputVolumeRef}
                colors={["#6366f1", "#a5b4fc"]}
                className="h-full w-full"
              />
            </div>
          </button>
        ) : (
          <div
            className="wt-voice-mode-orb-wrap"
            style={{
              transform: `scale(${orbScale})`,
              transition: "transform 0.12s ease-out",
            }}
          >
            <Orb
              agentState={orbAgentState}
              volumeMode={
                orbAgentState === "talking" || orbAgentState === "thinking" ? "auto" : "manual"
              }
              manualInput={inputVolume}
              inputVolumeRef={inputVolumeRef}
              outputVolumeRef={outputVolumeRef}
              colors={["#6366f1", "#a5b4fc"]}
              className="h-full w-full"
            />
          </div>
        )}

        <div className="wt-voice-mode-status">
          {voiceState === "THINKING" || voiceState === "GREETING" ? (
            <ShimmeringText text={status} className="text-xs font-medium text-white/90" />
          ) : (
            <p className="text-xs font-medium text-white/90">{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
