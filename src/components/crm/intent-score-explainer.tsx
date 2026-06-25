import { Progress } from "@/components/ui/progress";
import type { IntentSignal } from "@/types/domain";

export function IntentScoreExplainer({ score, signals }: { score: number; signals: IntentSignal[] }) {
  const reasons = signals.filter((s) => s.weight > 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex justify-between text-sm">
          <span>Intent Score</span>
          <span className="font-semibold">{score} / 100</span>
        </div>
        <Progress value={score} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Why this lead is hot:</p>
        <ul className="space-y-2">
          {reasons.map((r) => (
            <li key={r.type} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {r.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
