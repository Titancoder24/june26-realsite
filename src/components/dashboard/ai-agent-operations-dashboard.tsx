"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AITestConsole } from "@/components/ai/ai-test-console";

type Readiness = {
  categories: { category: string; status: string; count: number }[];
  overallPercent: number;
  canPublish: boolean;
  missing: string[];
};

export function AIAgentOperationsDashboard({ propertyId }: { propertyId: string }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [stats, setStats] = useState({ fallbackRate: 0, aiQuestions: 0, voiceSessions: 0 });

  useEffect(() => {
    fetch(`/api/knowledge?propertyId=${propertyId}`)
      .then((r) => r.json())
      .then((payload: { entries?: { category: string; approved?: boolean }[] }) => {
        const entries = payload.entries ?? [];
        const cats = ["pricing", "rera", "possession", "amenities", "nri_process", "faq"];
        const categories = cats.map((category) => {
          const items = entries.filter((e) => e.category === category);
          const approved = items.filter((e) => e.approved !== false).length;
          const status = approved >= 2 ? "complete" : approved > 0 ? "partial" : "missing";
          return { category, status, count: approved };
        });
        const complete = categories.filter((c) => c.status === "complete").length;
        const overallPercent = Math.round((complete / categories.length) * 100);
        const missing = categories.filter((c) => c.status !== "complete").map((c) => c.category);
        setReadiness({
          categories,
          overallPercent,
          canPublish: overallPercent >= 70 && !missing.includes("pricing") && !missing.includes("rera"),
          missing,
        });
      })
      .catch(() => {});

    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        const events = d.eventCounts ?? {};
        const aiQ = events.ai_question ?? 0;
        const fallback = events.ai_fallback ?? 0;
        setStats({
          aiQuestions: aiQ,
          fallbackRate: aiQ > 0 ? Math.round((fallback / aiQ) * 100) : 0,
          voiceSessions: events.voice_session ?? 0,
        });
      })
      .catch(() => {});
  }, [propertyId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>AI Readiness</CardDescription></CardHeader>
          <CardContent>
            <p className="metric-value metric-value--compact">{readiness?.overallPercent ?? 0}%</p>
            <Progress value={readiness?.overallPercent ?? 0} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Fallback Rate</CardDescription></CardHeader>
          <CardContent><p className="metric-value metric-value--compact">{stats.fallbackRate}%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Voice Sessions</CardDescription></CardHeader>
          <CardContent><p className="metric-value metric-value--compact">{stats.voiceSessions}</p></CardContent>
        </Card>
      </div>

      {readiness && !readiness.canPublish && (
        <Alert variant="destructive">
          <AlertTitle>Publish gate — knowledge incomplete</AlertTitle>
          <AlertDescription>
            Add approved entries for: {readiness.missing.join(", ")}. Target 70%+ readiness with pricing and RERA complete.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Readiness</CardTitle>
          <CardDescription>Categories required for zero-hallucination AI</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(readiness?.categories ?? []).map((c) => (
            <div key={c.category} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
              <Badge variant={c.status === "complete" ? "success" : c.status === "partial" ? "warning" : "secondary"}>
                {c.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <AITestConsole propertyId={propertyId} />
    </div>
  );
}
