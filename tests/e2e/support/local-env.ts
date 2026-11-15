import { createClient } from "@supabase/supabase-js";

/** Fake test users (D4). Each spec uses its own address so parallel tests don't share an inbox. */
export const TEST_USERS = {
  code: "e2e-code@example.com",
  link: "e2e-link@example.com",
} as const;

export const UNKNOWN_EMAIL = "e2e-nobody@example.com";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Throws unless the tests point at the local Docker stack. E2E must never touch prod. */
export function localSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (copy .env.example to .env.local).");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E tests only run against the local Supabase stack, not ${hostname}.`);
  }
  return url;
}

/** Admin client for test setup only. Uses the LOCAL secret key from .env.local; never imported by src/. */
export function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set in .env.local (local stack key, tests only).");
  return createClient(localSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type MailpitMessage = { ID: string; Text: string; HTML: string };

function toQuery(email: string) {
  return new URLSearchParams({ query: `to:"${email}"` }).toString();
}

export async function clearInbox(email: string) {
  await fetch(`${MAILPIT_URL}/api/v1/search?${toQuery(email)}`, { method: "DELETE" });
}

export async function countMessages(email: string): Promise<number> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?${toQuery(email)}`);
  const body = (await res.json()) as { messages_count: number };
  return body.messages_count;
}

/** Waits for the newest sign-in email to `email` and returns it. */
export async function latestMessage(email: string, timeoutMs = 15_000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?${toQuery(email)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const msg = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
      return (await msg.json()) as MailpitMessage;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email arrived for ${email} within ${timeoutMs}ms.`);
}

export function extractCode(message: MailpitMessage): string {
  const match = message.Text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("No 6-digit code in the sign-in email.");
  return match[1];
}

export function extractConfirmLink(message: MailpitMessage): string {
  const match = message.HTML.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/);
  if (!match) throw new Error("No /auth/confirm link in the sign-in email.");
  return match[1].replaceAll("&amp;", "&");
}
