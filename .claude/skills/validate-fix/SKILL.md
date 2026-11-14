---
name: validate-fix
description: The standard workflow for a bug fix or a small feature change with a clear before and after. Takes the error report, reproduces it with a failing check plus "before" screenshots, fixes it on a branch, proves the fix with the same check and "after" evidence, runs the quality gates, opens a PR with the evidence, then merges it (small fixes) or asks the owner to review (larger or risky changes). Use when given a bug report, an error-tracker issue, a crash, or "fix X and show me it works".
---

# Validate a fix

The goal is a PR that proves itself: a check that failed before and passes after, plus before/after screenshots for screen bugs. Follow the steps in order. Don't skip the reproduction because the fix "looks obvious".

## 0. Intake

Collect, from the report and by looking, and write it at the top of your notes (it becomes the PR's "Problem" section):
- What the user saw, and what they expected. Which app, which screen, which account role.
- The error itself: message, stack, error-tracker link, app version, device, time.
- The data involved: ids and states only, no personal data in notes.
- Steps to reproduce, if known.

Then read `.claude/CLAUDE.md`, the `.claude/rules/` files for the area, `docs/learnings.md` (has this bitten before?), and the PRD section for the feature. A fix must not change product behavior the PRD defines; if the "bug" is really a PRD gap, stop and ask the owner.

## 1. Reproduce

**Production is read-only** for this workflow. Read the error, logs and the involved rows' *shape* with read-only queries. Never copy personal data into dev, fixtures, notes, screenshots or PRs. Recreate the case in dev/staging with made-up details and the same shape. If dev data is shared with someone testing live, ask before running anything that writes.

**Make it fail, in code, before touching the fix.** Pick the cheapest check that fails for the reported reason:

| Bug lives in | Failing check |
|--------------|---------------|
| Pure logic | a unit test next to the module |
| A database rule (access policy, RPC, trigger) | a new case in the live access-control check (and the `db-migration` skill for the fix) |
| A screen or flow | a browser/preview script that waits for the correct text and times out today |

Run it and confirm it fails **for the reported reason** (read the failure, don't just see red). If you can't reproduce, stop and report what you tried; don't guess-fix.

**Before evidence.** On `main`, run the flow that shows the bug and save screenshots in the session's temp directory. Open them with Read and confirm they show the bug. A logic-only bug needs no screenshots; the failing test output is the evidence.

## 2. Fix

- Branch: `fix/<short-slug>` (or `feat/<slug>` for a small feature). In a background or cloud session, work in your worktree, never on `main`.
- Smallest fix at the root cause. No symptom guards (a `?? 0` or try/catch that hides the bad value). If the root cause is out of scope, fix what's in scope and list the rest as a follow-up.
- Follow the non-negotiable rules in `.claude/CLAUDE.md`.
- Database change: follow the `db-migration` skill fully, including asking the owner before applying. That alone makes the change "large" (step 5).
- Keep the failing check from step 1 in the PR. It's the regression test.

## 3. Verify

Run all of these; record each result for the PR:
1. The step-1 check now passes.
2. Typecheck and tests (commands in `.claude/CLAUDE.md`).
3. The same flow with "after" screenshots. Open them and compare with "before".
4. The **verification** agent. For database, payments, auth, location, addresses, photos or personal data, also the **security-reviewer** agent.
5. The `code-quality-review` skill in fix mode on the branch. Re-run 2 if it changed code.

## 4. Open the PR

Push the branch and open the PR (`gh` must be installed and authenticated; if it isn't, stop with `needs input:`). Keep evidence images out of `main` (upload them to the PR or a separate evidence branch). PR body:
```markdown
## Problem
<what the user saw, expected behavior, error/issue link>
## Root cause
<one or two sentences, file:line>
## Fix
<what changed and why it's the root cause>
## Proof
- Failing check: `<test name or flow>` failed before, passes after
- typecheck / tests / verification / code-quality-review: <results>
<before / after screenshots>
## Not run
<checks skipped and why>
## Size
<small | large>, reason: <rule from step 5>
```
End the body with the attribution line from the session's instructions.

## 5. Merge or ask

**Small: merge without the owner** only if every one of these holds:
- At most about 150 changed lines (excluding the new test, generated files and evidence) and at most 6 files.
- Nothing under migrations, `.github/**`, `.claude/**`, `scripts/check-*`, build/deploy config, `package.json` or lockfiles.
- Doesn't touch auth, privacy, or status history. For JobTracker that means none of: `supabase/**`, `src/proxy.ts`, `src/lib/supabase/**`, `src/app/(auth)/**`, `src/app/auth/**`, `src/lib/status.ts`, `src/types/database.types.ts`, `next.config.*`, `.env.example`, and no change to what personal data (contacts, salaries, notes) is shown, logged or sent anywhere.
- No new screen, route or dependency, and no change to PRD-defined behavior or product copy beyond a clear typo.
- CI green; verification PASS; code-quality-review has no open Must-fix; failing-then-passing check attached.

Then: `gh pr checks <n> --watch`, and when green `gh pr merge <n> --squash --delete-branch`. Add the `docs/progress.md` and `docs/learnings.md` entries in the PR itself before merging.

**Large: everything else.** Mark the PR ready, add the label `needs-owner-review` (create it once if missing), and finish with `needs input:` naming the PR and the one decision needed. Don't merge.

When in doubt, it's large.

## 6. Report

End with the PR link, small/large and why, merged or waiting, the checks run with results, and anything under "Not run".
