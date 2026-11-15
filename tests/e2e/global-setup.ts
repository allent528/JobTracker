import { adminClient, findUserByEmail, NO_ACCOUNT_EMAIL, TEST_USERS } from "./support/local-env";

/** Creates the confirmed e2e users on the local stack (sign-ups are off, so the admin API is the only way). */
export default async function globalSetup() {
  const admin = adminClient();

  for (const email of Object.values(TEST_USERS)) {
    if (await findUserByEmail(email)) continue;
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
  }

  const stray = await findUserByEmail(NO_ACCOUNT_EMAIL);
  if (stray) await admin.auth.admin.deleteUser(stray.id);
}
