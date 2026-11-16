import { z } from "zod";

import { INTERVIEW_KINDS, INTERVIEW_OUTCOMES, PENDING_OUTCOME } from "@/lib/closed-sets";
import { TEXT_LIMITS } from "@/lib/limits";

import { optionalText } from "./fields";

const LIMITS = TEXT_LIMITS.interviews;

/** Mirrors interviews_duration_minutes_range. */
export const DURATION_MINUTES = { min: 1, max: 1440 } as const;

export const MAX_PICKED_INTERVIEWERS = 50;

// Years 1900-2999 only: `Date.UTC` maps years 0-99 to the 1900s, and datetime-local can't show
// years below 1000.
const LOCAL_DATE_TIME = /^((?:19|2\d)\d{2}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/;

/** A `datetime-local` value; the action reads it in the owner's time zone. */
const scheduledAt = z
  .string()
  .trim()
  .refine(
    (value) => {
      const match = LOCAL_DATE_TIME.exec(value);
      return match !== null && z.iso.date().safeParse(match[1]).success;
    },
    { error: "Enter the date and time." },
  );

const duration = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), { error: "Enter whole minutes, like 45." })
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || (value >= DURATION_MINUTES.min && value <= DURATION_MINUTES.max), {
    error: `Enter between ${DURATION_MINUTES.min} and ${DURATION_MINUTES.max.toLocaleString("en-US")} minutes.`,
  });

/** `contact_ids` are interviewers picked from the application's contacts. */
export const interviewSchema = z.object({
  kind: z.enum(INTERVIEW_KINDS, { error: "Choose the type of interview." }),
  scheduled_at: scheduledAt,
  duration_minutes: duration,
  location: optionalText(LIMITS.location),
  interviewers: optionalText(LIMITS.interviewers),
  contact_ids: z
    .array(z.uuid({ error: "That contact no longer exists." }))
    .max(MAX_PICKED_INTERVIEWERS, { error: `Pick up to ${MAX_PICKED_INTERVIEWERS} interviewers.` })
    .transform((ids) => [...new Set(ids)]),
  outcome: z.enum(INTERVIEW_OUTCOMES, { error: "Choose an outcome." }),
  notes: optionalText(LIMITS.notes),
});

export type InterviewFormValues = z.input<typeof interviewSchema>;
export type InterviewInput = z.output<typeof interviewSchema>;

export const EMPTY_INTERVIEW_FORM: InterviewFormValues = {
  kind: "phone_screen",
  scheduled_at: "",
  duration_minutes: "",
  location: "",
  interviewers: "",
  contact_ids: [],
  outcome: PENDING_OUTCOME,
  notes: "",
};
