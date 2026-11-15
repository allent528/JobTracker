// Server code formats in the owner's `profiles.time_zone` (D11), never the server's.

/** Used until the browser time zone is detected (step 7) and `profiles.time_zone` is set. */
export const FALLBACK_TIME_ZONE = "UTC";

/** `YYYY-MM-DD` as "Nov 14, 2026". Date-only, so no time zone shift applies. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** A timestamptz as "Nov 14, 2026, 9:05 AM" in `timeZone`. */
export function formatDateTime(timestamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(timestamp),
  );
}

/** The calendar date (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function dateInTimeZone(instant: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whole calendar days from `from` to `to` (both `YYYY-MM-DD`); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const utc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}
