import { test as base, expect, type Locator, type Page } from "@playwright/test";

import { adminClient, findUserByEmail, type TestUsers, testUsers } from "./local-env";

type Fixtures = {
  /**
   * Signs `target` (default: the test's page) in as an existing test user through `/auth/confirm`
   * with an admin-generated token hash (no email involved). Deletes the user's applications and
   * clears the profile's time zone first, so each test starts empty and the browser's zone is
   * detected again (F8).
   */
  signInAs: (email: string, target?: Page) => Promise<void>;
  /** This project's test users, so the browsers never share a user. */
  users: TestUsers;
};

export const test = base.extend<Fixtures>({
  users: async ({}, provide, testInfo) => {
    await provide(testUsers(testInfo.project.name));
  },
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

/**
 * What engines raise for a fetch or script that a page load cut off: WebKit's cancelled prefetch
 * ("<url>?_rsc=… due to access control checks.", scheme dropped), its and Firefox's aborted
 * fetch, and Firefox's aborted script.
 */
const ABORT_ERROR =
  /^(\S+[?&]_rsc=\S+ due to access control checks\.|(TypeError: )?(Load failed|Error in input stream)|\[JavaScript Warning: "Loading failed for the <script> with source .*)$/;
const CANCELLED_REQUEST = /^(net::ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled)$/;
const ABORT_WINDOW_MS = 2_000;

/**
 * Collects console errors and warnings plus page errors; call the result at the end of a test and
 * expect `[]`. It drops only `ABORT_ERROR` messages within 2s of a main-frame navigation or a
 * cancelled request: `page.goto` and `reload` cut off Next's prefetches and refreshes, and WebKit
 * and Firefox report that. Playwright doesn't report every cancelled request, so the
 * navigation time counts too.
 */
export function collectConsoleErrors(page: Page): () => string[] {
  const seen: { text: string; at: number }[] = [];
  const cutoffs: number[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const entry = { text: message.text(), at: Date.now() };
    seen.push(entry);
    // Firefox prints an Error argument as "JSHandle@object"; read the error itself.
    const [first] = message.args();
    if (entry.text.startsWith("JSHandle@") && first) {
      first
        .evaluate((value) => (value instanceof Error ? `${value.name}: ${value.message}` : String(value)))
        .then((text) => (entry.text = text), () => {});
    }
  });
  page.on("pageerror", (error) => seen.push({ text: error.message, at: Date.now() }));
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) cutoffs.push(Date.now());
  });
  page.on("requestfailed", (request) => {
    if (CANCELLED_REQUEST.test(request.failure()?.errorText ?? "")) cutoffs.push(Date.now());
  });

  const cutOff = ({ text, at }: { text: string; at: number }) =>
    ABORT_ERROR.test(text) && cutoffs.some((cutoff) => Math.abs(cutoff - at) <= ABORT_WINDOW_MS);
  return () => seen.filter((entry) => !cutOff(entry)).map(({ text }) => text);
}

type Fiber = { tag: number; return: Fiber | null; stateNode: { pendingLanes?: number } | null };

/**
 * Waits until React has hydrated the element and has no render work left: a click before that is
 * lost, and the commit resets a controlled input filled while hydration runs. Use it after a
 * `page.goto` onto a form or the board. Pass a role or visible-filtered locator (one element).
 * Reads React internals (fiber, root `pendingLanes`); if they change, this times out, never passes.
 */
export async function expectHydrated(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
          let fiber = key ? ((element as unknown as Record<string, Fiber>)[key] ?? null) : null;
          while (fiber && fiber.tag !== 3) fiber = fiber.return; // 3: HostRoot
          return fiber?.stateNode?.pendingLanes === 0;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}
