"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export function MediaUpload({
  propertyId,
  forWorldLabs = false,
  onUploaded,
}: {
  propertyId?: string;
  forWorldLabs?: boolean;
  onUploaded: (asset: { id: string; file_url: string; worldlabs_media_asset_id?: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (propertyId) form.append("propertyId", propertyId);
      if (forWorldLabs) form.append("forWorldLabs", "true");

      const res = await fetch("/api/media/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data);
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
      <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Uploading…" : forWorldLabs ? "Upload for 3D Generation" : "Upload Media"}
      </Button>
    </div>
  );
}
