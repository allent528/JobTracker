# JobTracker design system

The visual rules for every screen. The tokens live in `src/app/globals.css`; this file explains them. `.claude/rules/ui.md` says how to apply them when building UI.

## Direction

Restrained, high-contrast, engineering-precise. JobTracker is a working tool the owner checks at a desk during the day and on a phone in the evening, so the interface stays quiet and lets the data lead:

- neutral greys with a faint cool cast, near-black ink on off-white (light) and near-white on graphite (dark);
- one sans family with a short, fixed type scale;
- tight 4px spacing, small radii (sharp, never zero), hairline borders, no decorative shadows;
- colour only where it means something: overdue (red), due today (amber), destructive actions (red);
- quiet motion that explains a change of state and never makes you wait.

The one signature element is the **stage rule**: a thin segmented bar along the active stages (Saved → Offer), filled up to the current stage. It heads each board column and sits beside the status on the application page.

## Colour

All colours are OKLCH. Neutrals use hue 255 with chroma at or below 0.009. Light and dark are both designed (surfaces get lighter as they rise in dark mode), not inverted.

Dark mode follows the OS (`prefers-color-scheme`). The `dark:` Tailwind variant is a media query (`@custom-variant dark` in `globals.css`), so shadcn's `dark:` classes follow the OS too. There is no in-app toggle.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--background` | 0.976 0.002 255 | 0.16 0.004 255 | page canvas |
| `--card`, `--popover` | white | 0.2 / 0.225 | panels, menus, dialogs |
| `--foreground` | 0.18 0.006 255 | 0.965 0.002 255 | text, ink |
| `--muted` | 0.952 | 0.235 | board columns, inset areas |
| `--muted-foreground` | 0.47 0.009 255 | 0.72 0.008 255 | secondary text |
| `--secondary`, `--accent` | 0.935 | 0.28 | active status badge fill, hover fill |
| `--primary` | ink | near-white | primary button |
| `--border` | 0.885 | 0.31 | hairlines, panel edges (decorative) |
| `--input` | 0.62 | 0.55 | form control edges (≥3:1) |
| `--ring` | ink | near-white | focus outline |
| `--destructive` | 0.53 0.2 27 | 0.7 0.17 25 | delete, errors, overdue |
| `--warning` / `--warning-foreground` | amber fill / dark text | dark amber / light text | "Due today" |
| `--stage-on` / `--stage-off` | ink / 0.83 | near-white / 0.38 | stage rule segments |
| `--chart-2` | 0.36 0.012 255 | 0.8 0.012 255 | the single stats mark colour (`STATS_MARK_COLOR`) |

Measured contrast (WCAG 2.1): body text 17–19:1 in both themes; muted text 5.6–7.8:1 on every surface it sits on; input edges 3.4–4.0:1; focus outline ≥3:1; destructive text 5.5–6.7:1; white on destructive fills ≥5.8:1; amber badge 8.9–11:1; chart marks ≥9.7:1. The stage rule's empty segments are decorative (the status is always written beside them), so they sit below 3:1 on purpose.

Browser surfaces are themed too: `color-scheme` (native date pickers and selects match the theme), `accent-color`, `::selection` (ink on canvas), and `scrollbar-color`.

## Typography

**Archivo** (SIL Open Font License 1.1, by Omnibus-Type), self-hosted through `next/font/local` from `src/app/fonts/archivo-latin-wght-normal.woff2`, licence in `src/app/fonts/Archivo-OFL.txt`. One variable file (Latin subset, weights 100–900, 35 KB). Nothing loads from a third party at runtime or at build time. Characters outside the Latin subset fall back to the system sans per glyph.

Product UI scale, fixed rem (no fluid type):

| Role | Utility | Size / line height | Weight | Tracking | Used for |
| --- | --- | --- | --- | --- | --- |
| Title | `text-title` | 28 / 34px | 600 | -0.022em | page `h1` |
| Heading | `text-heading` | 18 / 24px | 600 | -0.012em | section `h2`, form legends |
| Figure | `text-figure` | 40px / 1 | 500 | -0.03em | a single headline number (response rate) |
| Body | `text-base` | 16px | 400 | 0 | content |
| Small | `text-sm` | 14px | 400–500 | 0 | labels, metadata, tables |
| Micro | `text-xs` | 12px | 500 | 0.01em on badges | badges, card metadata |

Numbers in tables, counts and dates use `tabular-nums`. Headings use `text-wrap: balance`, paragraphs `pretty`. No uppercase labels, no eyebrows or kickers above headings.

## Spacing, radii, elevation

- Spacing: Tailwind's 4px step. Panels pad 16px (20–24px from `sm`). Page sections are 32–40px apart; items inside a section 12px.
- Radii: `--radius` is 4px. `rounded-sm` 2px (badges), `rounded-md` 3px (controls), `rounded-lg` 4px (panels, dialogs), `rounded-xl` 6px (the login card).
- Elevation is declared once: panels use a 1px border and no shadow; things that float (menus, dialogs, a dragged card) get `shadow-lg`. `shadow-xs` is flat, so shadcn controls carry no drop shadow.
- Lists inside a section are one bordered panel with `divide-y` rows (reminders, details, notes, history), not a stack of separate cards.

## Motion

Tokens from the transitions-dev scale, defined on `:root`:

| Token | Value | Use here |
| --- | --- | --- |
| `--duration-stagger` | 40ms | stage rule segments fill one after another |
| `--duration-quick` | 150ms | dialog and menu close; hover and colour changes (Tailwind's default transition) |
| `--duration-fast` | 250ms | dialog and menu open, nav indicator, stage rule fill, dropped board card settling |
| `--ease-smooth-out` | cubic-bezier(0.22, 1, 0.36, 1) | every transition (also `ease-smooth-out` utility and Tailwind's default easing) |
| `--scale-large` | 0.96 | dialogs scale from this on open and to it on close |
| `--scale-medium` / `--scale-tiny` | 0.97 / 0.99 | menus open from / close to (from the trigger, no slide) |

Opens are slower than closes. Toasts keep sonner's timing on `--ease-smooth-out`. The dragged board card tilts 1° and settles back on drop in 250ms.

`prefers-reduced-motion: reduce` keeps fades and colour changes (they carry state) and removes scale, tilt, stagger and the drop animation.

Overlays get their motion from `globals.css` rules on shadcn's `data-slot` attributes (`dialog-content`, `dropdown-menu-content`, …), which set tw-animate-css's variables. The components themselves are unchanged.

## Focus

One treatment everywhere: a 2px outline in `--ring`, offset 2px. It replaces shadcn's translucent 3px ring, which vanished against the black primary button. Menu items show focus with their highlight fill instead.

## Do

- Use the tokens and role utilities (`bg-card`, `text-muted-foreground`, `text-title`, `text-heading`, `border-input`, `bg-warning`). Add a token before adding a raw colour.
- Restyle shadcn primitives through tokens or a `data-slot` rule in `globals.css`, never by editing `src/components/ui/*`.
- Keep colour for meaning. A new state colour gets a token pair and a contrast check in both themes.
- Check new screens at 375px and 1280px in light and dark.

## Don't

- Don't use third-party brand assets: no other company's fonts, icons, logos, marques, brand colours or copied components. Everything here is original or openly licensed (Archivo under OFL; icons from lucide, ISC).
- Don't add analytics, tracking or third-party embeds, and don't load fonts or scripts from a CDN.
- No gradients, glass, glow, hard offset shadows, coloured side borders, pill-shaped panels or decorative illustration.
- No uppercase micro-labels or eyebrows above headings.
- No page-load choreography or bouncy easing; motion explains a change and stays under 300ms.
