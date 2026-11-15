import { describe, expect, it } from "vitest";

import { signInEmailSchema, verifyCodeSchema } from "./auth";

describe("signInEmailSchema", () => {
  it("trims and lowercases the email", () => {
    expect(signInEmailSchema.parse({ email: "  Jane@Example.COM " })).toEqual({
      email: "jane@example.com",
    });
  });

  it.each(["", "jane", "jane@", "@example.com"])("rejects %j", (email) => {
    expect(signInEmailSchema.safeParse({ email }).success).toBe(false);
  });
});

describe("verifyCodeSchema", () => {
  it("accepts a 6-digit code with surrounding spaces", () => {
    expect(verifyCodeSchema.parse({ email: "jane@example.com", code: " 012345 " })).toEqual({
      email: "jane@example.com",
      code: "012345",
    });
  });

  it.each(["", "12345", "1234567", "12a456", "12 456"])("rejects code %j", (code) => {
    expect(verifyCodeSchema.safeParse({ email: "jane@example.com", code }).success).toBe(false);
  });
});
