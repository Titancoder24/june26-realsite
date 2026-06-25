"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function EnginesAdminPage() {
  const [data, setData] = useState<{ globalDefault: string; organizations: { id: string; name: string; engine: string }[] } | null>(null);

  useEffect(() => {
    fetch("/api/admin/engines").then((r) => r.json()).then(setData);
  }, []);

  async function switchEngine(orgId: string, engine: string) {
    const res = await fetch("/api/admin/engines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId, defaultEngine: engine, reason: "Admin engine switch" }),
    });
    if (!res.ok) return toast.error("Failed");
    toast.success("Engine updated");
    fetch("/api/admin/engines").then((r) => r.json()).then(setData);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="section-title">Engine Control</h1>
        <Card>
          <CardHeader><CardTitle>Global Default: {data?.globalDefault}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data?.organizations.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded border p-3">
                <span>{o.name}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant={o.engine === "360_realistic" ? "default" : "outline"} onClick={() => switchEngine(o.id, "360_realistic")}>360°</Button>
                  <Button size="sm" variant={o.engine === "worldlabs_splat" ? "default" : "outline"} onClick={() => switchEngine(o.id, "worldlabs_splat")}>World Labs</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
    </div>
  );
}
