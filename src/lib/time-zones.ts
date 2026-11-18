import { FALLBACK_TIME_ZONE } from "@/lib/dates";

// An IANA name such as `America/New_York`, `UTC` or `Etc/GMT+5`. Offsets like `+05:00`, which newer
// Intl versions accept, are rejected: the database checks names against pg_timezone_names.
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

export function isSupportedTimeZone(value: string): boolean {
  if (value.length > 64 || !IANA_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone pages format in. pg_timezone_names accepts some names Intl can't format in (`Factory`);
 * those fall back to UTC instead of crashing every page.
 */
export function effectiveTimeZone(stored: string | null): string {
  return stored !== null && isSupportedTimeZone(stored) ? stored : FALLBACK_TIME_ZONE;
}

/** Intl's list leaves out UTC. */
export function timeZoneOptions(current: string): string[] {
  const zones = new Set(Intl.supportedValuesOf("timeZone"));
  zones.add(FALLBACK_TIME_ZONE);
  zones.add(current);
  return [...zones].sort((a, b) => a.localeCompare(b));
}
