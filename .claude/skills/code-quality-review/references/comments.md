<!-- Adapted from https://github.com/cursor/plugins (pstack/agents/comment-sicko.md and pstack/skills/no-comments/SKILL.md, pstack 0.15.36), MIT, (c) Cursor. See ../LICENSES.md. Changes: no persona, no dependency on pstack's /how, /why or /architect, and keep-rules for this repo. -->

# Comments pass

Review every comment the change adds or edits. Default: the comment goes. A comment survives only under a keep rule below. When you are not sure a keep rule applies, it goes.

## Keep rules (the only ones)

1. Legal or license headers.
2. Non-obvious behavior forced by something we cannot reshape: the framework or platform, the database, a payment provider, a vendor API or protocol. Surprises in **our own** code are not a reason to keep a comment: flag the symbol `MUST RESHAPE` (rename, extract, type, or restructure so the behavior is obvious without prose).
3. `// prettier-ignore`. Lint or TypeScript suppressions stay only when the rule is wrong, pedantic or style-only for that line.
4. Doc comments that define a public contract: exported functions in shared packages/libraries, and SQL functions the apps call.
5. Issue, RFC or docs links that explain a constraint the code cannot express.
6. In a **new** migration, one short comment per access policy or privileged function naming the access rule it enforces (for example "a member sees the invoice only once it's issued"). The security-reviewer agent reads those. Long justifications still go.

## Kill on sight

- Narration of what the next line does, section banners, commented-out code, "TODO" without an owner or issue, changelog-style notes ("added X for Y").
- `IMPORTANT`, `do not remove`, `too risky`, `fine for now`, long justifications. Read the nearby code first. If the claim is not obvious from code, check it (read the callers, the PRD, the rule file). Only a keep-rule-2 gotcha that is true today survives. Otherwise the comment goes and the symbol gets `MUST RESHAPE`.
- `@ts-ignore`, `@ts-expect-error`, `eslint-disable`: look up why it is there. If the rule protects correctness or safety, the suppression goes and the code it hides is flagged `MUST RESHAPE`.

## Constraint comments

"do not remove", "do not change wording", "talk to X first": offer the cheapest enforcement instead (a type, a runtime check, a unit test, a live access-control check, a check script in `scripts/`). Encode it only if the caller approved encodings up front; otherwise delete the comment and report the constraint as open.

## Never touch

- Applied migrations (any migration file that already exists on `main`). They are immutable; their comments stay.
- Generated files: generated types, lockfiles.
- Comments outside the change's scope.

## Report

Files touched, number of comments to delete (with `file:line`), `MUST RESHAPE` flags with one line each, encoding offers, and skipped items with the keep rule that saved them. Report only; the coordinator applies edits.
