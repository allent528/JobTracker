import { describe, expect, it } from "vitest";

import { isPublicPath, loginUrl, safeNextPath } from "./auth-routes";

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

describe("loginUrl", () => {
  it("builds /login with optional next and error", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl({ next: "/" })).toBe("/login");
    expect(loginUrl({ next: "/applications?tab=all" })).toBe(
      "/login?next=%2Fapplications%3Ftab%3Dall",
    );
    expect(loginUrl({ error: "link" })).toBe("/login?error=link");
  });
});

const OFF_SITE = [
  null,
  undefined,
  "",
  "applications",
  "//evil.example.com",
  "/\\evil.example.com",
  "/\t/evil.example.com",
  "/\n/evil.example.com",
  "https://evil.example.com",
  "javascript:alert(1)",
  "/.//evil.example.com",
  "/a/..//evil.example.com",
  "/%2e%2e//evil.example.com",
  "/x/..///evil.example.com",
  "/./\\evil.example.com",
];

describe("safeNextPath", () => {
  it.each([
    ["/applications", "/applications"],
    ["/applications/123?tab=notes", "/applications/123?tab=notes"],
    ["/stats#week", "/stats#week"],
    ["/a/../applications", "/applications"],
  ])("keeps same-origin path %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each(OFF_SITE)("falls back to / for %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it.each(["/login", "/auth/confirm?next=/x"])("falls back to / for public path %j", (input) => {
    expect(safeNextPath(input)).toBe("/");
  });

  it("never returns a path starting with //", () => {
    const inputs = [
      ...OFF_SITE,
      "/.//x",
      "/././/x",
      "/a/b/../..//x",
      "/%2e//x",
      "/%2E%2E//x",
      "/./\t/x",
      "/\\/x",
      "/./%2f/x",
    ];
    for (const input of inputs) {
      expect(safeNextPath(input).startsWith("//")).toBe(false);
    }
  });
});
