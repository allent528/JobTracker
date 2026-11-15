---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**"
---

# UI: pages, components, board, forms

For new screens or visual changes, use the `web-design-engineer` skill and the `frontend-design` plugin; check rendering with `webapp-testing`.

## Conventions
- Components come from shadcn/ui (`npx shadcn@latest add <component>`, or the shadcn MCP). `src/components/ui/` is generated, so restyle via Tailwind theme tokens, not by forking components.
- Server Components by default; add `'use client'` only for interactivity (forms, board drag, charts).
- Forms: react-hook-form + `zodResolver` with the same schema the Server Action uses; show field errors inline and the action's `error` in a toast. Exception: the sign-in form shows action errors inline in a `role="alert"` paragraph, because the code step needs the message beside the code field.
- Board (F3): `@dnd-kit/core`, one droppable per active status, `useOptimistic` for the move with rollback on error (D12). Card order is automatic (D9); no reorder within a column.
- Status labels, colors and order come from `src/lib/status.ts`. Never hard-code a status string in JSX.
- Dates are formatted with `src/lib/dates.ts` helpers in the owner's time zone.
- Charts (F9): shadcn/ui chart components (Recharts).

## Must / must not
- Every page works at 375px width; the board scrolls horizontally on small screens, and the page body never does.
- Keyboard accessible: the board has a non-drag way to change status (a select or menu on each card). WCAG 2.1 AA contrast in light and dark.
- No analytics, tracking pixels, or third-party scripts/embeds.
- Destructive actions (delete application, contact, interview) need a confirm dialog; archive does not.
- `interviews.location` is free text that may hold a video link. Render it as a link only if it matches `^https?://`; otherwise show plain text. (`job_url` and `linkedin_url` are already limited to http(s) by the database.)

## Lessons learned
- Form schemas that transform values (strings to numbers or nulls) use `zodResolver(schema, undefined, { raw: true })` with `useForm<z.input<…>>`, and the submit handler sends those raw values to the Server Action, which parses them with the same schema. The generated `FormField` types assume input and output types match.
- Show action results with `toastResult(result, success?)` from `src/lib/toast-result.ts` (sonner; `<Toaster />` is in the root layout). Status changes go through `useChangeStatus()` in `src/app/(app)/applications/`, so the board reuses the same call and toast.
- Next keeps recently visited routes mounted but hidden, so client state can outlive a navigation (see docs/learnings.md). Client state seeded from server data remounts on a `key` that changes with that data: the edit form keys on `updated_at`, and `StatusControl` keys its inner select on `status`.
- Status changes on the detail page apply on an explicit button, not on the select's `change` event: arrowing through a closed native select fires `change` per option on Windows, which would log a status event each time.
- The pipeline lives at `/applications` (`page.tsx`, `pipeline-board.tsx`, `pipeline-table.tsx`); `?view=table` switches views. `/` is a request-time redirect placeholder for step 7. Ordering, filtering and sorting stay in `src/lib/pipeline.ts`, not in components.
- Board: `MouseSensor` (8px) + `TouchSensor` (250ms long press) so swipes still scroll; no `KeyboardSensor` and no draggable `attributes` (the card's Move menu, a Radix radio menu, is the keyboard path). Links inside a draggable card get `draggable={false}`, or the browser's native link drag takes over. Moves call `useChangeStatus(setOptimistic)` so `useOptimistic` runs inside the action's transition.
- An `overflow-x-auto` container holding absolutely positioned content (including `sr-only` text) needs `relative`, or that content widens the page past 375px.
- A page that only redirects must do it at request time (`connection()` then `redirect()` inside `<Suspense>`); see docs/learnings.md.
