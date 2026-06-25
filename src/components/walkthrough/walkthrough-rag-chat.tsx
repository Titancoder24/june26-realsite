"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PropertyKnowledgeSummary } from "@/components/walkthrough/property-knowledge-summary";
import type { StructuredPropertyKnowledge } from "@/types/property-knowledge";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  hasExtraction?: boolean;
}

export function WalkthroughRagChat({
  experienceId,
  propertyId,
  onKnowledgeChange,
}: {
  experienceId: string;
  propertyId: string;
  onKnowledgeChange?: (knowledge: StructuredPropertyKnowledge | null) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Share property details in plain language — price, size, amenities, possession, RERA, FAQs. I'll extract structured knowledge you can review and edit below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);
  const [structuredKnowledge, setStructuredKnowledge] = useState<StructuredPropertyKnowledge | null>(null);
  const [attachments, setAttachments] = useState<
    { name: string; text?: string; mime?: string; data_base64?: string }[]
  >([]);

  const loadKnowledge = useCallback(async () => {
    setLoadingKnowledge(true);
    try {
      const res = await fetch(`/api/walkthrough/rag/knowledge?propertyId=${propertyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load knowledge");
      setStructuredKnowledge(data.structured_knowledge ?? null);
      onKnowledgeChange?.(data.structured_knowledge ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load property knowledge");
    } finally {
      setLoadingKnowledge(false);
    }
  }, [propertyId, onKnowledgeChange]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  function handleKnowledgeUpdate(next: StructuredPropertyKnowledge) {
    setStructuredKnowledge(next);
    onKnowledgeChange?.(next);
  }

  async function send() {
    if (!input.trim() && !attachments.length) return;
    const userMsg = input.trim();
    setMessages((m) => [...m, { role: "user", content: userMsg || "(attached files)" }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/walkthrough/rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_id: experienceId,
          property_id: propertyId,
          session_id: sessionId ?? undefined,
          message: userMsg || "Please extract knowledge from the attached content.",
          attachments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      if (data.session_id) setSessionId(data.session_id);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply,
          hasExtraction: Boolean(data.structured_knowledge),
        },
      ]);
      setAttachments([]);

      if (data.structured_knowledge) {
        setStructuredKnowledge(data.structured_knowledge);
        onKnowledgeChange?.(data.structured_knowledge);
      }

      if (data.entries_saved > 0) {
        toast.success(`Extracted and saved property knowledge (${data.entries_saved} additional RAG entries)`);
      } else if (data.structured_knowledge) {
        toast.success("Property knowledge extracted — review and edit below");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  }

  async function onFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf");
      const isText =
        file.type.startsWith("text/")
        || lower.endsWith(".txt")
        || lower.endsWith(".md")
        || lower.endsWith(".csv")
        || lower.endsWith(".json");

      if (!isPdf && !isText) {
        toast.error(`${file.name}: use PDF or text files.`);
        continue;
      }

      try {
        if (isText && file.size < 512_000) {
          const text = await file.text();
          setAttachments((a) => [...a, { name: file.name, text }]);
        } else {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Read failed"));
            reader.readAsDataURL(file);
          });
          const data_base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
          setAttachments((a) => [...a, { name: file.name, mime: file.type || (isPdf ? "application/pdf" : "text/plain"), data_base64 }]);
        }
        toast.success(`Attached ${file.name}`);
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }
    e.target.value = "";
  }

  return (
    <div className="wt-rag-layout">
      <div className="wt-rag-chat">
        <div className="wt-rag-messages">
          {messages.map((m, i) => (
            <div key={i}>
              <div className="wt-rag-bubble" data-role={m.role}>
                {m.content}
              </div>
              {m.hasExtraction && i === messages.length - 1 && structuredKnowledge && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Structured facts are shown in the summary card below — edit anything that looks wrong.
                </p>
              )}
            </div>
          ))}
          {attachments.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Attached: {attachments.map((a) => a.name).join(", ")}
            </div>
          )}
        </div>
        <div className="wt-rag-input">
          <label className="cursor-pointer rounded-md border p-2 hover:bg-muted">
            <Paperclip className="h-4 w-4" />
            <input type="file" accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/*" className="hidden" multiple onChange={onFileAttach} />
          </label>
          <textarea
            placeholder="e.g. 3BHK from ₹1.4 Cr, 1650 sq ft, possession Dec 2027, clubhouse, gym, pool…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button size="icon" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loadingKnowledge ? (
        <div className="wt-pk-summary wt-pk-summary--loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading property knowledge…</span>
        </div>
      ) : (
        <PropertyKnowledgeSummary
          propertyId={propertyId}
          experienceId={experienceId}
          knowledge={structuredKnowledge}
          onKnowledgeChange={handleKnowledgeUpdate}
          mode="edit"
          description="Verify extracted facts before publishing. Edits are saved to the AI knowledge base."
        />
      )}
    </div>
  );
}
