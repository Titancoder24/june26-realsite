"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIAgentOperationsDashboard } from "@/components/dashboard/ai-agent-operations-dashboard";
import { RoleGuard } from "@/components/auth/role-guard";

function Content() {
  const params = useSearchParams();
  const propertyId = params.get("propertyId");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState(propertyId ?? "");

  useEffect(() => {
    fetch("/api/properties").then((r) => r.json()).then((d) => {
      setProperties(d);
      if (!selected && d[0]) setSelected(d[0].id);
    });
  }, [selected]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">AI Agent Operations</h1>
        <p className="text-muted-foreground">RAG readiness, fallback monitoring, and test console</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Select Property</CardTitle></CardHeader>
        <CardContent>
          <Label className="sr-only">Property</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {selected && <AIAgentOperationsDashboard propertyId={selected} />}
    </div>
  );
}

export default function AIAgentPage() {
  return (
    <RoleGuard minRole="project_manager">
      <Suspense fallback={<p className="p-6 text-muted-foreground">Loading…</p>}>
        <Content />
      </Suspense>
    </RoleGuard>
  );
}
