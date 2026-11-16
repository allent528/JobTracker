import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";
import { adminClient, findUserByEmail, TEST_USERS } from "./support/local-env";

// The e2e users have no profiles.time_zone, so interview times are read and shown in UTC.

function field(page: Page, label: string) {
  return page.getByLabel(label).filter({ visible: true });
}

function items(page: Page, list: string) {
  return page.getByRole("list", { name: list }).getByRole("listitem");
}

function detailValue(scope: ReturnType<Page["locator"]>, label: string) {
  return scope.locator(`dt:text-is("${label}") + dd`);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Console errors and uncaught page errors, for a "console is clean" check at the end. */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function createApplication(email: string, status = "applied") {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`Test user ${email} doesn't exist; global setup creates it.`);
  const { data, error } = await adminClient()
    .from("applications")
    .insert({ user_id: user.id, company: "Acme Corp", role_title: "Software Engineer", status })
    .select("id")
    .single();
  if (error) throw error;
  return { userId: user.id, applicationId: data.id };
}

async function confirmDelete(page: Page, button: string | RegExp, dialogName: string, confirm: string) {
  await page.getByRole("button", { name: button, exact: typeof button === "string" }).click();
  const dialog = page.getByRole("alertdialog", { name: dialogName });
  await dialog.getByRole("button", { name: confirm }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("notes, contacts and interviews on an application", async ({ page, signInAs }) => {
    const consoleErrors = collectConsoleErrors(page);
    await signInAs(TEST_USERS.detailSections);
    const { applicationId } = await createApplication(TEST_USERS.detailSections);
    await page.goto(`/applications/${applicationId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Acme Corp" })).toBeVisible();
    await expect(page.getByText("No notes yet.")).toBeVisible();
    await expect(page.getByText("No contacts yet.")).toBeVisible();
    await expect(page.getByText("No interviews yet.")).toBeVisible();

    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Enter the note.")).toBeVisible();
    await field(page, "New note").fill("Phone screen went well.\n\n- ask about **on-call**");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(items(page, "Notes, newest first")).toHaveCount(1);
    await expect(field(page, "New note")).toHaveValue("");
    await field(page, "New note").fill("Sent a thank-you email.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(items(page, "Notes, newest first")).toHaveCount(2);
    await expect(items(page, "Notes, newest first").first()).toContainText("Sent a thank-you email.");
    await expect(items(page, "Notes, newest first").nth(1)).toContainText("- ask about **on-call**");
    await expect(items(page, "Notes, newest first").first()).toContainText("Added ");

    await items(page, "Notes, newest first").nth(1).getByRole("button", { name: /^Edit note added / }).click();
    await page.getByRole("textbox", { name: "Edit note" }).fill("Phone screen went very well.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(items(page, "Notes, newest first").nth(1)).toContainText("Phone screen went very well.");
    await expect(items(page, "Notes, newest first").nth(1)).toContainText("Edited");
    await expectNoHorizontalScroll(page);

    await items(page, "Notes, newest first").first().getByRole("button", { name: /^Delete note added / }).click();
    const noteDialog = page.getByRole("alertdialog", { name: "Delete this note?" });
    await noteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(items(page, "Notes, newest first")).toHaveCount(2);
    await items(page, "Notes, newest first").first().getByRole("button", { name: /^Delete note added / }).click();
    await noteDialog.getByRole("button", { name: "Delete note" }).click();
    await expect(items(page, "Notes, newest first")).toHaveCount(1);
    await expect(page.getByText("Sent a thank-you email.")).toHaveCount(0);

    await page.getByRole("button", { name: "Add contact" }).click();
    await field(page, "Email").fill("not-an-email");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Enter the name.")).toBeVisible();
    await expect(page.getByText("Enter an email address, like jane@example.com.")).toBeVisible();
    await field(page, "Name").fill("Jane Doe");
    await field(page, "Role or title").fill("Recruiter");
    await field(page, "Email").fill("jane@example.com");
    await field(page, "Phone").fill("555-0100");
    await field(page, "LinkedIn URL").fill("https://www.linkedin.com/in/jane-doe-example");
    await field(page, "Notes about this contact").fill("Prefers email.");
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Add contact" }).click();
    const jane = items(page, "Contacts").filter({ hasText: "Jane Doe" });
    await expect(jane).toContainText("Recruiter");
    await expect(jane.getByRole("link", { name: "jane@example.com" })).toHaveAttribute("href", "mailto:jane@example.com");
    await expect(jane.getByRole("link", { name: "555-0100" })).toHaveAttribute("href", "tel:555-0100");
    await expect(jane.getByRole("link", { name: "https://www.linkedin.com/in/jane-doe-example" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await expect(detailValue(jane, "Notes")).toHaveText("Prefers email.");

    await page.getByRole("button", { name: "Edit contact Jane Doe" }).click();
    await expect(field(page, "Phone")).toHaveValue("555-0100");
    await field(page, "Role or title").fill("Senior Recruiter");
    await page.getByRole("button", { name: "Save contact" }).click();
    await expect(jane).toContainText("Senior Recruiter");

    await page.getByRole("button", { name: "Add contact" }).click();
    await field(page, "Name").fill("John Roe");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(items(page, "Contacts")).toHaveCount(2);

    await page.getByRole("button", { name: "Add interview" }).click();
    await page.getByRole("button", { name: "Add interview" }).click();
    await expect(page.getByText("Enter the date and time.")).toBeVisible();
    await field(page, "Type").selectOption("technical");
    await field(page, "Date and time").fill("2026-12-01T10:00");
    await field(page, "Duration (minutes)").fill("90");
    await field(page, "Location or video link").fill("https://meet.example.com/abc-defg");
    await page.getByRole("checkbox", { name: /Jane Doe/ }).check();
    await field(page, "Other interviewers").fill("Pat Example");
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Add interview" }).click();

    const round = items(page, "Interviews, in schedule order").first();
    await expect(round).toContainText("Technical");
    await expect(round).toContainText("Pending");
    await expect(detailValue(round, "When")).toHaveText(/^Dec 1, 2026, 10:00\sAM UTC$/);
    await expect(detailValue(round, "Duration")).toHaveText("1 hr 30 min");
    await expect(detailValue(round, "Interviewers")).toHaveText("Jane Doe, Pat Example");
    await expect(round.getByRole("link", { name: "https://meet.example.com/abc-defg" })).toBeVisible();

    const suggestion = page.getByRole("status").filter({ hasText: "This is the first interview." });
    await expect(suggestion).toBeVisible();
    await suggestion.getByRole("button", { name: "Move to Interviewing" }).click();
    await expect(suggestion).toHaveCount(0);
    await expect(items(page, "Status changes, newest first").first()).toContainText("Applied → Interviewing");

    await round.getByRole("button", { name: /^Edit Technical interview/ }).click();
    await expect(field(page, "Date and time")).toHaveValue("2026-12-01T10:00");
    await expect(page.getByRole("checkbox", { name: /Jane Doe/ })).toBeChecked();
    await page.getByRole("checkbox", { name: /Jane Doe/ }).uncheck();
    await page.getByRole("checkbox", { name: /John Roe/ }).check();
    await field(page, "Outcome").selectOption("passed");
    await field(page, "Location or video link").fill("Room 4B");
    await page.getByRole("button", { name: "Save interview" }).click();
    await expect(round).toContainText("Passed");
    await expect(detailValue(round, "Interviewers")).toHaveText("John Roe, Pat Example");
    await expect(detailValue(round, "Location")).toHaveText("Room 4B");
    await expect(round.getByRole("link")).toHaveCount(0);

    await confirmDelete(page, "Delete contact John Roe", "Delete this contact?", "Delete contact");
    await expect(items(page, "Contacts")).toHaveCount(1);
    await expect(detailValue(round, "Interviewers")).toHaveText("Pat Example");

    await round.getByRole("button", { name: /^Edit Technical interview/ }).click();
    await page.getByRole("checkbox", { name: /Jane Doe/ }).check();
    await confirmDelete(page, "Delete contact Jane Doe", "Delete this contact?", "Delete contact");
    await expect(page.getByText("No contacts yet.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Jane Doe/ })).toHaveCount(0);
    await field(page, "Duration (minutes)").fill("60");
    await page.getByRole("button", { name: "Save interview" }).click();
    await expect(page.getByRole("button", { name: "Save interview" })).toHaveCount(0);
    await expect(detailValue(round, "Duration")).toHaveText("1 hr");
    await expect(detailValue(round, "Interviewers")).toHaveText("Pat Example");

    await page.getByRole("button", { name: "Add contact" }).click();
    await field(page, "Name").fill("Sam Poe");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(items(page, "Contacts")).toHaveCount(1);
    await page.getByRole("button", { name: "Add interview" }).click();
    await field(page, "Type").selectOption("final");
    await field(page, "Date and time").fill("2026-12-08T14:30");
    await page.getByRole("checkbox", { name: /Sam Poe/ }).check();
    await confirmDelete(page, "Delete contact Sam Poe", "Delete this contact?", "Delete contact");
    await expect(page.getByRole("checkbox", { name: /Sam Poe/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Add interview" }).click();
    await expect(items(page, "Interviews, in schedule order")).toHaveCount(2);
    const final = items(page, "Interviews, in schedule order").nth(1);
    await expect(final).toContainText("Final");
    await expect(detailValue(final, "Interviewers")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "This is the first interview." })).toHaveCount(0);

    await confirmDelete(page, /^Delete Final interview on Dec 8, 2026/, "Delete this interview?", "Delete interview");
    await expect(items(page, "Interviews, in schedule order")).toHaveCount(1);
    await expectNoHorizontalScroll(page);

    await page.reload();
    await expect(items(page, "Notes, newest first")).toHaveCount(1);
    await expect(page.getByText("No contacts yet.")).toBeVisible();
    await expect(items(page, "Interviews, in schedule order")).toHaveCount(1);
    await expect(detailValue(round, "Interviewers")).toHaveText("Pat Example");
    await expectNoHorizontalScroll(page);
    expect(consoleErrors).toEqual([]);
  });
});

test("another user can't see an application's notes, contacts or interviews", async ({ browser, signInAs, page }) => {
  await signInAs(TEST_USERS.detailIsolationOwner);
  const { userId, applicationId } = await createApplication(TEST_USERS.detailIsolationOwner);
  const admin = adminClient();
  const owned = { user_id: userId, application_id: applicationId };
  const { error: noteError } = await admin.from("notes").insert({ ...owned, body: "Owner-only note" });
  if (noteError) throw noteError;
  const { data: contact, error: contactError } = await admin
    .from("contacts")
    .insert({ ...owned, name: "Jane Doe", email: "jane@example.com" })
    .select("id")
    .single();
  if (contactError) throw contactError;
  const { data: interview, error: interviewError } = await admin
    .from("interviews")
    .insert({ ...owned, kind: "onsite", scheduled_at: "2026-12-01T15:00:00Z", interviewers: "Pat Example" })
    .select("id")
    .single();
  if (interviewError) throw interviewError;
  const { error: linkError } = await admin
    .from("interview_contacts")
    .insert({ ...owned, interview_id: interview.id, contact_id: contact.id });
  if (linkError) throw linkError;

  const path = `/applications/${applicationId}`;
  await page.goto(path);
  await expect(page.getByText("Owner-only note")).toBeVisible();
  await expect(detailValue(page.locator("body"), "Interviewers")).toHaveText("Jane Doe, Pat Example");

  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await signInAs(TEST_USERS.detailIsolationOther, other);
    await other.goto(path);
    await expect(other.getByText("This page could not be found.")).toBeVisible();
    for (const text of ["Owner-only note", "Jane Doe", "jane@example.com", "Pat Example", "Onsite"]) {
      await expect(other.getByText(text)).toHaveCount(0);
    }
  } finally {
    await otherContext.close();
  }
});
