"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { Input } from "@/components/ui/input";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Message, MessageContent } from "@/components/ui/message";
import { Orb } from "@/components/ui/orb";
import { Response } from "@/components/ui/response";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { WalkthroughVoiceProviderSettings } from "@/components/walkthrough/walkthrough-voice-provider-settings";
import { useVoiceAgentOrb } from "@/hooks/use-voice-agent-orb";
import {
  SARVAM_WALKTHROUGH_LANGUAGES,
  type SarvamWalkthroughLanguage,
} from "@/lib/sarvam-languages";
import {
  getVoiceProfileMeta,
  normalizeVoicePreferences,
  readVoicePreferences,
  storeVoicePreferences,
  viewerVoicePreferences,
  type WalkthroughVoiceProfile,
  type WalkthroughVoicePreferences,
} from "@/lib/walkthrough-voice-providers";
import type { WalkthroughBrainProvider } from "@/lib/walkthrough-brain-provider";
import { resolveBrainProvider } from "@/lib/walkthrough-brain-provider";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { Loader2, Mic, MicOff, Send, Volume2, X } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };

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
    voiceProfile: prefs.voiceProfile,
    speechLanguageCode: prefs.speechLanguageCode,
    chatLanguageCode: prefs.chatLanguageCode,
    brainProvider,
  };
}

export function WalkthroughVoicePanel({
  organizationId,
  propertyId,
  experienceId,
  sessionId,
  activeSceneId,
  lockedVoiceProfile,
  brainProvider: lockedBrainProvider,
  hideSettings = false,
  variant = "studio",
  onAnswer,
  onCommand,
  onClose,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  activeSceneId?: string;
  variant?: "studio" | "viewer";
  onAnswer?: (answer: string) => void;
  onCommand?: (command: WalkthroughAICommand | string) => void;
  onClose?: () => void;
  lockedVoiceProfile?: WalkthroughVoiceProfile;
  brainProvider?: WalkthroughBrainProvider;
  hideSettings?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [prefs, setPrefs] = useState<WalkthroughVoicePreferences>(() =>
    lockedVoiceProfile
      ? viewerVoicePreferences(lockedVoiceProfile)
      : normalizeVoicePreferences(readVoicePreferences(experienceId)),
  );
  const [indianLanguages, setIndianLanguages] = useState<SarvamWalkthroughLanguage[]>(
    SARVAM_WALKTHROUGH_LANGUAGES,
  );
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const liveLoopRef = useRef(false);
  const prefsRef = useRef(prefs);
  const brainProviderRef = useRef<WalkthroughBrainProvider>(
    lockedBrainProvider ?? resolveBrainProvider(experienceId),
  );

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    brainProviderRef.current = lockedBrainProvider ?? resolveBrainProvider(experienceId);
  }, [experienceId, lockedBrainProvider]);

  useEffect(() => {
    if (lockedVoiceProfile) {
      setPrefs(viewerVoicePreferences(lockedVoiceProfile));
      return;
    }
    const stored = normalizeVoicePreferences(readVoicePreferences(experienceId));
    setPrefs(stored);
    fetch("/api/walkthrough/voice")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.indianLanguages) && data.indianLanguages.length > 0) {
          setIndianLanguages(data.indianLanguages);
        }
      })
      .catch(() => {
        // static list already loaded
      });
  }, [experienceId, lockedVoiceProfile]);

  function updatePrefs(next: WalkthroughVoicePreferences) {
    const normalized = normalizeVoicePreferences(next);
    setPrefs(normalized);
    storeVoicePreferences(experienceId, normalized);
  }

  const {
    agentState,
    inputVolumeRef,
    outputVolumeRef,
    createMicAnalyser,
    startMicVolumeLoop,
    stopMicVolumeLoop,
    playAudioBlob,
    setThinking,
    reset,
  } = useVoiceAgentOrb();

  const profileMeta = getVoiceProfileMeta(prefs.voiceProfile);

  function applyCommand(commandRaw: WalkthroughAICommand | string | undefined) {
    if (!commandRaw || typeof commandRaw === "string") return;
    if (commandRaw.command && commandRaw.command !== "NONE") onCommand?.(commandRaw);
  }

  async function playVoiceResponse(res: Response, appendAssistant = true) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Voice request failed");
    }
    const answer = decodeHeader(res, "X-AI-Answer");
    const commandRaw = decodeHeader(res, "X-AI-Command");
    const transcript = decodeHeader(res, "X-AI-Transcript");

    if (transcript) {
      setMessages((m) => [...m, { role: "user", content: transcript }]);
      setInput(transcript);
    }

    const blob = await res.blob();
    await playAudioBlob(blob);

    if (answer && appendAssistant) {
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
      onAnswer?.(answer);
    }

    if (commandRaw) {
      try {
        const parsed = JSON.parse(commandRaw) as WalkthroughAICommand & { command?: string };
        applyCommand(parsed);
      } catch {
        // ignore
      }
    }
    return answer;
  }

  async function speakText(text: string, options?: { manageLoading?: boolean }) {
    const manageLoading = options?.manageLoading ?? true;
    if (manageLoading) {
      setLoading(true);
      setThinking();
    }
    try {
      const res = await fetch("/api/walkthrough/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          voiceRequestBody(prefsRef.current, brainProviderRef.current, {
            organizationId,
            propertyId,
            experienceId,
            speakOnly: true,
            text,
          }),
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Playback failed");
      }
      const blob = await res.blob();
      await playAudioBlob(blob);
    } catch (e) {
      reset();
      const msg = e instanceof Error ? e.message : "Playback failed";
      if (variant === "studio") toast.error(msg);
    } finally {
      if (manageLoading) setLoading(false);
    }
  }

  async function sendTextMessage(text: string) {
    if (!text.trim() || loading) return;
    const trimmed = text.trim();
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setThinking();
    try {
      const res = await fetch("/api/walkthrough/buyer-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          propertyId,
          experienceId,
          query: trimmed,
          activeSceneId,
          sessionId,
          brainProvider: brainProviderRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chat failed");

      const answer = typeof data.answer === "string" ? data.answer.trim() : "";
      if (answer) {
        setMessages((m) => [...m, { role: "assistant", content: answer }]);
        onAnswer?.(answer);
      }
      applyCommand(data.command);

      const shouldSpeak = variant === "viewer" || prefsRef.current.liveConversation;
      if (answer && shouldSpeak) {
        await speakText(answer, { manageLoading: false });
      } else {
        reset();
      }
    } catch (e) {
      reset();
      const msg = e instanceof Error ? e.message : "Chat failed";
      setMessages((m) => [...m, { role: "assistant", content: msg }]);
      if (variant === "studio") toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    if (loading || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const analyser = await createMicAnalyser(stream);
      startMicVolumeLoop(stream, analyser);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopMicVolumeLoop();
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!blob.size) {
          setRecording(false);
          return;
        }
        setLoading(true);
        setThinking();
        try {
          const form = new FormData();
          form.append("audio", blob, "question.webm");
          form.append("organizationId", organizationId);
          form.append("propertyId", propertyId);
          form.append("experienceId", experienceId);
          if (sessionId) form.append("sessionId", sessionId);
          if (activeSceneId) form.append("activeSceneId", activeSceneId);
          form.append("voiceProfile", prefsRef.current.voiceProfile);
          form.append("speechLanguageCode", prefsRef.current.speechLanguageCode);
          form.append("chatLanguageCode", prefsRef.current.chatLanguageCode);
          form.append("brainProvider", brainProviderRef.current);
          const res = await fetch("/api/walkthrough/voice", { method: "POST", body: form });
          await playVoiceResponse(res);
          if (variant === "studio") toast.success("Voice response played");
          if (prefsRef.current.liveConversation && liveLoopRef.current) {
            startRecording();
          }
        } catch (e) {
          reset();
          liveLoopRef.current = false;
          const msg = e instanceof Error ? e.message : "Voice input failed";
          setMessages((m) => [...m, { role: "assistant", content: msg }]);
          if (variant === "studio") toast.error(msg);
        } finally {
          setLoading(false);
          setRecording(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      reset();
      liveLoopRef.current = false;
      const msg = "Microphone access denied";
      setMessages((m) => [...m, { role: "assistant", content: msg }]);
      if (variant === "studio") toast.error(msg);
    }
  }

  function stopRecording() {
    liveLoopRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function toggleLiveMic() {
    if (recording) {
      stopRecording();
      return;
    }
    liveLoopRef.current = prefs.liveConversation;
    startRecording();
  }

  const displayAgentState =
    loading && agentState === null ? "thinking" : agentState;

  const stateLabel =
    agentState === "listening"
      ? prefs.liveConversation
        ? "Listening — speak now…"
        : "Listening…"
      : agentState === "thinking"
        ? "Thinking…"
        : agentState === "talking"
          ? "Speaking…"
          : prefs.liveConversation
            ? "Tap mic for live conversation"
            : "Ask about this property";

  const shellClass =
    variant === "viewer" ? "flex h-full flex-col bg-background" : "space-y-4";

  return (
    <div className={shellClass}>
      {variant === "viewer" && (
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium">Property AI</p>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close chat">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <Card className={variant === "viewer" ? "flex flex-1 flex-col gap-0 overflow-hidden border-0 shadow-none" : "overflow-hidden"}>
        <CardContent className={variant === "viewer" ? "relative flex flex-1 flex-col overflow-hidden p-0" : "p-0"}>
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted/40">
              <Orb
                agentState={displayAgentState}
                volumeMode="manual"
                manualInput={inputVolumeRef.current}
                manualOutput={outputVolumeRef.current}
                inputVolumeRef={inputVolumeRef}
                outputVolumeRef={outputVolumeRef}
                colors={prefs.voiceProfile === "indian-languages" ? ["#f97316", "#fdba74"] : ["#6366f1", "#a5b4fc"]}
                className="h-full w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              {loading && agentState !== "talking" ? (
                <ShimmeringText text={stateLabel} className="text-sm font-medium" />
              ) : (
                <p className="text-sm font-medium">{stateLabel}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {profileMeta.title} · {profileMeta.poweredBy}
              </p>
            </div>
          </div>

          {!hideSettings && (
            <WalkthroughVoiceProviderSettings
              prefs={prefs}
              onChange={updatePrefs}
              indianLanguages={indianLanguages}
            />
          )}

          {(recording || agentState === "talking") && (
            <div className="border-b px-4 py-2">
              <LiveWaveform
                active={recording}
                processing={agentState === "talking"}
                height={48}
                barColor="hsl(var(--primary))"
                className="w-full"
              />
            </div>
          )}

          <Conversation className={variant === "viewer" ? "flex-1 min-h-0" : "h-56"}>
            <ConversationContent className="flex min-w-0 flex-col gap-1 p-4">
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={
                    <Orb
                      className="size-10"
                      colors={prefs.voiceProfile === "indian-languages" ? ["#f97316", "#fdba74"] : ["#6366f1", "#a5b4fc"]}
                    />
                  }
                  title="Chat with Property AI"
                  description="Type a question or tap the mic for speech-to-speech. Replies are spoken in preview."
                />
              ) : (
                messages.map((message, index) => (
                  <Message key={index} from={message.role}>
                    <MessageContent className="max-w-[85%] min-w-0">
                      <Response className="w-auto [overflow-wrap:anywhere] whitespace-pre-wrap text-sm">
                        {message.content}
                      </Response>
                    </MessageContent>
                    {message.role === "assistant" && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        disabled={loading}
                        onClick={() => speakText(message.content)}
                      >
                        <Volume2 className="h-4 w-4" />
                      </Button>
                    )}
                  </Message>
                ))
              )}
              {loading && agentState !== "talking" && messages.length > 0 && (
                <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <ShimmeringText text="Thinking…" />
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="flex items-center gap-2 border-t p-4">
            <Input
              placeholder="Type or use mic for speech-to-speech…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && !recording) sendTextMessage(input);
              }}
              disabled={loading || recording}
              className="min-h-[44px]"
            />
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0 border-2 bg-background"
              disabled={loading && !recording}
              onClick={toggleLiveMic}
              aria-label={recording ? "Stop recording" : "Start voice input"}
            >
              {loading && !recording ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : recording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
              disabled={loading || recording || !input.trim()}
              onClick={() => sendTextMessage(input)}
              aria-label="Send message"
            >
              {loading && !recording ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
