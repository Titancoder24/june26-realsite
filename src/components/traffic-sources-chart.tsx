"use client";

import { formatCompactNumber } from "@/components/formater";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ShareBarList,
	ShareBarListContent,
	ShareBarListFill,
	ShareBarListItem,
	ShareBarListLabel,
	ShareBarListValue,
} from "@/components/share-bar-list";

const defaultChartData = [
	{ source: "Organic search", sessions: 4120 },
	{ source: "Direct", sessions: 2890 },
	{ source: "Referral", sessions: 1640 },
	{ source: "Paid social", sessions: 980 },
	{ source: "Email", sessions: 620 },
] as const;

function barWidthPercent(sessions: number, maxSessions: number) {
	if (maxSessions <= 0) return 0;
	return (sessions / maxSessions) * 75;
}

export function TrafficSourcesChart({
	data,
	title = "Sessions by source",
	description = "Attributed sessions in the last 12 months.",
}: {
	data?: { source: string; sessions: number }[];
	title?: string;
	description?: string;
} = {}) {
	const chartData = data?.length ? data : defaultChartData;
	const maxSessions = Math.max(...chartData.map((d) => d.sessions), 1);

	return (
		<Card className="bi-finance-card">
			<CardHeader className="flex flex-row items-start justify-between border-b border-border/50 px-6 pb-4">
				<div>
					<CardTitle className="text-balance text-base">{title}</CardTitle>
					<CardDescription className="text-pretty leading-relaxed">{description}</CardDescription>
				</div>
				<span className="bi-soft-select">Bar chart</span>
			</CardHeader>
			<CardContent className="p-0 py-1">
				<ShareBarList aria-label="Sessions by traffic source">
					{chartData.map((row) => (
						<ShareBarListItem
							key={row.source}
							value={barWidthPercent(row.sessions, maxSessions)}
						>
							<ShareBarListContent>
								<ShareBarListLabel>{row.source}</ShareBarListLabel>
								<ShareBarListValue>
									{formatCompactNumber(row.sessions)}
								</ShareBarListValue>
							</ShareBarListContent>
							<ShareBarListFill />
						</ShareBarListItem>
					))}
				</ShareBarList>
			</CardContent>
		</Card>
	);
}
