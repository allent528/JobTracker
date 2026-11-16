import type { Application } from "@/lib/applications";
import type { WorkMode } from "@/lib/closed-sets";
import type { DateOnly } from "@/lib/dates";
import { ACTIVE_STATUSES, STATUS_META, type Status, STATUSES } from "@/lib/status";

export type PipelineItem = Pick<
  Application,
  | "id"
  | "company"
  | "role_title"
  | "status"
  | "work_mode"
  | "date_applied"
  | "next_follow_up_on"
  | "archived_at"
  | "updated_at"
> & {
  /** Calendar days in the owner's time zone. */
  days_in_status: number;
};

const newestFirst = (a: PipelineItem, b: PipelineItem) => Date.parse(b.updated_at) - Date.parse(a.updated_at);

const compareDateOnly = (x: DateOnly, y: DateOnly) => (x < y ? -1 : x > y ? 1 : 0);

/** Nulls sort after values in either direction; `sign` flips only the values. */
function compareNullsLast<T>(a: T | null, b: T | null, compare: (x: T, y: T) => number, sign = 1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return sign * compare(a, b);
}

/**
 * D9: overdue first, then by next follow-up date, then most recently updated. Ascending dates put
 * overdue ones first without a separate check.
 */
export function compareBoardCards(a: PipelineItem, b: PipelineItem): number {
  return compareNullsLast(a.next_follow_up_on, b.next_follow_up_on, compareDateOnly) || newestFirst(a, b);
}

export type BoardColumnData = { status: Status; cards: PipelineItem[] };

export function boardColumns(
  items: readonly PipelineItem[],
  { showClosed }: { showClosed: boolean },
): BoardColumnData[] {
  const statuses = showClosed ? STATUSES : ACTIVE_STATUSES;
  const visible = items.filter((item) => item.archived_at === null);
  return statuses.map((status) => ({
    status,
    cards: visible.filter((item) => item.status === status).sort(compareBoardCards),
  }));
}

/** Unarchived applications in a closed status: what "Show closed" would add to the board. */
export function countClosed(items: readonly PipelineItem[]): number {
  return items.filter((item) => item.archived_at === null && STATUS_META[item.status].kind === "closed").length;
}

export const ALL = "all";

export type TableFilters = {
  query: string;
  status: Status | typeof ALL;
  workMode: WorkMode | typeof ALL;
  includeArchived: boolean;
};

export const DEFAULT_TABLE_FILTERS: TableFilters = {
  query: "",
  status: ALL,
  workMode: ALL,
  includeArchived: false,
};

export function filterApplications(items: readonly PipelineItem[], filters: TableFilters): PipelineItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (filters.includeArchived || item.archived_at === null) &&
      (filters.status === ALL || item.status === filters.status) &&
      (filters.workMode === ALL || item.work_mode === filters.workMode) &&
      (!query ||
        item.company.toLocaleLowerCase().includes(query) ||
        item.role_title.toLocaleLowerCase().includes(query)),
  );
}

export type SortKey = "company" | "role_title" | "status" | "date_applied" | "updated_at";
export type SortDirection = "asc" | "desc";
export type TableSort = { key: SortKey; direction: SortDirection };

export const DEFAULT_TABLE_SORT: TableSort = { key: "updated_at", direction: "desc" };

/** A new column sorts text A–Z and dates newest first; the same column flips. */
export function nextSort(current: TableSort, key: SortKey): TableSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "date_applied" || key === "updated_at" ? "desc" : "asc" };
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function compareBy(key: SortKey, a: PipelineItem, b: PipelineItem, sign: number): number {
  switch (key) {
    case "company":
    case "role_title":
      return sign * collator.compare(a[key], b[key]);
    case "status":
      return sign * (STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
    case "date_applied":
      return compareNullsLast(a.date_applied, b.date_applied, compareDateOnly, sign);
    case "updated_at":
      return sign * (Date.parse(a.updated_at) - Date.parse(b.updated_at));
    default: {
      const unknownKey: never = key;
      throw new Error(`Unknown sort key: ${String(unknownKey)}`);
    }
  }
}

/** Status sorts in lifecycle order; ties go newest first. */
export function sortApplications(items: readonly PipelineItem[], { key, direction }: TableSort): PipelineItem[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => compareBy(key, a, b, sign) || newestFirst(a, b));
}

export function formatDaysInStatus(days: number): string {
  if (days <= 0) return "In status since today";
  return days === 1 ? "1 day in status" : `${days} days in status`;
}
