import type { InterviewKind, InterviewOutcome } from "@/lib/closed-sets";
import { instantToLocalDateTime } from "@/lib/dates";
import type { ContactFormValues } from "@/lib/schemas/contact";
import type { InterviewFormValues } from "@/lib/schemas/interview";
import type { Tables } from "@/types/database.types";

export type Note = Pick<Tables<"notes">, "id" | "body" | "created_at" | "updated_at">;

export type Contact = Pick<
  Tables<"contacts">,
  "id" | "name" | "title" | "email" | "phone" | "linkedin_url" | "notes" | "updated_at"
>;

export type Interview = Pick<
  Tables<"interviews">,
  "id" | "scheduled_at" | "duration_minutes" | "location" | "interviewers" | "notes" | "updated_at"
> & { kind: InterviewKind; outcome: InterviewOutcome; contact_ids: string[] };

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

/** Picked contacts in contact order, then the free text. Ids that aren't contacts are skipped. */
export function interviewerNames(interview: Pick<Interview, "contact_ids" | "interviewers">, contacts: Contact[]): string[] {
  const picked = contacts.filter((c) => interview.contact_ids.includes(c.id)).map((c) => c.name);
  return interview.interviewers ? [...picked, interview.interviewers] : picked;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
