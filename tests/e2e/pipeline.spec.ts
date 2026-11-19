import type { Page, Route } from "@playwright/test";

import { UNREACHABLE_ERROR } from "../../src/lib/action-result";
import { APPLICATION_NOT_FOUND } from "../../src/lib/applications";
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUS_META } from "../../src/lib/status";
import { collectConsoleErrors, expect, expectHydrated, test } from "./support/fixtures";
import { adminClient, findUserByEmail, seedApplications } from "./support/local-env";

function dayFromTodayUtc(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function column(page: Page, label: string) {
  return page.getByRole("region", { name: label, exact: true });
}

function card(page: Page, columnLabel: string, company: string) {
  return column(page, columnLabel).getByRole("listitem").filter({ hasText: company });
}

function history(page: Page) {
  return page.getByRole("list", { name: "Status changes, newest first" }).getByRole("listitem");
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** How far the board's columns overflow their own scroller, in pixels. */
function boardOverflow(page: Page): Promise<number> {
  return column(page, "Saved").evaluate((el) => {
    const scroller = el.parentElement;
    return scroller ? scroller.scrollWidth - scroller.clientWidth : Number.NaN;
  });
}

test("table view sorts, filters and searches", async ({ page, signInAs, users }) => {
  const consoleErrors = collectConsoleErrors(page);
  await signInAs(users.pipelineTable);
  await seedApplications(users.pipelineTable, [
    { company: "Acme Corp", role_title: "Software Engineer", status: "applied", work_mode: "remote", date_applied: "2026-10-01", updated_at: "2026-11-03T10:00:00Z" },
    { company: "Globex", role_title: "Data Analyst", status: "screening", work_mode: "onsite", date_applied: "2026-09-15", updated_at: "2026-11-05T10:00:00Z" },
    { company: "Initech", role_title: "Product Manager", status: "rejected", work_mode: "hybrid", date_applied: "2026-10-20", updated_at: "2026-11-01T10:00:00Z" },
    { company: "Umbrella", role_title: "Backend Engineer", status: "saved", work_mode: "remote", archived_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-06T10:00:00Z" },
  ]);
  await page.goto("/applications?view=table");

  const table = page.getByRole("table", { name: "Applications" });
  const companies = table.locator("tbody tr td:first-child");
  const sortBy = (name: string) => table.getByRole("button", { name, exact: true }).click();

  await expect(companies).toHaveText(["Globex", "Acme Corp", "Initech"]);
  await expect(table.getByRole("columnheader", { name: "Last updated" })).toHaveAttribute("aria-sort", "descending");

  await sortBy("Company");
  await expect(companies).toHaveText(["Acme Corp", "Globex", "Initech"]);
  await expect(table.getByRole("columnheader", { name: "Company" })).toHaveAttribute("aria-sort", "ascending");
  await sortBy("Company");
  await expect(companies).toHaveText(["Initech", "Globex", "Acme Corp"]);
  await sortBy("Role");
  await expect(companies).toHaveText(["Globex", "Initech", "Acme Corp"]);
  await sortBy("Status");
  await expect(companies).toHaveText(["Acme Corp", "Globex", "Initech"]);
  await sortBy("Date applied");
  await expect(companies).toHaveText(["Initech", "Acme Corp", "Globex"]);
  await sortBy("Last updated");
  await expect(companies).toHaveText(["Globex", "Acme Corp", "Initech"]);

  const statusFilter = page.getByRole("combobox", { name: "Status" });
  const workModeFilter = page.getByRole("combobox", { name: "Work mode" });
  const showArchived = page.getByRole("checkbox", { name: "Show archived" });
  const search = page.getByRole("searchbox", { name: "Search" });

  await statusFilter.selectOption("screening");
  await expect(companies).toHaveText(["Globex"]);
  await statusFilter.selectOption("all");
  await workModeFilter.selectOption("remote");
  await expect(companies).toHaveText(["Acme Corp"]);
  await showArchived.click();
  await expect(companies).toHaveText(["Umbrella", "Acme Corp"]);
  await expect(table.getByRole("row").filter({ hasText: "Umbrella" })).toContainText("Archived");
  await workModeFilter.selectOption("all");

  await search.fill("engineer");
  await expect(companies).toHaveText(["Umbrella", "Acme Corp"]);
  await showArchived.click();
  await expect(companies).toHaveText(["Acme Corp"]);
  await search.fill("  GLOB ");
  await expect(companies).toHaveText(["Globex"]);
  await search.fill("no such company");
  await expect(table).toContainText("No applications match these filters.");
  await expect(page.getByRole("status").filter({ hasText: "applications" })).toHaveText("0 applications");
  expect(consoleErrors()).toEqual([]);
});

test("board shows active columns in automatic order and moves a card from its keyboard menu", async ({
  page,
  signInAs,
  users,
}) => {
  const consoleErrors = collectConsoleErrors(page);
  await signInAs(users.pipelineBoard);
  await seedApplications(users.pipelineBoard, [
    { company: "Plain Co", role_title: "Engineer", status: "applied", updated_at: "2026-11-10T10:00:00Z" },
    { company: "Later Co", role_title: "Engineer", status: "applied", next_follow_up_on: dayFromTodayUtc(3) },
    { company: "Overdue Co", role_title: "Engineer", status: "applied", next_follow_up_on: dayFromTodayUtc(-1) },
    { company: "Today Co", role_title: "Engineer", status: "saved", next_follow_up_on: dayFromTodayUtc(0) },
    { company: "Closed Co", role_title: "Engineer", status: "rejected" },
    { company: "Archived Co", role_title: "Engineer", status: "saved", archived_at: "2026-11-02T10:00:00Z" },
  ]);
  await page.goto("/applications");
  await expectHydrated(column(page, "Saved"));

  for (const status of ACTIVE_STATUSES) await expect(column(page, STATUS_META[status].label)).toBeVisible();
  for (const status of CLOSED_STATUSES) await expect(column(page, STATUS_META[status].label)).toHaveCount(0);
  await expect(page.getByText("Archived Co")).toHaveCount(0);
  await expect(page.getByText("Closed Co")).toHaveCount(0);
  // Playwright's Desktop Chrome is 1280px wide: all five active columns fit without scrolling.
  expect(await boardOverflow(page)).toBeLessThanOrEqual(0);

  await expect(column(page, "Applied").getByRole("listitem")).toHaveText([/Overdue Co/, /Later Co/, /Plain Co/]);
  await expect(card(page, "Applied", "Overdue Co")).toContainText("Overdue");
  await expect(card(page, "Applied", "Overdue Co")).toContainText("In status since today");
  await expect(card(page, "Saved", "Today Co")).toContainText("Due today");
  await expect(card(page, "Applied", "Plain Co")).toContainText("No follow-up set");

  const showClosed = page.getByRole("checkbox", { name: "Show closed (1)" });
  await showClosed.click();
  await expect(card(page, "Rejected", "Closed Co")).toBeVisible();
  await showClosed.click();
  await expect(column(page, "Rejected")).toHaveCount(0);

  // Keyboard only: focus the card's Move menu, open it, arrow down to Screening. Radix can drop the
  // first arrow press right after a keyboard open, so step until Screening has focus.
  await page.getByRole("button", { name: "Move Plain Co, Engineer" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "Applied" })).toHaveAttribute("aria-checked", "true");
  const screening = page.getByRole("menuitemradio", { name: "Screening" });
  await expect(async () => {
    await page.keyboard.press("ArrowDown");
    await expect(screening).toBeFocused({ timeout: 200 });
  }).toPass({ timeout: 5_000 });
  await page.keyboard.press("Enter");

  await expect(card(page, "Screening", "Plain Co")).toBeVisible();
  await expect(card(page, "Applied", "Plain Co")).toHaveCount(0);
  await expect(page.getByText("Moved to Screening.")).toBeVisible();

  await page.reload();
  await expect(card(page, "Screening", "Plain Co")).toBeVisible();
  await card(page, "Screening", "Plain Co").getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: "Plain Co" })).toBeVisible();
  await expect(history(page)).toHaveCount(2);
  await expect(history(page).first()).toContainText("Applied → Screening");
  expect(consoleErrors()).toEqual([]);
});

test("dragging a card to another column changes its status", async ({ page, signInAs, users }) => {
  const consoleErrors = collectConsoleErrors(page);
  await signInAs(users.pipelineDrag);
  await seedApplications(users.pipelineDrag, [{ company: "Drag Co", role_title: "Engineer", status: "saved" }]);
  await page.goto("/applications");
  await expectHydrated(card(page, "Saved", "Drag Co"));

  const source = await card(page, "Saved", "Drag Co").boundingBox();
  if (!source) throw new Error("Board not rendered.");

  // Grab the card's padding (not the link or menu), then move past the mouse sensor's 8px so the
  // drag starts. Measure the target only then: the layout can still move until the drag begins.
  await page.mouse.move(source.x + source.width - 8, source.y + 8);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width - 8, source.y + 24, { steps: 4 });
  await expect(page.getByRole("status").filter({ hasText: "Drag Co" })).toHaveText(
    /^(Picked up Drag Co|Drag Co is over Saved)\.$/,
  );
  const target = await column(page, "Screening").boundingBox();
  if (!target) throw new Error("Board not rendered.");
  await page.mouse.move(target.x + target.width / 2, target.y + 80, { steps: 15 });
  // The board works out the column under the pointer after the move event, so a release straight
  // after the last move can still drop on the column before it (Firefox, WebKit). Release once the
  // board announces the target.
  await expect(page.getByRole("status").filter({ hasText: "Drag Co is" })).toHaveText("Drag Co is over Screening.");
  await page.mouse.up();

  await expect(card(page, "Screening", "Drag Co")).toBeVisible();
  await expect(card(page, "Saved", "Drag Co")).toHaveCount(0);
  await expect(page.getByText("Moved to Screening.")).toBeVisible();

  await page.reload();
  await expect(card(page, "Screening", "Drag Co")).toBeVisible();
  await card(page, "Screening", "Drag Co").getByRole("link").click();
  await expect(history(page).first()).toContainText("Saved → Screening");
  expect(consoleErrors()).toEqual([]);
});

async function moveWithMenu(page: Page, company: string, status: string) {
  await page.getByRole("button", { name: `Move ${company}, Engineer` }).click();
  await page.getByRole("menuitemradio", { name: status }).click();
}

const isServerAction = (route: Route) =>
  route.request().method() === "POST" && route.request().headers()["next-action"] !== undefined;

test("a move shows at once and rolls back when it fails or can't reach the server", async ({ page, signInAs, users }) => {
  const consoleErrors = collectConsoleErrors(page);
  await signInAs(users.pipelineRollback);
  await seedApplications(users.pipelineRollback, [
    { company: "Gone Co", role_title: "Engineer", status: "saved" },
    { company: "Offline Co", role_title: "Engineer", status: "saved" },
  ]);
  await page.goto("/applications");
  await expect(card(page, "Saved", "Gone Co")).toBeVisible();
  await expectHydrated(card(page, "Saved", "Gone Co"));

  const user = await findUserByEmail(users.pipelineRollback);
  if (!user) throw new Error("Rollback test user is missing.");
  const { error } = await adminClient().from("applications").delete().eq("user_id", user.id).eq("company", "Gone Co");
  if (error) throw error;

  // Hold the Server Action until the optimistic move has been checked.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/applications*", async (route) => {
    if (!isServerAction(route)) return route.continue();
    await held;
    return route.continue();
  });
  await moveWithMenu(page, "Gone Co", "Offer");
  await expect(card(page, "Offer", "Gone Co")).toBeVisible();
  await expect(card(page, "Saved", "Gone Co")).toHaveCount(0);
  release();
  await expect(page.getByText(APPLICATION_NOT_FOUND)).toBeVisible();
  await expect(card(page, "Saved", "Gone Co")).toBeVisible();
  await expect(card(page, "Offer", "Gone Co")).toHaveCount(0);
  expect(consoleErrors()).toEqual([]); // before the aborted request below, which the browser logs

  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/applications*", (route) => (isServerAction(route) ? route.abort() : route.continue()));
  await moveWithMenu(page, "Offline Co", "Offer");
  await expect(page.getByText(UNREACHABLE_ERROR)).toBeVisible();
  await expect(card(page, "Saved", "Offline Co")).toBeVisible();
  await expect(card(page, "Offer", "Offline Co")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("board and table fit without horizontal page scroll", async ({ page, signInAs, users }) => {
    const consoleErrors = collectConsoleErrors(page);
    await signInAs(users.pipelinePhone);
    await seedApplications(users.pipelinePhone, [
      { company: "Acme Corp", role_title: "Senior Software Engineer, Platform Infrastructure", status: "interviewing", next_follow_up_on: dayFromTodayUtc(-2) },
      { company: "Globex", role_title: "Data Analyst", status: "saved", date_applied: "2026-10-01" },
    ]);
    await page.goto("/applications");

    await expect(card(page, "Interviewing", "Acme Corp")).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(await boardOverflow(page)).toBeGreaterThan(0);

    await page.getByRole("link", { name: "Table" }).click();
    await expect(page.getByRole("table", { name: "Applications" }).getByRole("link", { name: "Acme Corp" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(consoleErrors()).toEqual([]);
  });
});
