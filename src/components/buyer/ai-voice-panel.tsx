"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Mic, Send } from "lucide-react";

export function AIVoicePanel({
  organizationId,
  propertyId,
  sessionId,
  sceneId,
  onClose,
}: {
  organizationId: string;
  propertyId: string;
  sessionId: string;
  sceneId?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [fallback, setFallback] = useState(false);

  async function ask(text: string) {
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, propertyId, sessionId, sceneId, query: text }),
      });
      const data = await res.json();
      setAnswer(data.answer);
      setConfidence(data.confidenceScore);
      setFallback(data.fallbackUsed);
    } catch {
      setAnswer("Sorry, I could not process your question. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "What is the price?",
    "When is possession?",
    "Is this RERA approved?",
    "Can NRIs buy this?",
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl bg-card text-foreground shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-96 md:rounded-2xl">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <p className="font-semibold">AI Sales Agent</p>
          <p className="text-xs text-muted-foreground">Answers from approved property data only</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="max-h-64 overflow-y-auto p-4 space-y-3">
        {answer && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            {answer}
            <div className="mt-2 flex gap-2">
              {confidence !== null && <Badge variant="outline">Confidence {Math.round(confidence * 100)}%</Badge>}
              {fallback && <Badge variant="warning">Fallback</Badge>}
            </div>
          </div>
        )}
        {loading && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>

      <div className="flex flex-wrap gap-2 p-4 pt-0">
        {suggestions.map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => { setQuery(s); ask(s); }}>{s}</Button>
        ))}
      </div>

      <div className="flex gap-2 border-t p-4">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Ask about this property…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query && ask(query)}
        />
        <Button size="icon" onClick={() => query && ask(query)} disabled={loading}>
          <Send className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = async () => {
              stream.getTracks().forEach((t) => t.stop());
              const blob = new Blob(chunks, { type: "audio/webm" });
              const form = new FormData();
              form.append("audio", blob);
              form.append("organizationId", organizationId);
              form.append("propertyId", propertyId);
              form.append("sessionId", sessionId);
              const res = await fetch("/api/ai/voice", { method: "POST", body: form });
              if (res.ok) {
                const answer = decodeURIComponent(res.headers.get("X-AI-Answer") ?? "");
                setAnswer(answer);
                const audio = new Audio(URL.createObjectURL(await res.blob()));
                audio.play();
              }
            };
            recorder.start();
            setTimeout(() => recorder.stop(), 4000);
          } catch { setAnswer("Microphone access denied."); }
        }}><Mic className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
