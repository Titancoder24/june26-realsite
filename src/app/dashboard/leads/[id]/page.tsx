"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadTimeline } from "@/components/crm/lead-timeline";
import { IntentScoreExplainer } from "@/components/crm/intent-score-explainer";
import { toast } from "sonner";

export default function LeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [data, setData] = useState<{
    lead: {
      name?: string; phone?: string; intent_score?: number; group_intent_score?: number;
      lead_status?: string; assigned_agent?: string; next_follow_up?: string;
      intent_signals?: { type: string; weight: number; description: string }[];
      properties?: { name: string };
    };
    events: { id: string; event_type: string; payload?: Record<string, unknown>; created_at: string }[];
    messages: { role: string; content: string; created_at: string }[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/leads/${id}`).then((r) => r.json()).then(setData);
    fetch("/api/team/agents").then((r) => r.json()).then(setAgents).catch(() => {});
  }, [id]);

  async function updateLead(patch: Record<string, unknown>) {
    const res = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) return toast.error("Update failed");
    const updated = await res.json();
    setData((d) => d ? { ...d, lead: { ...d.lead, ...updated } } : d);
    toast.success("Lead updated");
  }

  if (!data) return <p>Loading lead…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">{data.lead.name ?? "Anonymous Lead"}</h1>
          <p className="text-muted-foreground">{data.lead.properties?.name} · {data.lead.phone}</p>
        </div>
        <Badge variant={data.lead.intent_score && data.lead.intent_score >= 80 ? "success" : "secondary"}>
          {data.lead.lead_status} · Intent {data.lead.intent_score}
          {data.lead.group_intent_score ? ` · Group ${data.lead.group_intent_score}` : ""}
        </Badge>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Assign agent</label>
            <select className="mt-1 w-full rounded border px-2 py-2 text-sm" value={data.lead.assigned_agent ?? ""} onChange={(e) => updateLead({ assigned_agent: e.target.value })}>
              <option value="">Unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select className="mt-1 w-full rounded border px-2 py-2 text-sm" value={data.lead.lead_status ?? "new"} onChange={(e) => updateLead({ lead_status: e.target.value })}>
              {["new", "contacted", "qualified", "hot", "callback_requested", "lost", "converted"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Next follow-up</label>
            <Input type="datetime-local" className="mt-1" defaultValue={data.lead.next_follow_up?.slice(0, 16)} onChange={(e) => updateLead({ next_follow_up: new Date(e.target.value).toISOString() })} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="intent">Intent</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <Card><CardContent className="pt-6"><LeadTimeline events={data.events} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="ai">
          <Card><CardContent className="space-y-3 pt-6">
            {data.messages.map((m, i) => (
              <div key={i} className={`rounded p-3 text-sm ${m.role === "user" ? "bg-muted" : "bg-primary/5"}`}>
                <span className="text-xs font-medium uppercase">{m.role}</span>
                <p>{m.content}</p>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="intent">
          <Card><CardContent className="pt-6">
            <IntentScoreExplainer score={data.lead.intent_score ?? 0} signals={data.lead.intent_signals ?? []} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
