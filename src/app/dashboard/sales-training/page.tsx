"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Overview = {
  totals?: { sessions: number; voiceCalls: number; averageReadiness: number; managerAlerts: number };
  readinessTrend: { label: string; score: number }[];
  skillBreakdown: { label: string; value: number }[];
  managerRows: { agent: string; readiness: number; sessions: number; focus: string; trend: string }[];
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold text-slate-950">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ReadinessTrend({ rows }: { rows: { label: string; score: number }[] }) {
  const safeRows = rows.length ? rows : [{ label: "No data", score: 0 }];
  const points = safeRows.map((row, i) => {
    const x = safeRows.length === 1 ? 50 : (i / (safeRows.length - 1)) * 100;
    const y = 100 - row.score;
    return `${x},${y}`;
  }).join(" ");

  return (
    <Card className="bi-finance-card lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">Readiness Trend</CardTitle>
          <p className="text-sm text-muted-foreground">Live team progression from stored text and voice training sessions.</p>
        </div>
        <span className="bi-soft-select">Line chart</span>
      </CardHeader>
      <CardContent>
        <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
          <defs>
            <linearGradient id="salesTrainingTrend" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="2 2" />)}
          <polygon points={`0,100 ${points} 100,100`} fill="url(#salesTrainingTrend)" />
          <polyline points={points} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </svg>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          {safeRows.map((row) => <span key={row.label}>{row.label}</span>)}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesTrainingPage() {
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/sales-training/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setOverview(data))
      .catch(() => {});
  }, []);

  const totals = overview?.totals;
  const skillRows = overview?.skillBreakdown?.length ? overview.skillBreakdown : [
    { label: "Discovery", value: 0 },
    { label: "Objections", value: 0 },
    { label: "Knowledge", value: 0 },
    { label: "Empathy", value: 0 },
    { label: "Closing", value: 0 },
    { label: "Compliance", value: 0 },
  ];

  return (
    <RoleGuard minRole="sales_agent">
      <div className="bi-dashboard bi-module-shell p-6">
        <div className="bi-module-hero">
          <div>
            <p className="bi-module-kicker">Sales Training</p>
            <h1>Training performance dashboard</h1>
            <p>
              Manager-ready reporting for every AI roleplay, voice call, readiness score, skill gap, and coaching summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full bg-slate-950 text-white hover:bg-slate-800">
              <Link href="/dashboard/sales-training/chat">
                Open Chat Training <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <span className="bi-soft-select">Live coaching</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bi-finance-card bi-finance-card-blue"><CardContent className="p-5"><p className="bi-finance-label">Average Readiness</p><p className="bi-finance-value">{totals?.averageReadiness ?? 0}</p><p className="text-xs text-muted-foreground">From real assessments</p></CardContent></Card>
          <Card className="bi-finance-card bi-finance-card-green"><CardContent className="p-5"><p className="bi-finance-label">Practice Sessions</p><p className="bi-finance-value">{totals?.sessions ?? 0}</p><p className="text-xs text-muted-foreground">Text + voice drills</p></CardContent></Card>
          <Card className="bi-finance-card bi-finance-card-orange"><CardContent className="p-5"><p className="bi-finance-label">Voice Calls</p><p className="bi-finance-value">{totals?.voiceCalls ?? 0}</p><p className="text-xs text-muted-foreground">Voice transcripts logged</p></CardContent></Card>
          <Card className="bi-finance-card bi-finance-card-purple"><CardContent className="p-5"><p className="bi-finance-label">Manager Alerts</p><p className="bi-finance-value">{totals?.managerAlerts ?? 0}</p><p className="text-xs text-muted-foreground">Readiness below 75</p></CardContent></Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <ReadinessTrend rows={overview?.readinessTrend ?? []} />
          <Card className="bi-finance-card">
            <CardHeader><CardTitle className="text-base">Latest Skill Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {skillRows.map((row) => <ScoreBar key={row.label} label={row.label} value={row.value} />)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="bi-finance-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" /> Manager readiness board</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(overview?.managerRows ?? []).map((row) => (
                <div key={row.agent} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <div>
                    <p className="font-semibold">{row.agent}</p>
                    <p className="text-xs text-muted-foreground">{row.sessions} drills · Focus: {row.focus}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{row.readiness}</p>
                    <p className="text-xs text-emerald-600">{row.trend}</p>
                  </div>
                </div>
              ))}
              {!overview?.managerRows?.length && <p className="text-sm text-muted-foreground">No training sessions yet. Start from Chat Training.</p>}
            </CardContent>
          </Card>

          <Card className="bi-finance-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Operational training system</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>All chat messages, buyer replies, coach notes, voice transcripts, datasets, and assessments are saved with organization-scoped access controls.</p>
              <p>The chat module supports scenario selection, easy/medium/hard/elite difficulty, text training, voice training, and PDF or pasted context datasets.</p>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/dashboard/sales-training/chat"><MessageCircle className="mr-2 h-4 w-4" /> Launch Chat Training</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
