import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { analyzeImageWalkthroughNode, guessTargetNodeId } from "@/services/image-walkthrough-ai.service";
import { refreshImageWalkthroughChecklist } from "@/services/image-walkthrough.service";
import { getNodeDisplayImageUrl } from "@/lib/image-walkthrough-utils";

const schema = z.object({
  experience_id: z.string().uuid(),
  node_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    let query = admin.from("image_walkthrough_nodes").select("*").eq("experience_id", body.experience_id);
    if (body.node_id) query = query.eq("id", body.node_id);
    const { data: nodes, error } = await query.order("node_order");
    if (error) return jsonError(error.message, 500);
    if (!nodes?.length) return jsonError("No nodes to analyze", 400);

    const allNodes = await admin.from("image_walkthrough_nodes").select("id, room_type").eq("experience_id", body.experience_id);
    const nodeList = allNodes.data ?? [];

    const results = [];
    for (const node of nodes) {
      try {
        const analysis = await analyzeImageWalkthroughNode(getNodeDisplayImageUrl(node));
        await admin.from("image_walkthrough_nodes").update({
          display_name: analysis.display_name,
          room_type: analysis.room_type,
          zone: analysis.zone,
          floor_label: analysis.floor_label,
          description: analysis.description,
          media_type: analysis.media_type ?? node.media_type,
          ai_confidence: analysis.confidence,
          ai_reasoning: analysis.reasoning,
          ai_analysis: analysis,
          updated_at: new Date().toISOString(),
        }).eq("id", node.id);

        for (const ann of analysis.suggested_annotations ?? []) {
          await admin.from("image_walkthrough_annotations").insert({
            experience_id: body.experience_id,
            node_id: node.id,
            x_position: ann.x_position,
            y_position: ann.y_position,
            title: ann.title,
            description: ann.description ?? "",
            category: ann.category ?? "feature",
            ai_suggested: true,
            confidence: ann.confidence,
          });
        }

        for (const hs of analysis.suggested_hotspots ?? []) {
          const toNodeId = guessTargetNodeId(nodeList, hs.target_room_type_guess, 0.75, hs.confidence ?? 0);
          await admin.from("image_walkthrough_hotspots").insert({
            experience_id: body.experience_id,
            from_node_id: node.id,
            to_node_id: toNodeId,
            x_position: hs.x_position,
            y_position: hs.y_position,
            label: hs.label,
            direction: hs.direction ?? "forward",
            ai_suggested: true,
            confidence: hs.confidence,
          });
        }

        results.push({ nodeId: node.id, ok: true, confidence: analysis.confidence });
      } catch (err) {
        results.push({ nodeId: node.id, ok: false, error: err instanceof Error ? err.message : "Analysis failed" });
      }
    }

    const hasPanorama = nodes.some((n) => n.media_type === "equirectangular");
    await admin.from("image_walkthrough_settings").upsert({
      experience_id: body.experience_id,
      panorama_ready: hasPanorama,
      updated_at: new Date().toISOString(),
    });

    await refreshImageWalkthroughChecklist(body.experience_id);
    return NextResponse.json({ analyzed: results.filter((r) => r.ok).length, results });
  }, "project_manager");
}
