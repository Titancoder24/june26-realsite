"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  IMAGE_WALKTHROUGH_ROOM_TYPES,
  IMAGE_WALKTHROUGH_WIZARD_STEPS,
  type ImageWalkthroughAnnotation,
  type ImageWalkthroughChecklist,
  type ImageWalkthroughHotspot,
  type ImageWalkthroughNode,
  type ImageWalkthroughWizardStep,
} from "@/types/image-walkthrough";
import { ImageWalkthroughViewer } from "@/components/image-walkthrough/image-walkthrough-viewer";
import {
  Check,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Rocket,
  Sparkles,
  UploadCloud,
  Wand2,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import "@/styles/image-walkthrough.css";

function confidenceBadge(c?: number | null) {
  if (c == null) return <Badge variant="outline">Needs Review</Badge>;
  const pct = Math.round(c * 100);
  return <Badge variant={c < 0.6 ? "warning" : "success"}>{pct}%</Badge>;
}

function nodeOriginalUrl(n: ImageWalkthroughNode) {
  return n.original_image_url ?? n.image_url;
}

function nodeDisplayUrl(n: ImageWalkthroughNode) {
  if (n.enhancement_status === "completed" && n.enhanced_image_url) return n.enhanced_image_url;
  return nodeOriginalUrl(n);
}

function enhancementBadge(status?: string | null) {
  const label = status ?? "pending";
  const variant = label === "completed" ? "success" : label === "failed" ? "destructive" : label === "processing" ? "default" : "secondary";
  return <Badge variant={variant as "success" | "destructive" | "default" | "secondary"}>{label}</Badge>;
}

export function ImageWalkthroughWizard({
  experienceId,
  propertyId,
}: {
  experienceId: string;
  propertyId: string;
  slug?: string;
}) {
  const [step, setStep] = useState<ImageWalkthroughWizardStep>("upload");
  const [nodes, setNodes] = useState<ImageWalkthroughNode[]>([]);
  const [hotspots, setHotspots] = useState<ImageWalkthroughHotspot[]>([]);
  const [annotations, setAnnotations] = useState<ImageWalkthroughAnnotation[]>([]);
  const [checklist, setChecklist] = useState<ImageWalkthroughChecklist | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewOpening, setPreviewOpening] = useState(false);
  const [placementMode, setPlacementMode] = useState<"hotspot" | "annotation" | null>(null);
  const [hotspotTarget, setHotspotTarget] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [bundleRes, checkRes] = await Promise.all([
      fetch(`/api/image-walkthrough/nodes?experienceId=${experienceId}`),
      fetch(`/api/image-walkthrough/checklist/${experienceId}`),
    ]);
    const bundle = await bundleRes.json();
    const check = checkRes.ok ? await checkRes.json() : null;
    setNodes(bundle.nodes ?? []);
    setHotspots(bundle.hotspots ?? []);
    setAnnotations(bundle.annotations ?? []);
    setChecklist(check);
    if (!activeNodeId && bundle.nodes?.[0]) setActiveNodeId(bundle.nodes[0].id);
  }, [experienceId, activeNodeId]);

  useEffect(() => { load(); }, [load]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("experienceId", experienceId);
      fd.append("propertyId", propertyId);
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        img.onload = () => {
          fd.append("width", String(img.width));
          fd.append("height", String(img.height));
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
      try {
        const res = await fetch("/api/image-walkthrough/nodes", { method: "POST", body: fd });
        if (res.ok) ok += 1;
      } catch { /* continue batch */ }
    }
    setUploading(false);
    toast.success(`Uploaded ${ok} image${ok === 1 ? "" : "s"}`);
    await load();
    if (ok > 0) setStep("enhance");
  }

  async function enhanceAll() {
    const pending = nodes.filter((n) => n.enhancement_status === "pending" || n.enhancement_status === "failed");
    if (!pending.length) {
      toast.info("All images already enhanced");
      setStep("analyze");
      return;
    }
    setEnhancing(true);
    setEnhanceProgress({ done: 0, total: pending.length, failed: 0 });
    let done = 0;
    let failed = 0;
    for (const node of pending) {
      try {
        const res = await fetch(`/api/image-walkthrough/nodes/${node.id}/enhance`, { method: "POST" });
        if (!res.ok) {
          failed += 1;
        } else {
          done += 1;
        }
      } catch {
        failed += 1;
      }
      setEnhanceProgress({ done, total: pending.length, failed });
      await load();
    }
    setEnhancing(false);
    toast.success(`Enhanced ${done} image${done === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""}`);
  }

  async function retryEnhance(nodeId: string) {
    setEnhancing(true);
    try {
      const res = await fetch(`/api/image-walkthrough/nodes/${nodeId}/enhance`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enhancement failed");
      toast.success("Image enhanced");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }

  async function skipEnhancement() {
    await fetch("/api/image-walkthrough/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId, skip_pending: true }),
    });
    await load();
    setStep("analyze");
  }

  async function runAnalysis(all = true) {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/image-walkthrough/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_id: experienceId,
          node_id: all ? undefined : activeNodeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      toast.success(`Analyzed ${data.analyzed} image${data.analyzed === 1 ? "" : "s"}`);
      await load();
      setStep("organize");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function updateNode(id: string, patch: Partial<ImageWalkthroughNode>) {
    const res = await fetch(`/api/image-walkthrough/nodes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return toast.error("Update failed");
    await load();
  }

  async function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placementMode || !activeNodeId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

    if (placementMode === "hotspot") {
      if (!hotspotTarget) return toast.error("Select destination image first");
      const res = await fetch("/api/image-walkthrough/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_id: experienceId,
          from_node_id: activeNodeId,
          to_node_id: hotspotTarget,
          x_position: x,
          y_position: y,
          label: nodes.find((n) => n.id === hotspotTarget)?.display_name ?? "Go",
          direction: "forward",
        }),
      });
      if (!res.ok) return toast.error("Failed to add hotspot");
      toast.success("Hotspot added");
    } else {
      const title = prompt("Annotation title")?.trim();
      if (!title) return;
      const res = await fetch("/api/image-walkthrough/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_id: experienceId,
          node_id: activeNodeId,
          x_position: x,
          y_position: y,
          title,
          description: "",
          category: "feature",
        }),
      });
      if (!res.ok) return toast.error("Failed to add annotation");
      toast.success("Annotation added");
    }
    setPlacementMode(null);
    await load();
  }

  async function openPreview() {
    setPreviewOpening(true);
    try {
      const res = await fetch(`/api/image-walkthrough/preview/${experienceId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      const path = data.previewUrl ?? `/image-walkthrough/${data.slug ?? experienceId}?preview=1`;
      const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error("Pop-up blocked — allow pop-ups, or copy this link", { description: url });
        return;
      }
      toast.success("Preview opened in a new tab");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewOpening(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      toast.success("Image Walkthrough published");
      window.open(data.publishedUrl, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  const activeNode = nodes.find((n) => n.id === activeNodeId);
  const nodeHotspots = hotspots.filter((h) => h.from_node_id === activeNodeId);
  const nodeAnnotations = annotations.filter((a) => a.node_id === activeNodeId);

  return (
    <div className="iw-studio">
      <header className="iw-header">
        <div>
          <h1 className="text-lg font-semibold">Image Walkthrough Studio</h1>
          <p className="text-sm text-muted-foreground">Google Maps–inspired navigation between property photos</p>
        </div>
        <Button variant="outline" size="sm" onClick={openPreview} disabled={previewOpening || !nodes.length}>
          {previewOpening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
          Preview Experience
        </Button>
      </header>

      <nav className="iw-steps">
        {IMAGE_WALKTHROUGH_WIZARD_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="iw-step"
            data-active={step === s.id}
            onClick={() => setStep(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="iw-body">
        {step === "upload" && (
          <div className="iw-card space-y-4">
            <h2 className="font-medium flex items-center gap-2"><UploadCloud className="h-4 w-4" /> Upload images</h2>
            <p className="text-sm text-muted-foreground">JPG, PNG, WebP — flat photos or 360° equirectangular panoramas (2:1).</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Upload Images
            </Button>
            <div className="iw-grid">
              {nodes.map((n) => (
                <div key={n.id} className="iw-node-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={nodeDisplayUrl(n)} alt={n.display_name ?? ""} />
                  <span>{n.display_name}</span>
                </div>
              ))}
            </div>
            {nodes.length > 0 && <Button onClick={() => setStep("enhance")}>Continue to Enhance Images</Button>}
          </div>
        )}

        {step === "enhance" && (
          <div className="space-y-4">
            <div className="iw-card flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-medium flex items-center gap-2"><Wand2 className="h-4 w-4" /> Enhance images</h2>
                <p className="text-sm text-muted-foreground">
                  Vertex Gemini improves clarity, lighting, and sharpness without changing room layout. Originals are kept as fallback.
                </p>
                {enhanceProgress.total > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {enhancing
                      ? `Enhancing ${enhanceProgress.done + 1} of ${enhanceProgress.total}…`
                      : `${enhanceProgress.done}/${enhanceProgress.total} done${enhanceProgress.failed ? ` · ${enhanceProgress.failed} failed` : ""}`}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={skipEnhancement} disabled={enhancing}>
                  Skip enhancement
                </Button>
                <Button onClick={enhanceAll} disabled={enhancing || !nodes.length}>
                  {enhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  {enhancing ? "Enhancing…" : "Enhance Images"}
                </Button>
              </div>
            </div>
            <div className="iw-grid">
              {nodes.map((n) => (
                <div key={n.id} className="iw-card space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={nodeOriginalUrl(n)} alt="Before" className="rounded-md aspect-video object-cover" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={nodeDisplayUrl(n)} alt="After" className="rounded-md aspect-video object-cover" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs truncate">{n.display_name}</p>
                    {enhancementBadge(n.enhancement_status)}
                  </div>
                  {n.enhancement_status === "failed" && (
                    <p className="text-xs text-destructive line-clamp-2">{n.enhancement_error}</p>
                  )}
                  {(n.enhancement_status === "failed" || n.enhancement_status === "pending") && (
                    <Button size="sm" variant="outline" onClick={() => retryEnhance(n.id)} disabled={enhancing}>
                      Retry
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button onClick={() => setStep("analyze")} disabled={enhancing}>
              Continue to Analyze Images
            </Button>
          </div>
        )}

        {step === "analyze" && (
          <div className="iw-card space-y-4">
            <h2 className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI analyze</h2>
            <p className="text-sm text-muted-foreground">Vertex AI names rooms, suggests hotspots and annotations. Low-confidence fields marked for review.</p>
            <Button onClick={() => runAnalysis(true)} disabled={analyzing || !nodes.length}>
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Analyze Images
            </Button>
          </div>
        )}

        {step === "organize" && (
          <div className="space-y-4">
            <div className="iw-grid">
              {nodes.map((n) => (
                <div key={n.id} className="iw-node-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={nodeDisplayUrl(n)} alt="" className="iw-node-card-img" />
                  <div className="space-y-2 p-3">
                    <Input value={n.display_name ?? ""} onChange={(e) => updateNode(n.id, { display_name: e.target.value })} />
                    <select className="iw-select" value={n.room_type ?? "unknown"} onChange={(e) => updateNode(n.id, { room_type: e.target.value })}>
                      {IMAGE_WALKTHROUGH_ROOM_TYPES.map((rt) => <option key={rt} value={rt}>{rt.replace(/_/g, " ")}</option>)}
                    </select>
                    <div className="flex items-center justify-between">
                      {confidenceBadge(n.ai_confidence)}
                      <Button size="sm" variant={n.is_start_node ? "default" : "outline"} onClick={() => updateNode(n.id, { is_start_node: true })}>
                        {n.is_start_node ? "Start" : "Set start"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{hotspots.filter((h) => h.from_node_id === n.id).length} hotspots</p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep("hotspots")}>Continue to Hotspots</Button>
          </div>
        )}

        {(step === "hotspots" || step === "annotations") && activeNode && (
          <div className="iw-split">
            <div className="iw-node-list">
              {nodes.map((n) => (
                <button key={n.id} type="button" className="iw-node-tab" data-active={n.id === activeNodeId} onClick={() => setActiveNodeId(n.id)}>
                  {n.display_name}
                </button>
              ))}
            </div>
            <div className="iw-canvas-wrap">
              <div className="iw-toolbar">
                {step === "hotspots" && (
                  <>
                    <select className="iw-select" value={hotspotTarget} onChange={(e) => setHotspotTarget(e.target.value)}>
                      <option value="">Destination image…</option>
                      {nodes.filter((n) => n.id !== activeNodeId).map((n) => (
                        <option key={n.id} value={n.id}>{n.display_name}</option>
                      ))}
                    </select>
                    <Button size="sm" variant={placementMode === "hotspot" ? "default" : "outline"} onClick={() => setPlacementMode(placementMode === "hotspot" ? null : "hotspot")}>
                      <Waypoints className="mr-1 h-4 w-4" /> Place hotspot
                    </Button>
                  </>
                )}
                {step === "annotations" && (
                  <Button size="sm" variant={placementMode === "annotation" ? "default" : "outline"} onClick={() => setPlacementMode(placementMode === "annotation" ? null : "annotation")}>
                    <MapPin className="mr-1 h-4 w-4" /> Place annotation
                  </Button>
                )}
              </div>
              <div className="iw-canvas" onClick={onImageClick} role="presentation">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nodeDisplayUrl(activeNode)} alt={activeNode.display_name ?? ""} className="iw-canvas-img" draggable={false} />
                {nodeHotspots.map((h) => (
                  <button key={h.id} type="button" className="iw-marker iw-marker-hotspot" style={{ left: `${h.x_position * 100}%`, top: `${h.y_position * 100}%` }} title={h.label} />
                ))}
                {nodeAnnotations.map((a) => (
                  <button key={a.id} type="button" className="iw-marker iw-marker-annotation" style={{ left: `${a.x_position * 100}%`, top: `${a.y_position * 100}%` }} title={a.title} />
                ))}
              </div>
              <ul className="text-sm space-y-1 mt-2">
                {step === "hotspots" && nodeHotspots.map((h) => (
                  <li key={h.id} className="flex justify-between">
                    <span>{h.label} → {nodes.find((n) => n.id === h.to_node_id)?.display_name ?? "unset"}</span>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await fetch(`/api/image-walkthrough/hotspots?id=${h.id}&experienceId=${experienceId}`, { method: "DELETE" });
                      await load();
                    }}>Remove</Button>
                  </li>
                ))}
                {step === "annotations" && nodeAnnotations.map((a) => (
                  <li key={a.id}>{a.title}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === "hotspots" && nodes.length > 0 && (
          <Button className="mt-4" onClick={() => setStep("annotations")}>Continue to Annotations</Button>
        )}
        {step === "annotations" && (
          <Button className="mt-4" onClick={() => setStep("preview")}>Continue to Preview Experience</Button>
        )}

        {step === "preview" && nodes.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quick preview below. Use <strong>Open full-screen preview</strong> to test the buyer experience in a new tab before publishing.
            </p>
            <div className="iw-preview-frame">
              <ImageWalkthroughViewer
                nodes={nodes}
                hotspots={hotspots}
                annotations={annotations}
                startNodeId={nodes.find((n) => n.is_start_node)?.id ?? nodes[0]?.id}
                preview
                embedded
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openPreview} disabled={previewOpening}>
                {previewOpening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                Open full-screen preview
              </Button>
              <Button onClick={async () => {
                await fetch(`/api/image-walkthrough/checklist/${experienceId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ preview_checked: true }),
                });
                await load();
                setStep("publish");
              }}>
                <Eye className="mr-2 h-4 w-4" /> Mark preview checked
              </Button>
            </div>
          </div>
        )}

        {step === "publish" && (
          <div className="iw-card space-y-4">
            <h2 className="font-medium flex items-center gap-2"><Rocket className="h-4 w-4" /> Publish</h2>
            {checklist && (
              <div className="space-y-2">
                {[
                  ["images_uploaded", "Images uploaded"],
                  ["images_enhanced", "Images enhanced"],
                  ["ai_analysis_completed", "AI analysis completed"],
                  ["start_node_selected", "Start node selected"],
                  ["navigation_connected", "Navigation connected"],
                  ["annotations_added", "Annotations added"],
                  ["preview_checked", "Preview checked"],
                  ["ready_to_publish", "Ready to publish"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 ${checklist[key as keyof ImageWalkthroughChecklist] ? "text-emerald-500" : "text-muted-foreground"}`} />
                    {label}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={publish} disabled={publishing || !checklist?.ready_to_publish}>
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Publish Walkthrough
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
