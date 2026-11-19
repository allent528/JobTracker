import type { FullConfig } from "@playwright/test";

import { adminClient, findUserByEmail, noAccountEmail, TEST_USER_KEYS, testUserEmail } from "./support/local-env";

/**
 * Creates the confirmed e2e users on the local stack, one set per project (sign-ups are off, so the
 * admin API is the only way).
 */
export default async function globalSetup(config: FullConfig) {
  const admin = adminClient();

  for (const { name } of config.projects) {
    for (const key of TEST_USER_KEYS) {
      const email = testUserEmail(key, name);
      if (await findUserByEmail(email)) continue;
      const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error) throw error;
    }

    const stray = await findUserByEmail(noAccountEmail(name));
    if (stray) await admin.auth.admin.deleteUser(stray.id);
  }
}
