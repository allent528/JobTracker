# Learnings

<!-- Append when you hit a bug, a wrong assumption, or a non-obvious fix.

## YYYY-MM-DD: <short title>
- **Mistake:** what went wrong
- **Root cause:** why
- **Fix:** what changed
- **Lesson:** the rule for next time (and update the matching .claude/rules/ file)
-->

## 2026-11-14: shadcn init adds a `cn` package, not clsx + tailwind-merge
- **Mistake:** Expected `src/lib/utils.ts` to define `cn` with clsx + tailwind-merge; it re-exports from an npm package named `cn`, which looked like a possible typosquat.
- **Root cause:** Current shadcn CLI uses its own compiled class merger (`cn`, repo `shadcn-ui/cn`, maintainer shadcn).
- **Fix:** Verified the package's repo and maintainer with `npm view`; kept it.
- **Lesson:** Check unfamiliar deps a generator adds (`npm view <pkg> repository.url maintainers`) before accepting them.
