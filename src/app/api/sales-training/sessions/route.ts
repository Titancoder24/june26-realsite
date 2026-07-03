import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import { salesTrainingService } from "@/services/sales-training.service";
import type { SalesTrainingDifficulty, SalesTrainingMode, SalesTrainingScenarioId } from "@/lib/sales-training";

const createSchema = z.object({
  scenarioId: z.string(),
  mode: z.enum(["text", "voice"]).default("text"),
  difficulty: z.enum(["easy", "medium", "hard", "elite"]).default("medium"),
  datasetIds: z.array(z.string().uuid()).default([]),
});

export async function GET() {
  return withAuth(async (profile) => {
    const sessions = await salesTrainingService.listSessions(profile);
    return NextResponse.json({ sessions });
  }, "sales_agent");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = createSchema.parse(await req.json());
    const session = await salesTrainingService.createSession(profile, {
      scenarioId: body.scenarioId as SalesTrainingScenarioId,
      mode: body.mode as SalesTrainingMode,
      difficulty: body.difficulty as SalesTrainingDifficulty,
      datasetIds: body.datasetIds,
    });
    const full = await salesTrainingService.getSession(profile, session.id);
    return NextResponse.json(full, { status: 201 });
  }, "sales_agent");
}
