// Mirrored by the `applications.status` check constraint (D7); change both in the same PR.
export const STATUSES = [
  "saved",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
] as const;

export type Status = (typeof STATUSES)[number];
export type StatusKind = "active" | "closed";

export const STATUS_META = {
  saved: { label: "Saved", kind: "active" },
  applied: { label: "Applied", kind: "active" },
  screening: { label: "Screening", kind: "active" },
  interviewing: { label: "Interviewing", kind: "active" },
  offer: { label: "Offer", kind: "active" },
  accepted: { label: "Accepted", kind: "closed" },
  rejected: { label: "Rejected", kind: "closed" },
  withdrawn: { label: "Withdrawn", kind: "closed" },
  ghosted: { label: "Ghosted", kind: "closed" },
} as const satisfies Record<Status, { label: string; kind: StatusKind }>;

export const ACTIVE_STATUSES: readonly Status[] = STATUSES.filter((s) => STATUS_META[s].kind === "active");
export const CLOSED_STATUSES: readonly Status[] = STATUSES.filter((s) => STATUS_META[s].kind === "closed");

// Suggested only; any status may change to any other (D6).
const FORWARD_PATH: readonly Status[] = [...ACTIVE_STATUSES, "accepted"];

export function nextSuggestedStatus(status: Status): Status | null {
  const i = FORWARD_PATH.indexOf(status);
  return i === -1 || i === FORWARD_PATH.length - 1 ? null : FORWARD_PATH[i + 1];
}

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}


/** F7: adding the first interview while in one of these suggests (never forces) moving on. */
const SUGGEST_INTERVIEWING_FROM: readonly Status[] = ["applied", "screening"];
export const INTERVIEWING_STATUS = "interviewing" satisfies Status;

export function suggestsInterviewing(status: Status, interviewCount: number): boolean {
  return interviewCount === 1 && SUGGEST_INTERVIEWING_FROM.includes(status);
}
