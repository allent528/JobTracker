<!-- Adapted from https://github.com/cursor/plugins (pstack/skills/typescript-best-practices/SKILL.md, pstack 0.15.36), MIT, (c) Cursor. See ../LICENSES.md. Changes: folded in the principle skills it points to, scoped to new code, and mapped to this repo. -->

# TypeScript pass

Apply to `.ts` / `.tsx` lines the change adds or edits. Don't demand rewrites of untouched code; mention an old pattern only when the change copies it.

| Rule | What to check |
|------|---------------|
| Discriminated unions | Variants are modeled with a literal discriminant (`kind`, `status`) so impossible states can't exist. No bags of optional fields that are only valid together. Status fields use the project's single shared union, never a loose `string`. |
| Branded types | Worth it only where two primitives are easy to mix up in this code (cents vs dollars, order id vs user id). A brand comes from a checking function, never from `as`. Don't flag unbranded ids by default. |
| Constructive modeling | Shape the type so the illegal value can't be built (`[T, ...T[]]` for non-empty, `start` + `durationMin` for a range) instead of adding runtime guards everywhere. |
| Simplest total type | Keep `T[]` while every use is total. Strengthen only where the loose type forces `!`, a cast, or a "should never happen" throw. |
| `unknown` over `any` | External data (DB rows not covered by generated types, webhook/push payloads, URL params, local storage) is `unknown` until parsed. `any` is a finding. |
| Boundary validation | Parse where data enters (data-access modules, route params, server/function input) into a named type, then trust the type inside. Prefer types derived from generated DB types (`Tables<'orders'>`, `Pick`, `Omit`) over hand-written interfaces that can drift. |
| No `as` casts | Each `as` needs a reason: after validation, or a library type gap. `as const` and `satisfies` are fine. |
| Narrowing order | Discriminant `switch` > `in` > `typeof`/`instanceof` > a type guard that really checks > `as`. A guard named `isX` must verify the claim. |
| Exhaustiveness | `switch` over a union ends with `const _exhaustive: never = x;` so a new job status or variant fails the build. |
| Object arguments | Functions with 3+ parameters, or two of the same type next to each other, take one object. |
| Money | Amounts are integer cents (one shared money helper module). No floats, no client-side fee math. |
| Real tests | Shared/domain logic gets a unit test that runs the real code; mock only what can't run locally (network, native modules). |
| Logging | No stray `console.log` in app code that ships. Errors go through the app's existing error/copy path. |

Report findings as `file:line`, the rule, the concrete problem, and the smallest fix.
