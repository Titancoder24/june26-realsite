import { createAdminClient } from "@/lib/supabase/admin";
import { embeddingService } from "@/services/embedding.service";
import {
  SALES_TRAINING_SCENARIOS,
  getSalesScenario,
  type SalesTrainingCoachResult,
  type SalesTrainingDifficulty,
  type SalesTrainingMessage,
  type SalesTrainingMode,
  type SalesTrainingScenarioId,
} from "@/lib/sales-training";
import type { UserProfile } from "@/lib/auth/session";

type SessionRow = {
  id: string;
  organization_id: string;
  agent_id: string;
  scenario_id: string;
  scenario_title: string;
  training_mode: SalesTrainingMode;
  difficulty: SalesTrainingDifficulty;
  status: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type SalesTrainingDatasetRow = {
  id: string;
  title: string;
  source_type: "text" | "url" | "pdf" | "file";
  source_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  text_content: string;
  char_count: number;
  created_at: string;
};

type MessageRow = {
  id: string;
  role: "agent" | "buyer" | "coach" | "system";
  content: string;
  input_mode: SalesTrainingMode;
  created_at: string;
};

export type SalesTrainingMemoryRow = {
  message_id: string;
  session_id: string;
  role: "agent" | "buyer" | "coach" | "system";
  content: string;
  similarity: number;
  created_at: string;
};

type AssessmentRow = {
  agent_id?: string;
  readiness_score: number;
  discovery_score: number;
  objection_score: number;
  product_knowledge_score: number;
  empathy_score: number;
  closing_score: number;
  compliance_score: number;
  strengths?: string[];
  improvements?: string[];
  manager_summary: string | null;
  next_drill: string | null;
  created_at: string;
};

function requireOrg(profile: UserProfile) {
  if (!profile.organization_id) throw new Error("No organization");
  return profile.organization_id;
}

function normalizeMessage(row: MessageRow): SalesTrainingMessage {
  return {
    role: row.role === "system" ? "coach" : row.role,
    content: row.content,
    inputMode: row.input_mode,
    createdAt: row.created_at,
  };
}

export const salesTrainingService = {
  async createSession(profile: UserProfile, params: {
    scenarioId: SalesTrainingScenarioId;
    mode: SalesTrainingMode;
    difficulty: SalesTrainingDifficulty;
    datasetIds?: string[];
  }) {
    const organizationId = requireOrg(profile);
    const scenario = getSalesScenario(params.scenarioId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_training_sessions")
      .insert({
        organization_id: organizationId,
        agent_id: profile.id,
        scenario_id: scenario.id,
        scenario_title: scenario.title,
        training_mode: params.mode,
        difficulty: params.difficulty,
        title: `${scenario.title} · ${params.mode}`,
        source_context: {
          buyerProfile: scenario.buyerProfile,
          goal: scenario.goal,
          managerFocus: scenario.managerFocus,
          datasetIds: params.datasetIds ?? [],
        },
      })
      .select()
      .single();
    if (error) throw error;
    if (params.datasetIds?.length) {
      await this.attachDatasets(profile, data.id, params.datasetIds);
    }
    await this.addMessage(profile, data.id, {
      role: "buyer",
      content: "Hi, I saw the project brochure and virtual walkthrough. I want to know if it is worth visiting this weekend.",
      inputMode: params.mode,
    });
    return data as SessionRow;
  },

  async listSessions(profile: UserProfile) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_training_sessions")
      .select("id, organization_id, agent_id, scenario_id, scenario_title, training_mode, difficulty, status, title, created_at, updated_at, completed_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as SessionRow[];
  },

  async getSession(profile: UserProfile, sessionId: string) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const [{ data: session, error: sessionError }, { data: messages, error: messagesError }, { data: assessments, error: assessmentsError }, datasets] = await Promise.all([
      admin.from("sales_training_sessions").select("*").eq("organization_id", organizationId).eq("id", sessionId).single(),
      admin.from("sales_training_messages").select("*").eq("organization_id", organizationId).eq("session_id", sessionId).order("created_at", { ascending: true }),
      admin.from("sales_training_assessments").select("*").eq("organization_id", organizationId).eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1),
      this.getSessionDatasets(profile, sessionId),
    ]);
    if (sessionError) throw sessionError;
    if (messagesError) throw messagesError;
    if (assessmentsError) throw assessmentsError;
    return {
      session: session as SessionRow,
      messages: ((messages ?? []) as MessageRow[]).map(normalizeMessage),
      latestAssessment: ((assessments ?? []) as AssessmentRow[])[0] ?? null,
      datasets,
    };
  },

  async listDatasets(profile: UserProfile) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_training_datasets")
      .select("id, title, source_type, source_url, file_name, mime_type, text_content, char_count, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as SalesTrainingDatasetRow[];
  },

  async createDataset(profile: UserProfile, params: {
    title: string;
    sourceType: "text" | "url" | "pdf" | "file";
    textContent: string;
    sourceUrl?: string;
    fileName?: string;
    mimeType?: string;
  }) {
    const organizationId = requireOrg(profile);
    const text = params.textContent.trim().slice(0, 120_000);
    if (!text) throw new Error("Dataset content is empty");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_training_datasets")
      .insert({
        organization_id: organizationId,
        agent_id: profile.id,
        title: params.title.trim().slice(0, 120) || "Training dataset",
        source_type: params.sourceType,
        source_url: params.sourceUrl ?? null,
        file_name: params.fileName ?? null,
        mime_type: params.mimeType ?? null,
        text_content: text,
        char_count: text.length,
      })
      .select("id, title, source_type, source_url, file_name, mime_type, text_content, char_count, created_at")
      .single();
    if (error) throw error;
    return data as SalesTrainingDatasetRow;
  },

  async attachDatasets(profile: UserProfile, sessionId: string, datasetIds: string[]) {
    const organizationId = requireOrg(profile);
    const uniqueIds = [...new Set(datasetIds)].filter(Boolean);
    if (!uniqueIds.length) return;
    const admin = createAdminClient();
    const { error } = await admin.from("sales_training_session_datasets").upsert(
      uniqueIds.map((datasetId) => ({
        session_id: sessionId,
        dataset_id: datasetId,
        organization_id: organizationId,
      })),
      { onConflict: "session_id,dataset_id" },
    );
    if (error) throw error;
  },

  async getSessionDatasets(profile: UserProfile, sessionId: string) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_training_session_datasets")
      .select("dataset_id")
      .eq("organization_id", organizationId)
      .eq("session_id", sessionId);
    if (error) throw error;
    const ids = (data ?? []).map((row: { dataset_id: string }) => row.dataset_id);
    if (!ids.length) return [] as SalesTrainingDatasetRow[];
    const { data: datasets, error: datasetError } = await admin
      .from("sales_training_datasets")
      .select("id, title, source_type, source_url, file_name, mime_type, text_content, char_count, created_at")
      .eq("organization_id", organizationId)
      .in("id", ids);
    if (datasetError) throw datasetError;
    return (datasets ?? []) as SalesTrainingDatasetRow[];
  },

  async addMessage(profile: UserProfile, sessionId: string, message: SalesTrainingMessage) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const { data: session, error: sessionError } = await admin
      .from("sales_training_sessions")
      .select("id, agent_id")
      .eq("organization_id", organizationId)
      .eq("id", sessionId)
      .single();
    if (sessionError) throw sessionError;
    const role = message.role;
    const agentId = role === "agent" ? profile.id : session.agent_id;
    const { data, error } = await admin.from("sales_training_messages").insert({
      session_id: sessionId,
      organization_id: organizationId,
      agent_id: agentId,
      role,
      content: message.content,
      input_mode: message.inputMode ?? "text",
    }).select("id, created_at").single();
    if (error) throw error;
    if (data?.id) {
      await this.storeMessageEmbedding({
        messageId: data.id,
        sessionId,
        organizationId,
        agentId,
        role,
        content: message.content,
      });
    }
    await admin.from("sales_training_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
    return data?.id as string | undefined;
  },

  async storeMessageEmbedding(params: {
    messageId: string;
    sessionId: string;
    organizationId: string;
    agentId: string;
    role: "agent" | "buyer" | "coach";
    content: string;
  }) {
    const trimmed = params.content.trim();
    if (!trimmed) return;
    try {
      const embedding = await embeddingService.embed(`${params.role}: ${trimmed}`);
      const admin = createAdminClient();
      await admin.from("sales_training_message_embeddings").upsert({
        message_id: params.messageId,
        session_id: params.sessionId,
        organization_id: params.organizationId,
        agent_id: params.agentId,
        role: params.role,
        content: trimmed.slice(0, 4000),
        embedding,
      }, { onConflict: "message_id" });
    } catch {
      // Embeddings are memory enhancement, not a blocker for live coaching.
    }
  },

  async retrieveRelevantMemory(profile: UserProfile, params: {
    query: string;
    sessionId?: string;
    limit?: number;
  }) {
    const organizationId = requireOrg(profile);
    const query = params.query.trim();
    if (!query) return [] as SalesTrainingMemoryRow[];
    const admin = createAdminClient();
    try {
      const embedding = await embeddingService.embed(query);
      const { data, error } = await admin.rpc("match_sales_training_memory", {
        query_embedding: embedding,
        match_threshold: 0.35,
        match_count: params.limit ?? 8,
        p_organization_id: organizationId,
        p_agent_id: profile.id,
        p_session_id: params.sessionId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as SalesTrainingMemoryRow[];
    } catch {
      const { data } = await admin
        .from("sales_training_messages")
        .select("id, session_id, role, content, created_at")
        .eq("organization_id", organizationId)
        .eq("agent_id", profile.id)
        .or(`content.ilike.%${query.split(/\s+/)[0]}%`)
        .order("created_at", { ascending: false })
        .limit(params.limit ?? 8);
      return (data ?? []).map((row: { id: string; session_id: string; role: "agent" | "buyer" | "coach" | "system"; content: string; created_at: string }) => ({
        message_id: row.id,
        session_id: row.session_id,
        role: row.role,
        content: row.content,
        similarity: 0.5,
        created_at: row.created_at,
      }));
    }
  },

  async saveAssessment(profile: UserProfile, sessionId: string, result: SalesTrainingCoachResult) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const { data: session, error: sessionError } = await admin
      .from("sales_training_sessions")
      .select("agent_id")
      .eq("organization_id", organizationId)
      .eq("id", sessionId)
      .single();
    if (sessionError) throw sessionError;
    const { error } = await admin.from("sales_training_assessments").insert({
      session_id: sessionId,
      organization_id: organizationId,
      agent_id: session.agent_id,
      readiness_score: result.readinessScore,
      discovery_score: result.score.discovery,
      objection_score: result.score.objectionHandling,
      product_knowledge_score: result.score.productKnowledge,
      empathy_score: result.score.empathy,
      closing_score: result.score.closing,
      compliance_score: result.score.compliance,
      strengths: result.strengths,
      improvements: result.improvements,
      manager_summary: result.managerSummary,
      next_drill: result.nextDrill,
      raw_assessment: result,
    });
    if (error) throw error;
  },

  async logVoiceCall(profile: UserProfile, params: {
    sessionId: string;
    transcript: string;
    status?: "completed" | "failed";
    durationSeconds?: number;
  }) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const { error } = await admin.from("sales_training_voice_calls").insert({
      session_id: params.sessionId,
      organization_id: organizationId,
      agent_id: profile.id,
      provider: "elevenlabs",
      stt_model: process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2",
      tts_model: process.env.ELEVENLABS_TTS_MODEL ?? null,
      transcript: params.transcript,
      status: params.status ?? "completed",
      duration_seconds: params.durationSeconds ?? null,
    });
    if (error) throw error;
  },

  async overview(profile: UserProfile) {
    const organizationId = requireOrg(profile);
    const admin = createAdminClient();
    const [{ data: sessions }, { data: assessments }, { data: calls }, { data: profiles }] = await Promise.all([
      admin.from("sales_training_sessions").select("id, agent_id, training_mode, scenario_title, difficulty, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
      admin.from("sales_training_assessments").select("agent_id, readiness_score, discovery_score, objection_score, product_knowledge_score, empathy_score, closing_score, compliance_score, manager_summary, next_drill, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200),
      admin.from("sales_training_voice_calls").select("id, agent_id, created_at").eq("organization_id", organizationId).limit(200),
      admin.from("profiles").select("id, full_name, email").eq("organization_id", organizationId),
    ]);
    const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name?: string | null; email?: string | null }) => [p.id, p.full_name || p.email || "Sales agent"]));
    const latestByAgent = new Map<string, AssessmentRow>();
    for (const row of (assessments ?? []) as AssessmentRow[]) {
      if (row.agent_id && !latestByAgent.has(row.agent_id)) latestByAgent.set(row.agent_id, row);
    }
    const latest = ((assessments ?? []) as AssessmentRow[])[0];
    const totals = {
      sessions: sessions?.length ?? 0,
      voiceCalls: calls?.length ?? 0,
      averageReadiness: assessments?.length ? Math.round((assessments as { readiness_score: number }[]).reduce((sum, row) => sum + row.readiness_score, 0) / assessments.length) : 0,
      managerAlerts: ((assessments ?? []) as { readiness_score: number }[]).filter((row) => row.readiness_score < 75).length,
    };
    return {
      scenarios: SALES_TRAINING_SCENARIOS,
      sessions: sessions ?? [],
      totals,
      readinessTrend: ((assessments ?? []) as { readiness_score: number; created_at: string }[]).slice(0, 12).reverse().map((row, index) => ({
        label: new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) || `Drill ${index + 1}`,
        score: row.readiness_score,
      })),
      skillBreakdown: latest ? [
        { label: "Discovery", value: latest.discovery_score },
        { label: "Objections", value: latest.objection_score },
        { label: "Knowledge", value: latest.product_knowledge_score },
        { label: "Empathy", value: latest.empathy_score },
        { label: "Closing", value: latest.closing_score },
        { label: "Compliance", value: latest.compliance_score },
      ] : [],
      managerRows: Array.from(latestByAgent.entries()).map(([agentId, row]) => ({
        agent: profileMap.get(agentId) ?? "Sales agent",
        readiness: row.readiness_score,
        sessions: (sessions ?? []).filter((session: { agent_id: string }) => session.agent_id === agentId).length,
        focus: row.next_drill ?? "Next best drill",
        trend: row.readiness_score >= 80 ? "Ready" : "Needs coaching",
      })),
      latestAssessment: latest ?? null,
    };
  },
};
