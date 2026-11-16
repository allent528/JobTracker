import { z } from "zod";

import { TEXT_LIMITS } from "@/lib/limits";

import { optionalText } from "./fields";

/** Marking a follow-up done (F8): a blank date clears it, a date sets the next one. */
export const followUpDoneSchema = z
  .object({
    next_follow_up_on: z
      .string()
      .trim()
      .refine((value) => value === "" || z.iso.date().safeParse(value).success, { error: "Enter a valid date." })
      .transform((value) => value || null),
    follow_up_note: optionalText(TEXT_LIMITS.applications.follow_up_note),
  })
  .refine(({ next_follow_up_on, follow_up_note }) => next_follow_up_on !== null || follow_up_note === null, {
    error: "Pick a date for the next follow-up, or clear the note.",
    path: ["next_follow_up_on"],
  });

export type FollowUpDoneValues = z.input<typeof followUpDoneSchema>;
