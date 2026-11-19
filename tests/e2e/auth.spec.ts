import type { Page } from "@playwright/test";

import { OTP_LENGTH } from "../../src/lib/schemas/auth";
import { expect, expectHydrated, noAccount, TEST_USERS, test } from "./support/fixtures";
import {
  clearInbox,
  countMessages,
  extractCode,
  extractConfirmLink,
  findUserByEmail,
  latestMessage,
} from "./support/local-env";

const CODE_LABEL = `${OTP_LENGTH}-digit code`;

async function requestEmail(page: Page, email: string) {
  await expectHydrated(page.getByLabel("Email"));
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("we sent it a sign-in link and a code");
}

async function expectSignedOutRedirect(page: Page, path: string, expectedNext: string | null) {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  expect(new URL(page.url()).searchParams.get("next")).toBe(expectedNext);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to JobTracker" })).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("signed-out visits to protected routes redirect to /login", async ({ page }) => {
  await expectSignedOutRedirect(page, "/", null);
  await expectSignedOutRedirect(page, "/applications?tab=all", "/applications?tab=all");
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("sign in with the emailed code, then sign out", async ({ page }) => {
    const email = TEST_USERS.code;
    await clearInbox(email);

    // Normalizes to //evil.example.com; must not become an open redirect.
    await page.goto("/login?next=/.//evil.example.com");
    await expectNoHorizontalScroll(page);
    await requestEmail(page, email);
    await expectNoHorizontalScroll(page);

    await page.getByLabel(CODE_LABEL).fill("0".repeat(OTP_LENGTH));
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();

    const code = extractCode(await latestMessage(email));
    await page.getByLabel(CODE_LABEL).fill(code);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: "Reminders" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("/login");
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/applications");
    await expect(page).toHaveURL("/login?next=%2Fapplications");
  });
});

test("sign in with the magic link, which works only once", async ({ page }) => {
  const email = TEST_USERS.link;
  await clearInbox(email);

  await page.goto("/login");
  await requestEmail(page, email);

  const link = extractConfirmLink(await latestMessage(email));
  await page.goto(link);
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto(link);
  await expect(page).toHaveURL("/login?error=link");
  const linkError = page.getByRole("alert").filter({ hasText: "invalid or has expired" });
  await expect(linkError).toBeVisible();

  // A stale ?error=link message must not come back after a new request.
  await requestEmail(page, email);
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(linkError).toHaveCount(0);
});

test("an unknown email gets the same answer, no email and no account", async ({ page }) => {
  const nobody = noAccount();
  await clearInbox(nobody);

  await page.goto("/login");
  await requestEmail(page, nobody);

  // Give the auth server time to have sent something, if it were going to.
  await page.waitForTimeout(1500);
  expect(await countMessages(nobody)).toBe(0);
  expect(await findUserByEmail(nobody)).toBeNull();
});
