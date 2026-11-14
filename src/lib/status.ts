// The one source of status values (PRD lifecycle, D7). The `applications.status` check
// constraint mirrors STATUS_VALUES; change both in the same PR.

export const STATUSES = [
  { value: "saved", label: "Saved", kind: "active" },
  { value: "applied", label: "Applied", kind: "active" },
  { value: "screening", label: "Screening", kind: "active" },
  { value: "interviewing", label: "Interviewing", kind: "active" },
  { value: "offer", label: "Offer", kind: "active" },
  { value: "accepted", label: "Accepted", kind: "closed" },
  { value: "rejected", label: "Rejected", kind: "closed" },
  { value: "withdrawn", label: "Withdrawn", kind: "closed" },
  { value: "ghosted", label: "Ghosted", kind: "closed" },
] as const;

export type StatusInfo = (typeof STATUSES)[number];
export type Status = StatusInfo["value"];
export type StatusKind = StatusInfo["kind"];

/** Tuple of values, in lifecycle order (e.g. for `z.enum`). */
export const STATUS_VALUES = STATUSES.map((s) => s.value) as [Status, ...Status[]];

export const ACTIVE_STATUSES = STATUSES.filter((s) => s.kind === "active").map((s) => s.value);
export const CLOSED_STATUSES = STATUSES.filter((s) => s.kind === "closed").map((s) => s.value);

const FORWARD_PATH: readonly Status[] = ["saved", "applied", "screening", "interviewing", "offer", "accepted"];

/** The next step on the suggested forward path, or null at the end or off it. A UI hint only (D6). */
export function nextSuggestedStatus(status: Status): Status | null {
  const i = FORWARD_PATH.indexOf(status);
  return i === -1 || i === FORWARD_PATH.length - 1 ? null : FORWARD_PATH[i + 1];
}

export function statusLabel(status: Status): string {
  return STATUSES.find((s) => s.value === status)!.label;
}
