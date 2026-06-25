import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

interface Event {
  id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

const LABELS: Record<string, string> = {
  session_started: "Opened property link",
  room_entered: "Entered room",
  ai_question: "Asked AI a question",
  floor_map_opened: "Opened floor map",
  invited_family: "Invited family member",
  requested_callback: "Requested callback",
  lead_captured: "Submitted contact details",
  clicked_cta: "Clicked contact sales",
};

export function LeadTimeline({ events }: { events: Event[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No events yet</p>;

  return (
    <div className="space-y-3">
      {events.map((e) => (
        <div key={e.id} className="flex gap-3 border-l-2 border-primary/30 pl-4">
          <div className="flex-1">
            <p className="text-sm font-medium">{LABELS[e.event_type] ?? e.event_type}</p>
            {typeof e.payload?.query === "string" && <p className="text-xs text-muted-foreground">&quot;{e.payload.query}&quot;</p>}
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-[10px]">{formatRelativeTime(e.created_at)}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
