import { z } from "zod";

import { TEXT_LIMITS } from "@/lib/limits";

import { optionalHttpUrl, optionalText, requiredText, tooLong } from "./fields";

const LIMITS = TEXT_LIMITS.contacts;

const email = z
  .string()
  .trim()
  .max(LIMITS.email, { error: tooLong(LIMITS.email) })
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    error: "Enter an email address, like jane@example.com.",
  })
  .transform((value) => value || null);

/** F6. Inputs are strings; blanks become nulls. */
export const contactSchema = z.object({
  name: requiredText("name", LIMITS.name),
  title: optionalText(LIMITS.title),
  email,
  phone: optionalText(LIMITS.phone),
  linkedin_url: optionalHttpUrl(LIMITS.linkedin_url),
  notes: optionalText(LIMITS.notes),
});

export type ContactFormValues = z.input<typeof contactSchema>;

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  title: "",
  email: "",
  phone: "",
  linkedin_url: "",
  notes: "",
};
