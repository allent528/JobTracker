import { beforeAll, describe, expect, it } from "vitest";

import { selectUpcomingInterviews, toUpcomingInterviews } from "@/lib/interview-query";

import { type Client, recreateUser, rowOrThrow, signedInClient } from "./support";

// Their own fake users, so this file never shares rows with the other suites.
const OWNER = "rls-upcoming@example.com";
const OTHER = "rls-upcoming-other@example.com";

const RANGE = { from: "2026-12-01T00:00:00Z", until: "2026-12-08T00:00:00Z" };

let ownerId: string;
let otherId: string;
let owner: Client;
let other: Client;

async function application(client: Client, company: string, archived = false) {
  return rowOrThrow(
    await client
      .from("applications")
      .insert({ company, role_title: "Software Engineer", archived_at: archived ? "2026-11-01T00:00:00Z" : null })
      .select("id")
      .single(),
  ).id;
}

async function interview(client: Client, applicationId: string, scheduled_at: string, outcome = "pending") {
  return rowOrThrow(
    await client
      .from("interviews")
      .insert({ application_id: applicationId, kind: "technical", scheduled_at, outcome })
      .select("id")
      .single(),
  ).id;
}

beforeAll(async () => {
  [ownerId, otherId] = await Promise.all([recreateUser(OWNER), recreateUser(OTHER)]);
  [owner, other] = await Promise.all([signedInClient(OWNER), signedInClient(OTHER)]);
});

describe("upcoming interviews query (for F8)", () => {
  it("returns pending rounds in the range on unarchived applications, soonest first", async () => {
    const acme = await application(owner, "Acme Corp");
    const archived = await application(owner, "Globex", true);
    const later = await interview(owner, acme, "2026-12-05T15:00:00Z");
    const sooner = await interview(owner, acme, "2026-12-01T00:00:00Z");
    await interview(owner, acme, "2026-12-08T00:00:00Z"); // `until` is exclusive
    await interview(owner, acme, "2026-11-30T23:59:59Z"); // before the range
    await interview(owner, acme, "2026-12-02T15:00:00Z", "cancelled");
    await interview(owner, acme, "2026-12-03T15:00:00Z", "passed");
    await interview(owner, archived, "2026-12-04T15:00:00Z");

    const otherApp = await application(other, "Initech");
    await interview(other, otherApp, "2026-12-03T15:00:00Z");

    const { data, error } = await selectUpcomingInterviews(owner, ownerId, RANGE);
    expect(error).toBeNull();
    const rows = toUpcomingInterviews(data ?? []);
    expect(rows.map((row) => row.id)).toEqual([sooner, later]);
    expect(rows[0]).toMatchObject({
      kind: "technical",
      application: { id: acme, company: "Acme Corp", role_title: "Software Engineer", status: "saved" },
    });
  });

  it("never returns another user's rounds, even when asked with their id", async () => {
    const { data, error } = await selectUpcomingInterviews(other, ownerId, RANGE);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const own = await selectUpcomingInterviews(other, otherId, RANGE);
    expect(own.data?.map((row) => row.applications.company)).toEqual(["Initech"]);
  });
});
