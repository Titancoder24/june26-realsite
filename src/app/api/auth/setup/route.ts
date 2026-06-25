import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOrganization, getSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({ organizationName: z.string().min(2) });

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return jsonError("Unauthorized", 401);

  const { organizationName } = schema.parse(await req.json());
  const org = await ensureOrganization(user.id, organizationName);
  return NextResponse.json(org);
}
