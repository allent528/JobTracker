import type { Page } from "@playwright/test";

import { formatDate } from "../../src/lib/dates";
import { expect, test } from "./support/fixtures";
import { TEST_USERS } from "./support/local-env";

// The e2e users have no profiles.time_zone, so "today" is today in UTC (FALLBACK_TIME_ZONE).
const todayIsoUtc = () => new Date().toISOString().slice(0, 10);

// Hidden, still-mounted routes can repeat a field (docs/learnings.md); use the visible one.
function field(page: Page, label: string) {
  return page.getByLabel(label).filter({ visible: true });
}

function statusSelect(page: Page) {
  return page.getByRole("combobox", { name: "Status", exact: true });
}

function detail(page: Page, label: string) {
  return page.locator(`dt:text-is("${label}") + dd`);
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

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("create, edit, change status, archive and delete an application", async ({ page, signInAs }) => {
    await signInAs(TEST_USERS.applications);
    await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
    await expect(page.getByText("No active applications.")).toBeVisible();

    await page.getByRole("link", { name: "New application" }).click();
    await expect(page).toHaveURL("/applications/new");
    await page.getByRole("button", { name: "Create application" }).click();
    await expect(page.getByText("Enter the company.")).toBeVisible();
    await expect(page.getByText("Enter the role title.")).toBeVisible();

    await field(page, "Company").fill("Acme Corp");
    await field(page, "Role title").fill("Software Engineer");
    await field(page, "Job posting URL").fill("https://jobs.example.com/acme/123");
    await field(page, "Work mode").selectOption("remote");
    await field(page, "Minimum").fill("150000");
    await field(page, "Maximum").fill("120000");
    await page.getByRole("button", { name: "Create application" }).click();
    await expect(page.getByText("The maximum can't be less than the minimum.")).toBeVisible();
    await field(page, "Maximum").fill("180,000");
    await field(page, "Next follow-up").fill("2026-12-01");
    await field(page, "Follow-up note").fill("Ask about the timeline");
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Create application" }).click();

    await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);
    const detailUrl = page.url();
    await expect(page.getByRole("heading", { level: 1, name: "Acme Corp" })).toBeVisible();
    await expect(detail(page, "Work mode")).toHaveText("Remote");
    await expect(detail(page, "Salary")).toHaveText("$150,000 – $180,000");
    await expect(detail(page, "Next follow-up")).toHaveText("Dec 1, 2026");
    await expect(detail(page, "Date applied")).toHaveText("Not set");
    await expect(page.getByRole("link", { name: "https://jobs.example.com/acme/123" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await expect(history(page)).toHaveCount(1);
    await expect(history(page).first()).toContainText("Created as Saved");
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(field(page, "Company")).toHaveValue("Acme Corp");
    await expect(field(page, "Maximum")).toHaveValue("180000");
    await field(page, "Role title").fill("Senior Software Engineer");
    await field(page, "Location").fill("Springfield");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(detailUrl);
    await expect(page.getByText("Senior Software Engineer")).toBeVisible();
    await expect(detail(page, "Location")).toHaveText("Springfield");

    await page.getByRole("link", { name: "Edit" }).click();
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(detailUrl);
    await page.getByRole("button", { name: "Move to Applied" }).click();
    await expect(history(page)).toHaveCount(2);
    await expect(history(page).first()).toContainText("Saved → Applied");
    await expect(detail(page, "Date applied")).toHaveText(formatDate(todayIsoUtc()));
    await expect(statusSelect(page)).toHaveValue("applied");

    // The edit form opened before the status change must show the date the trigger set.
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(field(page, "Date applied")).toHaveValue(todayIsoUtc());
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(detailUrl);
    await expect(detail(page, "Date applied")).toHaveText(formatDate(todayIsoUtc()));

    await statusSelect(page).selectOption("interviewing");
    await page.getByRole("button", { name: "Change status" }).click();
    await expect(history(page)).toHaveCount(3);
    await expect(history(page).first()).toContainText("Applied → Interviewing");
    await expect(page.getByRole("button", { name: "Move to Offer" })).toBeVisible();

    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unarchive" })).toBeVisible();
    await page.getByRole("link", { name: "All applications" }).click();
    await expect(page.getByRole("link", { name: /Acme Corp/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Show archived" }).click();
    await page.getByRole("link", { name: /Acme Corp/ }).click();
    await expect(page).toHaveURL(detailUrl);
    await page.getByRole("button", { name: "Unarchive" }).click();
    await expect(page.getByRole("button", { name: "Archive", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete this application?" });
    await expect(dialog).toContainText("Senior Software Engineer at Acme Corp");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Acme Corp" })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await dialog.getByRole("button", { name: "Delete application" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/?archived=1");
    await expect(page.getByText("No applications yet.")).toBeVisible();
    await page.goto(detailUrl);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});

test("a new application with a date applied starts in Applied", async ({ page, signInAs }) => {
  await signInAs(TEST_USERS.appliedOnCreate);
  await page.goto("/applications/new");
  await field(page, "Company").fill("Globex Inc");
  await field(page, "Role title").fill("Data Analyst");
  await field(page, "Date applied").fill("2026-11-02");
  await page.getByRole("button", { name: "Create application" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Globex Inc" })).toBeVisible();
  await expect(detail(page, "Date applied")).toHaveText("Nov 2, 2026");
  await expect(history(page)).toHaveCount(1);
  await expect(history(page).first()).toContainText("Created as Applied");
  await expect(statusSelect(page)).toHaveValue("applied");

  await page.getByRole("link", { name: "All applications" }).click();
  await page.getByRole("link", { name: "New application" }).click();
  await expect(field(page, "Company")).toHaveValue("");
  await expect(field(page, "Date applied")).toHaveValue("");
});

test("another user can't open someone else's application", async ({ browser, page, signInAs }) => {
  await signInAs(TEST_USERS.isolationOwner);
  await page.goto("/applications/new");
  await field(page, "Company").fill("Initech");
  await field(page, "Role title").fill("Platform Engineer");
  await field(page, "Follow-up note").fill("Owner-only note");
  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Initech" })).toBeVisible();
  const detailPath = new URL(page.url()).pathname;

  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await signInAs(TEST_USERS.isolationOther, other);
    for (const path of [detailPath, `${detailPath}/edit`]) {
      await other.goto(path);
      await expect(other.getByText("This page could not be found.")).toBeVisible();
      for (const text of ["Initech", "Platform Engineer", "Owner-only note"]) {
        await expect(other.getByText(text)).toHaveCount(0);
      }
    }
  } finally {
    await otherContext.close();
  }
});
