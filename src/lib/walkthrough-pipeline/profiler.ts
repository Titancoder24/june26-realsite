type StageEntry = { stage: string; startMs: number; endMs?: number };

export class PipelineProfiler {
  private readonly label: string;
  private readonly stages: StageEntry[] = [];
  private readonly startedAt = Date.now();

  constructor(label: string) {
    this.label = label;
  }

  start(stage: string) {
    this.stages.push({ stage, startMs: Date.now() });
  }

  end(stage: string) {
    const entry = [...this.stages].reverse().find((s) => s.stage === stage && s.endMs === undefined);
    if (entry) entry.endMs = Date.now();
  }

  elapsed(stage: string): number | undefined {
    const entry = this.stages.find((s) => s.stage === stage);
    if (!entry) return undefined;
    return (entry.endMs ?? Date.now()) - entry.startMs;
  }

  summary(): Record<string, number> {
    const out: Record<string, number> = { total: Date.now() - this.startedAt };
    for (const s of this.stages) {
      if (s.endMs) out[s.stage] = s.endMs - s.startMs;
    }
    return out;
  }

  log(extra?: Record<string, unknown>) {
    const timings = this.summary();
    console.info(`[veo-pipeline] ${this.label}`, { ...timings, ...extra });
    return timings;
  }
}
