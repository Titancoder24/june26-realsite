"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  reason?: string;
  severity: string;
  created_at: string;
  profiles?: { full_name?: string; email?: string };
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch("/api/admin/audit-logs").then((r) => r.json()).then(setLogs).catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">{log.action}</p>
            <p className="text-xs text-muted-foreground">{log.profiles?.full_name ?? log.profiles?.email ?? "System"} · {log.reason}</p>
          </div>
          <div className="text-right">
            <Badge variant="outline">{log.severity}</Badge>
            <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</p>
          </div>
        </div>
      ))}
      {!logs.length && <p className="text-sm text-muted-foreground">No audit logs yet.</p>}
    </div>
  );
}
