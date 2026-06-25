import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api-utils";
import { runImageEnhancement } from "@/services/walkthrough.service";

export const maxDuration = 300;

const schema = z.object({ experience_id: z.string().uuid() });

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data: images } = await admin
      .from("walkthrough_images")
      .select("id")
      .eq("experience_id", body.experience_id)
      .in("enhancement_status", ["pending", "failed", "rejected"]);

    if (!images?.length) return NextResponse.json({ enhanced: 0 });

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const img of images) {
      try {
        await runImageEnhancement(img.id);
        results.push({ id: img.id, ok: true });
      } catch (err) {
        results.push({ id: img.id, ok: false, error: err instanceof Error ? err.message : "failed" });
      }
    }

    return NextResponse.json({ enhanced: results.filter((r) => r.ok).length, results });
  }, "project_manager");
}
