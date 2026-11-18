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

## Design system (see DESIGN.md)
- Tokens live in `src/app/globals.css`; DESIGN.md documents them. Use the token utilities (`bg-card`, `bg-muted`, `text-muted-foreground`, `border-input`, `bg-warning text-warning-foreground`, `bg-stage-on`) and add a token, with a contrast check in both themes, before reaching for a raw colour.
- Type roles: `text-title` for the page `h1`, `text-heading` for section `h2`s and form legends, `text-figure` for a single headline number; body is `text-base` / `text-sm` / `text-xs`. Counts, dates and table numbers get `tabular-nums`.
- Dark mode follows the OS: `dark:` is a `prefers-color-scheme` media variant and the dark tokens sit in a media query. There is no `.dark` class and no toggle; screenshot dark mode with Playwright's `colorScheme: "dark"`.
- Restyle shadcn primitives through tokens or an unlayered `[data-slot="…"]` rule in `globals.css` (badge radius, overlay motion, focus), never by editing `src/components/ui/*`.
- Panels are `rounded-lg border bg-card`; a list inside a section is one panel with `divide-y` rows. Elevation is the border; only floating things (menus, dialogs, the dragged card) get `shadow-lg`.
- Motion uses the transitions-dev tokens on `:root` (`--duration-quick` 150ms closes and hovers, `--duration-fast` 250ms opens, `--ease-smooth-out` everywhere; Tailwind's default transition is already 150ms on that curve). Write `duration-(--duration-fast)`, not a raw number. Every new animation needs a `prefers-reduced-motion` path that drops movement but keeps fades.
- Focus is one 2px `--ring` outline with a 2px offset, set globally; don't add `focus-visible:ring-*` to new elements.
- `StageRule` (`src/components/stage-rule.tsx`) is the stage indicator; it reads its order from `ACTIVE_STATUSES`.
- Font: Archivo (OFL), self-hosted with `next/font/local` in `src/app/layout.tsx`. Never load fonts, icons or scripts from a CDN, and use no third-party brand assets.

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
- The pipeline lives at `/applications` (`page.tsx`, `pipeline-board.tsx`, `pipeline-table.tsx`). `?view=table` switches views. Ordering, filtering and sorting stay in `src/lib/pipeline.ts`, not in components.
- `/` is the reminders home page (F8). `page.tsx` buckets with `bucketReminders()` from `src/lib/reminders.ts` and renders each bucket as a `<section aria-labelledby>` region. Bucket labels and empty copy live in one record in `page.tsx`.
- Put a real space between a heading's text and an inline count span. Without it the accessible name runs together ("Today(2)").
- `/stats` (F9) is `stats/page.tsx`. Each section is a `<section aria-labelledby>` region, and each section's numbers are in a table (or text). The one chart (`weekly-chart.tsx`, shadcn `ChartContainer` + Recharts) has `role="img"` with a summary `aria-label`, a visible text total and a "Show as table" `<details>` table. The archived toggle is a checkbox that replaces the URL (`?archived=1`).
- Stats marks take their colour from `STATS_MARK_COLOR` in `stats/chart-color.ts`, which is `var(--chart-2)`: dark slate in light mode, light slate in dark, ≥9:1 against the card in both.
- The `(app)` layout has the main nav (Reminders, Applications, Stats, Settings; it wraps to a second row below `sm`) and renders `<TimeZoneDetector />` only while `profiles.time_zone` is null. A failed profile read there skips detection rather than breaking the shell. `/settings` edits the zone.
- "Mark done" on a follow-up opens a Dialog (`follow-up-done.tsx`) prefilled with the date 7 days out and the current note. A blank date clears the follow-up and its note.
- The signed-in shell is `max-w-7xl`. Pages that read better narrower cap themselves and centre (`mx-auto w-full`): the detail and stats pages at `max-w-5xl`, home, settings and the forms at `max-w-3xl`.
- The main nav (`(app)/main-nav.tsx`) marks the current section with `aria-current="page"`. It reads `usePathname()`, so the layout renders it inside `<Suspense>` with the plain links as the fallback (Cache Components needs that on dynamic routes).
- `cn` only resolves conflicts between utilities it knows. A custom size role (`text-heading`) passed to a component that already sets `text-sm` (such as `FormLabel`) can be dropped; put the role on an inner `<span>`.
- The board uses `MouseSensor` (8px) and `TouchSensor` (250ms long press), so a swipe still scrolls. It has no `KeyboardSensor` and spreads no draggable `attributes`.
- The keyboard path on the board is each card's Move menu, a Radix radio menu.
- Links inside a draggable card get `draggable={false}`. Otherwise the browser's native link drag takes over.
- Board moves call `useChangeStatus(setOptimistic)`, so the `useOptimistic` setter runs inside the action's transition.
- Client code that awaits a Server Action inside a transition catches rejections and toasts `UNREACHABLE_ERROR`. An uncaught rejection goes to `src/app/(app)/error.tsx`.
- Follow-up dates show `<FollowUpBadge state={followUpState(date, today)} />` from `src/components/follow-up-badge.tsx`.
- An `overflow-x-auto` container that holds absolutely positioned content (including `sr-only` text) needs `relative`. Otherwise that content widens the page past 375px.
- A page that only redirects must do it at request time: `connection()`, then `redirect()`, inside `<Suspense>`. See docs/learnings.md.
- Detail sections (notes, contacts, interviews) are server components in `[id]/sections.tsx` with client islands (`notes.tsx`, `contacts.tsx`, `interviews.tsx`). Shared pieces are in `src/components/section-ui.tsx` (also used by the home and settings pages): `useSectionAction()` (transition + try/catch + toast), `useSectionForm(schema, { defaultValues, action, success, onDone? })`, generic `TextField` / `TextAreaField` / `SelectField`, `FormButtons`, and `EditableRow` (Edit plus a confirmed Delete). Items take `row`, `label` and server-rendered `children`.
- Each list item is keyed `${id}:${updated_at}`, so a saved inline edit remounts it in view mode with fresh values. Add forms clear by bumping a `key`.
- A form that holds ids of other rows (the interview's picked contacts) keeps only the current ones when it submits: a row can be deleted elsewhere on the page while the form is open.
- Repeated row buttons get distinct accessible names (`Edit note added <time>`, `Delete contact Jane Doe`), not a bare "Edit".
- Notes render as plain text (`whitespace-pre-wrap`); Markdown is stored as typed, never rendered as HTML.
