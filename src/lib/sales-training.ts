export type SalesTrainingScenarioId =
  | "first-call"
  | "price-objection"
  | "site-visit"
  | "brochure-followup"
  | "walkthrough-lead"
  | "handover";

export type SalesTrainingMessage = {
  role: "agent" | "buyer" | "coach";
  content: string;
  inputMode?: "text" | "voice";
  createdAt?: string;
};

export type SalesTrainingMode = "text" | "voice";
export type SalesTrainingDifficulty = "easy" | "medium" | "hard" | "elite";

export type SalesTrainingScore = {
  discovery: number;
  objectionHandling: number;
  productKnowledge: number;
  empathy: number;
  closing: number;
  compliance: number;
};

export type SalesTrainingScenario = {
  id: SalesTrainingScenarioId;
  title: string;
  buyerProfile: string;
  difficulty: "Foundation" | "Intermediate" | "Advanced";
  goal: string;
  context: string;
  managerFocus: string[];
};

export type SalesTrainingCoachResult = {
  buyerReply: string;
  coachNote: string;
  score: SalesTrainingScore;
  readinessScore: number;
  strengths: string[];
  improvements: string[];
  managerSummary: string;
  nextDrill: string;
};

export const SALES_TRAINING_SCENARIOS: SalesTrainingScenario[] = [
  {
    id: "first-call",
    title: "New inbound lead",
    buyerProfile: "A first-time buyer who downloaded a brochure but has not yet shared budget clearly.",
    difficulty: "Foundation",
    goal: "Qualify budget, location preference, timeline, and book the next step without sounding pushy.",
    context: "Use polite discovery questions, confirm consent to follow up, and avoid unverified promises.",
    managerFocus: ["Discovery depth", "Tone", "Next-step clarity"],
  },
  {
    id: "price-objection",
    title: "Price objection",
    buyerProfile: "A price-sensitive buyer comparing three nearby projects.",
    difficulty: "Intermediate",
    goal: "Handle price resistance by connecting value, inventory, amenities, and financing options.",
    context: "Do not discount without approval. Reframe value and offer a site visit or finance callback.",
    managerFocus: ["Objection handling", "Value framing", "Compliance"],
  },
  {
    id: "site-visit",
    title: "Site visit conversion",
    buyerProfile: "A warm buyer who viewed a walkthrough twice but keeps postponing the visit.",
    difficulty: "Intermediate",
    goal: "Convert interest into a scheduled site visit with a specific date and time.",
    context: "Use walkthrough/brochure engagement signals to personalize the ask.",
    managerFocus: ["Personalization", "Closing", "Follow-up discipline"],
  },
  {
    id: "brochure-followup",
    title: "Brochure follow-up",
    buyerProfile: "A buyer spent time on pricing, amenities, and floor-plan pages in the brochure.",
    difficulty: "Foundation",
    goal: "Reference buyer intent signals naturally and ask helpful follow-up questions.",
    context: "Use brochure intelligence without sounding invasive. Keep privacy language simple.",
    managerFocus: ["Buyer-intent usage", "Trust", "Helpful questioning"],
  },
  {
    id: "walkthrough-lead",
    title: "Walkthrough lead",
    buyerProfile: "A buyer asked the AI concierge about balcony view, parking, and possession date.",
    difficulty: "Advanced",
    goal: "Use walkthrough conversation data to answer confidently and escalate unknowns.",
    context: "If possession/legal/price details are uncertain, say you will confirm with the manager.",
    managerFocus: ["Knowledge accuracy", "Escalation judgment", "Confidence"],
  },
  {
    id: "handover",
    title: "Manager handover",
    buyerProfile: "A hot lead wants negotiation, payment-plan clarity, and manager assurance.",
    difficulty: "Advanced",
    goal: "Summarize the lead cleanly and hand over to a sales manager with context.",
    context: "Capture buyer need, objections, budget range, urgency, and next action.",
    managerFocus: ["Summary quality", "CRM hygiene", "Commercial judgment"],
  },
];

export const SALES_TRAINING_MANAGER_ROWS = [
  { agent: "Ananya Rao", readiness: 86, sessions: 18, focus: "Closing consistency", trend: "+8%" },
  { agent: "Vikram Singh", readiness: 74, sessions: 11, focus: "Discovery questions", trend: "+4%" },
  { agent: "Meera Patel", readiness: 91, sessions: 22, focus: "Manager handover", trend: "+12%" },
  { agent: "Rahul Nair", readiness: 68, sessions: 9, focus: "Price objections", trend: "-2%" },
];

export function getSalesScenario(id?: string) {
  return SALES_TRAINING_SCENARIOS.find((scenario) => scenario.id === id) ?? SALES_TRAINING_SCENARIOS[0];
}

export function averageScore(score: SalesTrainingScore) {
  const values = Object.values(score);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function heuristicSalesScore(transcript: SalesTrainingMessage[]): SalesTrainingScore {
  const text = transcript.map((message) => message.content).join(" ").toLowerCase();
  const hasQuestion = (text.match(/\?/g) ?? []).length;
  const mentionsBudget = /budget|price|cost|emi|loan|payment/.test(text);
  const mentionsTimeline = /when|timeline|move|possession|visit|today|tomorrow|week/.test(text);
  const mentionsNeed = /looking for|prefer|requirement|family|bedroom|location|amenity/.test(text);
  const hasClose = /book|schedule|visit|call|next step|confirm/.test(text);
  const hasCompliance = /confirm|check|share accurate|manager|approved|consent|privacy/.test(text);
  return {
    discovery: Math.min(96, 48 + hasQuestion * 8 + (mentionsBudget ? 10 : 0) + (mentionsTimeline ? 8 : 0) + (mentionsNeed ? 8 : 0)),
    objectionHandling: Math.min(94, 52 + (mentionsBudget ? 14 : 0) + (/value|amenit|location|offer|compare/.test(text) ? 14 : 0)),
    productKnowledge: Math.min(93, 55 + (/floor|tower|parking|amenit|view|possession|brochure|walkthrough/.test(text) ? 22 : 0)),
    empathy: Math.min(95, 58 + (/understand|help|happy|concern|comfortable|thank/.test(text) ? 18 : 0)),
    closing: Math.min(96, 50 + (hasClose ? 26 : 0) + (mentionsTimeline ? 8 : 0)),
    compliance: Math.min(98, 62 + (hasCompliance ? 20 : 0) + (/guarantee|assured return|100%/.test(text) ? -18 : 0)),
  };
}

export function fallbackCoachResult(scenario: SalesTrainingScenario, transcript: SalesTrainingMessage[]): SalesTrainingCoachResult {
  const score = heuristicSalesScore(transcript);
  const readinessScore = averageScore(score);
  return {
    buyerReply:
      "That helps. I am interested, but I still need clarity before I visit. Can you explain what makes this project better than the other options nearby?",
    coachNote:
      "Good start. Ask one more discovery question, then connect the answer to a specific project benefit and propose a clear next step.",
    score,
    readinessScore,
    strengths: ["Maintained a helpful tone", "Kept the conversation moving", "Used the training scenario context"],
    improvements: ["Ask for timeline and budget earlier", "Summarize the buyer need before pitching", "Close with a specific date or callback"],
    managerSummary: `${scenario.title}: readiness ${readinessScore}/100. Review discovery depth and closing clarity in the next coaching huddle.`,
    nextDrill: readinessScore >= 82 ? "Advanced negotiation handover" : "Discovery and site-visit conversion",
  };
}
