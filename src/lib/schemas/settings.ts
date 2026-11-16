import { z } from "zod";

import { isSupportedTimeZone } from "@/lib/time-zones";

export const timeZoneSchema = z.object({
  time_zone: z.string().trim().refine(isSupportedTimeZone, { error: "Pick a time zone from the list." }),
});

export type TimeZoneFormValues = z.input<typeof timeZoneSchema>;
