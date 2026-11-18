import { describe, expect, it } from "vitest";

import { timeZoneSchema } from "./schemas/settings";
import { effectiveTimeZone, isSupportedTimeZone, timeZoneOptions } from "./time-zones";

describe("isSupportedTimeZone", () => {
  it.each(["UTC", "America/New_York", "Asia/Kolkata", "Asia/Calcutta", "Etc/GMT+5", "America/Argentina/Buenos_Aires"])(
    "accepts %s",
    (zone) => expect(isSupportedTimeZone(zone)).toBe(true),
  );

  it.each(["", "Factory", "Mars/Olympus_Mons", "+05:00", "-0800", "America/New York", "../etc/passwd", "a".repeat(65)])(
    "rejects %j",
    (zone) => expect(isSupportedTimeZone(zone)).toBe(false),
  );
});

describe("timeZoneSchema", () => {
  it("trims and accepts a zone, and explains a bad one", () => {
    expect(timeZoneSchema.parse({ time_zone: " Europe/Paris " })).toEqual({ time_zone: "Europe/Paris" });
    const bad = timeZoneSchema.safeParse({ time_zone: "Nowhere/Land" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("Pick a time zone from the list.");
  });
});

describe("timeZoneOptions", () => {
  it("includes UTC and the saved zone, sorted and without duplicates", () => {
    const options = timeZoneOptions("US/Eastern");
    expect(options).toContain("UTC");
    expect(options).toContain("US/Eastern");
    expect(options).toContain("Europe/Paris");
    expect(new Set(options).size).toBe(options.length);
    expect([...options].sort((a, b) => a.localeCompare(b))).toEqual(options);
    expect(timeZoneOptions("UTC")).not.toContain("US/Eastern");
  });
});

describe("effectiveTimeZone", () => {
  it("uses a saved zone Intl can format in, and UTC otherwise", () => {
    expect(effectiveTimeZone("America/New_York")).toBe("America/New_York");
    expect(effectiveTimeZone(null)).toBe("UTC");
    // Listed in pg_timezone_names, so the database accepts it, but Intl can't format in it.
    expect(effectiveTimeZone("Factory")).toBe("UTC");
  });
});
