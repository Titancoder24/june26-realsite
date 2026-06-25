"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Building2,
  Clapperboard,
  Globe2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInteger } from "@/components/formater";
import Link from "next/link";

type StatsPayload = {
  kpis: {
    totalUsers: number;
    totalOrganizations: number;
    totalExperiences: number;
    publishedExperiences: number;
    buyerSessions: number;
    buyerSessions7d: number;
    totalLeads: number;
    signupsLast7: number;
    signupsLast30: number;
    totalGenerations: number;
    apiCalls30d: number;
    liveBuyerSessions: number;
  };
  signupsByDay: { date: string; signups: number }[];
  sessionsByDay: { date: string; sessions: number }[];
  apiCallsByDay: { date: string; calls: number }[];
  generationsByType: { type: string; count: number }[];
  apiByProvider: { provider: string; calls: number }[];
  apiByOperation: { provider: string; operation: string; calls: number }[];
  roleBreakdown: { role: string; count: number }[];
  providerCredits: Record<string, { label: string; apiCalls: number; note: string }>;
  recentSignups: { id: string; email: string; full_name: string; role: string; created_at: string }[];
  organizations: { id: string; name: string; userCount: number; created_at: string }[];
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization: string;
  signed_up: string;
  last_sign_in: string | null;
  email_verified: boolean;
  account_status: string;
};

const signupsConfig = {
  signups: { label: "Signups", color: "var(--chart-1)" },
} satisfies ChartConfig;

const sessionsConfig = {
  sessions: { label: "Buyer sessions", color: "var(--chart-2)" },
} satisfies ChartConfig;

const apiConfig = {
  calls: { label: "API calls", color: "var(--chart-3)" },
} satisfies ChartConfig;

const genConfig = {
  count: { label: "Count", color: "var(--chart-4)" },
} satisfies ChartConfig;

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PlatformAnalyticsDashboard() {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/users?limit=100").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, u]) => {
        if (s) setStats(s);
        if (u?.users) setUsers(u.users);
      })
      .finally(() => setLoading(false));
  }, []);

  const kpis = stats?.kpis;

  const kpiCards = [
    { label: "Total users", value: kpis?.totalUsers ?? 0, icon: Users, hint: "Registered accounts" },
    { label: "Signups (7d)", value: kpis?.signupsLast7 ?? 0, icon: TrendingUp, hint: "New accounts this week" },
    { label: "Signups (30d)", value: kpis?.signupsLast30 ?? 0, icon: Users, hint: "New accounts this month" },
    { label: "Organizations", value: kpis?.totalOrganizations ?? 0, icon: Building2, hint: "Teams on platform" },
    { label: "Experiences", value: kpis?.totalExperiences ?? 0, icon: Globe2, hint: "All tours created" },
    { label: "Published tours", value: kpis?.publishedExperiences ?? 0, icon: Globe2, hint: "Live on web" },
    { label: "Buyer sessions", value: kpis?.buyerSessions ?? 0, icon: Activity, hint: "Viewer visits total" },
    { label: "Sessions (7d)", value: kpis?.buyerSessions7d ?? 0, icon: Activity, hint: "Recent viewer activity" },
    { label: "Live now", value: kpis?.liveBuyerSessions ?? 0, icon: Zap, hint: "Active in last 5 min" },
    { label: "Leads captured", value: kpis?.totalLeads ?? 0, icon: Users, hint: "Buyer inquiries" },
    { label: "AI generations", value: kpis?.totalGenerations ?? 0, icon: Sparkles, hint: "Plans, video, 3D" },
    { label: "API calls (30d)", value: kpis?.apiCalls30d ?? 0, icon: Clapperboard, hint: "Provider usage logged" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Platform Analytics</h1>
        <p className="type-body mt-1 text-muted-foreground">
          Users, signups, daily activity, AI generations, and API provider usage across the platform.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="metric-label">{kpi.label}</CardTitle>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="metric-value metric-value--compact">{formatInteger(kpi.value)}</div>
              <p className="type-caption mt-1">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="metric-value metric-value--hero">
              {formatInteger(stats?.signupsByDay.reduce((s, r) => s + r.signups, 0) ?? 0)}
            </CardTitle>
            <CardDescription>User signups — last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="aspect-auto h-52 w-full" config={signupsConfig}>
              <AreaChart data={stats?.signupsByDay ?? []} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
                <Area
                  type="monotone"
                  dataKey="signups"
                  stroke="var(--color-signups)"
                  fill="var(--color-signups)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="metric-value metric-value--hero">
              {formatInteger(stats?.sessionsByDay.reduce((s, r) => s + r.sessions, 0) ?? 0)}
            </CardTitle>
            <CardDescription>Buyer tour sessions — last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="aspect-auto h-52 w-full" config={sessionsConfig}>
              <AreaChart data={stats?.sessionsByDay ?? []} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  stroke="var(--color-sessions)"
                  fill="var(--color-sessions)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI generations by type</CardTitle>
            <CardDescription>Walkthrough plans, motion clips, enhancements, and 3D jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="aspect-auto h-56 w-full" config={genConfig}>
              <BarChart data={stats?.generationsByType ?? []} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="type" width={120} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="metric-value metric-value--hero">
              {formatInteger(stats?.apiCallsByDay.reduce((s, r) => s + r.calls, 0) ?? 0)}
            </CardTitle>
            <CardDescription>API calls logged — last 30 days (new calls tracked going forward)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer className="aspect-auto h-56 w-full" config={apiConfig}>
              <BarChart data={stats?.apiCallsByDay ?? []} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="calls" fill="var(--color-calls)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {stats?.providerCredits &&
          Object.entries(stats.providerCredits).map(([key, p]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.label}</CardTitle>
                <CardDescription>{p.note}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="metric-value metric-value--compact">{formatInteger(p.apiCalls)}</div>
                <p className="text-xs text-muted-foreground">API calls (30d)</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {stats?.apiByOperation && stats.apiByOperation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>API operations breakdown</CardTitle>
            <CardDescription>Per-provider operation counts (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.apiByOperation.map((op) => (
                <Badge key={`${op.provider}-${op.operation}`} variant="secondary" className="font-mono text-xs">
                  {op.provider}/{op.operation}: {op.calls}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Platform users</CardTitle>
          <CardDescription>
            Email, role, organization, signup date, and last sign-in. Passwords are never stored in plaintext — manage accounts via Supabase Auth.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role}</Badge>
                    </TableCell>
                    <TableCell>{u.organization}</TableCell>
                    <TableCell>{formatDate(u.signed_up)}</TableCell>
                    <TableCell>{formatDateTime(u.last_sign_in)}</TableCell>
                    <TableCell>
                      <Badge variant={u.account_status === "active" ? "success" : "secondary"}>
                        {u.email_verified ? (u.last_sign_in ? "Active" : "Verified") : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Property Walkthrough AI", href: "/admin/walkthrough-ai", status: "OpenRouter / Vertex" },
          { title: "World Labs Operations", href: "/admin/worldlabs", status: "Online" },
          { title: "Audit Logs", href: "/admin/audit", status: "Active" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>Platform admin</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="success">{item.status}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
