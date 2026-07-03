"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Database, FileText, Link as LinkIcon, Mic, Paperclip, Play, Plus, Send, Target, Upload } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Orb } from "@/components/ui/orb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VoiceButton } from "@/components/ui/voice-button";
import { Waveform } from "@/components/ui/waveform";
import {
  SALES_TRAINING_SCENARIOS,
  type SalesTrainingCoachResult,
  type SalesTrainingDifficulty,
  type SalesTrainingMessage,
  type SalesTrainingMode,
  type SalesTrainingScenarioId,
} from "@/lib/sales-training";

const initialMessages: SalesTrainingMessage[] = [
  {
    role: "buyer",
    content: "Hi, I saw the project brochure and virtual walkthrough. I want to know if it is worth visiting this weekend.",
  },
];

const demoWave = [0.18, 0.45, 0.32, 0.75, 0.48, 0.64, 0.28, 0.82, 0.54, 0.38, 0.66, 0.42, 0.7, 0.3, 0.58, 0.78];

type TrainingSessionRow = {
  id: string;
  scenario_id: string;
  scenario_title: string;
  training_mode: SalesTrainingMode;
  difficulty: SalesTrainingDifficulty;
  updated_at: string;
};

type DatasetRow = {
  id: string;
  title: string;
  source_type: "text" | "url" | "pdf" | "file";
  char_count: number;
  created_at: string;
};

export default function SalesTrainingChatPage() {
  const [scenarioId, setScenarioId] = useState<SalesTrainingScenarioId>("first-call");
  const [mode, setMode] = useState<SalesTrainingMode>("text");
  const [difficulty, setDifficulty] = useState<SalesTrainingDifficulty>("medium");
  const [sessions, setSessions] = useState<TrainingSessionRow[]>([]);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SalesTrainingMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [datasetText, setDatasetText] = useState("");
  const [datasetUrl, setDatasetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingDataset, setSavingDataset] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [coachResult, setCoachResult] = useState<SalesTrainingCoachResult | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scenario = useMemo(
    () => SALES_TRAINING_SCENARIOS.find((item) => item.id === scenarioId) ?? SALES_TRAINING_SCENARIOS[0],
    [scenarioId],
  );

  async function loadSessions() {
    const res = await fetch("/api/sales-training/sessions");
    const data = await res.json();
    if (res.ok) setSessions(data.sessions ?? []);
  }

  async function loadDatasets() {
    const res = await fetch("/api/sales-training/datasets");
    const data = await res.json();
    if (res.ok) setDatasets(data.datasets ?? []);
  }

  useEffect(() => {
    void loadSessions();
    void loadDatasets();
  }, []);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function createSession(nextMode = mode) {
    const res = await fetch("/api/sales-training/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId, mode: nextMode, difficulty, datasetIds: selectedDatasetIds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not create session");
    setCurrentSessionId(data.session.id);
    setMessages(data.messages?.length ? data.messages : initialMessages);
    setCoachResult(null);
    await loadSessions();
    return data.session.id as string;
  }

  async function openSession(sessionId: string) {
    const res = await fetch(`/api/sales-training/sessions/${sessionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load session");
    setCurrentSessionId(data.session.id);
    setScenarioId(data.session.scenario_id);
    setMode(data.session.training_mode);
    setDifficulty(data.session.difficulty);
    setSelectedDatasetIds((data.datasets ?? []).map((dataset: DatasetRow) => dataset.id));
    setMessages(data.messages.length ? data.messages : initialMessages);
    if (data.latestAssessment) {
      setCoachResult({
        buyerReply: "",
        coachNote: data.latestAssessment.manager_summary ?? "Loaded previous assessment.",
        readinessScore: data.latestAssessment.readiness_score,
        score: {
          discovery: data.latestAssessment.discovery_score,
          objectionHandling: data.latestAssessment.objection_score,
          productKnowledge: data.latestAssessment.product_knowledge_score,
          empathy: data.latestAssessment.empathy_score,
          closing: data.latestAssessment.closing_score,
          compliance: data.latestAssessment.compliance_score,
        },
        strengths: data.latestAssessment.strengths ?? [],
        improvements: data.latestAssessment.improvements ?? [],
        managerSummary: data.latestAssessment.manager_summary ?? "",
        nextDrill: data.latestAssessment.next_drill ?? "",
      });
    } else {
      setCoachResult(null);
    }
  }

  async function sendMessage(contentOverride?: string, inputMode: SalesTrainingMode = mode, sessionOverride?: string) {
    const content = (contentOverride ?? input).trim();
    if (!content || loading) return;
    setMessages((current) => [...current, { role: "agent", content, inputMode }]);
    setInput("");
    setLoading(true);
    try {
      const sessionId = sessionOverride ?? currentSessionId ?? await createSession(inputMode);
      const res = await fetch("/api/sales-training/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          scenarioId,
          input: content,
          conversation: messages,
          mode: inputMode,
          difficulty,
          datasetIds: selectedDatasetIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Coach failed");
      setCoachResult(data);
      setMessages((current) => [
        ...current,
        { role: "buyer", content: data.buyerReply, inputMode },
        { role: "coach", content: data.coachNote, inputMode },
      ]);
      setCurrentSessionId(data.sessionId);
      await loadSessions();
    } finally {
      setLoading(false);
    }
  }

  async function startVoiceRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    const sessionId = currentSessionId ?? await createSession("voice");
    setMode("voice");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      setRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "sales-training.webm");
      form.append("sessionId", sessionId);
      const voiceRes = await fetch("/api/sales-training/voice", { method: "POST", body: form });
      const voiceData = await voiceRes.json();
      if (voiceData.transcript) {
        await sendMessage(voiceData.transcript, "voice", sessionId);
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  async function speak(text: string) {
    setSpeaking(true);
    try {
      const res = await fetch("/api/sales-training/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Voice unavailable");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setSpeaking(false);
      await audioRef.current.play();
    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }

  async function saveTextDataset() {
    if (!datasetText.trim()) return;
    setSavingDataset(true);
    try {
      const res = await fetch("/api/sales-training/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "text", title: "Pasted sales context", content: datasetText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save dataset");
      setSelectedDatasetIds((current) => [...new Set([...current, data.dataset.id])]);
      setDatasetText("");
      await loadDatasets();
    } finally {
      setSavingDataset(false);
    }
  }

  async function saveUrlDataset() {
    if (!datasetUrl.trim()) return;
    setSavingDataset(true);
    try {
      const res = await fetch("/api/sales-training/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "url", title: datasetUrl, url: datasetUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save URL dataset");
      setSelectedDatasetIds((current) => [...new Set([...current, data.dataset.id])]);
      setDatasetUrl("");
      await loadDatasets();
    } finally {
      setSavingDataset(false);
    }
  }

  async function uploadDataset(file?: File) {
    if (!file) return;
    setSavingDataset(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const res = await fetch("/api/sales-training/datasets", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not upload dataset");
      setSelectedDatasetIds((current) => [...new Set([...current, data.dataset.id])]);
      await loadDatasets();
    } finally {
      setSavingDataset(false);
    }
  }

  function toggleDataset(id: string) {
    setSelectedDatasetIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <RoleGuard minRole="sales_agent">
      <div className="h-[calc(100dvh-7rem)] overflow-hidden bg-[#f7f7f8] p-3 md:h-[calc(100dvh-9rem)]">
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
          <aside className="flex min-h-0 flex-col rounded-3xl border bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Sales Training</p>
                <h1 className="text-lg font-bold">Chat</h1>
              </div>
              <Button size="icon" variant="outline" className="rounded-full" onClick={() => void createSession(mode)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button asChild variant="ghost" className="mb-2 h-9 w-full justify-start rounded-2xl">
              <Link href="/dashboard/sales-training"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
            </Button>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => void openSession(session.id)}
                  className={`w-full rounded-2xl p-2.5 text-left text-sm transition ${session.id === currentSessionId ? "bg-slate-950 text-white" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  <p className="font-semibold">{session.scenario_title}</p>
                  <p className="mt-1 text-xs opacity-70">{session.training_mode} · {session.difficulty}</p>
                </button>
              ))}
              {!sessions.length && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-muted-foreground">Your saved training history will appear here.</p>}
            </div>
          </aside>

          <main className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="shrink-0 border-b p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">AI roleplay workspace</p>
                  <h2 className="text-xl font-bold tracking-tight">{scenario.title}</h2>
                  <p className="text-sm text-muted-foreground">Practice with an AI buyer and get coaching grounded in your selected datasets.</p>
                </div>
                <span className="bi-soft-select">Live coaching</span>
              </div>
            </div>

            <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white via-white to-slate-50/60 p-4">
              <div className="mx-auto max-w-3xl space-y-3">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "agent" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[84%] rounded-3xl px-4 py-3 text-sm shadow-sm ${message.role === "agent" ? "bg-slate-950 text-white" : message.role === "coach" ? "bg-blue-50 text-blue-950" : "bg-slate-100 text-slate-800"}`}>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">{message.role}</p>
                      {message.content}
                    </div>
                  </div>
                ))}
                {loading && <p className="text-sm text-muted-foreground">Coach is evaluating and generating the next buyer reply...</p>}
              </div>
            </div>

            <div className="shrink-0 border-t bg-white/95 p-3">
              <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-[1.35rem] border border-slate-200 bg-white p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sendMessage();
                  }}
                  placeholder="Message the AI buyer as the sales agent..."
                  className="min-h-10 flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0"
                />
                <Button size="icon" className="mb-0.5 h-10 w-10 rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800" onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">Press Cmd/Ctrl + Enter to send. History is saved automatically.</p>
            </div>
          </main>

          <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
            <Card className="bi-finance-card">
              <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Training setup</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 p-4 pt-2">
                <Select value={scenarioId} onValueChange={(v) => {
                  setScenarioId(v as SalesTrainingScenarioId);
                  setMessages(initialMessages);
                  setCoachResult(null);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALES_TRAINING_SCENARIOS.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={mode} onValueChange={(v) => setMode(v as SalesTrainingMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text-based training</SelectItem>
                    <SelectItem value="voice">Voice-based training</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as SalesTrainingDifficulty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy tone</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-muted-foreground">
                  <p className="font-semibold text-slate-950">{scenario.buyerProfile}</p>
                  <p className="mt-1">{scenario.goal}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bi-finance-card">
              <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-base"><Mic className="h-4 w-4 text-primary" /> Voice coach</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-4 pt-2">
                <div className="relative h-32 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-inner">
                  <Orb className="absolute inset-0" agentState={speaking ? "talking" : loading ? "thinking" : "listening"} colors={["#2563eb", "#93c5fd"]} />
                </div>
                <Waveform data={demoWave} height={48} active={speaking || recording} barColor="#2563eb" className="rounded-2xl bg-blue-50 p-2" />
                <VoiceButton
                  className="w-full"
                  state={recording ? "recording" : speaking ? "processing" : "idle"}
                  label={recording ? "Stop and transcribe" : "Record voice answer"}
                  icon={<Mic className="h-4 w-4" />}
                  onPress={() => void startVoiceRecording()}
                />
                <Button variant="outline" className="w-full rounded-2xl" onClick={() => void speak(coachResult?.coachNote ?? "Start the drill and I will coach your sales response.")}>
                  <Play className="mr-2 h-4 w-4" /> Play coach feedback
                </Button>
              </CardContent>
            </Card>

            <Card className="bi-finance-card">
              <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> App dataset</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 p-4 pt-2">
                <Textarea
                  value={datasetText}
                  onChange={(e) => setDatasetText(e.target.value)}
                  placeholder="Paste brochure text, project data, objection notes, pricing rules, or buyer context..."
                  className="min-h-20 rounded-2xl"
                />
                <Button variant="outline" className="w-full rounded-2xl" disabled={savingDataset || !datasetText.trim()} onClick={() => void saveTextDataset()}>
                  <FileText className="mr-2 h-4 w-4" /> Save pasted context
                </Button>
                <div className="flex gap-2">
                  <input value={datasetUrl} onChange={(e) => setDatasetUrl(e.target.value)} placeholder="https://project-page.com" className="min-w-0 flex-1 rounded-2xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                  <Button size="icon" variant="outline" className="rounded-2xl" disabled={savingDataset || !datasetUrl.trim()} onClick={() => void saveUrlDataset()}>
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/*" className="hidden" onChange={(e) => void uploadDataset(e.target.files?.[0])} />
                <Button variant="outline" className="w-full rounded-2xl" disabled={savingDataset} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Upload PDF or text
                </Button>
                <div className="space-y-2">
                  {datasets.map((dataset) => (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => toggleDataset(dataset.id)}
                      className={`w-full rounded-2xl border p-3 text-left text-sm transition ${selectedDatasetIds.includes(dataset.id) ? "border-blue-300 bg-blue-50 text-blue-950" : "bg-white hover:bg-slate-50"}`}
                    >
                      <p className="flex items-center gap-2 font-semibold"><Paperclip className="h-3.5 w-3.5" /> {dataset.title}</p>
                      <p className="mt-1 text-xs opacity-70">{dataset.source_type} · {dataset.char_count.toLocaleString()} chars</p>
                    </button>
                  ))}
                  {!datasets.length && <p className="text-sm text-muted-foreground">Add a dataset to ground the AI in your office/project data.</p>}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </RoleGuard>
  );
}
