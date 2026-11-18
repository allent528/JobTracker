"use client";

import { useEffect, useRef } from "react";

import { detectTimeZone } from "./actions";

/** A zone the server rejects leaves the UTC fallback in place; settings can still pick one. */
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
