import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { INTERVIEW_KINDS, INTERVIEW_OUTCOMES, WORK_MODES } from "./closed-sets";
import { TEXT_LIMITS } from "./limits";
import { STATUSES } from "./status";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** All migrations in apply order, so a later re-added constraint replaces the earlier one. */
function migrationsSql(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
}

/** `constraint <name> check (<column> in ('a', 'b', ...))` → name: values. */
function closedSetConstraints(): Map<string, string[]> {
  const constraints = new Map<string, string[]>();
  const pattern = /constraint\s+(\w+)\s+check\s*\(\s*\w+\s+in\s*\(([^)]*)\)\s*\)/gi;
  for (const sql of migrationsSql()) {
    for (const [, name, list] of sql.matchAll(pattern)) {
      constraints.set(name, [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]));
    }
  }
  return constraints;
}

/** `constraint <name> check (char_length(<column>) <= <n>)` → name: "column <= n". */
function lengthConstraints(): Map<string, string> {
  const constraints = new Map<string, string>();
  const pattern = /constraint\s+(\w+)\s+check\s*\(\s*char_length\((\w+)\)\s*<=\s*(\d+)\s*\)/gi;
  for (const sql of migrationsSql()) {
    for (const [, name, column, max] of sql.matchAll(pattern)) {
      constraints.set(name, `${column} <= ${max}`);
    }
  }
  return constraints;
}

describe("check constraints mirror the TypeScript closed sets (D7)", () => {
  const constraints = closedSetConstraints();

  it.each([
    ["applications_status_check", STATUSES],
    ["applications_work_mode_check", WORK_MODES],
    ["interviews_kind_check", INTERVIEW_KINDS],
    ["interviews_outcome_check", INTERVIEW_OUTCOMES],
  ])("%s", (name, values) => {
    expect(constraints.get(name)).toEqual([...values]);
  });
});

describe("length constraints mirror TEXT_LIMITS", () => {
  it("has exactly one <table>_<column>_length constraint per limit, with the same maximum", () => {
    const expected = new Map<string, string>();
    for (const [table, columns] of Object.entries(TEXT_LIMITS)) {
      for (const [column, max] of Object.entries(columns)) {
        expected.set(`${table}_${column}_length`, `${column} <= ${max}`);
      }
    }
    expect(Object.fromEntries(lengthConstraints())).toEqual(Object.fromEntries(expected));
  });
});
