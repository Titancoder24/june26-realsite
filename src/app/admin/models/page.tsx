"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ModelsAdminPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch("/api/admin/models").then((r) => r.json()).then(setConfig);
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="section-title">Model & Voice Settings</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>OpenRouter</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries((config?.openrouter as Record<string, string>) ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono text-xs">{v}</span></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>ElevenLabs</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries((config?.elevenlabs as Record<string, string>) ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono text-xs">{v}</span></div>
              ))}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
