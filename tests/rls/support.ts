import { execFileSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { adminClient, findUserByEmail, localSupabaseUrl } from "../e2e/support/local-env";

export type Client = SupabaseClient<Database>;

export function publishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set in .env.local.");
  return key;
}

export function newClient(): Client {
  return createClient<Database>(localSupabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recreateUser(email: string): Promise<string> {
  const admin = adminClient();
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) throw error;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

/** Signs in through a magic-link token hash, as the app's /auth/confirm route does. */
export async function signedInClient(email: string): Promise<Client> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = newClient();
  const { error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw verifyError;
  return client;
}

export function rowOrThrow<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("expected a row");
  return result.data;
}

/**
 * Runs one SQL statement as the local `postgres` superuser through the Supabase CLI, which targets
 * the local stack unless given `--remote` (and this repo is never linked). For test setup that no
 * client role may do, such as backdating `status_events`.
 */
export function localSuperuserQuery(sql: string): void {
  localSupabaseUrl();
  execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "db", "query", sql], {
    stdio: ["ignore", "ignore", "pipe"],
  });
}
