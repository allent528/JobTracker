import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("JobTracker");
  await expect(page.getByRole("heading", { level: 1, name: "JobTracker" })).toBeVisible();
});
