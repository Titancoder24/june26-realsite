import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOrganization } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  organizationName: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.fullName, role: "organization_admin" },
    });

    if (error) return jsonError(error.message, 400);
    if (!data.user) return jsonError("User creation failed", 500);

    await ensureOrganization(data.user.id, body.organizationName);

    return NextResponse.json({ userId: data.user.id }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Signup failed", 500);
  }
}
