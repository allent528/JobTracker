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
- Forms: react-hook-form + `zodResolver` with the same schema the Server Action uses; show field errors inline and the action's `error` in a toast.
- Board (F3): `@dnd-kit/core`, one droppable per active status, `useOptimistic` for the move with rollback on error (D12). Card order is automatic (D9); no reorder within a column.
- Status labels, colors and order come from `src/lib/status.ts`. Never hard-code a status string in JSX.
- Dates are formatted with `src/lib/dates.ts` helpers in the owner's time zone.
- Charts (F9): shadcn/ui chart components (Recharts).

## Must / must not
- Every page works at 375px width; the board scrolls horizontally on small screens, and the page body never does.
- Keyboard accessible: the board has a non-drag way to change status (a select or menu on each card). WCAG 2.1 AA contrast in light and dark.
- No analytics, tracking pixels, or third-party scripts/embeds.
- Destructive actions (delete application, contact, interview) need a confirm dialog; archive does not.

## Lessons learned
- (none yet)
