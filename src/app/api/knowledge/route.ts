import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { embeddingService } from "@/services/embedding.service";
import { ragService } from "@/services/rag.service";

const schema = z.object({
  property_id: z.string().uuid(),
  category: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
  approved: z.boolean().optional(),
});

export async function GET(req: Request) {
  return withAuth(async () => {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId");
    if (!propertyId) return jsonError("propertyId required");
    const admin = createAdminClient();
    const { data, error } = await admin.from("knowledge_entries").select("*").eq("property_id", propertyId).order("category");
    if (error) return jsonError(error.message, 500);
    const readiness = await ragService.getReadinessScore(propertyId);
    return NextResponse.json({ entries: data, readiness });
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("knowledge_entries").insert({
      ...body,
      organization_id: profile.organization_id,
      created_by: profile.id,
      approved: body.approved ?? false,
    }).select().single();
    if (error) return jsonError(error.message, 500);

    const embedding = await embeddingService.embed(`${body.title}\n${body.content}`);
    await admin.from("knowledge_embeddings").upsert({
      knowledge_entry_id: data.id,
      embedding,
    }, { onConflict: "knowledge_entry_id" });

    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
