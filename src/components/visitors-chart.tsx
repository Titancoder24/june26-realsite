"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { formatInteger } from "@/components/formater";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

const defaultChartData = [
	{ month: "January", visitors: 555 },
	{ month: "February", visitors: 904 },
	{ month: "March", visitors: 727 },
	{ month: "April", visitors: 801 },
	{ month: "May", visitors: 942 },
	{ month: "June", visitors: 1048 },
	{ month: "July", visitors: 702 },
	{ month: "August", visitors: 1103 },
	{ month: "September", visitors: 879 },
	{ month: "October", visitors: 1046 },
	{ month: "November", visitors: 1407 },
	{ month: "December", visitors: 548 },
];

const chartConfig = {
	visitors: {
		label: "Visitors",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function VisitorsChart({
	data,
	delta,
	description = "Total sessions in the last 12 months.",
}: {
	data?: { month: string; visitors: number }[];
	delta?: number;
	description?: string;
} = {}) {
	const chartData = data?.length ? data : defaultChartData;
	const totalVisitors = chartData.reduce((sum, row) => sum + row.visitors, 0);
	const gradientId = `visitors-area-${useId().replace(/:/g, "")}`;

	return (
		<Card className="md:col-span-2 lg:col-span-3">
			<CardHeader className="flex flex-row items-start justify-between px-6 pb-2">
				<div className="flex flex-col gap-1.5">
					<CardTitle className="metric-value metric-value--hero">
						{formatInteger(totalVisitors)}
					</CardTitle>
					<CardDescription className="text-pretty leading-relaxed">{description}</CardDescription>
				</div>
				<Delta value={delta ?? 7.2} variant="badge">
					<DeltaIcon variant="trend" />
					<DeltaValue suffix="%" />
					<span>vs prior 12 months</span>
				</Delta>
			</CardHeader>
			<CardContent>
				<ChartContainer
					className="aspect-auto h-60 w-full"
					config={chartConfig}
				>
					<AreaChart
						accessibilityLayer
						data={chartData}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<defs>
							<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-visitors)"
									stopOpacity={0.28}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-visitors)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
						<XAxis
							axisLine={false}
							dataKey="month"
							tickFormatter={(value) => String(value).slice(0, 3)}
							tickLine={false}
							tickMargin={10}
							fontSize={11}
							fill="var(--muted-foreground)"
						/>
						<ChartTooltip
							content={<ChartTooltipContent indicator="dashed" />}
							cursor={{
								stroke: "var(--color-visitors)",
								strokeDasharray: "3 3",
								strokeLinecap: "round",
							}}
							wrapperStyle={{ outline: "none" }}
						/>
						<Area
							dataKey="visitors"
							dot={false}
							activeDot={{
								fill: "var(--color-visitors)",
								r: 4,
								stroke: "var(--background)",
								strokeWidth: 2,
							}}
							fill={`url(#${gradientId})`}
							isAnimationActive={false}
							name={chartConfig.visitors.label}
							stroke="var(--color-visitors)"
							strokeWidth={2.5}
							type="monotone"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
