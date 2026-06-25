"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TEST_PROMPTS = [
  "What is the price?",
  "What is the carpet area?",
  "Is this RERA approved?",
  "When is possession?",
  "Can NRIs buy this?",
  "Is parking included?",
  "What is the booking amount?",
];

export function AITestConsole({ propertyId }: { propertyId: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    answer: string;
    confidenceScore: number;
    fallbackUsed: boolean;
    sensitiveTopic: boolean;
    retrievedSources: { title: string; category: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function test(q: string) {
    setLoading(true);
    setQuery(q);
    const res = await fetch("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, query: q }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Test Console</CardTitle>
          <p className="text-sm text-muted-foreground">Test zero-hallucination answers before publishing</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TEST_PROMPTS.map((p) => (
              <Button key={p} size="sm" variant="outline" onClick={() => test(p)} disabled={loading}>{p}</Button>
            ))}
          </div>
          <textarea className="w-full rounded-md border p-3 text-sm" rows={3} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Custom test question…" />
          <Button onClick={() => test(query)} disabled={!query || loading}>{loading ? "Testing…" : "Run Test"}</Button>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader><CardTitle>Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{result.answer}</p>
            <div className="flex gap-2">
              <Badge variant="outline">Confidence {Math.round(result.confidenceScore * 100)}%</Badge>
              {result.fallbackUsed && <Badge variant="warning">Fallback</Badge>}
              {result.sensitiveTopic && <Badge variant="destructive">Sensitive</Badge>}
            </div>
            {result.retrievedSources?.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Sources:</p>
                {result.retrievedSources.map((s, i) => (
                  <p key={i} className="text-xs text-muted-foreground">[{s.category}] {s.title}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
