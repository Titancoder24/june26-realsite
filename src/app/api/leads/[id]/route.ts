import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  lead_status: z.string().optional(),
  assigned_agent: z.string().uuid().optional(),
  next_follow_up: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data: lead, error } = await admin
      .from("leads")
      .select("*, properties(name), projects(name)")
      .eq("id", id)
      .eq("organization_id", profile.organization_id!)
      .single();
    if (error) return jsonError("Not found", 404);

    const { data: events } = await admin
      .from("lead_events")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });

    const { data: messages } = await admin
      .from("conversation_messages")
      .select("*")
      .eq("session_id", lead.session_id)
      .order("created_at");

    return NextResponse.json({ lead, events: events ?? [], messages: messages ?? [] });
  }, "sales_agent");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("leads").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", profile.organization_id!).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "sales_manager");
}
