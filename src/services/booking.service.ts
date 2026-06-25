import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmService } from "./crm.service";
import { env } from "@/lib/env";
import type { SiteVisitStatus, SiteVisitType } from "@/types/domain";

interface CreateSiteVisitParams {
  organizationId: string;
  propertyId: string;
  projectId?: string;
  leadId?: string;
  sessionId?: string;
  assignedAgent?: string;
  visitType?: SiteVisitType;
  scheduledAt: string;
  durationMinutes?: number;
  visitorName?: string;
  visitorPhone?: string;
  visitorEmail?: string;
  partySize?: number;
  notes?: string;
}

export class BookingService {
  async createSiteVisit(params: CreateSiteVisitParams) {
    const admin = createAdminClient();
    const visitType = params.visitType ?? "in_person";

    let webrtcSessionId: string | undefined;
    let meetingUrl: string | undefined;

    // For video-call bookings, spin up a WebRTC room (reuses family-session infra)
    if (visitType === "video_call" && params.sessionId) {
      const roomCode = uuidv4().slice(0, 8);
      const inviteToken = uuidv4();
      const { data: room } = await admin
        .from("webrtc_sessions")
        .insert({
          buyer_session_id: params.sessionId,
          room_code: roomCode,
          invite_token: inviteToken,
          status: "scheduled",
        })
        .select()
        .single();
      if (room) {
        webrtcSessionId = room.id;
        // Link into the property's published experience viewer when available
        const { data: exp } = await admin
          .from("experiences")
          .select("slug")
          .eq("property_id", params.propertyId)
          .eq("status", "published")
          .limit(1)
          .maybeSingle();
        const base = exp?.slug ? `${env.NEXT_PUBLIC_APP_URL}/view/${exp.slug}` : env.NEXT_PUBLIC_APP_URL;
        meetingUrl = `${base}?room=${roomCode}&token=${inviteToken}`;
      }
    }

    const { data, error } = await admin
      .from("site_visits")
      .insert({
        organization_id: params.organizationId,
        property_id: params.propertyId,
        project_id: params.projectId,
        lead_id: params.leadId,
        session_id: params.sessionId,
        assigned_agent: params.assignedAgent,
        webrtc_session_id: webrtcSessionId,
        visit_type: visitType,
        status: "requested",
        scheduled_at: params.scheduledAt,
        duration_minutes: params.durationMinutes ?? 30,
        visitor_name: params.visitorName,
        visitor_phone: params.visitorPhone,
        visitor_email: params.visitorEmail,
        party_size: params.partySize ?? 1,
        notes: params.notes,
        meeting_url: meetingUrl,
      })
      .select()
      .single();

    if (error) throw error;

    // Feed the CRM intent engine (requested_site_visit weight = 18)
    if (params.sessionId) {
      await crmService.recordEvent({
        sessionId: params.sessionId,
        leadId: params.leadId,
        propertyId: params.propertyId,
        organizationId: params.organizationId,
        eventType: "requested_site_visit",
        payload: { visitType, scheduledAt: params.scheduledAt, siteVisitId: data.id },
      });
    }

    return data;
  }

  async updateSiteVisit(
    id: string,
    organizationId: string,
    updates: {
      status?: SiteVisitStatus;
      scheduled_at?: string;
      assigned_agent?: string;
      notes?: string;
      cancelled_reason?: string;
    },
  ) {
    const admin = createAdminClient();
    const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };

    // Auto-mark as rescheduled when the time changes without an explicit status
    if (updates.scheduled_at && !updates.status) {
      patch.status = "rescheduled";
    }

    const { data, error } = await admin
      .from("site_visits")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listSiteVisits(organizationId: string, filters?: { status?: string; agentId?: string }) {
    const admin = createAdminClient();
    let q = admin
      .from("site_visits")
      .select("*, properties(name, unit_type), leads(name, phone, intent_score)")
      .eq("organization_id", organizationId)
      .order("scheduled_at", { ascending: true });

    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.agentId) q = q.eq("assigned_agent", filters.agentId);

    const { data, error } = await q;
    if (error) throw error;
    return data;
  }
}

export const bookingService = new BookingService();
