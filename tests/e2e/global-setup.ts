import { adminClient, TEST_USERS, UNKNOWN_EMAIL } from "./support/local-env";

/** Creates the confirmed e2e users on the local stack (sign-ups are off, so the admin API is the only way). */
export default async function globalSetup() {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = new Set(data.users.map((user) => user.email));

  for (const email of Object.values(TEST_USERS)) {
    if (existing.has(email)) continue;
    const { error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (createError) throw createError;
  }

  // The "unknown email" test relies on this address having no account.
  const stray = data.users.find((user) => user.email === UNKNOWN_EMAIL);
  if (stray) await admin.auth.admin.deleteUser(stray.id);
}
