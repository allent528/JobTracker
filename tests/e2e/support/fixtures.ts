import { test as base, expect, type Page } from "@playwright/test";

import { adminClient, findUserByEmail } from "./local-env";

type Fixtures = {
  /**
   * Signs `target` (default: the test's page) in as an existing test user through `/auth/confirm`
   * with an admin-generated token hash (no email involved). Deletes the user's applications first,
   * so each test starts empty.
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

      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error) throw error;
      const params = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "email" });
      await target.goto(`/auth/confirm?${params}`);
      await expect(target).toHaveURL("/applications");
    });
  },
});

export { expect };
