"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Building } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { TrafficSourcesChart } from "@/components/traffic-sources-chart";

type Project = { id: string; name: string; city?: string };

function PropertiesContent() {
  const params = useSearchParams();
  const projectIdFromUrl = params.get("projectId");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromUrl ?? "");
  const [properties, setProperties] = useState<{
    id: string;
    name: string;
    unit_type?: string;
    publish_status?: string;
    experiences?: { id: string; type: string; status: string; slug?: string; published_url?: string }[];
  }[]>([]);
  const [analytics, setAnalytics] = useState<{ trafficSources?: { source: string; sessions: number }[] } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", unit_type: "", configuration: "", project_id: projectIdFromUrl ?? "" });

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setProjects(data);
        if (projectIdFromUrl) {
          setSelectedProjectId(projectIdFromUrl);
          setForm((f) => ({ ...f, project_id: projectIdFromUrl }));
        } else if (data.length === 1) {
          setSelectedProjectId(data[0].id);
          setForm((f) => ({ ...f, project_id: data[0].id }));
        }
      })
      .catch(() => {});
  }, [projectIdFromUrl]);

  useEffect(() => {
    const url = selectedProjectId ? `/api/properties?projectId=${selectedProjectId}` : "/api/properties";
    fetch(url).then((r) => r.json()).then((data) => Array.isArray(data) && setProperties(data)).catch(() => {});
    fetch("/api/analytics").then((r) => (r.ok ? r.json() : null)).then((d) => d && setAnalytics(d)).catch(() => {});
  }, [selectedProjectId]);

  const published = properties.filter((p) => p.publish_status === "published").length;
  const statusMix = useMemo(() => {
    const draft = properties.length - published;
    const total = Math.max(1, properties.length);
    return [
      { category: "Published", share: Math.round((published / total) * 100) },
      { category: "Draft", share: Math.round((draft / total) * 100) },
    ].filter((d) => d.share > 0);
  }, [properties, published]);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id) return toast.error("Select a project first");
    const res = await fetch("/api/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    setProperties((p) => [data, ...p]);
    setShowForm(false);
    setForm({ name: "", unit_type: "", configuration: "", project_id: form.project_id });
    toast.success("Property created");
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Listings"
        description="Property units across your developments — publish status and virtual tour coverage."
        actions={
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowForm(!showForm)} disabled={!projects.length}>Add Listing</Button>
            <Button className="w-full sm:w-auto" asChild><Link href="/dashboard/experiences/new">Launch 360° Capture</Link></Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="metric-label">Total Listings</CardTitle></CardHeader><CardContent><p className="metric-value">{properties.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="metric-label">Published</CardTitle></CardHeader><CardContent><p className="metric-value text-primary">{published}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="metric-label">With Tours</CardTitle></CardHeader><CardContent><p className="metric-value">{properties.filter((p) => (p.experiences?.length ?? 0) > 0).length}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {statusMix.length > 0 && <CategoryRankChart data={statusMix} title="Publish Status" description="Published vs draft listings." />}
        <TrafficSourcesChart data={analytics?.trafficSources} title="Buyer Traffic" description="Acquisition channels for tour sessions." />
      </div>

      {!projects.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No projects yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a project first, then add properties under it.{" "}
              <Link href="/dashboard/projects/new" className="text-primary underline">Create project</Link>
            </p>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="project-filter">Project</label>
          <select
            id="project-filter"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setForm((f) => ({ ...f, project_id: e.target.value }));
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <form onSubmit={createProperty} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
          <select
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm md:col-span-2"
            value={form.project_id}
            onChange={(e) => setForm({ ...form, project_id: e.target.value })}
            required
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
            ))}
          </select>
          <Input placeholder="Property name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Unit type (2BHK, 3BHK…)" value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} />
          <Input placeholder="Configuration" value={form.configuration} onChange={(e) => setForm({ ...form, configuration: e.target.value })} />
          <Button type="submit" disabled={!form.project_id}>Save Property</Button>
        </form>
      )}
      <div className="space-y-3">
        {properties.map((p) => {
          const walkthrough = p.experiences?.find((e) => e.type === "cinematic_walkthrough");
          return (
          <Card key={p.id}>
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {p.unit_type ?? "Unit"} · {p.experiences?.length ?? 0} experiences
                  {walkthrough ? ` · Walkthrough ${walkthrough.status}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={p.publish_status === "published" ? "success" : "secondary"}>{p.publish_status ?? "draft"}</Badge>
                {walkthrough && (
                  <>
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        href={`/walkthrough/${walkthrough.slug ?? walkthrough.id}${walkthrough.status === "published" ? "" : "?preview=1"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View walkthrough
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/walkthrough/${walkthrough.id}?propertyId=${p.id}`}>Edit walkthrough</Link>
                    </Button>
                  </>
                )}
                {!walkthrough && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/experiences/new`}>Create walkthrough</Link>
                  </Button>
                )}
                <Link href={`/dashboard/properties/${p.id}`} className="text-sm text-primary underline">Edit</Link>
              </div>
            </CardHeader>
          </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  return <Suspense fallback={<p>Loading…</p>}><PropertiesContent /></Suspense>;
}
