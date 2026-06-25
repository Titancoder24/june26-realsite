"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeSiteVisits } from "@/lib/supabase/realtime";
import type { SiteVisitStatus, SiteVisitType } from "@/types/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarDays, Video, MapPin } from "lucide-react";

type SiteVisit = {
  id: string;
  property_id: string;
  visit_type: SiteVisitType;
  status: SiteVisitStatus;
  scheduled_at: string;
  duration_minutes: number;
  visitor_name?: string | null;
  visitor_phone?: string | null;
  party_size?: number | null;
  notes?: string | null;
  meeting_url?: string | null;
  properties?: { name: string; unit_type?: string } | null;
  leads?: { name?: string; phone?: string; intent_score?: number } | null;
};

const STATUS_VARIANT: Record<SiteVisitStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  requested: "warning",
  confirmed: "success",
  rescheduled: "secondary",
  completed: "default",
  cancelled: "destructive",
  no_show: "destructive",
};

const NEXT_ACTIONS: Partial<Record<SiteVisitStatus, { label: string; status: SiteVisitStatus }[]>> = {
  requested: [
    { label: "Confirm", status: "confirmed" },
    { label: "Cancel", status: "cancelled" },
  ],
  confirmed: [
    { label: "Complete", status: "completed" },
    { label: "No-show", status: "no_show" },
    { label: "Cancel", status: "cancelled" },
  ],
  rescheduled: [
    { label: "Confirm", status: "confirmed" },
    { label: "Cancel", status: "cancelled" },
  ],
};

function groupByDay(visits: SiteVisit[]) {
  const groups: Record<string, SiteVisit[]> = {};
  for (const v of visits) {
    const day = new Date(v.scheduled_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    (groups[day] ??= []).push(v);
  }
  return groups;
}

export function SiteVisitsDashboard() {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    propertyId: "",
    visitType: "in_person" as SiteVisitType,
    scheduledAt: "",
    visitorName: "",
    visitorPhone: "",
    partySize: "1",
    notes: "",
  });

  const load = useCallback(() => {
    const url = statusFilter ? `/api/site-visits?status=${statusFilter}` : "/api/site-visits";
    fetch(url)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setVisits(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
    fetch("/api/properties").then((r) => r.json()).then((d) => Array.isArray(d) && setProperties(d)).catch(() => {});
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const { data } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
      if (cancelled || !data?.organization_id) return;
      cleanup = subscribeSiteVisits(data.organization_id, () => load());
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [load]);

  async function createVisit() {
    if (!form.propertyId || !form.scheduledAt) return toast.error("Pick a property and time");
    const res = await fetch("/api/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: form.propertyId,
        visitType: form.visitType,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        visitorName: form.visitorName || undefined,
        visitorPhone: form.visitorPhone || undefined,
        partySize: Number(form.partySize) || 1,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "Booking failed");
    toast.success("Site visit booked");
    setForm({ ...form, scheduledAt: "", visitorName: "", visitorPhone: "", notes: "" });
    load();
  }

  async function updateStatus(id: string, status: SiteVisitStatus) {
    const res = await fetch(`/api/site-visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "Update failed");
    toast.success(`Marked ${status.replace(/_/g, " ")}`);
    setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
  }

  const upcoming = visits.filter((v) => ["requested", "confirmed", "rescheduled"].includes(v.status));
  const grouped = groupByDay(upcoming);
  const counts = {
    requested: visits.filter((v) => v.status === "requested").length,
    confirmed: visits.filter((v) => v.status === "confirmed").length,
    video: visits.filter((v) => v.visit_type === "video_call").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:section-title">Site Visits & Video Calls</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Booking calendar · live updates from Supabase</p>
        </div>
        <Badge variant="success" className="w-fit">Live</Badge>
      </div>

      <div className="stat-card-grid">
        <Card><CardContent className="py-4"><p className="metric-value metric-value--compact">{counts.requested}</p><p className="type-caption">Pending confirmation</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="metric-value metric-value--compact">{counts.confirmed}</p><p className="type-caption">Confirmed</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="metric-value metric-value--compact">{counts.video}</p><p className="type-caption">Video calls</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="metric-value metric-value--compact">{upcoming.length}</p><p className="type-caption">Upcoming total</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Book a visit</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <select className="rounded-md border px-3 py-2 text-sm" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="rounded-md border px-3 py-2 text-sm" value={form.visitType} onChange={(e) => setForm({ ...form, visitType: e.target.value as SiteVisitType })}>
            <option value="in_person">In-person visit</option>
            <option value="video_call">Video call</option>
          </select>
          <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          <Input placeholder="Party size" type="number" min={1} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} />
          <Input placeholder="Visitor name" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} />
          <Input placeholder="Visitor phone" value={form.visitorPhone} onChange={(e) => setForm({ ...form, visitorPhone: e.target.value })} />
          <Textarea placeholder="Notes (optional)" className="md:col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button className="md:col-span-2" onClick={createVisit} disabled={!form.propertyId || !form.scheduledAt}>Book visit</Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {["", "requested", "confirmed", "completed", "cancelled"].map((s) => (
          <Button key={s || "all"} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
            {s ? s.replace(/_/g, " ") : "Upcoming"}
          </Button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading bookings…</p>}
      {!loading && !visits.length && <p className="text-sm text-muted-foreground">No bookings yet. Book a visit above, or buyers can request one from the published viewer.</p>}

      {Object.entries(grouped).map(([day, dayVisits]) => (
        <div key={day} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {day}
          </div>
          {dayVisits.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {v.visit_type === "video_call" ? <Video className="h-4 w-4 text-primary" /> : <MapPin className="h-4 w-4 text-primary" />}
                    <p className="truncate font-medium">{v.properties?.name ?? "Property"}</p>
                    <Badge variant={STATUS_VARIANT[v.status]}>{v.status.replace(/_/g, " ")}</Badge>
                    {typeof v.leads?.intent_score === "number" && <Badge variant="outline">intent {v.leads.intent_score}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {v.duration_minutes} min ·{" "}
                    {v.visitor_name ?? v.leads?.name ?? "Guest"}
                    {v.visitor_phone ? ` · ${v.visitor_phone}` : ""}
                    {v.party_size ? ` · party of ${v.party_size}` : ""}
                  </p>
                  {v.meeting_url && (
                    <a href={v.meeting_url} className="text-xs text-primary underline break-all" target="_blank" rel="noreferrer">{v.meeting_url}</a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(NEXT_ACTIONS[v.status] ?? []).map((a) => (
                    <Button key={a.status} size="sm" variant="outline" onClick={() => updateStatus(v.id, a.status)}>{a.label}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}
