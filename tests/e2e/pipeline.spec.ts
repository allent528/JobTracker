import type { Page } from "@playwright/test";

import { APPLICATION_NOT_FOUND } from "../../src/lib/applications";
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUS_META } from "../../src/lib/status";
import { expect, test } from "./support/fixtures";
import { adminClient, seedApplications, TEST_USERS } from "./support/local-env";

// The e2e users have no profiles.time_zone, so "today" is today in UTC (FALLBACK_TIME_ZONE).
function dayFromToday(offset: number): string {
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

test("table view sorts, filters and searches", async ({ page, signInAs }) => {
  await signInAs(TEST_USERS.pipelineTable);
  await seedApplications(TEST_USERS.pipelineTable, [
    { company: "Acme Corp", role_title: "Software Engineer", status: "applied", work_mode: "remote", date_applied: "2026-10-01", updated_at: "2026-11-03T10:00:00Z" },
    { company: "Globex", role_title: "Data Analyst", status: "screening", work_mode: "onsite", date_applied: "2026-09-15", updated_at: "2026-11-05T10:00:00Z" },
    { company: "Initech", role_title: "Product Manager", status: "rejected", work_mode: "hybrid", date_applied: "2026-10-20", updated_at: "2026-11-01T10:00:00Z" },
    { company: "Umbrella", role_title: "Backend Engineer", status: "saved", work_mode: "remote", archived_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-06T10:00:00Z" },
  ]);
  await page.goto("/applications?view=table");

  const table = page.getByRole("table", { name: "Applications" });
  const companies = table.locator("tbody tr td:first-child");
  const sortBy = (name: string) => table.getByRole("button", { name, exact: true }).click();

  // Last updated, newest first; archived hidden.
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
});

test("board shows active columns in automatic order and moves a card from its keyboard menu", async ({
  page,
  signInAs,
}) => {
  await signInAs(TEST_USERS.pipelineBoard);
  await seedApplications(TEST_USERS.pipelineBoard, [
    { company: "Plain Co", role_title: "Engineer", status: "applied", updated_at: "2026-11-10T10:00:00Z" },
    { company: "Later Co", role_title: "Engineer", status: "applied", next_follow_up_on: dayFromToday(3) },
    { company: "Overdue Co", role_title: "Engineer", status: "applied", next_follow_up_on: dayFromToday(-1) },
    { company: "Today Co", role_title: "Engineer", status: "saved", next_follow_up_on: dayFromToday(0) },
    { company: "Closed Co", role_title: "Engineer", status: "rejected" },
    { company: "Archived Co", role_title: "Engineer", status: "saved", archived_at: "2026-11-02T10:00:00Z" },
  ]);
  await page.goto("/applications");

  for (const status of ACTIVE_STATUSES) await expect(column(page, STATUS_META[status].label)).toBeVisible();
  for (const status of CLOSED_STATUSES) await expect(column(page, STATUS_META[status].label)).toHaveCount(0);
  await expect(page.getByText("Archived Co")).toHaveCount(0);
  await expect(page.getByText("Closed Co")).toHaveCount(0);

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
});

test("dragging a card to another column changes its status", async ({ page, signInAs }) => {
  await signInAs(TEST_USERS.pipelineDrag);
  await seedApplications(TEST_USERS.pipelineDrag, [{ company: "Drag Co", role_title: "Engineer", status: "saved" }]);
  await page.goto("/applications");

  const source = await card(page, "Saved", "Drag Co").boundingBox();
  const target = await column(page, "Screening").boundingBox();
  if (!source || !target) throw new Error("Board not rendered.");

  // Grab the card's padding (not the link or menu), then move in steps so the mouse sensor activates.
  await page.mouse.move(source.x + source.width - 8, source.y + 8);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 80, { steps: 15 });
  await page.mouse.up();

  await expect(card(page, "Screening", "Drag Co")).toBeVisible();
  await expect(card(page, "Saved", "Drag Co")).toHaveCount(0);
  await expect(page.getByText("Moved to Screening.")).toBeVisible();

  await page.reload();
  await expect(card(page, "Screening", "Drag Co")).toBeVisible();
  await card(page, "Screening", "Drag Co").getByRole("link").click();
  await expect(history(page).first()).toContainText("Saved → Screening");
});

test("a failed move rolls the card back", async ({ page, signInAs }) => {
  await signInAs(TEST_USERS.pipelineRollback);
  await seedApplications(TEST_USERS.pipelineRollback, [{ company: "Gone Co", role_title: "Engineer", status: "saved" }]);
  await page.goto("/applications");
  await expect(card(page, "Saved", "Gone Co")).toBeVisible();

  // Delete it behind the board's back, so changeStatus finds no row.
  const { error } = await adminClient().from("applications").delete().eq("company", "Gone Co");
  if (error) throw error;

  await page.getByRole("button", { name: "Move Gone Co, Engineer" }).click();
  await page.getByRole("menuitemradio", { name: "Offer" }).click();
  await expect(page.getByText(APPLICATION_NOT_FOUND)).toBeVisible();
  await expect(card(page, "Saved", "Gone Co")).toBeVisible();
  await expect(card(page, "Offer", "Gone Co")).toHaveCount(0);
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("board and table fit without horizontal page scroll", async ({ page, signInAs }) => {
    await signInAs(TEST_USERS.pipelinePhone);
    await seedApplications(TEST_USERS.pipelinePhone, [
      { company: "Acme Corp", role_title: "Senior Software Engineer, Platform Infrastructure", status: "interviewing", next_follow_up_on: dayFromToday(-2) },
      { company: "Globex", role_title: "Data Analyst", status: "saved", date_applied: "2026-10-01" },
    ]);
    await page.goto("/applications");

    await expect(card(page, "Interviewing", "Acme Corp")).toBeVisible();
    await expectNoHorizontalScroll(page);
    // The board scrolls inside its own container instead.
    const boardScrolls = await column(page, "Saved").evaluate((el) => {
      const scroller = el.parentElement!;
      return scroller.scrollWidth > scroller.clientWidth;
    });
    expect(boardScrolls).toBe(true);

    await page.getByRole("link", { name: "Table" }).click();
    await expect(page.getByRole("table", { name: "Applications" }).getByRole("link", { name: "Acme Corp" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
