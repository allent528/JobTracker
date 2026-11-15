import { test as base, expect } from "@playwright/test";

import { adminClient, findUserByEmail } from "./local-env";

type Fixtures = {
  /**
   * Signs `page` in as an existing test user without email: the local admin API makes a magic-link
   * token hash and the page opens `/auth/confirm` with it, exactly as the emailed link would.
   * Deletes the user's applications first (children and history cascade), so each test starts empty.
   */
  signInAs: (email: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  signInAs: async ({ page }, provide) => {
    await provide(async (email) => {
      const admin = adminClient();
      const user = await findUserByEmail(email);
      if (!user) throw new Error(`Test user ${email} doesn't exist; global setup creates it.`);

      const { error: cleanupError } = await admin.from("applications").delete().eq("user_id", user.id);
      if (cleanupError) throw cleanupError;

      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error) throw error;
      const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "email" });
      await page.goto(`/auth/confirm?${params}`);
      await expect(page).toHaveURL("/");
    });
  },
});

export { expect };
