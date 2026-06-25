import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { jsonError } from "@/lib/api-utils";

export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return jsonError("LiveKit not configured", 503);
  }

  const { room, identity } = await req.json();
  const token = new AccessToken(apiKey, apiSecret, { identity: identity ?? "guest" });
  token.addGrant({ roomJoin: true, room: room ?? "family" });
  const jwt = await token.toJwt();
  return NextResponse.json({ token: jwt, url: process.env.LIVEKIT_URL });
}
