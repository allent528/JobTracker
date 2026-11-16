import { describe, expect, it } from "vitest";

import {
  boardColumns,
  compareBoardCards,
  countClosed,
  DEFAULT_TABLE_FILTERS,
  filterApplications,
  formatDaysInStatus,
  nextSort,
  type PipelineItem,
  sortApplications,
} from "./pipeline";
import { isWorkMode } from "./closed-sets";
import { ACTIVE_STATUSES, STATUSES } from "./status";

const TODAY = "2026-11-14";

let seq = 0;
function item(overrides: Partial<PipelineItem> = {}): PipelineItem {
  seq += 1;
  return {
    id: `id-${seq}`,
    company: "Acme Corp",
    role_title: "Software Engineer",
    status: "applied",
    work_mode: null,
    date_applied: null,
    next_follow_up_on: null,
    archived_at: null,
    updated_at: "2026-11-01T12:00:00+00:00",
    days_in_status: 0,
    ...overrides,
  };
}

const ids = (items: PipelineItem[]) => items.map((i) => i.id);

describe("compareBoardCards", () => {
  it("puts overdue first, then by follow-up date, then no follow-up, newest update first on ties", () => {
    const noFollowUpOld = item({ id: "none-old", updated_at: "2026-11-01T00:00:00+00:00" });
    const noFollowUpNew = item({ id: "none-new", updated_at: "2026-11-10T00:00:00.5+00:00" });
    const upcoming = item({ id: "upcoming", next_follow_up_on: "2026-11-20" });
    const dueToday = item({ id: "today", next_follow_up_on: TODAY });
    const overdueLong = item({ id: "overdue-long", next_follow_up_on: "2026-10-01" });
    const overdue = item({ id: "overdue", next_follow_up_on: "2026-11-13" });
    const sameDateNewer = item({
      id: "upcoming-newer",
      next_follow_up_on: "2026-11-20",
      updated_at: "2026-11-12T00:00:00+00:00",
    });

    const sorted = [noFollowUpOld, upcoming, noFollowUpNew, dueToday, overdue, sameDateNewer, overdueLong].sort(
      compareBoardCards,
    );
    expect(ids(sorted)).toEqual([
      "overdue-long",
      "overdue",
      "today",
      "upcoming-newer",
      "upcoming",
      "none-new",
      "none-old",
    ]);
  });
});

describe("boardColumns", () => {
  const items = [
    item({ id: "a", status: "saved" }),
    item({ id: "b", status: "interviewing" }),
    item({ id: "c", status: "rejected" }),
    item({ id: "d", status: "saved", archived_at: "2026-11-02T00:00:00+00:00" }),
  ];

  it("has one column per active status and hides closed statuses and archived cards by default", () => {
    const columns = boardColumns(items, { showClosed: false });
    expect(columns.map((c) => c.status)).toEqual(ACTIVE_STATUSES);
    expect(ids(columns.flatMap((c) => c.cards))).toEqual(["a", "b"]);
  });

  it("adds the closed columns when asked", () => {
    const columns = boardColumns(items, { showClosed: true });
    expect(columns.map((c) => c.status)).toEqual(STATUSES);
    expect(columns.find((c) => c.status === "rejected")?.cards.map((card) => card.id)).toEqual(["c"]);
  });

  it("counts unarchived closed applications for the Show closed toggle", () => {
    expect(countClosed(items)).toBe(1);
    expect(countClosed([...items, item({ status: "ghosted", archived_at: "2026-11-02T00:00:00+00:00" })])).toBe(1);
    expect(countClosed([item({ status: "offer" })])).toBe(0);
  });
});

describe("filterApplications", () => {
  const items = [
    item({ id: "acme", company: "Acme Corp", role_title: "Software Engineer", work_mode: "remote" }),
    item({ id: "globex", company: "Globex", role_title: "Data Analyst", status: "screening", work_mode: "onsite" }),
    item({ id: "initech", company: "Initech", role_title: "Product Manager", status: "rejected" }),
    item({
      id: "umbrella",
      company: "Umbrella",
      role_title: "Backend Engineer",
      work_mode: "remote",
      archived_at: "2026-11-02T00:00:00+00:00",
    }),
  ];

  it("hides archived applications by default", () => {
    expect(ids(filterApplications(items, DEFAULT_TABLE_FILTERS))).toEqual(["acme", "globex", "initech"]);
    expect(ids(filterApplications(items, { ...DEFAULT_TABLE_FILTERS, includeArchived: true }))).toHaveLength(4);
  });

  it("searches company and role, case-insensitively and trimmed", () => {
    const search = (query: string, includeArchived = false) =>
      ids(filterApplications(items, { ...DEFAULT_TABLE_FILTERS, query, includeArchived }));
    expect(search("  ENGINEER ")).toEqual(["acme"]);
    expect(search("engineer", true)).toEqual(["acme", "umbrella"]);
    expect(search("glob")).toEqual(["globex"]);
    expect(search("nothing matches")).toEqual([]);
  });

  it("filters by status and work mode", () => {
    expect(ids(filterApplications(items, { ...DEFAULT_TABLE_FILTERS, status: "screening" }))).toEqual(["globex"]);
    expect(ids(filterApplications(items, { ...DEFAULT_TABLE_FILTERS, workMode: "remote" }))).toEqual(["acme"]);
    expect(
      ids(filterApplications(items, { ...DEFAULT_TABLE_FILTERS, workMode: "remote", status: "screening" })),
    ).toEqual([]);
  });
});

describe("sortApplications", () => {
  const items = [
    item({ id: "b", company: "globex", role_title: "Analyst", status: "offer", date_applied: "2026-09-15", updated_at: "2026-11-03T00:00:00+00:00" }),
    item({ id: "a", company: "Acme Corp", role_title: "Engineer", status: "saved", date_applied: null, updated_at: "2026-11-05T00:00:00+00:00" }),
    item({ id: "c", company: "Initech", role_title: "Designer", status: "applied", date_applied: "2026-10-01", updated_at: "2026-11-01T00:00:00+00:00" }),
  ];
  const sorted = (key: Parameters<typeof nextSort>[1], direction: "asc" | "desc") =>
    ids(sortApplications(items, { key, direction }));

  it("sorts text case-insensitively", () => {
    expect(sorted("company", "asc")).toEqual(["a", "b", "c"]);
    expect(sorted("company", "desc")).toEqual(["c", "b", "a"]);
    expect(sorted("role_title", "asc")).toEqual(["b", "c", "a"]);
  });

  it("sorts status in lifecycle order", () => {
    expect(sorted("status", "asc")).toEqual(["a", "c", "b"]);
  });

  it("keeps blank dates applied last in both directions", () => {
    expect(sorted("date_applied", "asc")).toEqual(["b", "c", "a"]);
    expect(sorted("date_applied", "desc")).toEqual(["c", "b", "a"]);
  });

  it("sorts by last updated", () => {
    expect(sorted("updated_at", "desc")).toEqual(["a", "b", "c"]);
  });

  it("breaks ties newest first and doesn't mutate the input", () => {
    const tied = [
      item({ id: "old", company: "Same" }),
      item({ id: "new", company: "Same", updated_at: "2026-11-09T00:00:00+00:00" }),
    ];
    expect(ids(sortApplications(tied, { key: "company", direction: "asc" }))).toEqual(["new", "old"]);
    expect(ids(tied)).toEqual(["old", "new"]);
  });
});

describe("nextSort", () => {
  it("flips the direction on the same column and picks a default for a new one", () => {
    expect(nextSort({ key: "company", direction: "asc" }, "company")).toEqual({ key: "company", direction: "desc" });
    expect(nextSort({ key: "updated_at", direction: "desc" }, "company")).toEqual({ key: "company", direction: "asc" });
    expect(nextSort({ key: "company", direction: "asc" }, "date_applied")).toEqual({
      key: "date_applied",
      direction: "desc",
    });
  });
});

describe("formatDaysInStatus", () => {
  it("labels the day count", () => {
    expect(formatDaysInStatus(0)).toBe("In status since today");
    expect(formatDaysInStatus(1)).toBe("1 day in status");
    expect(formatDaysInStatus(12)).toBe("12 days in status");
  });
});

describe("isWorkMode", () => {
  it("accepts only stored work modes", () => {
    expect(isWorkMode("remote")).toBe(true);
    expect(isWorkMode("all")).toBe(false);
    expect(isWorkMode("Remote")).toBe(false);
  });
});
