import { beforeAll, describe, expect, it } from "vitest";

import type { Status } from "@/lib/status";
import { selectStats } from "@/lib/stats-query";

import { type Client, localSuperuserQuery, newClient, recreateUser, rowOrThrow, signedInClient } from "./support";

// Its own fake users, so this file never shares rows with the other local-stack files.
const OWNER = "rls-stats-a@example.com";
const OTHER = "rls-stats-b@example.com";
const TODAY = "2026-11-17"; // a Tuesday; its week starts 2026-11-16
const DENIED = "42501";

let owner: Client;
let other: Client;

/** Inserts an application, walks it through `statuses` and pins each event to `start + days`. */
async function seed(
  client: Client,
  row: { company: string; date_applied?: string },
  path: { status: Status; day: number }[],
): Promise<string> {
  const [first, ...rest] = path;
  const { id } = rowOrThrow(
    await client
      .from("applications")
      .insert({ ...row, role_title: "Software Engineer", status: first.status })
      .select("id")
      .single(),
  );
  for (const step of rest) {
    rowOrThrow(await client.from("applications").update({ status: step.status }).eq("id", id).select("id"));
  }
  for (const step of path) {
    localSuperuserQuery(
      `update public.status_events set changed_at = timestamptz '2026-01-01 00:00:00+00' + interval '${step.day} days' where application_id = '${id}' and to_status = '${step.status}'`,
    );
  }
  return id;
}

beforeAll(async () => {
  await recreateUser(OWNER);
  await recreateUser(OTHER);
  owner = await signedInClient(OWNER);
  other = await signedInClient(OTHER);

  await seed(owner, { company: "Acme Corp", date_applied: "2026-11-16" }, [
    { status: "saved", day: 0 },
    { status: "applied", day: 2 },
    { status: "screening", day: 5 },
    { status: "rejected", day: 6 },
  ]);
  await seed(owner, { company: "Globex", date_applied: "2026-08-31" }, [
    { status: "applied", day: 0 },
    { status: "ghosted", day: 10 },
  ]);
  // Saved with a date applied in the week after the window: never counted per week.
  await seed(owner, { company: "Initech", date_applied: "2026-11-23" }, [{ status: "saved", day: 0 }]);
  const archived = await seed(owner, { company: "Umbrella", date_applied: "2026-11-17" }, [
    { status: "applied", day: 0 },
    { status: "screening", day: 4 },
  ]);
  rowOrThrow(
    await owner.from("applications").update({ archived_at: new Date().toISOString() }).eq("id", archived).select("id"),
  );
});

describe("stats functions (F9)", () => {
  it("count the owner's unarchived applications", async () => {
    const stats = await selectStats(owner, { today: TODAY, includeArchived: false });

    const count = (status: Status) =>
      [...stats.statusCounts.active, ...stats.statusCounts.closed].find((c) => c.status === status)?.applications;
    expect(stats.statusCounts.total).toBe(3);
    expect([count("saved"), count("rejected"), count("ghosted"), count("screening")]).toEqual([1, 1, 1, 0]);

    expect(stats.weeks).toHaveLength(12);
    expect(stats.weeks[0]).toEqual({ weekStart: "2026-08-31", applications: 1 });
    expect(stats.weeks[11]).toEqual({ weekStart: "2026-11-16", applications: 1 });
    expect(stats.weeks.reduce((sum, w) => sum + w.applications, 0)).toBe(2);

    // Acme reached Screening; Globex went Applied → Ghosted; Initech never reached Applied.
    expect(stats.responseRate).toEqual({ reached: 2, responded: 1, percent: 50 });

    const duration = (status: Status) => stats.stageDurations.find((d) => d.status === status);
    expect(duration("saved")).toEqual({ status: "saved", stays: 1, averageDays: 2 });
    expect(duration("applied")).toEqual({ status: "applied", stays: 2, averageDays: 6.5 }); // 3 and 10 days
    expect(duration("screening")).toEqual({ status: "screening", stays: 1, averageDays: 1 });
    // Current stages (Rejected, Ghosted, Initech's Saved) have no end yet.
    expect(duration("rejected")).toEqual({ status: "rejected", stays: 0, averageDays: null });
  });

  it("include archived applications only when asked", async () => {
    const stats = await selectStats(owner, { today: TODAY, includeArchived: true });
    expect(stats.statusCounts.total).toBe(4);
    expect(stats.statusCounts.active.find((c) => c.status === "screening")?.applications).toBe(1);
    expect(stats.weeks[11]).toEqual({ weekStart: "2026-11-16", applications: 2 });
    expect(stats.responseRate).toEqual({ reached: 3, responded: 2, percent: 67 });
    const applied = stats.stageDurations.find((d) => d.status === "applied");
    expect(applied?.stays).toBe(3);
    expect(applied?.averageDays).toBeCloseTo(17 / 3);
  });

  it("never count another user's applications", async () => {
    for (const includeArchived of [false, true]) {
      const stats = await selectStats(other, { today: TODAY, includeArchived });
      expect(stats.statusCounts.total).toBe(0);
      expect(stats.weeks.every((w) => w.applications === 0)).toBe(true);
      expect(stats.responseRate).toEqual({ reached: 0, responded: 0, percent: null });
      expect(stats.stageDurations.every((d) => d.stays === 0)).toBe(true);
    }

    // The other user's own rows don't leak into the owner's stats either.
    await seed(other, { company: "Hooli", date_applied: "2026-11-17" }, [
      { status: "applied", day: 0 },
      { status: "offer", day: 1 },
    ]);
    const mine = await selectStats(other, { today: TODAY, includeArchived: false });
    expect(mine.statusCounts.total).toBe(1);
    expect(mine.responseRate).toEqual({ reached: 1, responded: 1, percent: 100 });
    const owners = await selectStats(owner, { today: TODAY, includeArchived: false });
    expect(owners.statusCounts.total).toBe(3);
    expect(owners.responseRate).toEqual({ reached: 2, responded: 1, percent: 50 });
  });

  it("are not callable signed out", async () => {
    const anon = newClient();
    const calls = [
      anon.rpc("stats_status_counts", { include_archived: true }),
      anon.rpc("stats_applied_per_day", { from_day: "2026-01-01", until_day: "2027-01-01", include_archived: true }),
      anon.rpc("stats_response_counts", { reached_statuses: [], responded_statuses: [], include_archived: true }),
      anon.rpc("stats_stage_durations", { include_archived: true }),
    ];
    for (const result of await Promise.all(calls)) {
      expect(result.error?.code).toBe(DENIED);
      expect(result.data).toBeNull();
    }
  });
});
