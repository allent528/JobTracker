// Closed sets besides status (which lives in status.ts). Each is mirrored by a check constraint
// in supabase/migrations (D7); change both in the same PR. check-constraints.test.ts enforces it.
export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const INTERVIEW_KINDS = ["phone_screen", "technical", "behavioral", "onsite", "final", "other"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_OUTCOMES = ["pending", "passed", "failed", "cancelled"] as const;
export type InterviewOutcome = (typeof INTERVIEW_OUTCOMES)[number];
