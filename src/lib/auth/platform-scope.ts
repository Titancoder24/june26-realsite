import type { UserProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export function isPlatformAdmin(profile: UserProfile): boolean {
  return profile.role === "platform_admin";
}

export async function resolveOrganizationId(
  profile: UserProfile,
  opts?: { propertyId?: string; experienceId?: string },
): Promise<string | null> {
  if (profile.organization_id) return profile.organization_id;
  if (!isPlatformAdmin(profile)) return null;

  const admin = createAdminClient();
  if (opts?.experienceId) {
    const { data } = await admin
      .from("experiences")
      .select("organization_id")
      .eq("id", opts.experienceId)
      .single();
    return data?.organization_id ?? null;
  }
  if (opts?.propertyId) {
    const { data } = await admin
      .from("properties")
      .select("organization_id")
      .eq("id", opts.propertyId)
      .single();
    return data?.organization_id ?? null;
  }
  return null;
}
