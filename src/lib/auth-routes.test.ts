import { describe, expect, it } from "vitest";

import { isPublicPath, safeNextPath } from "./auth-routes";

describe("isPublicPath", () => {
  it.each(["/login", "/auth/confirm", "/auth/confirm/"])("allows %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/", "/applications", "/loginx", "/auth", "/auth/confirmed", "/settings/login"])(
    "protects %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("safeNextPath", () => {
  it.each([
    ["/applications", "/applications"],
    ["/applications/123?tab=notes", "/applications/123?tab=notes"],
    ["/stats#week", "/stats#week"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "applications",
    "//evil.example.com",
    "/\\evil.example.com",
    "https://evil.example.com",
    "javascript:alert(1)",
    "/\t/evil.example.com",
    "/login",
    "/auth/confirm?next=/x",
  ])("falls back to / for %s", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});
