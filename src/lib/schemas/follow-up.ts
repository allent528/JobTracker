import { z } from "zod";

import { TEXT_LIMITS } from "@/lib/limits";

import { optionalText } from "./fields";

/** A blank date clears the follow-up and its note; a date sets the next one. */
export const followUpDoneSchema = z
  .object({
    next_follow_up_on: z
      .string()
      .trim()
      .refine((value) => value === "" || z.iso.date().safeParse(value).success, { error: "Enter a valid date." })
      .transform((value) => value || null),
    follow_up_note: optionalText(TEXT_LIMITS.applications.follow_up_note),
  })
  .transform(({ next_follow_up_on, follow_up_note }) => ({
    next_follow_up_on,
    follow_up_note: next_follow_up_on === null ? null : follow_up_note,
  }));

export type FollowUpDoneValues = z.input<typeof followUpDoneSchema>;
