import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { runImageEnhancement } from "@/services/walkthrough.service";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    try {
      const url = await runImageEnhancement(id);
      return NextResponse.json({ enhanced_image_url: url });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Enhancement failed", 500);
    }
  }, "project_manager");
}
