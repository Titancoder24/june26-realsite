"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/http-json";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  resolveBrainProvider,
  type WalkthroughBrainProvider,
} from "@/lib/walkthrough-brain-provider";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatResponse = {
  answer?: string;
  command?: WalkthroughAICommand;
  suggestedFollowups?: string[];
  error?: string;
};

const DEFAULT_SUGGESTIONS = [
  "What's the price?",
  "Show me the kitchen",
  "What amenities are included?",
  "Book a site visit",
];

export function WalkthroughChatWidget({
  organizationId,
  propertyId,
  experienceId,
  sessionId,
  propertyName,
  viewerConfig,
  activeSceneId,
  onCommand,
  onTrack,
}: {
  organizationId: string;
  propertyId: string;
  experienceId: string;
  sessionId?: string;
  propertyName: string;
  viewerConfig?: Record<string, unknown> | null;
  activeSceneId?: string;
  onCommand: (cmd: WalkthroughAICommand) => void;
  onTrack?: (eventType: string, payload?: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi! I'm your guide for ${propertyName}. Ask me anything about the property, pricing, or amenities — or tell me which room you'd like to see.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [unread, setUnread] = useState(false);

  const brainProviderRef = useRef<WalkthroughBrainProvider>(
    resolveBrainProvider(experienceId, viewerConfig),
  );
  const activeSceneRef = useRef(activeSceneId);
  activeSceneRef.current = activeSceneId;

  useEffect(() => {
    brainProviderRef.current = resolveBrainProvider(experienceId, viewerConfig);
  }, [experienceId, viewerConfig]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setSending(true);
      onTrack?.("ai_chat_query", { query: text });

      try {
        const res = await fetchWithTimeout("/api/walkthrough/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            propertyId,
            experienceId,
            sessionId,
            query: text,
            activeSceneId: activeSceneRef.current,
            brainProvider: brainProviderRef.current,
          }),
        });

        const data = await readJsonResponse<ChatResponse>(res);
        if (!res.ok) throw new Error(data.error ?? "Chat request failed");

        const answer =
          data.answer?.trim() ||
          "I'm here to help — what would you like to know about this property?";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);

        if (Array.isArray(data.suggestedFollowups) && data.suggestedFollowups.length) {
          setSuggestions(data.suggestedFollowups.slice(0, 4));
        }

        if (data.command && data.command.command !== "NONE") {
          onCommand(data.command);
          onTrack?.("ai_chat_command", { command: data.command.command });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      } finally {
        setSending(false);
      }
    },
    [experienceId, onCommand, onTrack, organizationId, propertyId, sending, sessionId],
  );

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnread(false);
        onTrack?.("ai_chat_opened", {});
      }
      return next;
    });
  }, [onTrack]);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="wt-chat-fab"
          aria-label="Ask AI about this property"
          aria-expanded={open}
          onClick={toggleOpen}
        >
          <span className="wt-chat-fab-glow" aria-hidden />
          <Sparkles className="wt-chat-fab-icon" />
          <span className="wt-chat-fab-label">Ask&nbsp;AI</span>
          {unread && <span className="wt-chat-fab-dot" aria-hidden />}
        </button>
      )}

      {open && (
        <div className="wt-chat-panel" role="dialog" aria-label={`Chat about ${propertyName}`}>
          <div className="wt-chat-panel-header">
            <div className="wt-chat-panel-title">
              <span className="wt-chat-panel-avatar" aria-hidden>
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="wt-chat-panel-name">Property Assistant</p>
                <p className="wt-chat-panel-sub">{propertyName}</p>
              </div>
            </div>
            <button
              type="button"
              className="wt-chat-panel-close"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Conversation className="wt-chat-conversation">
            <ConversationContent className="wt-chat-messages">
              {messages.map((m, i) => (
                <Message from={m.role} key={`${m.role}-${i}`}>
                  <MessageContent variant="contained">
                    {m.role === "assistant" ? (
                      <Response>{m.content}</Response>
                    ) : (
                      <span>{m.content}</span>
                    )}
                  </MessageContent>
                </Message>
              ))}
              {sending && (
                <Message from="assistant">
                  <MessageContent variant="contained">
                    <span className="wt-chat-typing" aria-label="Assistant is typing">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {!sending && suggestions.length > 0 && (
            <div className="wt-chat-suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="wt-chat-chip"
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="wt-chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this property…"
              className="wt-chat-input"
              disabled={sending}
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              className="wt-chat-send"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
