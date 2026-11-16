"use client";

import { useEffect, useRef } from "react";

import { detectTimeZone } from "./actions";

/**
 * Rendered only while `profiles.time_zone` is unset: saves the browser's zone once (F8). The action
 * revalidates every page, so lists rendered with the UTC fallback refresh in the owner's zone. A
 * zone the server rejects leaves the fallback in place; settings can still pick one.
 */
export function TimeZoneDetector() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) detectTimeZone({ time_zone: timeZone }).catch(() => {});
  }, []);
  return null;
}
