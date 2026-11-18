import { createClient } from "@supabase/supabase-js";

import { OTP_LENGTH } from "../../../src/lib/schemas/auth";
import type { Database, TablesInsert } from "../../../src/types/database.types";

/** Fake test users (D4). Each spec uses its own address so parallel tests don't share an inbox. */
export const TEST_USERS = {
  code: "e2e-code@example.com",
  link: "e2e-link@example.com",
  applications: "e2e-applications@example.com",
  appliedOnCreate: "e2e-applied-on-create@example.com",
  isolationOwner: "e2e-isolation-owner@example.com",
  isolationOther: "e2e-isolation-other@example.com",
  pipelineTable: "e2e-pipeline-table@example.com",
  pipelineBoard: "e2e-pipeline-board@example.com",
  pipelineDrag: "e2e-pipeline-drag@example.com",
  pipelinePhone: "e2e-pipeline-phone@example.com",
  pipelineRollback: "e2e-pipeline-rollback@example.com",
  detailSections: "e2e-detail-sections@example.com",
  detailIsolationOwner: "e2e-detail-isolation-owner@example.com",
  detailIsolationOther: "e2e-detail-isolation-other@example.com",
  homeBuckets: "e2e-home-buckets@example.com",
  homeFollowUp: "e2e-home-follow-up@example.com",
  homeTimeZone: "e2e-home-time-zone@example.com",
  homeIsolationOwner: "e2e-home-isolation-owner@example.com",
  homeIsolationOther: "e2e-home-isolation-other@example.com",
} as const;

/** Must never have an account; global setup deletes it if a past run left one. */
export const NO_ACCOUNT_EMAIL = "e2e-nobody@example.com";

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
  return createClient<Database>(localSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function findUserByEmail(email: string) {
  const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email) ?? null;
}

export async function seedApplications(
  email: string,
  rows: Omit<TablesInsert<"applications">, "user_id">[],
): Promise<{ id: string; company: string }[]> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`Test user ${email} doesn't exist; global setup creates it.`);
  const { data, error } = await adminClient()
    .from("applications")
    // defaultToNull: false lets rows leave out columns (PostgREST otherwise nulls them in a bulk insert).
    .insert(rows.map((row) => ({ ...row, user_id: user.id })), { defaultToNull: false })
    .select("id, company");
  if (error) throw error;
  return data;
}

export async function seedInterviews(
  email: string,
  rows: Omit<TablesInsert<"interviews">, "user_id">[],
): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`Test user ${email} doesn't exist; global setup creates it.`);
  const { error } = await adminClient()
    .from("interviews")
    .insert(rows.map((row) => ({ ...row, user_id: user.id })), { defaultToNull: false });
  if (error) throw error;
}

type MailpitMessage = { ID: string; Text: string; HTML: string };

async function mailpit<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  if (!res.ok) throw new Error(`Mailpit ${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  return (res.headers.get("content-type")?.includes("json") ? res.json() : res.text()) as Promise<T>;
}

function searchPath(email: string, extra = "") {
  return `/search?${new URLSearchParams({ query: `to:"${email}"` })}${extra}`;
}

export async function clearInbox(email: string) {
  await mailpit(searchPath(email), { method: "DELETE" });
}

export async function countMessages(email: string): Promise<number> {
  const body = await mailpit<{ messages_count: number }>(searchPath(email));
  return body.messages_count;
}

/** Waits for the newest email to `email` and returns it. */
export async function latestMessage(email: string, timeoutMs = 15_000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { messages } = await mailpit<{ messages: { ID: string }[] }>(searchPath(email, "&limit=1"));
    if (messages.length > 0) return mailpit<MailpitMessage>(`/message/${messages[0].ID}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email arrived for ${email} within ${timeoutMs}ms.`);
}

export function extractCode(message: MailpitMessage): string {
  const match = message.Text.match(new RegExp(`\\b(\\d{${OTP_LENGTH}})\\b`));
  if (!match) throw new Error(`No ${OTP_LENGTH}-digit code in the sign-in email.`);
  return match[1];
}

export function extractConfirmLink(message: MailpitMessage): string {
  const match = message.HTML.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/);
  if (!match) throw new Error("No /auth/confirm link in the sign-in email.");
  return match[1].replaceAll("&amp;", "&");
}
