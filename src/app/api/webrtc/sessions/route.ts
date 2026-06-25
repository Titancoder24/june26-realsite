import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { crmService } from "@/services/crm.service";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  buyerSessionId: z.string().uuid(),
  propertyId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const roomCode = uuidv4().slice(0, 8);
    const inviteToken = uuidv4();

    const { data: session } = await admin.from("buyer_sessions").select("organization_id").eq("id", body.buyerSessionId).single();
    if (!session) return jsonError("Session not found", 404);

    const { data: room, error } = await admin.from("webrtc_sessions").insert({
      buyer_session_id: body.buyerSessionId,
      room_code: roomCode,
      invite_token: inviteToken,
      status: "active",
    }).select().single();

    if (error) return jsonError(error.message, 500);

    await admin.from("buyer_sessions").update({ family_session_id: room.id }).eq("id", body.buyerSessionId);

    await crmService.recordEvent({
      sessionId: body.buyerSessionId,
      propertyId: body.propertyId,
      organizationId: session.organization_id,
      eventType: "invited_family",
      payload: { roomCode },
    });

    const { data: exp } = await admin.from("experiences").select("slug").eq("property_id", body.propertyId).eq("status", "published").limit(1).maybeSingle();
    const base = exp?.slug ? `${env.NEXT_PUBLIC_APP_URL}/view/${exp.slug}` : env.NEXT_PUBLIC_APP_URL;
    const inviteUrl = `${base}?family=${inviteToken}&room=${roomCode}`;

    return NextResponse.json({ roomId: room.id, roomCode, inviteUrl });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed", 500);
  }
}
