import { createAdminClient } from "@/lib/supabase/admin";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function aggregateByDay(rows: { created_at?: string; started_at?: string }[], days = 30, field: "created_at" | "started_at" = "created_at") {
  const map = new Map<string, number>();
  const start = new Date();
  start.setDate(start.getDate() - days);
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const raw = row[field];
    if (!raw) continue;
    const d = new Date(raw);
    if (d < start) continue;
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}

export async function getPlatformAdminStats() {
  const admin = createAdminClient();
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);

  const [
    { count: totalUsers },
    { count: totalOrgs },
    { count: totalExperiences },
    { count: publishedExperiences },
    { count: buyerSessions },
    { count: buyerSessions7d },
    { count: totalLeads },
    { data: profiles },
    { data: orgs },
    { data: recentProfiles },
    { count: videoJobs },
    { count: videoJobsCompleted },
    { count: walkthroughPlans },
    { count: worldlabsJobs },
    { count: worldlabsSucceeded },
    { count: enhancementJobs },
    { data: apiLogs },
    { data: buyerSessionsRecent },
    { data: signupsRecent },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("organizations").select("*", { count: "exact", head: true }),
    admin.from("experiences").select("*", { count: "exact", head: true }),
    admin.from("experiences").select("*", { count: "exact", head: true }).eq("status", "published"),
    admin.from("buyer_sessions").select("*", { count: "exact", head: true }),
    admin.from("buyer_sessions").select("*", { count: "exact", head: true }).gte("started_at", since7),
    admin.from("leads").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("id, role, organization_id, created_at"),
    admin.from("organizations").select("id, name, created_at"),
    admin.from("profiles").select("id, email, full_name, role, organization_id, created_at").order("created_at", { ascending: false }).limit(5),
    admin.from("walkthrough_video_jobs").select("*", { count: "exact", head: true }),
    admin.from("walkthrough_video_jobs").select("*", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("walkthrough_plans").select("*", { count: "exact", head: true }),
    admin.from("worldlabs_jobs").select("*", { count: "exact", head: true }),
    admin.from("worldlabs_jobs").select("*", { count: "exact", head: true }).eq("status", "succeeded"),
    admin.from("walkthrough_enhancement_jobs").select("*", { count: "exact", head: true }),
    admin.from("api_usage_logs").select("provider, operation, status, created_at").gte("created_at", since30).order("created_at", { ascending: false }).limit(500),
    admin.from("buyer_sessions").select("started_at").gte("started_at", since30),
    admin.from("profiles").select("created_at").gte("created_at", since30),
  ]);

  const signupsByDay = aggregateByDay(signupsRecent ?? [], 30, "created_at").map((r) => ({
    date: monthLabel(r.date),
    signups: r.count,
  }));

  const sessionsByDay = aggregateByDay(
    (buyerSessionsRecent ?? []).map((s) => ({ created_at: s.started_at })),
    30,
    "created_at",
  ).map((r) => ({
    date: monthLabel(r.date),
    sessions: r.count,
  }));

  const apiByDayMap = new Map<string, number>();
  const apiByProvider = new Map<string, number>();
  const apiByOperation = new Map<string, number>();

  for (const log of apiLogs ?? []) {
    const day = new Date(log.created_at).toISOString().slice(0, 10);
    apiByDayMap.set(day, (apiByDayMap.get(day) ?? 0) + 1);
    apiByProvider.set(log.provider, (apiByProvider.get(log.provider) ?? 0) + 1);
    const opKey = `${log.provider}:${log.operation}`;
    apiByOperation.set(opKey, (apiByOperation.get(opKey) ?? 0) + 1);
  }

  const apiCallsByDay = aggregateByDay(
    (apiLogs ?? []).map((l) => ({ created_at: l.created_at })),
    30,
    "created_at",
  ).map((r) => ({ date: monthLabel(r.date), calls: r.count }));

  const generationsByType = [
    { type: "Walkthrough plans", count: walkthroughPlans ?? 0 },
    { type: "Veo motion clips", count: videoJobs ?? 0 },
    { type: "Motion completed", count: videoJobsCompleted ?? 0 },
    { type: "Image enhancements", count: enhancementJobs ?? 0 },
    { type: "World Labs 3D", count: worldlabsJobs ?? 0 },
    { type: "3D succeeded", count: worldlabsSucceeded ?? 0 },
  ];

  const roleBreakdown = new Map<string, number>();
  for (const p of profiles ?? []) {
    roleBreakdown.set(p.role, (roleBreakdown.get(p.role) ?? 0) + 1);
  }

  const signupsLast7 = (signupsRecent ?? []).filter((p) => p.created_at && p.created_at >= since7).length;
  const signupsLast30 = signupsRecent?.length ?? 0;

  const totalGenerations =
    (walkthroughPlans ?? 0) +
    (videoJobs ?? 0) +
    (enhancementJobs ?? 0) +
    (worldlabsJobs ?? 0);

  const providerCredits = {
    openrouter: {
      label: "OpenRouter",
      apiCalls: apiByProvider.get("openrouter") ?? 0,
      note: "Check openrouter.ai/credits for remaining balance",
    },
    vertex: {
      label: "Google Vertex AI",
      apiCalls: apiByProvider.get("vertex") ?? 0,
      note: "Check Google Cloud billing for quota",
    },
    elevenlabs: {
      label: "ElevenLabs",
      apiCalls: apiByProvider.get("elevenlabs") ?? 0,
      note: "Check ElevenLabs dashboard for characters",
    },
    worldlabs: {
      label: "World Labs",
      apiCalls: apiByProvider.get("worldlabs") ?? 0,
      note: "Job-based usage tracked",
    },
  };

  return {
    kpis: {
      totalUsers: totalUsers ?? 0,
      totalOrganizations: totalOrgs ?? 0,
      totalExperiences: totalExperiences ?? 0,
      publishedExperiences: publishedExperiences ?? 0,
      buyerSessions: buyerSessions ?? 0,
      buyerSessions7d: buyerSessions7d ?? 0,
      totalLeads: totalLeads ?? 0,
      signupsLast7,
      signupsLast30,
      totalGenerations,
      apiCalls30d: apiLogs?.length ?? 0,
      liveBuyerSessions: (buyerSessionsRecent ?? []).filter((s) => {
        if (!s.started_at) return false;
        return Date.now() - new Date(s.started_at).getTime() < 5 * 60_000;
      }).length,
    },
    signupsByDay,
    sessionsByDay,
    apiCallsByDay,
    generationsByType,
    apiByProvider: [...apiByProvider.entries()].map(([provider, calls]) => ({ provider, calls })),
    apiByOperation: [...apiByOperation.entries()]
      .map(([key, calls]) => {
        const [provider, operation] = key.split(":");
        return { provider, operation, calls };
      })
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 12),
    roleBreakdown: [...roleBreakdown.entries()].map(([role, count]) => ({ role, count })),
    providerCredits,
    recentSignups: (recentProfiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      organization_id: p.organization_id,
      created_at: p.created_at,
    })),
    organizations: (orgs ?? []).slice(0, 10).map((o) => ({
      id: o.id,
      name: o.name,
      created_at: o.created_at,
      userCount: (profiles ?? []).filter((p) => p.organization_id === o.id).length,
    })),
  };
}

export async function getPlatformUsers(limit = 100) {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, role, organization_id, created_at, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  const authUsers: { id: string; email?: string; last_sign_in_at?: string; created_at?: string; email_confirmed_at?: string }[] = [];
  try {
    const { data } = await admin.auth.admin.listUsers({ perPage: limit, page: 1 });
    if (data?.users) authUsers.push(...data.users.map((u) => ({
      id: u.id,
      email: u.email,
      last_sign_in_at: u.last_sign_in_at,
      created_at: u.created_at,
      email_confirmed_at: u.email_confirmed_at,
    })));
  } catch {
    // Auth list may fail in some envs
  }

  const authMap = new Map(authUsers.map((u) => [u.id, u]));

  return (profiles ?? []).map((p) => {
    const auth = authMap.get(p.id);
    const org = p.organizations as { name?: string } | null;
    return {
      id: p.id,
      email: p.email ?? auth?.email ?? "—",
      full_name: p.full_name ?? "—",
      role: p.role,
      organization: org?.name ?? "—",
      organization_id: p.organization_id,
      signed_up: p.created_at,
      last_sign_in: auth?.last_sign_in_at ?? null,
      email_verified: Boolean(auth?.email_confirmed_at),
      account_status: auth?.last_sign_in_at ? "active" : "pending_first_login",
    };
  });
}
