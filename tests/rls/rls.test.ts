import { beforeAll, describe, expect, it } from "vitest";

import { INTERVIEW_KINDS, INTERVIEW_OUTCOMES, WORK_MODES } from "@/lib/closed-sets";
import { TEXT_LIMITS } from "@/lib/limits";
import { STATUSES } from "@/lib/status";
import type { TablesUpdate } from "@/types/database.types";

import { localSupabaseUrl } from "../e2e/support/local-env";
import { type Client, newClient, publishableKey, recreateUser, rowOrThrow, signedInClient } from "./support";

// Fake users for these checks only; recreated each run so every row below is fresh.
const USER_A = "rls-a@example.com";
const USER_B = "rls-b@example.com";

// Postgres error codes as returned by PostgREST.
const DENIED = "42501"; // RLS violation or missing (column) privilege
const FK_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

type Fixture = { applicationId: string; noteId: string; contactId: string; interviewId: string; linkId: string };

async function createFixture(client: Client, company: string): Promise<Fixture> {
  const app = rowOrThrow(
    await client.from("applications").insert({ company, role_title: "Software Engineer" }).select("id").single(),
  );
  const note = rowOrThrow(
    await client.from("notes").insert({ application_id: app.id, body: "Fake note" }).select("id").single(),
  );
  const contact = rowOrThrow(
    await client
      .from("contacts")
      .insert({ application_id: app.id, name: "Jane Doe", email: "jane@example.com", phone: "555-0100" })
      .select("id")
      .single(),
  );
  const interview = rowOrThrow(
    await client
      .from("interviews")
      .insert({ application_id: app.id, kind: "phone_screen", scheduled_at: "2026-12-01T15:00:00Z" })
      .select("id")
      .single(),
  );
  const link = rowOrThrow(
    await client
      .from("interview_contacts")
      .insert({ application_id: app.id, interview_id: interview.id, contact_id: contact.id })
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
    .order("changed_at");
  if (error) throw error;
  return data;
}

async function accessToken(client: Client): Promise<string> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("not signed in");
  return data.session.access_token;
}

/** Today's date (YYYY-MM-DD) in an IANA time zone. */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
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
  it("are created on sign-up with no time zone yet, visible only to their owner", async () => {
    const { data, error } = await a.from("profiles").select("id, time_zone");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: userA, time_zone: null }]);
  });

  it("accept a valid IANA time zone and reject an unknown one", async () => {
    const ok = await a.from("profiles").update({ time_zone: "America/New_York" }).eq("id", userA).select("time_zone");
    expect(ok.error).toBeNull();
    expect(ok.data).toEqual([{ time_zone: "America/New_York" }]);

    const bad = await a.from("profiles").update({ time_zone: "Mars/Olympus_Mons" }).eq("id", userA);
    expect(bad.error?.message).toBe("invalid_time_zone");
  });

  it("can't change their id", async () => {
    const { error } = await a.from("profiles").update({ id: userB }).eq("id", userA);
    expect(error?.code).toBe(DENIED);
  });

  it("can't be changed, created or deleted by another user", async () => {
    const update = await b.from("profiles").update({ time_zone: "Europe/Paris" }).eq("id", userA).select();
    expect(update.data).toEqual([]);

    const insert = await b.from("profiles").insert({ id: userB });
    expect(insert.error?.code).toBe(DENIED);

    const del = await b.from("profiles").delete().eq("id", userA);
    expect(del.error?.code).toBe(DENIED);

    const own = rowOrThrow(await a.from("profiles").select("time_zone").eq("id", userA).single());
    expect(own.time_zone).toBe("America/New_York");
  });
});

describe("user B can't touch user A's rows", () => {
  it("applications: no read, update or delete", async () => {
    const id = fa.applicationId;
    expect((await b.from("applications").select("id").eq("id", id)).data).toEqual([]);
    expect((await b.from("applications").update({ company: "Hacked" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await b.from("applications").delete().eq("id", id).select("id")).data).toEqual([]);
    expect(rowOrThrow(await a.from("applications").select("company").eq("id", id).single()).company).toBe("Acme Corp");
  });

  it("notes: no read, update or delete", async () => {
    const id = fa.noteId;
    expect((await b.from("notes").select("id").eq("id", id)).data).toEqual([]);
    expect((await b.from("notes").update({ body: "Hacked" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await b.from("notes").delete().eq("id", id).select("id")).data).toEqual([]);
    expect(rowOrThrow(await a.from("notes").select("body").eq("id", id).single()).body).toBe("Fake note");
  });

  it("contacts: no read, update or delete", async () => {
    const id = fa.contactId;
    expect((await b.from("contacts").select("id").eq("id", id)).data).toEqual([]);
    expect((await b.from("contacts").update({ name: "Hacked" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await b.from("contacts").delete().eq("id", id).select("id")).data).toEqual([]);
    expect(rowOrThrow(await a.from("contacts").select("name").eq("id", id).single()).name).toBe("Jane Doe");
  });

  it("interviews: no read, update or delete", async () => {
    const id = fa.interviewId;
    expect((await b.from("interviews").select("id").eq("id", id)).data).toEqual([]);
    expect((await b.from("interviews").update({ notes: "Hacked" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await b.from("interviews").delete().eq("id", id).select("id")).data).toEqual([]);
    expect(rowOrThrow(await a.from("interviews").select("notes").eq("id", id).single()).notes).toBeNull();
  });

  it("interview_contacts: no read or delete", async () => {
    const id = fa.linkId;
    expect((await b.from("interview_contacts").select("id").eq("id", id)).data).toEqual([]);
    expect((await b.from("interview_contacts").delete().eq("id", id).select("id")).data).toEqual([]);
    expect((await a.from("interview_contacts").select("id").eq("id", id)).data).toEqual([{ id }]);
  });

  it("status_events: only the owner can read", async () => {
    expect(await eventsFor(b, fa.applicationId)).toEqual([]);
    expect((await eventsFor(a, fa.applicationId)).length).toBeGreaterThan(0);
  });

  it("can't create rows owned by A or under A's application", async () => {
    const asA = await b.from("applications").insert({ company: "Acme Corp", role_title: "Spy", user_id: userA });
    expect(asA.error?.code).toBe(DENIED);

    const upsert = await b
      .from("applications")
      .upsert({ id: fa.applicationId, company: "Hacked", role_title: "Spy" });
    expect(upsert.error?.code).toBe(DENIED);

    const note = await b.from("notes").insert({ application_id: fa.applicationId, body: "Sneaky" });
    expect(note.error?.code).toBe(FK_VIOLATION);

    const contact = await b.from("contacts").insert({ application_id: fa.applicationId, name: "John Doe" });
    expect(contact.error?.code).toBe(FK_VIOLATION);

    const interview = await b
      .from("interviews")
      .insert({ application_id: fa.applicationId, kind: "other", scheduled_at: "2026-12-01T15:00:00Z" });
    expect(interview.error?.code).toBe(FK_VIOLATION);

    const linkUnderA = await b
      .from("interview_contacts")
      .insert({ application_id: fa.applicationId, interview_id: fa.interviewId, contact_id: fb.contactId });
    expect(linkUnderA.error?.code).toBe(FK_VIOLATION);

    const existingPair = { application_id: fb.applicationId, interview_id: fa.interviewId, contact_id: fa.contactId };
    const pairInsert = await b.from("interview_contacts").insert(existingPair);
    expect(pairInsert.error?.code).toBe(FK_VIOLATION);
    const pairUpsert = await b
      .from("interview_contacts")
      .upsert(existingPair, { onConflict: "user_id,interview_id,contact_id", ignoreDuplicates: true });
    expect(pairUpsert.error?.code).toBe(FK_VIOLATION);

    const ownInterviewAsContact = await b
      .from("interview_contacts")
      .insert({ application_id: fb.applicationId, interview_id: fb.interviewId, contact_id: fa.contactId });
    expect(ownInterviewAsContact.error?.code).toBe(FK_VIOLATION);
  });

  it("can't spoof user_id on child rows", async () => {
    const inserts = [
      await b.from("notes").insert({ application_id: fa.applicationId, body: "Sneaky", user_id: userA }),
      await b.from("contacts").insert({ application_id: fa.applicationId, name: "John Doe", user_id: userA }),
      await b.from("interviews").insert({
        application_id: fa.applicationId,
        kind: "other",
        scheduled_at: "2026-12-01T15:00:00Z",
        user_id: userA,
      }),
      await b.from("interview_contacts").insert({
        application_id: fa.applicationId,
        interview_id: fa.interviewId,
        contact_id: fa.contactId,
        user_id: userA,
      }),
    ];
    for (const { error } of inserts) expect(error?.code).toBe(DENIED);

    for (const table of ["applications", "notes", "contacts", "interviews"] as const) {
      const id = { applications: fb.applicationId, notes: fb.noteId, contacts: fb.contactId, interviews: fb.interviewId }[
        table
      ];
      const { error } = await b.from(table).update({ user_id: userA }).eq("id", id);
      expect(error?.code, table).toBe(DENIED);
    }
  });

  it("anon sees and writes nothing", async () => {
    for (const table of [
      "profiles",
      "applications",
      "notes",
      "contacts",
      "interviews",
      "interview_contacts",
      "status_events",
    ] as const) {
      const read = await anon.from(table).select("id");
      expect(read.error?.code, table).toBe(DENIED);
    }
    const insert = await anon.from("applications").insert({ company: "Acme Corp", role_title: "Anon" });
    expect(insert.error?.code).toBe(DENIED);
  });
});

describe("parent links are fixed after insert", () => {
  it("notes, contacts and interviews can't move to another application, even the user's own", async () => {
    const other = await createFixture(a, "Initech");
    for (const [table, id] of [
      ["notes", fa.noteId],
      ["contacts", fa.contactId],
      ["interviews", fa.interviewId],
    ] as const) {
      const { error } = await a.from(table).update({ application_id: other.applicationId }).eq("id", id);
      expect(error?.code, table).toBe(DENIED);
    }
  });

  it("interview_contacts reject a contact from another application of the same user", async () => {
    const other = await createFixture(a, "Initrode");
    const link = await a
      .from("interview_contacts")
      .insert({ application_id: fa.applicationId, interview_id: fa.interviewId, contact_id: other.contactId });
    expect(link.error?.code).toBe(FK_VIOLATION);
  });

  it("interview_contacts can't be updated", async () => {
    const update = await a.from("interview_contacts").update({ contact_id: fa.contactId }).eq("id", fa.linkId);
    expect(update.error?.code).toBe(DENIED);
  });
});

describe("private functions", () => {
  it.each(["log_status_event", "handle_new_user", "set_date_applied"])("%s is not callable over the API", async (fn) => {
    const token = await accessToken(a);
    for (const headers of [{ "Content-Profile": "private" }, {}] as Record<string, string>[]) {
      const res = await fetch(`${localSupabaseUrl()}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          apikey: publishableKey(),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: "{}",
      });
      expect([404, 406], JSON.stringify(headers)).toContain(res.status);
    }
  });
});

describe("status_events", () => {
  it("logs the initial status, each change, and not no-op updates", async () => {
    const app = rowOrThrow(
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
    expect(insert.error?.code).toBe(DENIED);

    const update = await a.from("status_events").update({ to_status: "offer" }).eq("application_id", fa.applicationId);
    expect(update.error?.code).toBe(DENIED);

    const del = await a.from("status_events").delete().eq("application_id", fa.applicationId);
    expect(del.error?.code).toBe(DENIED);

    const anonInsert = await anon
      .from("status_events")
      .insert({ user_id: userA, application_id: fa.applicationId, to_status: "offer" });
    expect(anonInsert.error?.code).toBe(DENIED);

    expect(await eventsFor(a, fa.applicationId)).toEqual([{ from_status: null, to_status: "saved" }]);
  });
});

describe("date_applied (F4)", () => {
  // User A's profile time zone is America/New_York (set in the profiles tests).
  const insertApp = (patch: { status?: "saved" | "applied"; date_applied?: string }) =>
    a
      .from("applications")
      .insert({ company: "Soylent Corp", role_title: "Engineer", ...patch })
      .select("id, date_applied")
      .single();

  it("is set to today in the owner's time zone when created as applied without one", async () => {
    const app = rowOrThrow(await insertApp({ status: "applied" }));
    expect(app.date_applied).toBe(todayIn("America/New_York"));
  });

  it("is set when moving to applied without one", async () => {
    const app = rowOrThrow(await insertApp({ status: "saved" }));
    expect(app.date_applied).toBeNull();
    const moved = rowOrThrow(
      await a.from("applications").update({ status: "applied" }).eq("id", app.id).select("date_applied").single(),
    );
    expect(moved.date_applied).toBe(todayIn("America/New_York"));
  });

  it("keeps an explicit date", async () => {
    const app = rowOrThrow(await insertApp({ status: "applied", date_applied: "2026-10-15" }));
    expect(app.date_applied).toBe("2026-10-15");
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
    ] satisfies TablesUpdate<"applications">[];
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
    const bad = [{ kind: "lunch" }, { outcome: "maybe" }, { duration_minutes: 0 }] satisfies TablesUpdate<"interviews">[];
    for (const patch of bad) {
      const { error } = await a.from("interviews").update(patch).eq("id", fa.interviewId);
      expect(error?.code, JSON.stringify(patch)).toBe(CHECK_VIOLATION);
    }
  });

  it("enforce text length limits", async () => {
    const max = TEXT_LIMITS.applications.company;
    const atLimit = await a.from("applications").update({ company: "x".repeat(max) }).eq("id", fa.applicationId);
    expect(atLimit.error).toBeNull();
    const over = await a.from("applications").update({ company: "x".repeat(max + 1) }).eq("id", fa.applicationId);
    expect(over.error?.code).toBe(CHECK_VIOLATION);
    const note = await a
      .from("notes")
      .update({ body: "x".repeat(TEXT_LIMITS.notes.body + 1) })
      .eq("id", fa.noteId);
    expect(note.error?.code).toBe(CHECK_VIOLATION);
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
