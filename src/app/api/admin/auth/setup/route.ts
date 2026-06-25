import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api-utils";
import { getSuperAdminConfig, setPlatformSetting } from "@/lib/platform-settings";
import { hashPassword } from "@/lib/super-admin-auth";

const schema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(8),
  email: z.string().email().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const existing = await getSuperAdminConfig();
    if (existing.configured) {
      return jsonError("Super admin already configured. Use login instead.", 400);
    }

    const email = body.email ?? `${body.username}@realsite.platform`;
    const admin = createAdminClient();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: "Platform Super Admin", role: "platform_admin" },
    });

    if (createErr || !created.user) {
      return jsonError(createErr?.message ?? "Failed to create super admin user", 500);
    }

    await admin.from("profiles").upsert({
      id: created.user.id,
      email,
      full_name: "Platform Super Admin",
      role: "platform_admin",
    });

    await setPlatformSetting("super_admin", {
      username: body.username,
      email,
      password_hash: hashPassword(body.password),
      configured: true,
    });

    const supabase = await createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: body.password });
    if (signInErr) return jsonError(signInErr.message, 500);

    return NextResponse.json({ ok: true, email });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("Invalid setup data", 400);
    return jsonError(err instanceof Error ? err.message : "Setup failed", 500);
  }
}

export async function GET() {
  const config = await getSuperAdminConfig();
  return NextResponse.json({ configured: config.configured, username: config.username });
}
