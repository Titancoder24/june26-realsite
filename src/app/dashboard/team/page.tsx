"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleGuard } from "@/components/auth/role-guard";
import { toast } from "sonner";
import type { UserRole } from "@/types/domain";

type Agent = {
  id: string;
  full_name?: string;
  email?: string;
  role?: UserRole;
};

const ROLES: UserRole[] = [
  "viewer",
  "sales_agent",
  "marketing_manager",
  "sales_manager",
  "project_manager",
  "organization_admin",
];

export default function TeamPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/team/agents").then((r) => r.json()).then(setAgents).catch(() => {});
  }, []);

  async function updateRole(agentId: string, role: UserRole) {
    const res = await fetch("/api/team/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, role }),
    });
    if (!res.ok) return toast.error("Failed to update role");
    setAgents((list) => list.map((a) => (a.id === agentId ? { ...a, role } : a)));
    toast.success("Role updated");
  }

  return (
    <RoleGuard minRole="organization_admin">
      <div className="space-y-6">
        <div>
          <h1 className="section-title">Team & Roles</h1>
          <p className="text-muted-foreground">Manage organization members and RBAC</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{agent.full_name ?? "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{agent.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="sr-only">Role</Label>
                  <Select value={agent.role ?? "viewer"} onValueChange={(v) => updateRole(agent.id, v as UserRole)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline">{agent.role ?? "viewer"}</Badge>
                </div>
              </div>
            ))}
            {!agents.length && <p className="text-sm text-muted-foreground">No team members found.</p>}
          </CardContent>
        </Card>
        <Button variant="outline" asChild>
          <a href="/dashboard/settings">Organization settings</a>
        </Button>
      </div>
    </RoleGuard>
  );
}
