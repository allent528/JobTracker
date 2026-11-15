// Pure ordering, filtering and sorting for the pipeline views (F3). No I/O, safe on the client.
import type { WorkMode } from "@/lib/closed-sets";
import { ACTIVE_STATUSES, type Status, STATUSES } from "@/lib/status";

export type PipelineItem = {
  id: string;
  company: string;
  role_title: string;
  status: Status;
  work_mode: WorkMode | null;
  date_applied: string | null;
  next_follow_up_on: string | null;
  archived_at: string | null;
  updated_at: string;
  /** Calendar days since the latest status change, in the owner's time zone. */
  days_in_status: number;
};

export type FollowUpState = "overdue" | "today" | "upcoming";

/** `today` is `YYYY-MM-DD` in the owner's time zone (D11). */
export function followUpState(nextFollowUpOn: string | null, today: string): FollowUpState | null {
  if (!nextFollowUpOn) return null;
  if (nextFollowUpOn < today) return "overdue";
  return nextFollowUpOn === today ? "today" : "upcoming";
}

const newestFirst = (a: PipelineItem, b: PipelineItem) => Date.parse(b.updated_at) - Date.parse(a.updated_at);

/**
 * Board order (D9): overdue follow-ups first, then by next follow-up date, then most recently
 * updated. Ascending dates already put overdue ones first; cards without a follow-up come last.
 */
export function compareBoardCards(a: PipelineItem, b: PipelineItem): number {
  const x = a.next_follow_up_on;
  const y = b.next_follow_up_on;
  if (x !== y) {
    if (x === null) return 1;
    if (y === null) return -1;
    return x < y ? -1 : 1;
  }
  return newestFirst(a, b);
}

export type BoardColumn = { status: Status; cards: PipelineItem[] };

/** One column per active status (plus closed ones when `showClosed`); archived cards are left out. */
export function boardColumns(items: readonly PipelineItem[], { showClosed }: { showClosed: boolean }): BoardColumn[] {
  const statuses = showClosed ? STATUSES : ACTIVE_STATUSES;
  const visible = items.filter((item) => item.archived_at === null);
  return statuses.map((status) => ({
    status,
    cards: visible.filter((item) => item.status === status).sort(compareBoardCards),
  }));
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

/** Text search is case-insensitive and matches company or role title. */
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

export const SORT_KEYS = ["company", "role_title", "status", "date_applied", "updated_at"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";
export type TableSort = { key: SortKey; direction: SortDirection };

export const DEFAULT_TABLE_SORT: TableSort = { key: "updated_at", direction: "desc" };

/** Clicking a new column sorts text A–Z and dates newest first; clicking it again flips. */
export function nextSort(current: TableSort, key: SortKey): TableSort {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: key === "date_applied" || key === "updated_at" ? "desc" : "asc" };
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function compareBy(key: SortKey, a: PipelineItem, b: PipelineItem): number {
  switch (key) {
    case "company":
    case "role_title":
      return collator.compare(a[key], b[key]);
    case "status":
      return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    case "date_applied":
      return (a.date_applied ?? "").localeCompare(b.date_applied ?? "");
    case "updated_at":
      return Date.parse(a.updated_at) - Date.parse(b.updated_at);
  }
}

/** Status sorts in lifecycle order. Blank dates applied always sort last; ties go newest first. */
export function sortApplications(items: readonly PipelineItem[], { key, direction }: TableSort): PipelineItem[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (key === "date_applied" && (a.date_applied === null) !== (b.date_applied === null)) {
      return a.date_applied === null ? 1 : -1;
    }
    return sign * compareBy(key, a, b) || newestFirst(a, b);
  });
}

/** "In status since today", "1 day in status", "12 days in status". */
export function formatDaysInStatus(days: number): string {
  if (days <= 0) return "In status since today";
  return days === 1 ? "1 day in status" : `${days} days in status`;
}
