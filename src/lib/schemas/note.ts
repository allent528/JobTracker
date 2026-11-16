import { z } from "zod";

import { TEXT_LIMITS } from "@/lib/limits";

import { requiredText } from "./fields";

/** F5: plain text; Markdown is kept as typed and shown as plain text. */
export const noteSchema = z.object({
  body: requiredText("note", TEXT_LIMITS.notes.body),
});

export type NoteFormValues = z.input<typeof noteSchema>;

export const EMPTY_NOTE_FORM: NoteFormValues = { body: "" };
