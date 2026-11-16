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

/** A calendar date as `YYYY-MM-DD`; compares correctly as a string. */
export type DateOnly = string;

export function dateInTimeZone(instant: Date | string, timeZone: string): DateOnly {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function daysBetween(from: DateOnly, to: DateOnly): number {
  const utc = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** A `datetime-local` input value, `YYYY-MM-DDTHH:mm`: a wall-clock time with no zone. */
export type LocalDateTime = string;

/** Wall-clock parts of `instant` in `timeZone`. */
function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** How far `timeZone`'s wall clock is ahead of UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which `timeZone`'s clock shows `local`. A time skipped by a DST change resolves
 * to the same wall time under the earlier offset (e.g. 2:30 on a spring-forward night becomes 3:30);
 * a repeated time resolves to its first occurrence.
 */
export function localDateTimeToInstant(local: LocalDateTime, timeZone: string): Date {
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Try the offsets in force a day either side of the wall time; the earlier offset wins ties.
  const candidates = [-86_400_000, 86_400_000].map((shift) => {
    const offset = zoneOffsetMs(new Date(wallAsUtc + shift), timeZone);
    return new Date(wallAsUtc - offset);
  });
  const exact = candidates
    .filter((c) => instantToLocalDateTime(c, timeZone) === local)
    .sort((a, b) => a.getTime() - b.getTime());
  return exact[0] ?? candidates[0];
}

/** `instant` as a `datetime-local` value in `timeZone`. */
export function instantToLocalDateTime(instant: Date | string, timeZone: string): LocalDateTime {
  const p = zonedParts(new Date(instant), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** A timestamptz as "Dec 1, 2026, 10:00 AM EST" in `timeZone`, with the zone's short name. */
export function formatDateTimeWithZone(timestamp: string, timeZone: string): string {
  const zone = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(new Date(timestamp))
    .find((p) => p.type === "timeZoneName")?.value;
  return `${formatDateTime(timestamp, timeZone)} ${zone ?? timeZone}`;
}
