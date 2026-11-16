// Closed sets besides status (which lives in status.ts), each mirrored by a check constraint in
// supabase/migrations (D7). check-constraints.test.ts keeps them equal.
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const INTERVIEW_KINDS = ["phone_screen", "technical", "behavioral", "onsite", "final", "other"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_OUTCOMES = ["pending", "passed", "failed", "cancelled"] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];

export const WORK_MODE_LABELS = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
} as const satisfies Record<WorkMode, string>;

export function isWorkMode(value: string): value is WorkMode {
  return (WORK_MODES as readonly string[]).includes(value);
}

export const INTERVIEW_KIND_LABELS = {
  phone_screen: "Phone screen",
  technical: "Technical",
  behavioral: "Behavioral",
  onsite: "Onsite",
  final: "Final",
  other: "Other",
} as const satisfies Record<InterviewKind, string>;

export const INTERVIEW_OUTCOME_LABELS = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  cancelled: "Cancelled",
} as const satisfies Record<InterviewOutcome, string>;

/** New rounds start here (the column default); only pending rounds count as upcoming. */
export const PENDING_OUTCOME = "pending" satisfies InterviewOutcome;
