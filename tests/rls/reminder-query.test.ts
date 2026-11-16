import { beforeAll, describe, expect, it } from "vitest";

import { selectUpcomingInterviews } from "@/lib/interview-query";
import { selectDueFollowUps, toDueFollowUps } from "@/lib/reminder-query";

import { type Client, recreateUser, rowOrThrow, signedInClient } from "./support";

// Their own fake users, so this file never shares rows with the other suites.
const OWNER = "rls-reminders@example.com";
const OTHER = "rls-reminders-other@example.com";

const LAST_DAY = "2026-12-08";

let ownerId: string;
let otherId: string;
let owner: Client;
let other: Client;

async function application(
  client: Client,
  company: string,
  values: { next_follow_up_on?: string | null; archived?: boolean; status?: string } = {},
) {
  return rowOrThrow(
    await client
      .from("applications")
      .insert({
        company,
        role_title: "Software Engineer",
        next_follow_up_on: values.next_follow_up_on ?? null,
        follow_up_note: values.next_follow_up_on ? `Ping ${company}` : null,
        status: values.status ?? "applied",
        archived_at: values.archived ? "2026-11-01T00:00:00Z" : null,
      })
      .select("id")
      .single(),
  ).id;
}

beforeAll(async () => {
  [ownerId, otherId] = await Promise.all([recreateUser(OWNER), recreateUser(OTHER)]);
  [owner, other] = await Promise.all([signedInClient(OWNER), signedInClient(OTHER)]);
});

describe("due follow-ups query (F8)", () => {
  it("returns follow-ups up to the last day on unarchived applications, soonest first, overdue included", async () => {
    const lastDay = await application(owner, "Acme Corp", { next_follow_up_on: LAST_DAY });
    const overdue = await application(owner, "Globex", { next_follow_up_on: "2025-06-01" });
    const closed = await application(owner, "Initech", { next_follow_up_on: "2026-12-02", status: "rejected" });
    await application(owner, "Umbrella", { next_follow_up_on: "2026-12-09" }); // after the last day
    await application(owner, "Hooli", { next_follow_up_on: "2026-12-01", archived: true });
    await application(owner, "Vandelay"); // no follow-up
    await application(other, "Wonka", { next_follow_up_on: "2026-12-01" });

    const { data, error } = await selectDueFollowUps(owner, ownerId, LAST_DAY);
    expect(error).toBeNull();
    const rows = toDueFollowUps(data ?? []);
    expect(rows.map((row) => row.id)).toEqual([overdue, closed, lastDay]);
    expect(rows[2]).toEqual({
      id: lastDay,
      company: "Acme Corp",
      role_title: "Software Engineer",
      status: "applied",
      next_follow_up_on: LAST_DAY,
      follow_up_note: "Ping Acme Corp",
    });
  });

  it("never returns another user's follow-ups, even when asked with their id", async () => {
    const { data, error } = await selectDueFollowUps(other, ownerId, LAST_DAY);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const own = await selectDueFollowUps(other, otherId, LAST_DAY);
    expect(own.data?.map((row) => row.company)).toEqual(["Wonka"]);
  });

  it("another user can't mark the owner's follow-up done", async () => {
    const id = await application(owner, "Soylent", { next_follow_up_on: "2026-12-03" });
    const { data, error } = await other
      .from("applications")
      .update({ next_follow_up_on: null, follow_up_note: null })
      .eq("id", id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const row = rowOrThrow(await owner.from("applications").select("next_follow_up_on").eq("id", id).single());
    expect(row.next_follow_up_on).toBe("2026-12-03");
  });
});

describe("pending interviews without a lower bound (F8 overdue)", () => {
  it("includes every earlier pending round", async () => {
    const acme = await application(owner, "Acme Interviews");
    const old = rowOrThrow(
      await owner
        .from("interviews")
        .insert({ application_id: acme, kind: "technical", scheduled_at: "2024-01-10T15:00:00Z" })
        .select("id")
        .single(),
    ).id;
    await owner
      .from("interviews")
      .insert({ application_id: acme, kind: "final", scheduled_at: "2024-01-11T15:00:00Z", outcome: "passed" });

    const { data, error } = await selectUpcomingInterviews(owner, ownerId, { until: "2026-12-09T00:00:00Z" });
    expect(error).toBeNull();
    expect(data?.map((row) => row.id)).toEqual([old]);
  });
});
