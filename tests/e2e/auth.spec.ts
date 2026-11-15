import { expect, type Page, test } from "@playwright/test";

import {
  adminClient,
  clearInbox,
  countMessages,
  extractCode,
  extractConfirmLink,
  latestMessage,
  TEST_USERS,
  UNKNOWN_EMAIL,
} from "./support/local-env";

async function requestEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "we sent it a sign-in link and a code",
  );
}

async function expectSignedOutRedirect(
  page: Page,
  path: string,
  expectedNext: string | null,
) {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname === "/login");
  expect(new URL(page.url()).searchParams.get("next")).toBe(expectedNext);
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to JobTracker" }),
  ).toBeVisible();
}

test("signed-out visits to protected routes redirect to /login", async ({
  page,
}) => {
  await expectSignedOutRedirect(page, "/", null);
  await expectSignedOutRedirect(
    page,
    "/applications?tab=all",
    "/applications?tab=all",
  );
});

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("sign in with the emailed code, then sign out", async ({ page }) => {
    const email = TEST_USERS.code;
    await clearInbox(email);

    // An off-site ?next= must be ignored after sign-in (no open redirect).
    await page.goto("/login?next=//evil.example.com");
    await expectNoHorizontalScroll(page);
    await requestEmail(page, email);
    await expectNoHorizontalScroll(page);

    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();

    const code = extractCode(await latestMessage(email));
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "JobTracker" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Signed in, /login bounces home.
    await page.goto("/login");
    await expect(page).toHaveURL("/");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });
});

test("sign in with the magic link", async ({ page }) => {
  const email = TEST_USERS.link;
  await clearInbox(email);

  await page.goto("/login");
  await requestEmail(page, email);

  const link = extractConfirmLink(await latestMessage(email));
  await page.goto(link);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // The link is single-use.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto(link);
  await expect(page).toHaveURL("/login?error=link");
  await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible();
});

test("an unknown email gets the same answer, no email and no account", async ({
  page,
}) => {
  await clearInbox(UNKNOWN_EMAIL);

  await page.goto("/login");
  await requestEmail(page, UNKNOWN_EMAIL);

  // Give the auth server time to have sent something, if it were going to.
  await page.waitForTimeout(1500);
  expect(await countMessages(UNKNOWN_EMAIL)).toBe(0);

  const { data, error } = await adminClient().auth.admin.listUsers({
    perPage: 1000,
  });
  expect(error).toBeNull();
  expect(data.users.some((user) => user.email === UNKNOWN_EMAIL)).toBe(false);
});
