"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDeviceLabel } from "@/lib/brochure-device";

export function BrochureDeviceSourcePanel({
  session,
}: {
  session: {
    device?: string | null;
    browser?: string | null;
    os?: string | null;
    screen_width?: number | null;
    screen_height?: number | null;
    language?: string | null;
    timezone?: string | null;
    referrer?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    viewer_mode?: string | null;
    started_at: string;
  };
}) {
  const deviceLabel = formatDeviceLabel({
    device: (session.device as "mobile" | "tablet" | "desktop") ?? "desktop",
    browser: session.browser ?? "Unknown",
    os: session.os ?? "Unknown",
  });

  const rows = [
    { label: "Device", value: deviceLabel },
    { label: "Screen", value: session.screen_width ? `${session.screen_width}×${session.screen_height}` : "—" },
    { label: "Language", value: session.language ?? "—" },
    { label: "Timezone", value: session.timezone ?? "—" },
    { label: "Source", value: session.utm_source ?? "Direct" },
    { label: "Medium", value: session.utm_medium ?? "—" },
    { label: "Campaign", value: session.utm_campaign ?? "—" },
    {
      label: "Referrer",
      value: session.referrer
        ? (() => {
            try {
              return new URL(session.referrer).hostname;
            } catch {
              return session.referrer;
            }
          })()
        : "—",
    },
    { label: "Viewer", value: session.viewer_mode ?? "pdf" },
    { label: "Opened", value: new Date(session.started_at).toLocaleString() },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device &amp; Source</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 text-sm font-medium break-all">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
