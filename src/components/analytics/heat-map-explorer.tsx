"use client";

interface HeatPoint {
  scene_id?: string;
  x?: number;
  y?: number;
  z?: number;
  dwell_seconds?: number;
}

export function HeatMapExplorer({ points, mode }: { points: HeatPoint[]; mode: "360" | "3d" }) {
  const roomDwell: Record<string, number> = {};
  points.forEach((p) => {
    const key = mode === "360" ? (p.scene_id ?? "unknown") : `${p.x?.toFixed(1)},${p.z?.toFixed(1)}`;
    roomDwell[key] = (roomDwell[key] ?? 0) + (p.dwell_seconds ?? 0);
  });

  const max = Math.max(...Object.values(roomDwell), 1);
  const entries = Object.entries(roomDwell).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{mode === "360" ? "Room dwell heat map" : "3D position heat zones"}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([zone, dwell]) => (
          <div key={zone} className="rounded-lg border p-3">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium truncate">{zone}</span>
              <span>{dwell}s</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(dwell / max) * 100}%` }} />
            </div>
          </div>
        ))}
        {!entries.length && <p className="text-sm text-muted-foreground">No heat map data yet. Buyer sessions will populate this.</p>}
      </div>
    </div>
  );
}
