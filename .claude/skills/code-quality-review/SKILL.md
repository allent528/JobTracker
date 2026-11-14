---
name: code-quality-review
description: Debloat-and-quality review of a PR or branch in this repo. Runs up to five passes in parallel (ponytail review for correctness and lean code, comments, TypeScript rules, unslop for prose, and the thermo-nuclear structure review on large changes), verifies every finding, then reports or applies the fixes. Use on every PR before merge, from the validate-fix skill, or when asked to "debloat", "clean up", "quality review" or "thermonuclear review" a change.
---

# Code quality review

One coordinated review built from vendored upstream checklists (MIT, see `LICENSES.md`):

| Pass | Reference | Looks for | Subagent model |
|------|-----------|-----------|----------------|
| Ponytail | `references/ponytail-review.md` | bugs, security, scale, missing tests, speed, code that shouldn't exist | `opus` |
| Comments | `references/comments.md` | narration, stale or defensive comments, suppressions | `sonnet` |
| TypeScript | `references/typescript.md` | `any`, casts, loose unions, boundary parsing, money in cents | `sonnet` |
| Unslop | `references/unslop.md` | AI tells in PR text, docs, comments and new product-copy strings | `sonnet` |
| Thermo-nuclear | `references/thermo-nuclear.md` | structure: code-judo simplifications, special-case branches piling up, files past 1k lines, wrong layer | `opus` |

It complements, not replaces: the `verification` agent (does it meet the PRD, do the checks pass), the `security-reviewer` agent (database, money, privacy) and `/code-review` (bug hunt).

## 1. Scope

- Arguments: a PR number, a branch, or file paths. Default: the current branch against `main` (`git diff main...HEAD` plus uncommitted changes).
- For a PR number: `gh pr diff <n>` and `gh pr view <n> --json title,body,headRefName`. If `gh` is missing, say so and use the local branch.
- Count changed lines, excluding lockfiles, generated files (e.g. generated database types), images and design assets.

## 2. Pick the passes

| Change size | Passes |
|-------------|--------|
| Under 50 changed lines | Ponytail only, plus Comments if it adds comments |
| 50 to 300 lines | Ponytail, Comments, TypeScript (if `.ts`/`.tsx` changed), Unslop (if PR text, docs, comments or product copy changed) |
| Over 300 lines, over 8 files, a new module/package, or the caller asks for "thermo" | All five |

## 3. Run the passes in parallel

Start one Agent per pass in a single message (`subagent_type: "general-purpose"`, the model from the table). Each prompt contains:
- the scope (diff command or PR number) and the list of changed files,
- "Read `.claude/skills/code-quality-review/references/<file>` and follow it. Also read `.claude/CLAUDE.md` and the `.claude/rules/` files for the changed areas; where they conflict with the reference, the repo rules win.",
- the guardrails below,
- "Report only. Don't edit files. For each finding give `file:line`, the concrete case (this input or situation gives this wrong result), and the smallest fix."

### Guardrails for every pass (repo rules win over upstream advice)

- Never suggest editing an applied migration (any migration file already on `main`). A fix to the database is a new migration (via the `db-migration` skill if the project has one).
- Don't touch generated files (generated types, lockfiles).
- Centralized product copy (e.g. a `copy.ts` / i18n file) holds the owner's product words: Unslop flags new strings but doesn't rewrite them. PR text, docs and code comments it may rewrite.
- If the project centralizes look and words (theme tokens, a UI package, a copy file), never propose hardcoded colors, sizes or strings.
- Don't propose new dependencies when the platform, framework or an existing helper already does it (name the existing path).
- Structural rewrites beyond the change's own files are follow-ups, not blockers, unless the change made the structure worse.

## 4. Consolidate (you, not a subagent)

1. Merge duplicates across passes; keep the clearest wording.
2. Check each finding yourself: open the lines, confirm the caller exists, the value can be empty, the code is unused. Drop anything without a concrete case, and drop style taste.
3. Group as **Must fix** (bug, security, privacy, money, data loss), **Should fix** (missing test for risky logic, dead or duplicate code, `any`/casts, structure the change made worse, slop in PR text/docs), **Nice to have**. Number across groups.

## 5. Fix or report

- **Fix mode** (default when called from `validate-fix`, or when run on your own branch): apply Must and Should fixes that stay inside the change's files and don't change behavior. Then rerun `npm run typecheck` and `npm test`; if a fix breaks something, revert that fix and report it. Leave Nice-to-have and cross-cutting structure items as a list in the PR body under "Follow-ups".
- **Report mode** (someone else's PR, or `--report`): change nothing. With `--comment` and `gh` available, post the report as one PR comment (`gh pr comment <n> --body-file <file>`).

## 6. Output

```
Code quality: <passes run> on <N> changed lines
Must fix: <n>  Should fix: <n>  Nice: <n>  Lean: -<lines> possible
1. **<title>** (`file:line`) <problem in one sentence>. Fix: <smallest fix>.
...
Applied: <numbers fixed, or "none (report mode)">
Verdict: Ship | fix <numbers> first
```

Updating the vendored references: re-download the upstream file, keep the attribution line at the top, and note the version in that line.
