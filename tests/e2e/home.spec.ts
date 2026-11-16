import type { Page } from "@playwright/test";

import { addDays, dateInTimeZone } from "../../src/lib/dates";
import { expect, test } from "./support/fixtures";
import { adminClient, findUserByEmail, seedApplications, seedInterviews, TEST_USERS } from "./support/local-env";

// F8: the home page's Overdue / Today / Next 7 days lists, follow-up done, and the owner's time zone.

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

const bucket = (page: Page, name: "Overdue" | "Today" | "Next 7 days") =>
  page.getByRole("region", { name: new RegExp(`^${name} \\(`) });

function todayIn(timeZone: string) {
  return dateInTimeZone(new Date(), timeZone);
}

async function storedTimeZone(email: string) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`Test user ${email} doesn't exist; global setup creates it.`);
  const { data, error } = await adminClient().from("profiles").select("time_zone").eq("id", user.id).single();
  if (error) throw error;
  return data.time_zone;
}

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("follow-ups and pending interviews land in the right lists", async ({ page, signInAs }) => {
    const consoleErrors = collectConsoleErrors(page);
    const email = TEST_USERS.homeBuckets;
    await signInAs(email);
    const today = todayIn("UTC");
    const day = (offset: number) => addDays(today, offset);
    const at = (offset: number, time: string) => `${day(offset)}T${time}:00Z`;

    const apps = await seedApplications(email, [
      { company: "Overdue Co", role_title: "Engineer", status: "applied", next_follow_up_on: day(-3), follow_up_note: "Send a thank-you note" },
      { company: "Today Co", role_title: "Engineer", status: "screening", next_follow_up_on: day(0) },
      { company: "Week Co", role_title: "Engineer", status: "applied", next_follow_up_on: day(7) },
      { company: "Later Co", role_title: "Engineer", status: "applied", next_follow_up_on: day(8) },
      { company: "Archived Co", role_title: "Engineer", status: "applied", next_follow_up_on: day(0), archived_at: "2026-11-01T00:00:00Z" },
      { company: "Rejected Co", role_title: "Engineer", status: "rejected", next_follow_up_on: day(2) },
      { company: "Interview Co", role_title: "Engineer", status: "interviewing" },
    ]);
    const id = (company: string) => apps.find((app) => app.company === company)!.id;
    await seedInterviews(email, [
      { application_id: id("Interview Co"), kind: "technical", scheduled_at: at(-1, "10:00"), location: "Room overdue" },
      { application_id: id("Interview Co"), kind: "behavioral", scheduled_at: at(0, "12:00"), location: "https://meet.example.com/today" },
      { application_id: id("Interview Co"), kind: "final", scheduled_at: at(7, "12:00"), location: "Room week" },
      { application_id: id("Interview Co"), kind: "final", scheduled_at: at(8, "12:00"), location: "Room later" },
      { application_id: id("Interview Co"), kind: "onsite", scheduled_at: at(0, "13:00"), location: "Room passed", outcome: "passed" },
      { application_id: id("Archived Co"), kind: "onsite", scheduled_at: at(0, "14:00"), location: "Room archived" },
    ]);

    await page.reload();
    await expect(page.getByText("in UTC.")).toBeVisible();

    const overdue = bucket(page, "Overdue");
    await expect(overdue.getByRole("listitem")).toHaveCount(2);
    await expect(overdue.getByText("Overdue Co")).toBeVisible();
    await expect(overdue.getByText("3 days overdue")).toBeVisible();
    await expect(overdue.getByText("Send a thank-you note")).toBeVisible();
    await expect(overdue.getByText("Room overdue")).toBeVisible();
    await expect(overdue.getByText("Outcome not recorded yet.", { exact: false })).toBeVisible();

    const todayList = bucket(page, "Today");
    await expect(todayList.getByRole("listitem")).toHaveCount(2);
    await expect(todayList.getByText("Today Co")).toBeVisible();
    await expect(todayList.getByRole("link", { name: "https://meet.example.com/today" })).toBeVisible();

    const week = bucket(page, "Next 7 days");
    await expect(week.getByRole("listitem")).toHaveCount(3);
    // Closed applications keep their follow-ups (only archived ones are hidden).
    await expect(week.getByRole("listitem").nth(0)).toContainText("Rejected Co");
    await expect(week.getByRole("listitem").nth(1)).toContainText("Room week");
    await expect(week.getByRole("listitem").nth(2)).toContainText("Week Co");
    await expect(week.getByText("In 7 days")).toBeVisible();

    for (const hidden of ["Later Co", "Archived Co", "Room later", "Room passed", "Room archived"]) {
      await expect(page.getByText(hidden)).toHaveCount(0);
    }

    await overdue.getByRole("link", { name: /Overdue Co/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Overdue Co" })).toBeVisible();
    await page.getByRole("link", { name: "Reminders" }).click();
    await expect(bucket(page, "Overdue")).toBeVisible();

    await expectNoHorizontalScroll(page);
    expect(consoleErrors).toEqual([]);
  });

  test("marking a follow-up done clears it and offers the next one", async ({ page, signInAs }) => {
    const consoleErrors = collectConsoleErrors(page);
    const email = TEST_USERS.homeFollowUp;
    await signInAs(email);
    const today = todayIn("UTC");
    const [app] = await seedApplications(email, [
      { company: "Acme Corp", role_title: "Software Engineer", status: "applied", next_follow_up_on: addDays(today, -1), follow_up_note: "Ping the recruiter" },
    ]);
    await page.reload();

    const openDialog = async () => {
      await page.getByRole("button", { name: "Mark follow-up done for Acme Corp, Software Engineer" }).click();
      return page.getByRole("dialog", { name: "Follow-up done" });
    };

    let dialog = await openDialog();
    await expect(dialog.getByLabel("Next follow-up")).toHaveValue(addDays(today, 7));
    await expect(dialog.getByLabel("Follow-up note")).toHaveValue("Ping the recruiter");
    await expectNoHorizontalScroll(page);
    await dialog.getByLabel("Follow-up note").fill("Ask about the timeline");
    await dialog.getByRole("button", { name: "Mark done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Follow-up marked done.")).toBeVisible();

    await expect(bucket(page, "Overdue").getByText("Nothing overdue.")).toBeVisible();
    const week = bucket(page, "Next 7 days");
    await expect(week.getByText("Acme Corp")).toBeVisible();
    await expect(week.getByText("Ask about the timeline")).toBeVisible();
    await expect(week.getByText("In 7 days")).toBeVisible();

    dialog = await openDialog();
    await expect(dialog.getByLabel("Follow-up note")).toHaveValue("Ask about the timeline");
    await dialog.getByLabel("Next follow-up").fill("");
    await dialog.getByRole("button", { name: "Mark done", exact: true }).click();
    await expect(dialog.getByText("Pick a date for the next follow-up, or clear the note.")).toBeVisible();
    await dialog.getByLabel("Follow-up note").fill("");
    await dialog.getByRole("button", { name: "Mark done", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(week.getByText("Nothing in the next 7 days.")).toBeVisible();

    const { data, error } = await adminClient()
      .from("applications")
      .select("next_follow_up_on, follow_up_note")
      .eq("id", app.id)
      .single();
    if (error) throw error;
    expect(data).toEqual({ next_follow_up_on: null, follow_up_note: null });
    expect(consoleErrors).toEqual([]);
  });
});

test("the browser's time zone is saved on first sign-in and can be changed in settings", async ({
  browser,
  signInAs,
}) => {
  // Kiritimati (UTC+14) and Pago Pago (UTC-11) are 25 hours apart, so their dates always differ.
  const ahead = "Pacific/Kiritimati";
  const behind = "Pacific/Pago_Pago";
  const email = TEST_USERS.homeTimeZone;
  const context = await browser.newContext({ timezoneId: behind });
  const page = await context.newPage();
  const consoleErrors = collectConsoleErrors(page);
  try {
    await signInAs(email, page);
    await expect.poll(() => storedTimeZone(email)).toBe(behind);

    await seedApplications(email, [
      { company: "Ahead Co", role_title: "Engineer", status: "applied", next_follow_up_on: todayIn(ahead) },
      { company: "Behind Co", role_title: "Engineer", status: "applied", next_follow_up_on: todayIn(behind) },
    ]);
    await page.reload();
    await expect(page.getByText(`in ${behind}.`)).toBeVisible();
    await expect(bucket(page, "Today").getByText("Behind Co")).toBeVisible();
    await expect(bucket(page, "Next 7 days").getByText("Ahead Co")).toBeVisible();

    await page.getByRole("link", { name: "Change time zone" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    const select = page.getByRole("combobox", { name: "Time zone" });
    await expect(select).toHaveValue(behind);
    await select.selectOption(ahead);
    await page.getByRole("button", { name: "Save time zone" }).click();
    await expect(page.getByText("Time zone saved.")).toBeVisible();
    await expect(page.getByText(`use ${ahead}.`)).toBeVisible();
    expect(await storedTimeZone(email)).toBe(ahead);

    await page.getByRole("link", { name: "Reminders" }).click();
    await expect(page.getByText(`in ${ahead}.`)).toBeVisible();
    await expect(bucket(page, "Today").getByText("Ahead Co")).toBeVisible();
    await expect(bucket(page, "Overdue").getByText("Behind Co")).toBeVisible();

    // A saved zone is never replaced by detection, even though this browser is still in Pago Pago.
    await page.reload();
    await expect(page.getByText(`in ${ahead}.`)).toBeVisible();
    expect(await storedTimeZone(email)).toBe(ahead);
    expect(consoleErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("another user sees none of the owner's reminders", async ({ page, browser, signInAs }) => {
  const owner = TEST_USERS.homeIsolationOwner;
  await signInAs(owner);
  const today = todayIn("UTC");
  const [app] = await seedApplications(owner, [
    { company: "Secret Co", role_title: "Engineer", status: "applied", next_follow_up_on: today, follow_up_note: "Owner-only note" },
  ]);
  await seedInterviews(owner, [
    { application_id: app.id, kind: "technical", scheduled_at: `${addDays(today, 1)}T12:00:00Z`, location: "Owner-only room" },
  ]);
  await page.reload();
  await expect(bucket(page, "Today").getByText("Secret Co")).toBeVisible();

  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    await signInAs(TEST_USERS.homeIsolationOther, other);
    await expect(bucket(other, "Overdue").getByText("Nothing overdue.")).toBeVisible();
    await expect(bucket(other, "Today").getByText("Nothing due today.")).toBeVisible();
    await expect(bucket(other, "Next 7 days").getByText("Nothing in the next 7 days.")).toBeVisible();
    for (const text of ["Secret Co", "Owner-only note", "Owner-only room"]) {
      await expect(other.getByText(text)).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});
