import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api-utils";
import { getSuperAdminConfig } from "@/lib/platform-settings";
import { verifyPassword } from "@/lib/super-admin-auth";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const config = await getSuperAdminConfig();

    if (!config.configured) {
      return jsonError("Super admin not configured. Visit /admin/setup first.", 400);
    }

    if (body.username !== config.username || !verifyPassword(body.password, config.password_hash)) {
      return jsonError("Invalid super admin credentials", 401);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: config.email,
      password: body.password,
    });

    if (error) return jsonError(error.message, 401);
    return NextResponse.json({ ok: true, redirect: "/admin" });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("Invalid credentials", 400);
    return jsonError(err instanceof Error ? err.message : "Login failed", 500);
  }
}
