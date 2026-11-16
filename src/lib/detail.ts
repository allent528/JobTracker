import type { InterviewKind, InterviewOutcome } from "@/lib/closed-sets";
import { instantToLocalDateTime } from "@/lib/dates";
import type { ContactFormValues } from "@/lib/schemas/contact";
import type { InterviewFormValues } from "@/lib/schemas/interview";
import type { Tables } from "@/types/database.types";

// Rows shown in the application detail page's notes, contacts and interviews sections (F5–F7).

export const NOTE_NOT_FOUND = "That note no longer exists.";
export const CONTACT_NOT_FOUND = "That contact no longer exists.";
export const INTERVIEW_NOT_FOUND = "That interview no longer exists.";

export type Note = Pick<Tables<"notes">, "id" | "body" | "created_at" | "updated_at">;

export type Contact = Pick<
  Tables<"contacts">,
  "id" | "name" | "title" | "email" | "phone" | "linkedin_url" | "notes" | "updated_at"
>;

/** `kind` / `outcome` narrowed like `status` (check constraints keep it safe); `contact_ids` are picked interviewers. */
export type Interview = Omit<
  Pick<
    Tables<"interviews">,
    | "id"
    | "kind"
    | "scheduled_at"
    | "duration_minutes"
    | "location"
    | "interviewers"
    | "outcome"
    | "notes"
    | "updated_at"
  >,
  "kind" | "outcome"
> & { kind: InterviewKind; outcome: InterviewOutcome; contact_ids: string[] };

/** True when a note was changed after it was added (the updated_at trigger moves it). */
export function wasEdited(note: Pick<Note, "created_at" | "updated_at">): boolean {
  return new Date(note.updated_at).getTime() > new Date(note.created_at).getTime();
}

export function contactFormValues(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    title: contact.title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    linkedin_url: contact.linkedin_url ?? "",
    notes: contact.notes ?? "",
  };
}

/** Edit-form values; the scheduled time is shown on the owner's wall clock. */
export function interviewFormValues(interview: Interview, timeZone: string): InterviewFormValues {
  return {
    kind: interview.kind,
    scheduled_at: instantToLocalDateTime(interview.scheduled_at, timeZone),
    duration_minutes: interview.duration_minutes === null ? "" : String(interview.duration_minutes),
    location: interview.location ?? "",
    interviewers: interview.interviewers ?? "",
    contact_ids: interview.contact_ids,
    outcome: interview.outcome,
    notes: interview.notes ?? "",
  };
}

/** Picked contacts first (in contact order), then the free-text names. Unknown ids are skipped. */
export function interviewerNames(interview: Pick<Interview, "contact_ids" | "interviewers">, contacts: Contact[]): string[] {
  const picked = contacts.filter((c) => interview.contact_ids.includes(c.id)).map((c) => c.name);
  return interview.interviewers ? [...picked, interview.interviewers] : picked;
}

/** "45 min", "1 hr", "1 hr 30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
