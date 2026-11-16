import { FALLBACK_TIME_ZONE } from "@/lib/dates";

// An IANA name such as `America/New_York`, `UTC` or `Etc/GMT+5`. Offsets like `+05:00`, which newer
// Intl versions accept, are rejected: the database checks names against pg_timezone_names.
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

/** A zone name this runtime's Intl can format in. The database trigger is the final check. */
export function isSupportedTimeZone(value: string): boolean {
  if (value.length > 64 || !IANA_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The settings list: Intl's zones plus UTC (which Intl leaves out) and the saved zone, sorted. */
export function timeZoneOptions(current: string | null): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  zones.add(FALLBACK_TIME_ZONE);
  if (current) zones.add(current);
  return [...zones].sort((a, b) => a.localeCompare(b));
}
