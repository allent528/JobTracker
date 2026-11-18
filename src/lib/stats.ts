import { addDays, type DateOnly, startOfWeek } from "@/lib/dates";
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUSES, type Status } from "@/lib/status";

export const STATS_PATH = "/stats";
export const STATS_WEEKS = 12;

/** `?archived=1` includes archived applications in every stat. */
export const INCLUDE_ARCHIVED_PARAM = "archived";

/** Anything but a single `1` (including a repeated param) means the default, archived left out. */
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
export function toStatusCounts(rows: StatusCount[]): StatusCounts {
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

/** A whole percent that never rounds up to 100 while some applications haven't responded. */
export function toResponseRate({ reached, responded }: { reached: number; responded: number }): ResponseRate {
  if (reached === 0) return { reached, responded, percent: null };
  const percent = Math.round((responded / reached) * 100);
  return { reached, responded, percent: responded < reached ? Math.min(percent, 99) : percent };
}

export type StageDuration = { status: Status; stays: number; averageDays: number | null };

/** Every status, in lifecycle order; `averageDays` is null when no stay in it has ended. */
export function toStageDurations(rows: { status: Status; stays: number; averageDays: number }[]): StageDuration[] {
  const byStatus = new Map(rows.map((row) => [row.status, row]));
  return STATUSES.map((status) => {
    const row = byStatus.get(status);
    return { status, stays: row?.stays ?? 0, averageDays: row ? row.averageDays : null };
  });
}

/** "4.5 days", "1 day", "<0.1 days" (more than 0 but under a tenth), "0 days". */
export function formatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  if (rounded === 0 && days > 0) return "<0.1 days";
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

export type Stats = {
  statusCounts: StatusCounts;
  /** The first day of the 12-week window. */
  fromDay: DateOnly;
  weeks: WeekCount[];
  responseRate: ResponseRate;
  stageDurations: StageDuration[];
};
