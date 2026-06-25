"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { imageWalkthroughAdminStudioPath, getImageWalkthroughApprovalStatus } from "@/lib/image-walkthrough-approval";
import { Map, Plus } from "lucide-react";
import { toast } from "sonner";

type ImageWalkthroughRow = {
  id: string;
  status: string;
  slug: string;
  property_id: string;
  published_url?: string | null;
  properties?: { name: string; projects?: { name: string } };
};

type PropertyRow = {
  id: string;
  name: string;
  projects?: { name: string };
};

export function AdminImageWalkthroughDashboard() {
  const router = useRouter();
  const [walkthroughs, setWalkthroughs] = useState<ImageWalkthroughRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/image-walkthrough")
      .then((r) => (r.ok ? r.json() : []))
      .then(setWalkthroughs)
      .catch(() => {});
    fetch("/api/admin/properties")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProperties)
      .catch(() => {});
  }, []);

  async function createWalkthrough() {
    if (!propertyId) {
      toast.error("Select a property first");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/image-walkthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      toast.success("Image Walkthrough created");
      router.push(imageWalkthroughAdminStudioPath(data.id, propertyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Image Walkthrough</h1>
        <p className="type-body mt-1 text-muted-foreground">
          Super Admin studio — create, review, and publish image walkthroughs before they appear in org dashboards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Image Walkthrough</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">Property</label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">Select property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projects?.name ? `${p.projects.name} · ` : ""}{p.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={createWalkthrough} disabled={creating || !propertyId}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? "Creating…" : "New Image Walkthrough"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {walkthroughs.map((w) => {
          const approval = getImageWalkthroughApprovalStatus(w);
          return (
            <Card key={w.id} className="border-border/60">
              <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/10 text-violet-700">
                    <Map className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">
                      {w.properties?.name ?? "Property"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {w.properties?.projects?.name ?? "Project"} · /image-walkthrough/{w.slug}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant={w.status === "published" ? "success" : "secondary"}>{w.status}</Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{approval.replace(/_/g, " ")}</Badge>
                  <Button size="sm" asChild>
                    <Link href={imageWalkthroughAdminStudioPath(w.id, w.property_id)}>
                      Open studio
                    </Link>
                  </Button>
                  {w.published_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={w.published_url} target="_blank" rel="noreferrer">View published</a>
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
        {!walkthroughs.length && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No image walkthroughs yet. Create one above to start the super-admin workflow.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
