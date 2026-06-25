"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Cloud, Loader2, Play, Router, Save, Sparkles, Wand2 } from "lucide-react";

interface WalkthroughAIConfig {
  provider: "openrouter" | "vertex";
  openrouter: { configured: boolean; planner: string; video: string };
  vertex: {
    configured: boolean;
    planner_model: string;
    video_model: string;
    location: string;
    project_id: string;
    api_key_set: boolean;
    api_key_preview: string;
  };
}

type PipelineTestResult = {
  ok: boolean;
  provider: string;
  planner: { ok: boolean; model?: string; latency_ms?: number; error?: string };
  video: { ok: boolean; model?: string; operation?: string; error?: string };
  config: {
    vertex_configured: boolean;
    project_id: string;
    location: string;
    openrouter_configured: boolean;
  };
};

export default function WalkthroughAIAdminPage() {
  const [config, setConfig] = useState<WalkthroughAIConfig | null>(null);
  const [vertexKey, setVertexKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("us-central1");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pipelineTest, setPipelineTest] = useState<PipelineTestResult | null>(null);

  function load() {
    fetch("/api/admin/walkthrough-ai")
      .then((r) => r.json())
      .then((d) => {
        setConfig(d);
        setProjectId(d.vertex?.project_id ?? "");
        setLocation(d.vertex?.location ?? "us-central1");
      });
  }

  useEffect(() => { load(); }, []);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch("/api/admin/walkthrough-ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) throw new Error(data.error ?? "Save failed");
    return data;
  }

  async function saveVertexCredentials() {
    try {
      await patch({
        vertex_api_key: vertexKey || undefined,
        vertex_project_id: projectId,
        vertex_location: location,
        reason: "Saved Vertex API key and project ID",
      });
      toast.success("Vertex credentials saved");
      setVertexKey("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function setProvider(provider: "openrouter" | "vertex") {
    try {
      await patch({
        provider,
        vertex_api_key: vertexKey || undefined,
        vertex_project_id: projectId,
        vertex_location: location,
        reason: `Switched walkthrough AI to ${provider}`,
      });
      toast.success(`Active provider: ${provider === "vertex" ? "Google Vertex AI" : "OpenRouter"}`);
      setVertexKey("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update provider");
    }
  }

  async function testPipeline() {
    setTesting(true);
    setPipelineTest(null);
    try {
      const res = await fetch("/api/admin/walkthrough-ai/test", { method: "POST" });
      const data = await res.json();
      setPipelineTest(data);
      if (data.ok) {
        toast.success("Pipeline healthy — planner and video submit working");
      } else {
        toast.error("Pipeline test failed — check details below");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pipeline test failed");
    } finally {
      setTesting(false);
    }
  }

  async function saveAndActivateVertex() {
    try {
      await patch({
        provider: "vertex",
        vertex_api_key: vertexKey || undefined,
        vertex_project_id: projectId,
        vertex_location: location,
        reason: "Saved and activated Vertex AI for walkthrough pipeline",
      });
      toast.success("Vertex saved and activated");
      setVertexKey("");
      load();
      await testPipeline();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  if (!config) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="section-title">Property Walkthrough AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure Gemini (scene planning) and Veo 3.1 Lite (motion) for the Property Walkthrough pipeline.
        </p>
      </div>

      <Card id="provider">
        <CardHeader>
          <CardTitle className="text-base">Active AI provider</CardTitle>
          <CardDescription>Choose whether scene planning and motion use OpenRouter or Google Vertex AI directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant={config.provider === "openrouter" ? "default" : "outline"}
              disabled={saving}
              onClick={() => setProvider("openrouter")}
              className="gap-2"
            >
              <Router className="h-4 w-4" /> OpenRouter
              {config.provider === "openrouter" && <Badge variant="secondary">Active</Badge>}
            </Button>
            <Button
              variant={config.provider === "vertex" ? "default" : "outline"}
              disabled={saving}
              onClick={() => setProvider("vertex")}
              className="gap-2"
            >
              <Cloud className="h-4 w-4" /> Google Vertex AI
              {config.provider === "vertex" && <Badge variant="secondary">Active</Badge>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Planner: {config.provider === "vertex" ? config.vertex.planner_model : config.openrouter.planner} ·
            Video: {config.provider === "vertex" ? config.vertex.video_model : config.openrouter.video}
          </p>
        </CardContent>
      </Card>

      <Card id="vertex">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" /> Google Vertex AI credentials
          </CardTitle>
          <CardDescription>
            Save your Vertex API key and project ID. Credentials are stored in Supabase and used for Property Walkthrough when Vertex is active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Status: </span>
            {config.vertex.configured ? (
              <span className="font-medium text-emerald-700">
                Configured {config.vertex.api_key_preview && `(key ${config.vertex.api_key_preview})`}
                {config.vertex.project_id && ` · project ${config.vertex.project_id}`}
              </span>
            ) : (
              <span className="text-amber-700">Not configured — add API key below</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vertex-key">Vertex API key</Label>
              <Input
                id="vertex-key"
                type="password"
                placeholder={config.vertex.api_key_set ? "••••••••  (leave blank to keep current)" : "AQ.xxx… from Google Cloud"}
                value={vertexKey}
                onChange={(e) => setVertexKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-id">Google Cloud project ID</Label>
              <Input
                id="project-id"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="your-gcp-project-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Region / location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="us-central1"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveVertexCredentials} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save credentials
            </Button>
            <Button
              variant="outline"
              disabled={saving}
              onClick={saveAndActivateVertex}
              className="gap-2"
            >
              Save & activate Vertex
            </Button>
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p>Gemini planner: <span className="font-mono">{config.vertex.planner_model}</span></p>
            <p>Veo video: <span className="font-mono">{config.vertex.video_model}</span></p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Router className="h-4 w-4" /> OpenRouter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{config.openrouter.configured ? "Env configured" : "Missing key"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Planner</span><span className="font-mono text-xs">{config.openrouter.planner}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Video</span><span className="font-mono text-xs">{config.openrouter.video}</span></div>
          </CardContent>
        </Card>

        <Card id="pipeline">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4" /> Pipeline</CardTitle>
            <CardDescription>Test scene planning and Veo motion submit against live credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2 text-muted-foreground">
              <p className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="text-foreground">Analyze & plan scenes</strong> — Gemini vision planner</span></p>
              <p className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="text-foreground">Generate motion</strong> — Veo 3.1 Lite image-to-video</span></p>
              <p className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><strong className="text-foreground">Fallback</strong> — Scenes from uploads if AI fails</span></p>
            </div>

            <Button onClick={testPipeline} disabled={testing || saving} className="w-full gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Test pipeline
            </Button>

            {pipelineTest && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Provider</span>
                  <Badge variant={pipelineTest.ok ? "success" : "destructive"}>{pipelineTest.provider}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Planner {pipelineTest.planner.model && `(${pipelineTest.planner.model})`}</span>
                  <span className={pipelineTest.planner.ok ? "text-emerald-700" : "text-destructive"}>
                    {pipelineTest.planner.ok ? `OK${pipelineTest.planner.latency_ms ? ` · ${pipelineTest.planner.latency_ms}ms` : ""}` : pipelineTest.planner.error ?? "Failed"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Video submit {pipelineTest.video.model && `(${pipelineTest.video.model})`}</span>
                  <span className={pipelineTest.video.ok ? "text-emerald-700" : "text-destructive"}>
                    {pipelineTest.video.ok ? "Queued" : pipelineTest.video.error ?? "Failed"}
                  </span>
                </div>
                {pipelineTest.config.project_id && (
                  <p className="text-muted-foreground">Project: {pipelineTest.config.project_id}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
