import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim().toLowerCase(),
      password: body.password,
    });

    if (error) return jsonError(error.message, 401);
    if (!data.session) return jsonError("Sign in failed. Please try again.", 401);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("Invalid email or password", 400);
    return jsonError(err instanceof Error ? err.message : "Login failed", 500);
  }
}
