"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeInventory } from "@/lib/supabase/realtime";
import { INVENTORY_STATUSES, type InventoryStatus } from "@/types/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type InventoryUnit = {
  id: string;
  name: string;
  unit_number?: string | null;
  unit_type?: string | null;
  tower?: string | null;
  floor?: string | null;
  facing?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  price_current?: number | null;
  availability?: string | null;
  hold_expires_at?: string | null;
  project_id?: string | null;
};

const STATUS_META: Record<InventoryStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  available: { label: "Available", variant: "success" },
  on_hold: { label: "On Hold", variant: "warning" },
  booked: { label: "Booked", variant: "default" },
  sold: { label: "Sold", variant: "destructive" },
  blocked: { label: "Blocked", variant: "secondary" },
};

function formatPrice(value?: number | null) {
  if (value == null) return "—";
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function InventoryBoard() {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const url = filter ? `/api/inventory?status=${filter}` : "/api/inventory";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (d.properties) setUnits(d.properties);
        if (d.summary) setSummary(d.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
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
      cleanup = subscribeInventory(data.organization_id, () => load());
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [load]);

  async function changeStatus(unit: InventoryUnit, toStatus: InventoryStatus) {
    const body: Record<string, unknown> = { toStatus };
    if (toStatus === "on_hold") body.holdHours = 24;
    const res = await fetch(`/api/inventory/${unit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "Update failed");
    toast.success(`${unit.name} → ${STATUS_META[toStatus].label}`);
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, availability: toStatus } : u)));
  }

  const totalUnits = Object.values(summary).reduce((a, b) => a + b, 0);
  const soldOrBooked = (summary.sold ?? 0) + (summary.booked ?? 0);
  const sellThrough = totalUnits > 0 ? ((soldOrBooked / totalUnits) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Live Inventory</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Real-time unit availability · synced via Supabase Realtime</p>
        </div>
        <Badge variant="success" className="w-fit">Live</Badge>
      </div>

      <div className="kpi-card-grid kpi-card-grid--compact">
        {INVENTORY_STATUSES.map((s) => (
          <Card
            key={s}
            className={`cursor-pointer transition-shadow hover:shadow-md ${filter === s ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilter(filter === s ? "" : s)}
          >
            <CardContent className="py-4">
              <p className="metric-value metric-value--compact">{summary[s] ?? 0}</p>
              <p className="text-xs text-muted-foreground">{STATUS_META[s].label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Units {filter && <span className="text-muted-foreground">· filtered by {STATUS_META[filter as InventoryStatus]?.label}</span>}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{sellThrough}% sell-through</span>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading inventory…</p>}
          {!loading && !units.length && (
            <p className="text-sm text-muted-foreground">No units yet. Add properties under Portfolio → Properties.</p>
          )}
          {units.map((unit) => {
            const status = (unit.availability ?? "available") as InventoryStatus;
            const meta = STATUS_META[status] ?? STATUS_META.available;
            return (
              <div key={unit.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {unit.name}
                    {unit.unit_number ? ` · ${unit.unit_number}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[unit.unit_type, unit.tower && `Tower ${unit.tower}`, unit.floor && `Floor ${unit.floor}`, unit.facing]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(unit.price_current ?? unit.price_min)}
                    {unit.price_max ? ` – ${formatPrice(unit.price_max)}` : ""}
                    {status === "on_hold" && unit.hold_expires_at
                      ? ` · hold until ${new Date(unit.hold_expires_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  {INVENTORY_STATUSES.filter((s) => s !== status).map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => changeStatus(unit, s)}>
                      {STATUS_META[s].label}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
