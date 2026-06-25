import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  image_url: z.string().url().optional(),
  name: z.string().optional(),
  pins: z.array(z.unknown()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("floor_maps").update(body).eq("id", id).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "project_manager");
}
