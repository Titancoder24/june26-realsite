type SessionRow = {
  started_at?: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  device?: string | null;
  lead_id?: string | null;
  experience_id?: string | null;
};

type EventRow = {
  event_type: string;
  created_at?: string;
  payload?: { scene_name?: string; experience_name?: string; query?: string };
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function aggregateSessionsByMonth(sessions: SessionRow[]) {
  const counts = new Array(12).fill(0);
  const now = new Date();
  for (const s of sessions) {
    if (!s.started_at) continue;
    const d = new Date(s.started_at);
    if (d.getFullYear() !== now.getFullYear()) continue;
    counts[d.getMonth()] += 1;
  }
  return MONTHS.map((month, i) => ({ month, visitors: counts[i] }));
}

export function aggregateTrafficSources(sessions: SessionRow[]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const source = s.utm_source?.trim() || "Direct";
    map.set(source, (map.get(source) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([source, sessions]) => ({ source, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6);
}

export function aggregateDeviceMix(sessions: SessionRow[]) {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const device = (s.device ?? "unknown").toLowerCase();
    const label = device.includes("mobile") ? "Mobile" : device.includes("tablet") ? "Tablet" : "Desktop";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  const total = sessions.length || 1;
  return [...map.entries()].map(([label, count]) => ({
    label,
    share: Math.round((count / total) * 100),
  }));
}

export function aggregateAudienceMix(sessions: SessionRow[]) {
  const withLead = sessions.filter((s) => s.lead_id).length;
  const returning = Math.round((withLead / Math.max(sessions.length, 1)) * 100);
  const newVisitors = 100 - returning;
  return [
    { label: "Returning visitors", share: returning },
    { label: "New visitors", share: newVisitors },
    { label: "Logged-in users", share: 0 },
  ];
}

export function aggregateTopScenes(events: EventRow[]) {
  const map = new Map<string, number>();
  for (const e of events) {
    if (e.event_type !== "scene_view" && e.event_type !== "room_entered") continue;
    const name = e.payload?.scene_name ?? e.payload?.experience_name ?? e.event_type;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([path, visits]) => ({ path, visits, delta: 0 }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5);
}

export function aggregateSessionsByDay(sessions: SessionRow[], days = 60) {
  const map = new Map<string, number>();
  const start = new Date();
  start.setDate(start.getDate() - days);
  for (const s of sessions) {
    if (!s.started_at) continue;
    const d = new Date(s.started_at);
    if (d < start) continue;
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

export function countLiveSessions(sessions: SessionRow[], minutes = 5) {
  const cutoff = Date.now() - minutes * 60_000;
  return sessions.filter((s) => s.started_at && new Date(s.started_at).getTime() >= cutoff).length;
}

export function aggregateCampaignMix(campaigns: { utm_campaign?: string; sessions?: number }[]) {
  const total = campaigns.reduce((s, c) => s + (c.sessions ?? 0), 0) || 1;
  return campaigns
    .filter((c) => c.utm_campaign)
    .map((c) => ({
      category: c.utm_campaign!,
      share: Math.round(((c.sessions ?? 0) / total) * 100),
    }))
    .sort((a, b) => b.share - a.share);
}
