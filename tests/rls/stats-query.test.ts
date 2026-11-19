import { beforeAll, describe, expect, it } from "vitest";

import { STATUSES, type Status } from "@/lib/status";
import { selectStats } from "@/lib/stats-query";

import { type Client, localSuperuserQuery, newClient, recreateUser, rowOrThrow, signedInClient } from "./support";

const OWNER = "rls-stats-a@example.com";
const OTHER = "rls-stats-b@example.com";
const REENTRY = "rls-stats-c@example.com";
const CLOSED = "rls-stats-d@example.com";
const TODAY = "2026-11-17"; // a Tuesday; its week starts 2026-11-16
const DENIED = "42501";
const INVALID_PARAMETER = "22023";

let owner: Client;
let other: Client;
let reentry: Client;
let closed: Client;

/** Pins the application's newest status event to 2026-01-01 plus `day` days. */
function backdateNewestEvent(applicationId: string, day: number) {
  localSuperuserQuery(
    `update public.status_events set changed_at = timestamptz '2026-01-01 00:00:00+00' + interval '${day} days' where id = (select id from public.status_events where application_id = '${applicationId}' order by changed_at desc limit 1)`,
  );
}

/** Inserts an application and walks it through `path`, backdating each event as it's logged. */
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
  backdateNewestEvent(id, first.day);
  for (const step of rest) {
    rowOrThrow(await client.from("applications").update({ status: step.status }).eq("id", id).select("id"));
    backdateNewestEvent(id, step.day);
  }
  return id;
}

beforeAll(async () => {
  for (const email of [OWNER, OTHER, REENTRY, CLOSED]) await recreateUser(email);
  [owner, other, reentry, closed] = await Promise.all([OWNER, OTHER, REENTRY, CLOSED].map(signedInClient));

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
  it("return nothing to another user calling them directly with the widest arguments", async () => {
    const [statusCounts, perDay, response, durations] = await Promise.all([
      other.rpc("stats_status_counts", { include_archived: true }),
      other.rpc("stats_applied_per_day", { from_day: "-infinity", until_day: "infinity", include_archived: true }),
      other.rpc("stats_response_counts", {
        reached_statuses: [...STATUSES],
        responded_statuses: [...STATUSES],
        include_archived: true,
      }),
      other.rpc("stats_stage_durations", { include_archived: true }),
    ]);
    expect(statusCounts).toMatchObject({ error: null, data: [] });
    expect(perDay).toMatchObject({ error: null, data: [] });
    expect(response).toMatchObject({ error: null, data: [{ reached: 0, responded: 0 }] });
    expect(durations).toMatchObject({ error: null, data: [] });
  });

  it("count the owner's unarchived applications", async () => {
    const stats = await selectStats(owner, { today: TODAY, includeArchived: false });

    const count = (status: Status) =>
      [...stats.statusCounts.active, ...stats.statusCounts.closed].find((c) => c.status === status)?.applications;
    expect(stats.statusCounts.total).toBe(3);
    expect([count("saved"), count("rejected"), count("ghosted"), count("screening")]).toEqual([1, 1, 1, 0]);

    expect(stats.fromDay).toBe("2026-08-31");
    expect(stats.weeks).toHaveLength(12);
    expect(stats.weeks[0]).toEqual({ weekStart: "2026-08-31", applications: 1 });
    expect(stats.weeks[11]).toEqual({ weekStart: "2026-11-16", applications: 1 });
    expect(stats.weeks.reduce((sum, w) => sum + w.applications, 0)).toBe(2);

    expect(stats.responseRate).toEqual({ reached: 2, responded: 1, percent: 50 });

    const duration = (status: Status) => stats.stageDurations.find((d) => d.status === status);
    expect(duration("saved")).toEqual({ status: "saved", stays: 1, averageDays: 2 });
    expect(duration("applied")).toEqual({ status: "applied", stays: 2, averageDays: 6.5 });
    expect(duration("screening")).toEqual({ status: "screening", stays: 1, averageDays: 1 });
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

  it("count each stay in a re-entered stage, and the application once in the response rate", async () => {
    await seed(reentry, { company: "Vandelay Industries", date_applied: "2026-06-01" }, [
      { status: "applied", day: 0 },
      { status: "screening", day: 2 },
      { status: "applied", day: 3 },
      { status: "screening", day: 6 },
      { status: "rejected", day: 7 },
    ]);
    const stats = await selectStats(reentry, { today: TODAY, includeArchived: false });
    const duration = (status: Status) => stats.stageDurations.find((d) => d.status === status);
    expect(duration("applied")).toEqual({ status: "applied", stays: 2, averageDays: 2.5 });
    expect(duration("screening")).toEqual({ status: "screening", stays: 2, averageDays: 1 });
    expect(stats.responseRate).toEqual({ reached: 1, responded: 1, percent: 100 });
  });

  it("count a rejection after Applied as a response, but not withdrawn, ghosted or a rejection before Applied", async () => {
    await seed(closed, { company: "Acme Corp" }, [
      { status: "applied", day: 0 },
      { status: "rejected", day: 3 },
    ]);
    await seed(closed, { company: "Globex" }, [
      { status: "applied", day: 0 },
      { status: "withdrawn", day: 3 },
    ]);
    await seed(closed, { company: "Initech" }, [
      { status: "applied", day: 0 },
      { status: "ghosted", day: 3 },
    ]);
    await seed(closed, { company: "Umbrella" }, [
      { status: "saved", day: 0 },
      { status: "rejected", day: 3 },
    ]);
    const stats = await selectStats(closed, { today: TODAY, includeArchived: false });
    expect(stats.responseRate).toEqual({ reached: 3, responded: 1, percent: 33 });
  });

  it("never count another user's applications", async () => {
    for (const includeArchived of [false, true]) {
      const stats = await selectStats(other, { today: TODAY, includeArchived });
      expect(stats.statusCounts.total).toBe(0);
      expect(stats.weeks.every((w) => w.applications === 0)).toBe(true);
      expect(stats.responseRate).toEqual({ reached: 0, responded: 0, percent: null });
      expect(stats.stageDurations.every((d) => d.stays === 0)).toBe(true);
    }

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

  it("reject more than 32 statuses in either list", async () => {
    const statuses = (n: number) => Array.from({ length: n }, (_, i) => `status_${i}`);
    for (const [reached, responded] of [
      [statuses(33), []],
      [[], statuses(33)],
    ]) {
      const result = await owner.rpc("stats_response_counts", {
        reached_statuses: reached,
        responded_statuses: responded,
        include_archived: false,
      });
      expect(result.error?.code).toBe(INVALID_PARAMETER);
      expect(result.data).toBeNull();
    }
    const atLimit = await owner.rpc("stats_response_counts", {
      reached_statuses: statuses(32),
      responded_statuses: statuses(32),
      include_archived: false,
    });
    expect(atLimit).toMatchObject({ error: null, data: [{ reached: 0, responded: 0 }] });
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
