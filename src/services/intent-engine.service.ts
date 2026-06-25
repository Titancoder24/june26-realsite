import type { IntentSignal } from "@/types/domain";

const SIGNAL_WEIGHTS: Record<string, { weight: number; description: string }> = {
  asked_price: { weight: 15, description: "Asked about price" },
  asked_possession: { weight: 12, description: "Asked about possession" },
  asked_rera: { weight: 10, description: "Asked about RERA approval" },
  asked_nri: { weight: 12, description: "Asked about NRI process" },
  asked_loan: { weight: 10, description: "Asked about financing" },
  requested_callback: { weight: 20, description: "Requested callback" },
  requested_site_visit: { weight: 18, description: "Requested site visit" },
  invited_family: { weight: 15, description: "Invited family members" },
  returned_visit: { weight: 8, description: "Returned for another visit" },
  long_session: { weight: 10, description: "Spent significant time in walkthrough" },
  viewed_balcony: { weight: 5, description: "Viewed balcony repeatedly" },
  viewed_master_bedroom: { weight: 5, description: "Viewed master bedroom repeatedly" },
  clicked_cta: { weight: 8, description: "Clicked contact sales CTA" },
  price_concern: { weight: -5, description: "Expressed price concern" },
  possession_concern: { weight: -4, description: "Expressed possession concern" },
};

export class IntentEngineService {
  computeScore(events: { event_type: string }[]): { score: number; signals: IntentSignal[] } {
    const signals: IntentSignal[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      const config = SIGNAL_WEIGHTS[event.event_type];
      if (config && !seen.has(event.event_type)) {
        seen.add(event.event_type);
        signals.push({ type: event.event_type, weight: config.weight, description: config.description });
      }
    }

    const base = 20;
    const score = Math.max(0, Math.min(100, base + signals.reduce((s, sig) => s + sig.weight, 0)));
    return { score, signals };
  }

  explainScore(signals: IntentSignal[]): string[] {
    return signals.filter((s) => s.weight > 0).map((s) => s.description);
  }
}

export const intentEngineService = new IntentEngineService();
