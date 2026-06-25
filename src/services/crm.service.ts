import { createAdminClient } from "@/lib/supabase/admin";
import { intentEngineService } from "./intent-engine.service";

export class CRMService {
  async recordEvent(params: {
    sessionId: string;
    leadId?: string;
    propertyId: string;
    organizationId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }) {
    const supabase = createAdminClient();

    await supabase.from("lead_events").insert({
      session_id: params.sessionId,
      lead_id: params.leadId,
      property_id: params.propertyId,
      organization_id: params.organizationId,
      event_type: params.eventType,
      payload: params.payload ?? {},
    });

    await supabase.from("analytics_events").insert({
      session_id: params.sessionId,
      property_id: params.propertyId,
      organization_id: params.organizationId,
      event_type: params.eventType,
      payload: params.payload ?? {},
    });

    if (params.leadId) {
      await this.refreshIntentScore(params.leadId);
    }
  }

  async refreshIntentScore(leadId: string) {
    const supabase = createAdminClient();
    const { data: lead } = await supabase.from("leads").select("session_id").eq("id", leadId).single();
    const { data: events } = await supabase
      .from("lead_events")
      .select("event_type")
      .eq("lead_id", leadId);

    const { score, signals } = intentEngineService.computeScore(events ?? []);

    let groupIntentScore: number | undefined;
    if (lead?.session_id) {
      const { data: familyEvents } = await supabase
        .from("lead_events")
        .select("event_type")
        .eq("session_id", lead.session_id);
      groupIntentScore = intentEngineService.computeScore(familyEvents ?? []).score;
    }

    await supabase.from("leads").update({
      intent_score: score,
      intent_signals: signals,
      group_intent_score: groupIntentScore,
      updated_at: new Date().toISOString(),
    }).eq("id", leadId);

    await supabase.from("intent_scores").insert({
      lead_id: leadId,
      score,
      signals,
      explanation: intentEngineService.explainScore(signals),
    });
  }

  async createLead(params: {
    organizationId: string;
    propertyId: string;
    projectId?: string;
    sessionId: string;
    name?: string;
    phone?: string;
    email?: string;
    source?: string;
    campaign?: string;
  }) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("leads").insert({
      organization_id: params.organizationId,
      property_id: params.propertyId,
      project_id: params.projectId,
      session_id: params.sessionId,
      name: params.name,
      phone: params.phone,
      email: params.email,
      source: params.source,
      campaign: params.campaign,
      lead_status: "new",
      intent_score: 20,
    }).select().single();

    if (error) throw error;
    return data;
  }
}

export const crmService = new CRMService();
