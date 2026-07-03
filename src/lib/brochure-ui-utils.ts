import type { BrochureCta } from "@/types/brochure-intelligence";

export function handleBrochureCta(
  cta: BrochureCta,
  page: number,
  fileUrl: string,
  tracker: {
    recordCta: (page: number, type: string) => void;
    recordDownload: (page: number) => void;
  },
) {
  tracker.recordCta(page, cta.type);
  if (cta.type === "whatsapp" && cta.phone) {
    window.open(`https://wa.me/${cta.phone.replace(/\D/g, "")}`, "_blank");
    return;
  }
  if (cta.type === "call" && cta.phone) {
    window.open(`tel:${cta.phone.replace(/\s/g, "")}`, "_self");
    return;
  }
  if (cta.type === "download") {
    tracker.recordDownload(page);
    window.open(fileUrl, "_blank");
    return;
  }
  if (cta.url) {
    window.open(cta.url, "_blank");
  }
}

export function formatBrochureDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function interestLevel(seconds: number, maxVisible = 0): "Very High" | "High" | "Medium" | "Low" {
  const score = seconds + maxVisible * 0.5;
  if (score >= 60) return "Very High";
  if (score >= 30) return "High";
  if (score >= 10) return "Medium";
  return "Low";
}
