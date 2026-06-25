"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SettingsPage() {
  const [profile, setProfile] = useState<{ full_name?: string; email?: string; role?: string } | null>(null);
  const [branding, setBranding] = useState({ primary_color: "#4f46e5", logo_url: "" });
  const [customDomain, setCustomDomain] = useState("");
  const [dbHealth, setDbHealth] = useState<{ connected: boolean; configured: boolean; latencyMs?: number; error?: string; projectUrl?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfile({ email: data.user.email ?? undefined, full_name: data.user.user_metadata?.full_name, role: data.user.user_metadata?.role });
    });
    fetch("/api/organization/settings").then((r) => r.json()).then((d) => {
      if (d.branding) setBranding({ primary_color: d.branding.primary_color ?? "#4f46e5", logo_url: d.branding.logo_url ?? "" });
      if (d.custom_domain) setCustomDomain(d.custom_domain);
    }).catch(() => {});
    fetch("/api/health/db").then((r) => r.json()).then(setDbHealth).catch(() => {});
  }, []);

  async function saveBranding() {
    const res = await fetch("/api/organization/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branding, custom_domain: customDomain, white_label_config: { enabled: true } }),
    });
    if (!res.ok) return toast.error("Failed to save");
    toast.success("White-label settings saved");
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="section-title">Settings</h1>
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {profile?.full_name}</p>
          <p><span className="text-muted-foreground">Email:</span> {profile?.email}</p>
          <p><span className="text-muted-foreground">Role:</span> {profile?.role ?? "organization_admin"}</p>
          <Button variant="outline" onClick={logout}>Sign Out</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Database Connection</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {dbHealth ? (
            <>
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className={dbHealth.connected ? "text-emerald-600" : "text-amber-700"}>
                  {dbHealth.connected ? "Connected" : dbHealth.configured ? "Configured but unreachable" : "Not configured"}
                </span>
              </p>
              {dbHealth.projectUrl && <p><span className="text-muted-foreground">Project:</span> {dbHealth.projectUrl}</p>}
              {dbHealth.latencyMs != null && <p><span className="text-muted-foreground">Latency:</span> {dbHealth.latencyMs}ms</p>}
              {dbHealth.error && <p className="text-amber-800">{dbHealth.error}</p>}
              {!dbHealth.connected && (
                <p className="text-muted-foreground">Set real Supabase keys in <code>.env.local</code> and apply migrations 001–003. Authenticate the Supabase MCP server in Cursor to manage schema from the IDE.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Checking connection…</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>White-Label Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Primary color" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
          <Input placeholder="Logo URL" value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />
          <Input placeholder="Custom domain (e.g. tours.yourbrand.com)" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} />
          <Button onClick={saveBranding}>Save Branding</Button>
        </CardContent>
      </Card>
    </div>
  );
}
