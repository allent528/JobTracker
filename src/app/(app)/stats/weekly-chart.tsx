"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMonthDay } from "@/lib/dates";
import { STATS_WEEKS, type WeekCount } from "@/lib/stats";

import { MARK_RADIUS, STATS_MARK_COLOR } from "./chart-color";

const chartConfig = {
  applications: { label: "Applications", color: STATS_MARK_COLOR },
} satisfies ChartConfig;

/** A bar chart for sighted readers, with the same numbers in a table behind "Show as table". */
export function WeeklyChart({ weeks }: { weeks: WeekCount[] }) {
  const total = weeks.reduce((sum, week) => sum + week.applications, 0);
  const data = weeks.map((week) => ({ ...week, label: formatMonthDay(week.weekStart) }));

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        <span className="font-medium tabular-nums">{total}</span> applications in the last {STATS_WEEKS} weeks.
      </p>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-56 w-full"
        role="img"
        aria-label={`Bar chart of applications per week. ${total} in total; "Show as table" lists each week.`}
      >
        <BarChart data={data} accessibilityLayer={false}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const weekStart = payload[0]?.payload?.weekStart;
                  return typeof weekStart === "string" ? `Week of ${formatDate(weekStart)}` : null;
                }}
              />
            }
          />
          <Bar dataKey="applications" fill="var(--color-applications)" radius={[MARK_RADIUS, MARK_RADIUS, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <details className="text-sm">
        <summary className="cursor-pointer rounded-sm text-muted-foreground transition-colors hover:text-foreground">Show as table</summary>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Week of</TableHead>
              <TableHead scope="col" className="text-right">
                Applications
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeks.map((week) => (
              <TableRow key={week.weekStart}>
                <TableHead scope="row" className="font-normal">
                  {formatDate(week.weekStart)}
                </TableHead>
                <TableCell className="text-right tabular-nums">{week.applications}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </div>
  );
}
