import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError, slugify } from "@/lib/api-utils";
import { env } from "@/lib/env";

const schema = z.object({
  property_id: z.string().uuid(),
  experience_id: z.string().uuid().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  sales_agent_id: z.string().uuid().optional(),
});

export async function GET() {
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("campaign_links")
      .select("*, properties(name)")
      .eq("organization_id", profile.organization_id!)
      .order("created_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "marketing_manager");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    let experienceSlug = "";
    if (body.experience_id) {
      const { data: exp } = await admin.from("experiences").select("slug").eq("id", body.experience_id).single();
      experienceSlug = exp?.slug ?? "";
    } else {
      const { data: exp } = await admin.from("experiences").select("slug").eq("property_id", body.property_id).eq("status", "published").eq("primary_experience", true).maybeSingle();
      experienceSlug = exp?.slug ?? "";
    }

    const slug = slugify(`campaign-${body.utm_campaign ?? "link"}-${Date.now().toString(36)}`);
    const params = new URLSearchParams();
    if (body.utm_source) params.set("utm_source", body.utm_source);
    if (body.utm_medium) params.set("utm_medium", body.utm_medium);
    if (body.utm_campaign) params.set("utm_campaign", body.utm_campaign);

    const baseUrl = experienceSlug ? `${env.NEXT_PUBLIC_APP_URL}/view/${experienceSlug}` : `${env.NEXT_PUBLIC_APP_URL}/view/${slug}`;
    const fullUrl = params.toString() ? `${baseUrl}?${params}` : baseUrl;

    const { data, error } = await admin.from("campaign_links").insert({
      organization_id: profile.organization_id,
      property_id: body.property_id,
      experience_id: body.experience_id,
      slug,
      utm_source: body.utm_source,
      utm_medium: body.utm_medium,
      utm_campaign: body.utm_campaign,
      sales_agent_id: body.sales_agent_id,
    }).select().single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ...data, url: fullUrl }, { status: 201 });
  }, "marketing_manager");
}
