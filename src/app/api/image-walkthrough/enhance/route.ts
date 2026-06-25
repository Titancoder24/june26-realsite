import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api-utils";
import { runImageWalkthroughNodeEnhancement, skipImageWalkthroughNodeEnhancement } from "@/services/image-walkthrough.service";

export const maxDuration = 300;

const schema = z.object({
  experience_id: z.string().uuid(),
  skip_pending: z.boolean().optional(),
});

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    if (body.skip_pending) {
      const { data: pending } = await admin
        .from("image_walkthrough_nodes")
        .select("id")
        .eq("experience_id", body.experience_id)
        .in("enhancement_status", ["pending", "failed"]);
      for (const n of pending ?? []) {
        await skipImageWalkthroughNodeEnhancement(n.id);
      }
      return NextResponse.json({ skipped: pending?.length ?? 0 });
    }

    const { data: nodes } = await admin
      .from("image_walkthrough_nodes")
      .select("id, original_filename, display_name, enhancement_status")
      .eq("experience_id", body.experience_id)
      .in("enhancement_status", ["pending", "failed"]);

    if (!nodes?.length) return NextResponse.json({ enhanced: 0, results: [] });

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const node of nodes) {
      try {
        await runImageWalkthroughNodeEnhancement(node.id);
        results.push({ id: node.id, ok: true });
      } catch (err) {
        results.push({
          id: node.id,
          ok: false,
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    return NextResponse.json({
      enhanced: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  }, "project_manager");
}
