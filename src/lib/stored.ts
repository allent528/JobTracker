import type { InterviewKind, InterviewOutcome, WorkMode } from "@/lib/closed-sets";
import type { Status } from "@/lib/status";

// Stored closed-set text read back from the database. The casts are safe because each column's check
// constraint allows only these values, and check-constraints.test.ts keeps the constraints equal to the
// TS constants. status_events copies a checked status, so renaming a status migrates its rows (database.md).

export const storedStatus = (value: string) => value as Status;
export const storedWorkMode = (value: string | null) => value as WorkMode | null;
export const storedInterviewKind = (value: string) => value as InterviewKind;
export const storedInterviewOutcome = (value: string) => value as InterviewOutcome;
