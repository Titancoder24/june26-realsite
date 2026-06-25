"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Job {
  id: string;
  status: string;
  operation_id?: string;
  retry_count?: number;
  properties?: { name: string };
  error_message?: string;
}

export default function WorldLabsAdminPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState({ queued: 0, processing: 0, succeeded: 0, failed: 0 });

  function load() {
    fetch("/api/admin/worldlabs/jobs").then((r) => r.json()).then((d) => {
      setJobs(d.jobs ?? []);
      setStats(d.stats ?? stats);
    }).catch(() => {});
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function retry(jobId: string) {
    const res = await fetch("/api/admin/worldlabs/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action: "retry" }),
    });
    if (!res.ok) return toast.error("Retry failed");
    toast.success("Retry started");
    load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="section-title">World Labs Operations</h1>
          <Badge variant="success">Live Data</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "In Queue", value: stats.queued },
            { label: "Processing", value: stats.processing },
            { label: "Succeeded", value: stats.succeeded },
            { label: "Failed", value: stats.failed },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">{s.label}</CardTitle></CardHeader>
              <CardContent><p className="metric-value metric-value--compact">{s.value}</p></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle>Jobs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{job.properties?.name ?? job.id}</p>
                  <p className="text-xs text-muted-foreground">Op: {job.operation_id ?? "—"} · Retries: {job.retry_count ?? 0}</p>
                  {job.error_message && <p className="text-xs text-destructive">{job.error_message}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={job.status.includes("failed") ? "destructive" : "secondary"}>{job.status}</Badge>
                  {job.status.includes("failed") && <Button size="sm" variant="outline" onClick={() => retry(job.id)}>Retry</Button>}
                </div>
              </div>
            ))}
            {!jobs.length && <p className="text-sm text-muted-foreground">No World Labs jobs yet.</p>}
          </CardContent>
        </Card>
    </div>
  );
}
