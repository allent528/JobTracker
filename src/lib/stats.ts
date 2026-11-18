import { addDays, type DateOnly, startOfWeek } from "@/lib/dates";
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUSES, type Status } from "@/lib/status";

// F9. The SQL functions (D13) return raw facts; this module classifies statuses and fills gaps.

export const STATS_PATH = "/stats";
export const STATS_WEEKS = 12;

/** `?archived=1` includes archived applications in every stat. */
export const INCLUDE_ARCHIVED_PARAM = "archived";

export function parseIncludeArchived(value: string | string[] | undefined): boolean {
  return value === "1";
}

export function statsPath(includeArchived: boolean): string {
  return includeArchived ? `${STATS_PATH}?${INCLUDE_ARCHIVED_PARAM}=1` : STATS_PATH;
}

/**
 * The last `STATS_WEEKS` weeks, ending with the week that holds `today`, as a half-open
 * `[fromDay, untilDay)` window of owner-zone dates.
 */
export function statsWindow(today: DateOnly): { weekStarts: DateOnly[]; fromDay: DateOnly; untilDay: DateOnly } {
  const currentWeek = startOfWeek(today);
  const weekStarts = Array.from({ length: STATS_WEEKS }, (_, i) => addDays(currentWeek, (i - STATS_WEEKS + 1) * 7));
  return { weekStarts, fromDay: weekStarts[0], untilDay: addDays(currentWeek, 7) };
}

export type StatusCount = { status: Status; applications: number };
export type StatusCounts = { active: StatusCount[]; closed: StatusCount[]; total: number };

/** Every status, in lifecycle order, with 0 where the database returned no row. */
export function toStatusCounts(rows: { status: Status; applications: number }[]): StatusCounts {
  const counts = new Map(rows.map((row) => [row.status, row.applications]));
  const list = (statuses: readonly Status[]) =>
    statuses.map((status) => ({ status, applications: counts.get(status) ?? 0 }));
  return {
    active: list(ACTIVE_STATUSES),
    closed: list(CLOSED_STATUSES),
    total: rows.reduce((sum, row) => sum + row.applications, 0),
  };
}

export type WeekCount = { weekStart: DateOnly; applications: number };

/** One entry per week in `weekStarts`, summing the per-day counts that fall in it. */
export function toWeekCounts(rows: { day: DateOnly; applications: number }[], weekStarts: DateOnly[]): WeekCount[] {
  const perWeek = new Map(weekStarts.map((week) => [week, 0]));
  for (const row of rows) {
    const week = startOfWeek(row.day);
    const count = perWeek.get(week);
    if (count !== undefined) perWeek.set(week, count + row.applications);
  }
  return weekStarts.map((weekStart) => ({ weekStart, applications: perWeek.get(weekStart) ?? 0 }));
}

export type ResponseRate = { reached: number; responded: number; percent: number | null };

export function toResponseRate(row: { reached: number; responded: number } | undefined): ResponseRate {
  const reached = row?.reached ?? 0;
  const responded = row?.responded ?? 0;
  return { reached, responded, percent: reached === 0 ? null : Math.round((responded / reached) * 100) };
}

export type StageDuration = { status: Status; stays: number; averageDays: number | null };

/** Every status, in lifecycle order; `averageDays` is null when no stay in it has ended. */
export function toStageDurations(
  rows: { status: Status; stays: number; average_days: number }[],
): StageDuration[] {
  const byStatus = new Map(rows.map((row) => [row.status, row]));
  return STATUSES.map((status) => {
    const row = byStatus.get(status);
    return { status, stays: row?.stays ?? 0, averageDays: row ? row.average_days : null };
  });
}

/** "4.5 days", "1 day", "0.3 days". */
export function formatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

export type Stats = {
  statusCounts: StatusCounts;
  weeks: WeekCount[];
  responseRate: ResponseRate;
  stageDurations: StageDuration[];
};
