import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { brochureService } from "@/services/brochure.service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const brochure = await brochureService.getPublicBySlug(slug);
    return NextResponse.json(brochure);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Brochure not found";
    return jsonError(message, 404);
  }
}
