import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { INTERVIEW_KINDS, INTERVIEW_OUTCOMES, WORK_MODES } from "./closed-sets";
import { STATUSES } from "./status";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * Reads every `constraint <name> check (<column> in ('a', 'b', ...))` from the migrations, in
 * order, so a later migration that re-adds a constraint replaces the earlier definition.
 */
function closedSetConstraints(): Map<string, string[]> {
  const constraints = new Map<string, string[]>();
  const pattern = /constraint\s+(\w+)\s+check\s*\(\s*\w+\s+in\s*\(([^)]*)\)\s*\)/gi;
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const [, name, list] of sql.matchAll(pattern)) {
      constraints.set(name, [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]));
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
