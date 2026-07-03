import { cn } from "@/lib/utils";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type Stat = {
	label: string;
	value: string;
	delta: number;
	footnote?: string;
	hint?: string;
	lowerIsBetter?: boolean;
};

const defaultStats: readonly Stat[] = [
	{
		label: "Open queue",
		value: "38",
		delta: -12.4,
		footnote: "vs yesterday",
		lowerIsBetter: true,
	},
	{
		label: "Active conversations",
		value: "126",
		delta: 5.2,
		footnote: "vs last week",
		lowerIsBetter: false,
	},
	{
		label: "Median first reply",
		value: "4.1m",
		delta: -8.0,
		footnote: "vs last week",
		lowerIsBetter: true,
	},
	{
		label: "CSAT (30d)",
		value: "94%",
		delta: 1.1,
		footnote: "vs prior 30d",
		lowerIsBetter: false,
	},
];

export function DashboardStats({ stats }: { stats?: Stat[] }) {
	const rows = stats ?? defaultStats;

	return (
		<>
			{rows.map((s) => (
				<Card className={cn("bi-finance-card shadow-none dark:ring-0")} key={s.label}>
					<CardHeader>
						<CardTitle className="metric-label">
							{s.label}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<p className="metric-value metric-value--compact">{s.value}</p>
						<div className="flex items-center gap-1 text-xs">
							<Delta value={s.delta}>
								<DeltaIcon />
								<DeltaValue />
							</Delta>
							<span className="text-muted-foreground">{s.footnote ?? s.hint ?? ""}</span>
						</div>
					</CardContent>
				</Card>
			))}
		</>
	);
}
