import type { FullConfig } from "@playwright/test";

import { adminClient, noAccountEmail, testUsers } from "./support/local-env";

/**
 * Creates the confirmed e2e users on the local stack, one set per project (sign-ups are off, so the
 * admin API is the only way), and deletes any account a past run left on the no-account address.
 */
export default async function globalSetup(config: FullConfig) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = new Map(data.users.map((user) => [user.email, user.id]));

  for (const { name } of config.projects) {
    for (const email of Object.values(testUsers(name))) {
      if (existing.has(email)) continue;
      const { error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (createError) throw createError;
    }

    const strayId = existing.get(noAccountEmail(name));
    if (strayId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(strayId);
      if (deleteError) throw deleteError;
    }
  }
}
