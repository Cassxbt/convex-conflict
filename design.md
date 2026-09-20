# Design — Conflict Clear

A locked design system for this app. Every view reads this file before emitting code. Extend or amend this file when the system needs to grow; do not regenerate per page.

## Genre
modern-minimal. An operational console for a law firm's intake desk: calm, precise, instrument-panel. Function carries every page. No hero, no enrichment, no marketing rhythm.

## Macrostructure family
- App pages (Intake, Partner review, Matter history, Record): Workbench. Small functional headings, hairline-structured surfaces, the content is the product. Variation lives in the composition of panels, never in theme.
- The one dark beat per page: a graphite readout band. On Record it is the verdict card; on Intake it is the live queue strip; on Review it is the case under review.

## Theme
Custom, tuned from the Cobalt register. Cool engineered paper, cool charcoal ink, one cobalt signal. The three verdict colours are semantic tokens, not decoration, and are the only other chroma on the page.

- `--color-paper`     oklch(98.5% 0.004 250)
- `--color-paper-2`   oklch(96.5% 0.005 250)
- `--color-rule`      oklch(90% 0.008 250)
- `--color-rule-2`    oklch(84% 0.010 250)
- `--color-neutral`   oklch(56% 0.014 255)
- `--color-ink-2`     oklch(34% 0.018 257)
- `--color-ink`       oklch(24% 0.02 258)
- `--color-accent`    oklch(58% 0.20 256)
- `--color-accent-ink` oklch(98% 0.01 256)
- `--color-focus`     oklch(58% 0.20 256)
- `--color-graphite`  oklch(22% 0.016 260)
- `--color-graphite-2` oklch(27% 0.016 260)
- `--color-graphite-ink` oklch(94% 0.008 250)
- `--color-clear`     oklch(60% 0.15 155)
- `--color-conflict`  oklch(56% 0.19 25)
- `--color-review`    oklch(70% 0.16 75)

Dark mode keeps the hue; only lightness and chroma move.

## Typography
- Display: Inter Tight, weight 600, style normal, tracking -0.02em
- Body: Inter, weight 400/500
- Mono: JetBrains Mono, weight 400/500. Company numbers, matter refs, timestamps, message ids, and UPPERCASE 0.06em meta labels.
- Scale anchor: `--text-display` = clamp(1.5rem, 1.2rem + 1.2vw, 2rem). Headings are small; this is a console.

## Spacing
4-point named scale in `tokens.css`. Views use named tokens only.

## Motion
- Easings: `--ease-out` cubic-bezier(0.23, 1, 0.32, 1); `--ease-in-out` cubic-bezier(0.77, 0, 0.175, 1).
- Reveal pattern: none. Pages are composed.
- Realtime inserts (a new board row, a new party on a record): fade + 6px rise once, 200ms ease-out, so live data does not pop.
- Stage bar: width transition 300ms ease-out.
- Pressables: transform scale(0.97) on :active, 120ms.
- Keyboard-initiated actions (⌘K open/close, navigation): no animation.
- Reduced motion: opacity only, ≤150ms.

## Microinteractions stance
- Silent success. The only toast is "Review recorded" via sonner, 2s, bottom-right, no icon flourish.
- Hover tooltips delay 800ms; focus tooltips 0ms.
- Focus rings instant, 2px accent, offset 2px, never animated.
- Every pressable ships all 8 states.

## CTA voice
- Primary: solid accent fill, 6px radius, 500 weight, names the action ("Run conflict screen", "Confirm hold").
- Secondary: hairline outline, ink text, same radius.
- Never pills, never gradients.

## Icons
lucide-react, 16px in text, 18px in nav, stroke 1.75. One icon per control at most; never an icon without a label except in the ⌘K trigger.

## Per-page allowances
- App pages MUST NOT use enrichment.
- Each page gets exactly one graphite band.

## What pages MUST share
- Wordmark "Conflict Clear" with the firm name as a mono meta label.
- The accent colour and its placement (< 5% per viewport).
- Inter Tight / Inter / JetBrains Mono roles.
- The bordered nav with the working ⌘K palette.
- Verdict badge component and its three semantic colours.

## What pages MAY differ on
- Panel composition within Workbench (two-column intake, single-column queue, dossier layout on Record).
- Which content sits in the graphite band.
