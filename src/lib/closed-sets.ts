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
