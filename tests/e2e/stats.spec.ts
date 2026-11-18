import type { Page } from "@playwright/test";

import { addDays, dateInTimeZone } from "../../src/lib/dates";
import { localSuperuserQuery } from "../rls/support";
import { expect, test } from "./support/fixtures";
import { adminClient, seedApplications, TEST_USERS } from "./support/local-env";

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const section = (page: Page, name: string | RegExp) => page.getByRole("region", { name });

/** Moves an application through `statuses` (the trigger logs each), then backdates each event. */
async function walk(id: string, path: { status: string; daysAgo: number }[]) {
  for (const { status } of path) {
    const { error } = await adminClient().from("applications").update({ status }).eq("id", id);
    if (error) throw error;
  }
  for (const { status, daysAgo } of path) {
    localSuperuserQuery(
      `update public.status_events set changed_at = now() - interval '${daysAgo} days' where application_id = '${id}' and to_status = '${status}'`,
    );
  }
}

/** Three unarchived applications and one archived; returns nothing the page doesn't show. */
async function seedStats(email: string) {
  const today = dateInTimeZone(new Date(), "UTC");
  const apps = await seedApplications(email, [
    { company: "Acme Corp", role_title: "Engineer", status: "applied", date_applied: today },
    { company: "Globex", role_title: "Engineer", status: "applied", date_applied: addDays(today, -7) },
    { company: "Initech", role_title: "Engineer" },
    { company: "Archived Co", role_title: "Engineer", status: "applied", date_applied: today, archived_at: "2026-11-01T00:00:00Z" },
  ]);
  const id = (company: string) => apps.find((app) => app.company === company)!.id;
  await walk(id("Acme Corp"), [
    { status: "applied", daysAgo: 10 },
    { status: "screening", daysAgo: 7 },
  ]);
  await walk(id("Globex"), [
    { status: "applied", daysAgo: 6 },
    { status: "rejected", daysAgo: 1 },
  ]);
}

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("shows the counts, weekly numbers, response rate and stage averages", async ({ page, signInAs }) => {
    const consoleErrors = collectConsoleErrors(page);
    const email = TEST_USERS.stats;
    await signInAs(email);
    await seedStats(email);

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Stats" }).click();
    await expect(page).toHaveURL("/stats");
    await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Include archived applications" })).not.toBeChecked();

    const byStatus = section(page, "Applications by status");
    await expect(byStatus.getByRole("row", { name: "Saved 1" })).toBeVisible();
    await expect(byStatus.getByRole("row", { name: "Applied 0" })).toBeVisible();
    await expect(byStatus.getByRole("row", { name: "Screening 1" })).toBeVisible();
    await expect(byStatus.getByRole("row", { name: "Rejected 1" })).toBeVisible();
    await expect(byStatus.getByRole("row", { name: "Total 3" })).toBeVisible();

    // Acme reached Screening; Globex went Applied → Rejected; Initech never reached Applied.
    const response = section(page, "Response rate");
    await expect(response.getByText("50%")).toBeVisible();
    await expect(response).toContainText("1 of 2 applications that reached Applied got to Screening or later.");

    const weekly = section(page, /^Applications per week/);
    await expect(weekly).toContainText("2 applied in these 12 weeks.");
    await expect(weekly.getByRole("img", { name: /Bar chart of applications per week/ })).toBeVisible();
    await weekly.getByText("Show as table").click();
    const weekRows = weekly.getByRole("row");
    await expect(weekRows).toHaveCount(13);
    await expect(weekRows.last()).toHaveText(/1$/); // this week: Acme
    await expect(weekRows.nth(11)).toHaveText(/1$/); // last week: Globex

    // Applied: Acme 3 days, Globex 5 days. Screening and Rejected are current stages.
    const stages = section(page, "Average days in each stage");
    await expect(stages.getByRole("row", { name: "Applied 4 days 2" })).toBeVisible();
    await expect(stages.getByRole("row", { name: "Screening No data 0" })).toBeVisible();

    await expectNoHorizontalScroll(page);

    await page.getByRole("checkbox", { name: "Include archived applications" }).click();
    await expect(page).toHaveURL("/stats?archived=1");
    await expect(byStatus.getByRole("row", { name: "Total 4" })).toBeVisible();
    await expect(byStatus.getByRole("row", { name: "Applied 1" })).toBeVisible();
    await expect(response.getByText("33%")).toBeVisible();
    await expect(weekly).toContainText("3 applied in these 12 weeks.");

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Include archived applications" })).toBeChecked();
    await expect(byStatus.getByRole("row", { name: "Total 4" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Include archived applications" }).click();
    await expect(page).toHaveURL("/stats");
    await expect(byStatus.getByRole("row", { name: "Total 3" })).toBeVisible();

    await expectNoHorizontalScroll(page);
    expect(consoleErrors).toEqual([]);
  });
});

test("another user sees an empty dashboard, not the owner's stats", async ({ browser, page, signInAs }) => {
  await signInAs(TEST_USERS.statsIsolationOwner);
  await seedStats(TEST_USERS.statsIsolationOwner);
  await page.goto("/stats");
  await expect(section(page, "Applications by status").getByRole("row", { name: "Total 3" })).toBeVisible();

  const context = await browser.newContext();
  const otherPage = await context.newPage();
  const consoleErrors = collectConsoleErrors(otherPage);
  await signInAs(TEST_USERS.statsIsolationOther, otherPage);
  for (const [path, message] of [
    ["/stats", "No applications to count yet. Archived applications count only when included."],
    ["/stats?archived=1", "No applications to count yet."],
  ]) {
    await otherPage.goto(path);
    // Streaming can briefly leave a hidden copy of the content in the DOM.
    await expect(otherPage.getByText(message, { exact: true }).filter({ visible: true })).toBeVisible();
    for (const name of ["Applications by status", "Response rate", "Average days in each stage"]) {
      await expect(section(otherPage, name)).toHaveCount(0);
    }
  }
  expect(consoleErrors).toEqual([]);
  await context.close();
});
