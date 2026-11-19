import { test as base, expect, type Locator, type Page } from "@playwright/test";

import {
  adminClient,
  findUserByEmail,
  noAccountEmail,
  TEST_USER_KEYS,
  type TestUserKey,
  testUserEmail,
} from "./local-env";

type Fixtures = {
  /**
   * Signs `target` (default: the test's page) in as an existing test user through `/auth/confirm`
   * with an admin-generated token hash (no email involved). Deletes the user's applications and
   * clears the profile's time zone first, so each test starts empty and the browser's zone is
   * detected again (F8).
   */
  signInAs: (email: string, target?: Page) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  signInAs: async ({ page }, provide) => {
    await provide(async (email, target = page) => {
      const admin = adminClient();
      const user = await findUserByEmail(email);
      if (!user) throw new Error(`Test user ${email} doesn't exist; global setup creates it.`);

      const { error: cleanupError } = await admin.from("applications").delete().eq("user_id", user.id);
      if (cleanupError) throw cleanupError;
      const { error: profileError } = await admin.from("profiles").update({ time_zone: null }).eq("id", user.id);
      if (profileError) throw profileError;

      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error) throw error;
      const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "email" });
      await target.goto(`/auth/confirm?${params}`);
      await expect(target).toHaveURL("/");
      await expect(target.getByRole("heading", { level: 1, name: "Reminders" })).toBeVisible();

      // The page saves the browser's zone and then re-renders every page. Wait for both, so that
      // re-render can't land in the middle of the test (it once closed an open board menu).
      await expect
        .poll(async () => {
          const { data } = await admin.from("profiles").select("time_zone").eq("id", user.id).single();
          return data?.time_zone ?? null;
        })
        .not.toBeNull();
      await target.waitForLoadState("networkidle");
    });
  },
});

export { expect };

/** The current project's test users (`testUserEmail`). Read them inside a test, where `test.info()` works. */
export const TEST_USERS = {} as Readonly<Record<TestUserKey, string>>;
for (const key of TEST_USER_KEYS) {
  Object.defineProperty(TEST_USERS, key, {
    enumerable: true,
    get: () => testUserEmail(key, test.info().project.name),
  });
}

/** The current project's address that never has an account. */
export function noAccount(): string {
  return noAccountEmail(test.info().project.name);
}

/**
 * WebKit logs a cancelled fetch as "<url> due to access control checks." A full page load
 * (`page.goto`) cancels Next's in-flight route prefetches (`?_rsc=`), so this shows up there
 * without anything having failed. Only that shape, for a prefetch URL, is ignored.
 */
const WEBKIT_CANCELLED_PREFETCH = /^\S+[?&]_rsc=[\w-]+ due to access control checks\.$/;

/** Collects console errors and warnings plus page errors; expect it to be empty at the end of a test. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    if (WEBKIT_CANCELLED_PREFETCH.test(message.text())) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/**
 * Waits until React has hydrated the element and has no render work left. A click before that is
 * lost, and React resets a controlled input filled while hydration is still in progress (the node
 * already has its fiber, but the commit hasn't run). WebKit under parallel load can take seconds to
 * get there, so interact only after this once a `page.goto` lands on a form or the board.
 *
 * Reads React internals (the node's fiber, then its root's `pendingLanes`). If React renames them,
 * this times out rather than passing.
 */
export async function expectHydrated(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
          type Fiber = { tag: number; return: Fiber | null; stateNode: { pendingLanes?: number } | null };
          let fiber = key ? ((element as unknown as Record<string, Fiber>)[key] ?? null) : null;
          while (fiber && fiber.tag !== 3) fiber = fiber.return; // 3: HostRoot
          return fiber?.stateNode?.pendingLanes === 0;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}
