"use client";

import { useEffect, useState } from "react";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { RevenueChart } from "@/components/revenue-chart";
import { DashboardStats } from "@/components/stats";
import { aggregateCampaignMix } from "@/lib/analytics/aggregate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Campaign = {
  id: string;
  utm_campaign?: string;
  url?: string;
  properties?: { name: string };
  sessions?: number;
  leads?: number;
  hotLeads?: number;
};

export function CampaignPerformanceDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [sessionSeries, setSessionSeries] = useState<{ date: string; revenue: number }[]>([]);
  const [form, setForm] = useState({ property_id: "", utm_source: "whatsapp", utm_medium: "social", utm_campaign: "" });

  useEffect(() => {
    fetch("/api/campaigns").then((r) => r.json()).then(setCampaigns).catch(() => {});
    fetch("/api/properties").then((r) => r.json()).then(setProperties);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.sessionsByDay) setSessionSeries(d.sessionsByDay);
      })
      .catch(() => {});
    fetch("/api/campaigns/analytics")
      .then((r) => r.json())
      .then((analytics) => {
        if (Array.isArray(analytics)) {
          setCampaigns((prev) => {
            const merged = prev.length
              ? prev.map((c) => {
                  const a = analytics.find((x: Campaign) => x.id === c.id);
                  return a ? { ...c, ...a } : c;
                })
              : analytics;
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const totalSessions = campaigns.reduce((s, c) => s + (c.sessions ?? 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + (c.leads ?? 0), 0);
  const totalHot = campaigns.reduce((s, c) => s + (c.hotLeads ?? 0), 0);
  const conversion = totalSessions > 0 ? ((totalLeads / totalSessions) * 100).toFixed(2) : "0";

  const stats = [
    { label: "Campaign sessions", value: String(totalSessions), delta: 0, hint: "all UTM links" },
    { label: "Leads captured", value: String(totalLeads), delta: 0, hint: "from campaigns" },
    { label: "Hot leads", value: String(totalHot), delta: 0, hint: "intent ≥ 80" },
    { label: "Conversion rate", value: `${conversion}%`, delta: 0, hint: "leads / sessions" },
  ];

  async function create() {
    const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    setCampaigns((c) => [data, ...c]);
    toast.success("Campaign link created");
  }

  return (
    <div className="bi-dashboard bi-module-shell p-6">
      <div className="bi-module-hero">
        <div>
          <p className="bi-module-kicker">Calls & Campaigns</p>
          <h1>Campaign report center</h1>
          <p>UTM campaign performance, session trends, call-ready lead conversion, and quick actions with the same modern report layout as Brochure Reports.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStats stats={stats} />
        <RevenueChart series={sessionSeries.length ? sessionSeries : undefined} title="Buyer sessions" valueLabel="Sessions" />
        <CategoryRankChart
          data={aggregateCampaignMix(campaigns)}
          title="Sessions by campaign"
          description="Share of sessions per UTM campaign"
        />
        <CampaignQuickActions onExport={() => { window.location.href = "/api/leads/export"; }} />
      </div>

      <Card className="bi-finance-card">
        <CardHeader className="flex flex-row items-start justify-between"><CardTitle className="text-base">Create campaign link</CardTitle><span className="bi-soft-select">Generator</span></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <select className="rounded-md border px-3 py-2 text-sm" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input placeholder="Campaign name" value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} />
          <Input placeholder="Source" value={form.utm_source} onChange={(e) => setForm({ ...form, utm_source: e.target.value })} />
          <Input placeholder="Medium" value={form.utm_medium} onChange={(e) => setForm({ ...form, utm_medium: e.target.value })} />
          <Button onClick={create} disabled={!form.property_id}>Generate Link</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id} className="bi-finance-card">
            <CardContent className="py-4">
              <p className="font-medium">{c.properties?.name} — {c.utm_campaign}</p>
              <p className="text-xs text-muted-foreground">{c.sessions ?? 0} sessions · {c.leads ?? 0} leads · {c.hotLeads ?? 0} hot</p>
              <p className="text-xs text-muted-foreground break-all">{c.url}</p>
            </CardContent>
          </Card>
        ))}
        {!campaigns.length && <Card className="bi-finance-card border-dashed"><CardContent className="py-8 text-sm text-muted-foreground">No campaigns yet. Create a UTM link above.</CardContent></Card>}
      </div>
    </div>
  );
}

function CampaignQuickActions({ onExport }: { onExport: () => void }) {
  const actions = [
    { title: "New campaign", description: "Scroll to link generator.", href: "#create", icon: null },
    { title: "View analytics", description: "Buyer experience dashboard.", href: "/dashboard/analytics", icon: null },
    { title: "Export leads", description: "Download CSV.", onClick: onExport },
    { title: "CRM leads", description: "Open lead pipeline.", href: "/dashboard/leads", icon: null },
  ];

  return (
    <Card className="bi-finance-card">
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((a) => (
          a.onClick ? (
            <button key={a.title} type="button" onClick={a.onClick} className="block w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/50">
              <p className="font-medium">{a.title}</p>
              <p className="text-muted-foreground">{a.description}</p>
            </button>
          ) : (
            <a key={a.title} href={a.href} className="block rounded-lg border p-3 text-sm hover:bg-muted/50">
              <p className="font-medium">{a.title}</p>
              <p className="text-muted-foreground">{a.description}</p>
            </a>
          )
        ))}
      </CardContent>
    </Card>
  );
}
