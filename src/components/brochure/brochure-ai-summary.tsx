"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BrochureAISummary({
  sessionId,
  initialSummary,
  recommendedAction,
  intentScore,
  leadStatus,
  aiSummary,
  loadingAi,
  onGenerate,
}: {
  sessionId: string;
  initialSummary?: string | null;
  recommendedAction?: string | null;
  intentScore: number;
  leadStatus: string;
  aiSummary: string | null;
  loadingAi: boolean;
  onGenerate: (sessionId: string) => void;
}) {
  const text =
    aiSummary ??
    initialSummary ??
    recommendedAction ??
    "Generate an AI summary to get follow-up advice based on pages and sections visible on screen.";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Sales Insight
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Intent {intentScore} / {leadStatus}
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={loadingAi} onClick={() => onGenerate(sessionId)}>
          {loadingAi ? "Generating…" : "Refresh summary"}
        </Button>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed">{text}</CardContent>
    </Card>
  );
}
