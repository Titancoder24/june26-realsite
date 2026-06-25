import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/domain";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  organization_id: string | null;
  role: UserRole;
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<UserProfile | null> {
  const user = await getSession();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, organization_id, role")
    .eq("id", user.id)
    .single();

  if (data) return data as UserProfile;

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ?? null,
    organization_id: user.user_metadata?.organization_id ?? null,
    role: (user.user_metadata?.role as UserRole) ?? "organization_admin",
  };
}

export async function requireProfile(minRole?: UserRole): Promise<UserProfile> {
  const profile = await getProfile();
  if (!profile) throw new Error("Unauthorized");

  if (minRole) {
    const { hasRole } = await import("./rbac");
    if (!hasRole(profile.role, minRole)) throw new Error("Forbidden");
  }
  return profile;
}

export async function ensureOrganization(userId: string, orgName: string) {
  const admin = createAdminClient();
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name: orgName, slug: `${slug}-${Date.now().toString(36)}` })
    .select()
    .single();

  if (error) throw error;

  await admin.from("profiles").update({ organization_id: org.id, role: "organization_admin" }).eq("id", userId);
  return org;
}
