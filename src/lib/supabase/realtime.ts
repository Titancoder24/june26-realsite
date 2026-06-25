import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

function removeChannelByName(supabase: SupabaseClient, channelName: string) {
  for (const channel of supabase.getChannels()) {
    if (channel.topic === `realtime:${channelName}`) {
      void supabase.removeChannel(channel);
    }
  }
}

function subscribeToTable(
  channelName: string,
  config: {
    event: "INSERT" | "UPDATE" | "DELETE" | "*";
    table: string;
    filter?: string;
  },
  onChange: (payload: Record<string, unknown>) => void,
) {
  const supabase = createClient();
  removeChannelByName(supabase, channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: config.event,
        schema: "public",
        table: config.table,
        ...(config.filter ? { filter: config.filter } : {}),
      },
      (payload) => onChange((payload.new ?? payload.old) as Record<string, unknown>),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeWorldLabsJob(jobId: string, onUpdate: (payload: Record<string, unknown>) => void) {
  return subscribeToTable(
    `worldlabs-job-${jobId}`,
    { event: "UPDATE", table: "worldlabs_jobs", filter: `id=eq.${jobId}` },
    onUpdate,
  );
}

export function subscribeInventory(organizationId: string, onChange: (payload: Record<string, unknown>) => void) {
  return subscribeToTable(
    `inventory-${organizationId}`,
    { event: "UPDATE", table: "properties", filter: `organization_id=eq.${organizationId}` },
    onChange,
  );
}

export function subscribeSiteVisits(organizationId: string, onChange: (payload: Record<string, unknown>) => void) {
  return subscribeToTable(
    `site-visits-${organizationId}`,
    { event: "*", table: "site_visits", filter: `organization_id=eq.${organizationId}` },
    onChange,
  );
}
