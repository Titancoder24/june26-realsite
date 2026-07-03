import type { LeadStatus } from "@/types/brochure-intelligence";

export type ScoringInput = {
  leadCaptured?: boolean;
  totalSeconds?: number;
  pagesViewed?: number;
  pricingSeconds?: number;
  paymentPlanSeconds?: number;
  floorPlanSeconds?: number;
  amenitiesSeconds?: number;
  downloaded?: boolean;
  ctaClicked?: boolean;
  siteVisitSubmitted?: boolean;
  bouncedUnder10s?: boolean;
};

export type ScoringResult = {
  score: number;
  status: LeadStatus;
  signals: string[];
  recommendedAction: string;
};

export function scoreBrochureIntent(input: ScoringInput): ScoringResult {
  let score = 0;
  const signals: string[] = [];

  if (input.leadCaptured) {
    score += 10;
    signals.push("Entered name and phone");
  }
  if ((input.totalSeconds ?? 0) > 0) {
    score += 5;
    signals.push("Opened brochure");
  }
  if ((input.totalSeconds ?? 0) >= 30) {
    score += 5;
    signals.push("Stayed more than 30 seconds");
  }
  if ((input.floorPlanSeconds ?? 0) >= 15) {
    score += 10;
    signals.push("Viewed floor plan section");
  }
  if ((input.pricingSeconds ?? 0) >= 10) {
    score += 15;
    signals.push("Viewed pricing page");
  }
  if ((input.pricingSeconds ?? 0) >= 30) {
    score += 15;
    signals.push("Spent 30+ seconds on pricing");
  }
  if ((input.paymentPlanSeconds ?? 0) >= 10) {
    score += 10;
    signals.push("Viewed payment plan");
  }
  if ((input.amenitiesSeconds ?? 0) >= 10) {
    score += 8;
    signals.push("Viewed amenities");
  }
  if (input.downloaded) {
    score += 10;
    signals.push("Downloaded brochure");
  }
  if (input.ctaClicked) {
    score += 15;
    signals.push("Clicked CTA");
  }
  if (input.siteVisitSubmitted) {
    score += 20;
    signals.push("Submitted site visit request");
  }
  if (input.bouncedUnder10s) {
    score -= 10;
    signals.push("Bounced under 10 seconds");
  }

  score = Math.max(0, Math.min(100, score));
  const status: LeadStatus = score >= 66 ? "hot" : score >= 31 ? "warm" : "cold";

  let recommendedAction = "Send a follow-up message with project highlights.";
  if (status === "hot") {
    recommendedAction = "Call first — discuss pricing, payment plan, and book a site visit.";
  } else if (status === "warm") {
    recommendedAction = "WhatsApp with floor plan and pricing details they viewed.";
  }

  return { score, status, signals, recommendedAction };
}
