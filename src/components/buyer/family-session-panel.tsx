"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Copy, Users } from "lucide-react";
import { toast } from "sonner";

export function FamilySessionPanel({
  sessionId,
  propertyId,
  onClose,
  onInvited,
}: {
  sessionId: string;
  propertyId: string;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{ name: string; role: string }[]>([{ name: "You", role: "host" }]);
  const [name, setName] = useState("");

  async function createInvite() {
    const res = await fetch("/api/webrtc/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerSessionId: sessionId, propertyId }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    setInviteUrl(data.inviteUrl);
    onInvited?.();
    toast.success("Family invite link created");
  }

  function copyLink() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      toast.success("Copied to clipboard");
    }
  }

  return (
    <div className="absolute bottom-24 left-4 right-4 max-w-md rounded-xl bg-card p-4 text-foreground shadow-2xl md:left-auto md:right-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Users className="h-5 w-5" /><span className="font-semibold">Invite Family</span></div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Share link so family can explore together. Voice requires consent.</p>
      {!inviteUrl ? (
        <Button className="w-full" onClick={createInvite}>Generate Invite Link</Button>
      ) : (
        <div className="mb-3 flex gap-2">
          <Input readOnly value={inviteUrl} className="text-xs" />
          <Button size="icon" variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs font-medium">Participants</p>
        {participants.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span>{p.name}</span>
            <Badge variant="outline">{p.role}</Badge>
          </div>
        ))}
        <div className="flex gap-2">
          <Input placeholder="Family member name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => { if (name) { setParticipants([...participants, { name, role: "guest" }]); setName(""); } }}>Add</Button>
        </div>
      </div>
    </div>
  );
}
