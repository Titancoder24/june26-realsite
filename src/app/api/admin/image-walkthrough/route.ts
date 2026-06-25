import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError, slugify, formatDbError } from "@/lib/api-utils";

const createSchema = z.object({
  property_id: z.string().uuid(),
});

export async function GET() {
  return withAuth(async () => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("experiences")
      .select("id, type, status, slug, property_id, organization_id, published_url, updated_at, properties(name, projects(name))")
      .eq("type", "image_walkthrough")
      .order("updated_at", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data ?? []);
  }, "platform_admin");
}

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = createSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("name, organization_id")
      .eq("id", body.property_id)
      .single();

    if (propertyError || !property?.organization_id) {
      return jsonError("Property not found", 404);
    }

    const slug = slugify(`${property.name ?? "property"}-image-walkthrough-${Date.now().toString(36)}`);

    const { data, error } = await admin
      .from("experiences")
      .insert({
        property_id: body.property_id,
        organization_id: property.organization_id,
        type: "image_walkthrough",
        status: "draft",
        slug,
        primary_experience: false,
      })
      .select()
      .single();

    if (error) return jsonError(formatDbError(error.message), 500);
    return NextResponse.json(data, { status: 201 });
  }, "platform_admin");
}
