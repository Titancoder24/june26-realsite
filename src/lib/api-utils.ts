import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/session";
import type { UserRole } from "@/types/domain";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withAuth(handler: (profile: Awaited<ReturnType<typeof requireProfile>>) => Promise<Response>, minRole?: UserRole) {
  try {
    const profile = await requireProfile(minRole);
    return await handler(profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "Unauthorized") return jsonError("Unauthorized", 401);
    if (msg === "Forbidden") return jsonError("Forbidden", 403);
    return jsonError(msg, 500);
  }
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** Turn Postgres/Supabase errors into short user-facing messages. */
export function formatDbError(message: string): string {
  if (message.includes("experiences_type_check")) {
    return "This experience type is not enabled yet. Ask your admin to run the latest database migration.";
  }
  if (message.includes("violates check constraint")) {
    return "Invalid data for this action. Please refresh and try again.";
  }
  if (message.includes("duplicate key")) {
    return "This record already exists.";
  }
  return message;
}
