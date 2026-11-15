import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { INTERVIEW_KINDS, INTERVIEW_OUTCOMES, WORK_MODES } from "@/lib/closed-sets";
import { STATUSES } from "@/lib/status";
import type { Database } from "@/types/database.types";

import { adminClient, findUserByEmail, localSupabaseUrl } from "../e2e/support/local-env";

type Client = SupabaseClient<Database>;
type ChildTable = "notes" | "contacts" | "interviews" | "interview_contacts" | "status_events";

// Fake users for these checks only; recreated each run so every row below is fresh.
const USER_A = "rls-a@example.com";
const USER_B = "rls-b@example.com";

const RLS_VIOLATION = "42501";
const CHECK_VIOLATION = "23514";

function publishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set in .env.local.");
  return key;
}

function newClient(): Client {
  return createClient<Database>(localSupabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function recreateUser(email: string): Promise<string> {
  const admin = adminClient();
  const existing = await findUserByEmail(email);
  if (existing) await admin.auth.admin.deleteUser(existing.id);
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

/** Signs in through a magic-link token hash, as the app's /auth/confirm route does. */
async function signedInClient(email: string): Promise<Client> {
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

/** Throws on error; returns the single row. */
function one<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("expected a row");
  return result.data;
}

type Fixture = { applicationId: string; noteId: string; contactId: string; interviewId: string; linkId: string };

async function createFixture(client: Client, company: string): Promise<Fixture> {
  const app = one(
    await client.from("applications").insert({ company, role_title: "Software Engineer" }).select("id").single(),
  );
  const note = one(
    await client.from("notes").insert({ application_id: app.id, body: "Fake note" }).select("id").single(),
  );
  const contact = one(
    await client
      .from("contacts")
      .insert({ application_id: app.id, name: "Jane Doe", email: "jane@example.com", phone: "555-0100" })
      .select("id")
      .single(),
  );
  const interview = one(
    await client
      .from("interviews")
      .insert({ application_id: app.id, kind: "phone_screen", scheduled_at: "2026-12-01T15:00:00Z" })
      .select("id")
      .single(),
  );
  const link = one(
    await client
      .from("interview_contacts")
      .insert({ interview_id: interview.id, contact_id: contact.id })
      .select("id")
      .single(),
  );
  return { applicationId: app.id, noteId: note.id, contactId: contact.id, interviewId: interview.id, linkId: link.id };
}

async function eventsFor(client: Client, applicationId: string) {
  const { data, error } = await client
    .from("status_events")
    .select("from_status, to_status")
    .eq("application_id", applicationId)
    .order("changed_at")
    .order("created_at");
  if (error) throw error;
  return data;
}

let a: Client;
let b: Client;
let anon: Client;
let userA: string;
let userB: string;
let fa: Fixture;
let fb: Fixture;

beforeAll(async () => {
  userA = await recreateUser(USER_A);
  userB = await recreateUser(USER_B);
  a = await signedInClient(USER_A);
  b = await signedInClient(USER_B);
  anon = newClient();
  fa = await createFixture(a, "Acme Corp");
  fb = await createFixture(b, "Globex Inc");
});

describe("profiles", () => {
  it("are created on sign-up with UTC and visible only to their owner", async () => {
    const { data, error } = await a.from("profiles").select("id, time_zone");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: userA, time_zone: "UTC" }]);
  });

  it("accept a valid IANA time zone and reject an unknown one", async () => {
    const ok = await a.from("profiles").update({ time_zone: "America/New_York" }).eq("id", userA).select("time_zone");
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual([{ time_zone: "America/New_York" }]);

    const bad = await a.from("profiles").update({ time_zone: "Mars/Olympus_Mons" }).eq("id", userA);
    expect(bad.error?.message).toBe("invalid_time_zone");
  });

  it("can't be changed, created or deleted by another user", async () => {
    const update = await b.from("profiles").update({ time_zone: "Europe/Paris" }).eq("id", userA).select();
    expect(update.data).toEqual([]);

    const insert = await b.from("profiles").insert({ id: userB });
    expect(insert.error?.code).toBe(RLS_VIOLATION);

    const del = await b.from("profiles").delete().eq("id", userA);
    expect(del.error?.code).toBe(RLS_VIOLATION);

    const own = one(await a.from("profiles").select("time_zone").eq("id", userA).single());
    expect(own.time_zone).toBe("America/New_York");
  });
});

describe("user B can't touch user A's rows", () => {
  const ids = (f: Fixture): Record<"applications" | Exclude<ChildTable, "status_events">, string> => ({
    applications: f.applicationId,
    notes: f.noteId,
    contacts: f.contactId,
    interviews: f.interviewId,
    interview_contacts: f.linkId,
  });

  it.each(["applications", "notes", "contacts", "interviews", "interview_contacts"] as const)(
    "%s: no read, update or delete",
    async (table) => {
      const id = ids(fa)[table];

      const read = await b.from(table).select("id").eq("id", id);
      expect(read.data).toEqual([]);

      if (table !== "interview_contacts") {
        const update = await b.from(table).update({ created_at: "2000-01-01T00:00:00Z" }).eq("id", id).select("id");
        expect(update.data).toEqual([]);
      }

      const del = await b.from(table).delete().eq("id", id).select("id");
      expect(del.data).toEqual([]);

      const stillThere = await a.from(table).select("id").eq("id", id);
      expect(stillThere.data).toEqual([{ id }]);
    },
  );

  it("status_events: no read", async () => {
    expect(await eventsFor(b, fa.applicationId)).toEqual([]);
    expect((await eventsFor(a, fa.applicationId)).length).toBeGreaterThan(0);
  });

  it("can't insert rows owned by A, or children under A's application", async () => {
    const asA = await b.from("applications").insert({ company: "Acme Corp", role_title: "Spy", user_id: userA });
    expect(asA.error?.code).toBe(RLS_VIOLATION);

    const note = await b.from("notes").insert({ application_id: fa.applicationId, body: "Sneaky" });
    expect(note.error?.code).toBe(RLS_VIOLATION);

    const contact = await b.from("contacts").insert({ application_id: fa.applicationId, name: "John Doe" });
    expect(contact.error?.code).toBe(RLS_VIOLATION);

    const interview = await b
      .from("interviews")
      .insert({ application_id: fa.applicationId, kind: "other", scheduled_at: "2026-12-01T15:00:00Z" });
    expect(interview.error?.code).toBe(RLS_VIOLATION);

    const link = await b.from("interview_contacts").insert({ interview_id: fa.interviewId, contact_id: fb.contactId });
    expect(link.error?.code).toBe(RLS_VIOLATION);
  });

  it("can't move its own rows to A or under A's application", async () => {
    const reassign = await b.from("applications").update({ user_id: userA }).eq("id", fb.applicationId);
    expect(reassign.error?.code).toBe(RLS_VIOLATION);

    for (const [table, id] of [
      ["notes", fb.noteId],
      ["contacts", fb.contactId],
      ["interviews", fb.interviewId],
    ] as const) {
      const move = await b.from(table).update({ application_id: fa.applicationId }).eq("id", id);
      expect(move.error?.code, table).toBe(RLS_VIOLATION);
    }
  });

  it("anon sees and writes nothing", async () => {
    for (const table of ["profiles", "applications", "notes", "contacts", "interviews", "interview_contacts", "status_events"] as const) {
      const read = await anon.from(table).select("id");
      expect(read.error?.code, table).toBe(RLS_VIOLATION);
    }
    const insert = await anon.from("applications").insert({ company: "Acme Corp", role_title: "Anon" });
    expect(insert.error?.code).toBe(RLS_VIOLATION);
  });
});

describe("interview_contacts", () => {
  it("rejects a contact from a different application of the same user", async () => {
    const other = await createFixture(a, "Initech");
    const link = await a.from("interview_contacts").insert({ interview_id: fa.interviewId, contact_id: other.contactId });
    expect(link.error?.code).toBe(RLS_VIOLATION);
  });

  it("can't be updated", async () => {
    const update = await a.from("interview_contacts").update({ contact_id: fa.contactId }).eq("id", fa.linkId);
    expect(update.error?.code).toBe(RLS_VIOLATION);
  });
});

describe("status_events", () => {
  it("logs the initial status, each change, and not no-op updates", async () => {
    const app = one(
      await a
        .from("applications")
        .insert({ company: "Umbrella Co", role_title: "Engineer", status: "applied", date_applied: "2026-11-01" })
        .select("id")
        .single(),
    );
    expect(await eventsFor(a, app.id)).toEqual([{ from_status: null, to_status: "applied" }]);

    expect((await a.from("applications").update({ status: "screening" }).eq("id", app.id)).error).toBeNull();
    expect((await a.from("applications").update({ status: "screening" }).eq("id", app.id)).error).toBeNull();
    expect((await a.from("applications").update({ company: "Umbrella Corp" }).eq("id", app.id)).error).toBeNull();
    expect((await a.from("applications").update({ status: "saved" }).eq("id", app.id)).error).toBeNull();

    expect(await eventsFor(a, app.id)).toEqual([
      { from_status: null, to_status: "applied" },
      { from_status: "applied", to_status: "screening" },
      { from_status: "screening", to_status: "saved" },
    ]);
  });

  it("can't be inserted, updated or deleted by a client, even for its own rows", async () => {
    const insert = await a
      .from("status_events")
      .insert({ user_id: userA, application_id: fa.applicationId, from_status: "saved", to_status: "offer" });
    expect(insert.error?.code).toBe(RLS_VIOLATION);

    const update = await a.from("status_events").update({ to_status: "offer" }).eq("application_id", fa.applicationId);
    expect(update.error?.code).toBe(RLS_VIOLATION);

    const del = await a.from("status_events").delete().eq("application_id", fa.applicationId);
    expect(del.error?.code).toBe(RLS_VIOLATION);

    const anonInsert = await anon
      .from("status_events")
      .insert({ user_id: userA, application_id: fa.applicationId, to_status: "offer" });
    expect(anonInsert.error?.code).toBe(RLS_VIOLATION);

    expect(await eventsFor(a, fa.applicationId)).toEqual([{ from_status: null, to_status: "saved" }]);
  });
});

describe("check constraints", () => {
  it("accept every status in STATUSES and reject anything else", async () => {
    for (const status of STATUSES) {
      const { data, error } = await a
        .from("applications")
        .insert({ company: "Acme Corp", role_title: "Engineer", status })
        .select("status");
      expect(error, status).toBeNull();
      expect(data).toEqual([{ status }]);
    }
    const insert = await a.from("applications").insert({ company: "Acme Corp", role_title: "Engineer", status: "hired" });
    expect(insert.error?.code).toBe(CHECK_VIOLATION);
    const update = await a.from("applications").update({ status: "hired" }).eq("id", fa.applicationId);
    expect(update.error?.code).toBe(CHECK_VIOLATION);
  });

  it("enforce work mode, salary, currency and URL rules", async () => {
    for (const work_mode of WORK_MODES) {
      expect((await a.from("applications").update({ work_mode }).eq("id", fa.applicationId)).error).toBeNull();
    }
    const bad = [
      { work_mode: "office" },
      { salary_min: 200, salary_max: 100 },
      { salary_min: -1 },
      { salary_currency: "usd" },
      { job_url: "javascript:alert(1)" },
      { company: "   " },
    ];
    for (const patch of bad) {
      const { error } = await a.from("applications").update(patch).eq("id", fa.applicationId);
      expect(error?.code, JSON.stringify(patch)).toBe(CHECK_VIOLATION);
    }
    const contact = await a.from("contacts").update({ linkedin_url: "javascript:alert(1)" }).eq("id", fa.contactId);
    expect(contact.error?.code).toBe(CHECK_VIOLATION);
  });

  it("enforce interview kind, outcome and duration", async () => {
    for (const kind of INTERVIEW_KINDS) {
      expect((await a.from("interviews").update({ kind }).eq("id", fa.interviewId)).error).toBeNull();
    }
    for (const outcome of INTERVIEW_OUTCOMES) {
      expect((await a.from("interviews").update({ outcome }).eq("id", fa.interviewId)).error).toBeNull();
    }
    for (const patch of [{ kind: "lunch" }, { outcome: "maybe" }, { duration_minutes: 0 }]) {
      const { error } = await a.from("interviews").update(patch).eq("id", fa.interviewId);
      expect(error?.code, JSON.stringify(patch)).toBe(CHECK_VIOLATION);
    }
  });
});

describe("deleting an application", () => {
  it("removes its notes, contacts, interviews, links and history", async () => {
    const f = await createFixture(a, "Hooli");
    expect((await a.from("applications").delete().eq("id", f.applicationId)).error).toBeNull();

    for (const [table, id] of [
      ["notes", f.noteId],
      ["contacts", f.contactId],
      ["interviews", f.interviewId],
      ["interview_contacts", f.linkId],
    ] as const) {
      expect((await a.from(table).select("id").eq("id", id)).data, table).toEqual([]);
    }
    expect(await eventsFor(a, f.applicationId)).toEqual([]);
  });
});
