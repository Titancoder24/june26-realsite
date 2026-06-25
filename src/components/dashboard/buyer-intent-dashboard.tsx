"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { IntentScoreExplainer } from "@/components/crm/intent-score-explainer";

interface Lead {
  id: string;
  name?: string;
  properties?: { name: string };
  intent_score?: number;
  lead_status?: string;
  source?: string;
  intent_signals?: { type: string; weight: number; description: string }[];
}

export function BuyerIntentDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [topLead, setTopLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(typeof data?.error === "string" ? data.error : "Failed to load leads");
          setLeads([]);
          setTopLead(null);
          return;
        }
        if (!Array.isArray(data)) {
          setError("Unexpected response from leads API");
          setLeads([]);
          setTopLead(null);
          return;
        }
        setError(null);
        setLeads(data);
        setTopLead(data[0] ?? null);
      })
      .catch(() => {
        setError("Failed to load leads");
        setLeads([]);
        setTopLead(null);
      });
  }, []);

  const hotCount = leads.filter((l) => (l.intent_score ?? 0) >= 80).length;
  const avgIntent = leads.length ? Math.round(leads.reduce((s, l) => s + (l.intent_score ?? 0), 0) / leads.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title">Lead Pipeline</h1>
          <p className="type-body text-muted-foreground">Live lead data from buyer sessions</p>
        </div>
        <button type="button" onClick={() => { window.location.href = "/api/leads/export"; }} className="w-full rounded-md border px-3 py-2.5 text-sm hover:bg-muted sm:w-auto">Export CSV</button>
      </div>
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
      <div className="stat-card-grid">
        {[
          { label: "Total Leads", value: leads.length },
          { label: "Hot Leads", value: hotCount },
          { label: "Callbacks", value: leads.filter((l) => l.lead_status === "callback_requested").length },
          { label: "Avg Intent", value: `${avgIntent}%` },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardDescription>{k.label}</CardDescription></CardHeader>
            <CardContent><div className="metric-value metric-value--compact">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Leads</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {leads.map((lead) => (
              <Link key={lead.id} href={`/dashboard/leads/${lead.id}`} className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="flex-1">
                  <p className="font-medium">{lead.name ?? "Anonymous"}</p>
                  <p className="text-sm text-muted-foreground">{lead.properties?.name} · {lead.source ?? "direct"}</p>
                </div>
                <div className="w-24">
                  <Progress value={lead.intent_score ?? 0} />
                  <p className="mt-1 text-center text-xs">{lead.intent_score ?? 0}</p>
                </div>
                <Badge variant={(lead.intent_score ?? 0) >= 80 ? "success" : "secondary"}>{lead.lead_status}</Badge>
              </Link>
            ))}
            {!leads.length && <p className="text-sm text-muted-foreground">No leads yet. Share a published buyer link.</p>}
          </CardContent>
        </Card>
        {topLead && (
          <Card>
            <CardHeader>
              <CardTitle>Top Lead</CardTitle>
              <CardDescription>{topLead.name ?? "Anonymous"} — {topLead.intent_score ?? 0}/100</CardDescription>
            </CardHeader>
            <CardContent>
              <IntentScoreExplainer score={topLead.intent_score ?? 0} signals={topLead.intent_signals ?? []} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
