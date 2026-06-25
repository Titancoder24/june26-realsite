"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GuidedCameraCapture } from "@/components/capture/guided-camera";
import { PublishChecklist } from "@/components/capture/publish-checklist";
import { Tour360Builder } from "@/components/experience/tour360-builder";
import { FloorMapBuilder } from "@/components/builders/floor-map-builder";
import { ROOM_TEMPLATES, type PropertyTemplate } from "@/lib/capture/room-templates";
import { CheckCircle2, Circle, Camera, Link2, Rocket, Plus } from "lucide-react";
import { toast } from "sonner";

interface CaptureRoom {
  id: string;
  room_name: string;
  status: string;
  quality_score?: string;
  scene_id?: string;
  capture_frames?: { id: string; angle_label: string }[];
}

type Step = "setup" | "capture" | "connect" | "publish";

export function MobileCaptureWizard({
  experienceId,
  propertyId,
}: {
  experienceId: string;
  propertyId: string;
}) {
  const [step, setStep] = useState<Step>("setup");
  const [template, setTemplate] = useState<PropertyTemplate>("residential");
  const [rooms, setRooms] = useState<CaptureRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<CaptureRoom | null>(null);
  const [customRoom, setCustomRoom] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadRooms() {
    const res = await fetch(`/api/capture/rooms?experienceId=${experienceId}`);
    const data = await res.json();
    if (Array.isArray(data)) setRooms(data);
  }

  useEffect(() => {
    loadRooms().then(() => {
      fetch(`/api/capture/rooms?experienceId=${experienceId}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) setStep("capture");
        })
        .catch(() => {});
    });
  }, [experienceId]);

  async function initCapturePlan() {
    setLoading(true);
    const res = await fetch("/api/capture/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId, property_id: propertyId, template }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.error ?? "Failed to create capture plan");
    setRooms(data);
    setStep("capture");
    toast.success("Capture plan ready. Start in the first room.");
  }

  async function addCustomRoom() {
    if (!customRoom.trim()) return;
    const names = [...rooms.map((r) => r.room_name), customRoom.trim()];
    setLoading(true);
    const res = await fetch("/api/capture/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experience_id: experienceId,
        property_id: propertyId,
        template,
        custom_rooms: names,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.error);
    setRooms(data);
    setCustomRoom("");
  }

  const completeCount = rooms.filter((r) => r.status === "complete").length;
  const allComplete = rooms.length > 0 && completeCount === rooms.length;

  const steps: { id: Step; label: string; icon: typeof Camera }[] = [
    { id: "setup", label: "Rooms", icon: Circle },
    { id: "capture", label: "Capture", icon: Camera },
    { id: "connect", label: "Connect", icon: Link2 },
    { id: "publish", label: "Publish", icon: Rocket },
  ];

  if (activeRoom) {
    return (
      <GuidedCameraCapture
        roomName={activeRoom.room_name}
        roomId={activeRoom.id}
        propertyId={propertyId}
        progress={completeCount + 1}
        total={rooms.length}
        onBack={() => { setActiveRoom(null); loadRooms(); }}
        onComplete={() => { setActiveRoom(null); loadRooms(); }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24 md:max-w-2xl">
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/30 p-1">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${active ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {step === "setup" && (
        <Card>
          <CardHeader>
            <CardTitle>What rooms do you want to capture?</CardTitle>
            <CardDescription>Choose a template or add custom rooms. You will walk through each one with your phone camera.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {(Object.keys(ROOM_TEMPLATES) as PropertyTemplate[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTemplate(key)}
                  className={`rounded-lg border p-3 text-left text-sm ${template === key ? "border-primary bg-primary/5" : ""}`}
                >
                  <p className="font-medium">{ROOM_TEMPLATES[key].label}</p>
                  <p className="text-xs text-muted-foreground">{ROOM_TEMPLATES[key].rooms.join(" · ")}</p>
                </button>
              ))}
            </div>
            <Button className="w-full" size="lg" disabled={loading} onClick={initCapturePlan}>
              {loading ? "Setting up…" : "Start Capture Plan"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "capture" && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Room Checklist</CardTitle>
                <Badge variant="secondary">{completeCount} of {rooms.length} captured</Badge>
              </div>
              <CardDescription>Google Street View style — stand in the center, rotate slowly, and photos capture automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center gap-3 rounded-lg border p-3">
                  {room.status === "complete" ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{room.room_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.status === "complete" ? (room.quality_score ?? "Complete") : room.status === "needs_retake" ? "Needs retake" : "Not started"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={room.status === "complete" ? "outline" : "default"}
                    onClick={() => setActiveRoom(room)}
                  >
                    {room.status === "complete" ? "Retake" : "Capture"}
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="Add custom room" value={customRoom} onChange={(e) => setCustomRoom(e.target.value)} />
                <Button size="icon" variant="outline" onClick={addCustomRoom}><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          {allComplete && (
            <Button className="w-full" size="lg" onClick={() => setStep("connect")}>
              Continue — Connect Rooms
            </Button>
          )}
        </>
      )}

      {step === "connect" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connect Scenes & Annotate</CardTitle>
              <CardDescription>
                Link rooms with navigation pins, annotate fixtures with 100+ pin types, and place scenes on the floor plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const res = await fetch("/api/scenes/auto-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ experience_id: experienceId }),
                  });
                  const data = await res.json();
                  if (!res.ok) return toast.error(data.error ?? "Auto-link failed");
                  toast.success(`Linked ${data.navigationPinsAdded} navigation pins across ${data.scenes} scenes`);
                }}
              >
                Auto-link scenes (agent)
              </Button>
            </CardContent>
          </Card>
          <Tour360Builder experienceId={experienceId} propertyId={propertyId} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Floor Plan</CardTitle>
              <CardDescription>Upload your floor plan and place pins for each captured scene.</CardDescription>
            </CardHeader>
            <CardContent>
              <FloorMapBuilder propertyId={propertyId} experienceId={experienceId} />
            </CardContent>
          </Card>
          <Button className="w-full" size="lg" onClick={() => setStep("publish")}>
            Continue — Preview & Publish
          </Button>
        </div>
      )}

      {step === "publish" && (
        <div className="space-y-4">
          <PublishChecklist
            experienceId={experienceId}
            onPublish={(url) => window.open(url, "_blank")}
          />
          <Button variant="outline" className="w-full" onClick={async () => {
            const res = await fetch(`/api/experiences/${experienceId}`);
            const exp = await res.json();
            if (exp.slug) window.open(`/view/${exp.slug}`, "_blank");
            else toast.error("Publish first to preview buyer experience");
          }}>
            Preview Buyer Experience
          </Button>
        </div>
      )}
    </div>
  );
}
