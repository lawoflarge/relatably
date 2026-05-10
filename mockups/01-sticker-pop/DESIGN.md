# Relatably · Sticker Pop — DESIGN.md

## 1. Direction in one sentence

Y2K-maximalist sticker-shadow UI: cream paper, candy pastels, chunky display type, every interactive surface peeled off a sticker sheet.

## 2. Mood board references

- **Duolingo (post-2022 mascot redesign)** — chunky 2D shapes, hard color blocks, friendly anti-skeuomorphic energy. Steal: confidence to use one giant primary color per screen without apologizing.
- **Imprint (the learning app)** — sticker shadows on cream paper, chunky icon system, editorial cadence under a playful skin. Steal: the cream paper as a real surface, not a "background."
- **Cash App (early-2020s)** — bold green, money-themed chunky type, big primary CTA. Steal: a single accent that does 80% of the visual lifting (here: hot pink instead of green).
- **Snapchat camera UI** — bright icon stickers, peeling-corner detail, gestural feel. Steal: the peel-corner clip-path on the input field.
- **MSCHF product drops** — playful brutalism, hard ink borders, absurd confidence. Steal: 3px ink borders on everything + hard offset shadows.
- **Polymarket Sport** — pop-art treatment of prediction markets, big colored chips. Steal: a clustered, colored "verdict" surface that feels alive.
- **21st.dev / Vercel `Button` (id similarity 0.397, "Rounded" demo)** — `shadow` prop pattern (hard offset, no blur). Steal: the discipline of one shadow token applied consistently.
- **21st.dev / `First Place Leaderboard` (id similarity 0.068)** — crown indicator and rank badge as overlapping sticker. Steal: rank badge anchored to the corner of the row, not embedded inside it.
- **21st.dev / `Word cloud` (visx `Wordcloud`)** — `scaleLog` font sizing from min/max count. Steal: the log-mapped size buckets (we use xl / l / m / s / xs).
- **21st.dev / `Animated Tab Bar` (id similarity 0.147) + `Bottom menu` (similarity 1.232)** — active-pill indicator on bottom nav. Steal: a single active tab grows + inverts color rather than a sliding glow.

## 3. Brand attributes

**Owns:** chunky · friendly · candy · handmade · loud-but-warm.
**Rejects:** sleek · luxe · monochrome · enterprise.

## 4. Color palette

Light-only direction. Cream paper canvas with hard ink type and candy accents.

| Hex       | Name                | Role                                                       |
|-----------|---------------------|------------------------------------------------------------|
| `#FFF7E8` | Cream Paper         | Primary background — every screen                          |
| `#FBEED1` | Cream Paper 2       | Optional secondary surface (unused at v1, reserved)        |
| `#1A1A1A` | Ink                 | Primary text + every sticker border + active tab fill      |
| `#4A4541` | Ink Soft            | Secondary text (counters, labels, sub-copy)                |
| `#FF4FA3` | Hot Pink            | **Primary accent** — submit CTA, self-cluster, self-row    |
| `#FFD43B` | Lemon 2             | **Secondary accent / called-it win** — crown sticker, YOU tab, peel corner |
| `#FFDF6B` | Lemon               | Soft lemon variant for timer pill, lemon row tints         |
| `#7AE6C3` | Mint                | Tertiary accent — wordcloud bubbles, share button          |
| `#7BC8F6` | Baby Blue           | Tertiary accent — wordcloud bubbles, scope-active pill     |
| `#FF5A4F` | Warm Red            | Error / destructive (not used in current screens; reserved)|

**Contrast (WCAG):**
- Ink `#1A1A1A` on Cream `#FFF7E8` → 16.1:1 (AAA)
- Cream `#FFF7E8` on Hot Pink `#FF4FA3` → 3.3:1 (AA for ≥18pt; submit/self labels qualify)
- Ink on Lemon 2 `#FFD43B` → 13.4:1 (AAA)

## 5. Typography

All fonts loaded via Google Fonts `<link>`.

- **Display — `Bagel Fat One`**
  URL: `https://fonts.googleapis.com/css2?family=Bagel+Fat+One&display=swap`
  Specimen weights: 400 (it ships single-weight; chunky-by-design).
  Use: the question, screen titles, verdicts, scores, submit-button label, brand wordmark.
  Fallback: `system-ui, sans-serif`.

- **Body — `Hanken Grotesk`** (500 / 700 / 800)
  URL: `https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@500;700;800&display=swap`
  Use: input text, leaderboard handles, archive question copy, "YOU" tab, CTA pills.
  Fallback: `system-ui, sans-serif`.

- **Label / mono — `Space Grotesk`** (500 / 600 / 700)
  URL: `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap`
  Use: small UPPERCASE labels — date pill, countries strip, streak label, "SPONSORED", tab labels. Letter-spacing 0.10–0.18em.
  Fallback: `ui-monospace, monospace`.

## 6. Type scale

| Token   | px / line-height | Used for                              |
|---------|------------------|---------------------------------------|
| hero    | 52 / 50          | Question on screen 1                  |
| h1      | 40 / 38          | Archive title                         |
| h2      | 36 / 34          | Leaderboard title                     |
| h3      | 22 / 22          | Wordcloud title, submit label         |
| body-l  | 17 / 24          | Input text                            |
| body    | 15 / 20          | Leaderboard handle                    |
| body-s  | 13 / 18          | Share button, archive question copy (10.5) |
| label   | 11 / 14          | Date pill, scope pill, tab label      |
| micro   | 9–10 / 12        | Streak label, ad label, archive count |

## 7. Spacing scale

Base unit 4px. Tokens: `--sp-1 4`, `--sp-2 8`, `--sp-3 12`, `--sp-4 16`, `--sp-5 24`, `--sp-6 32`, `--sp-7 48`, `--sp-8 64`.
**Screen-edge gutter:** 22px (left/right inside the phone frame).
**Section gap:** 24px between major blocks.

## 8. Radii

| Token       | Value  | Use                                              |
|-------------|--------|--------------------------------------------------|
| `--sp-r-s`  | 14px   | Date pill, small stickers                        |
| `--sp-r-m`  | 22px   | Input, leaderboard row, archive tile, wc bubble  |
| `--sp-r-l`  | 28px   | Submit button, large wc bubbles                  |
| `--sp-r-xl` | 36px   | Reserved for full-screen sheets                  |
| `--sp-r-pill` | 999px | Toggles, scope pills, tab bar, share button     |

No 0-radius rectangles. No fully-rounded "blob" radii > 36px (avoid bouncy-castle look).

## 9. Elevation / shadow

All shadows are HARD OFFSET, blur = 0. The shadow color is always `--sp-ink` (`#1A1A1A`).

| Token         | Spec                          | Use                                  |
|---------------|-------------------------------|--------------------------------------|
| `--sp-shadow-s` | `2px 2px 0 #1A1A1A`         | Small pills, ar-tile, secondary chips |
| `--sp-shadow-m` | `4px 4px 0 #1A1A1A`         | Default sticker: input, row, bubble  |
| `--sp-shadow-l` | `6px 6px 0 #1A1A1A`         | Primary CTA, hero self-cluster       |

No `rgba` shadows. No drop-shadow blur. The shadow is the brand.

## 10. Buttons

**Primary — Submit ("DROP IT")**
- Bg: `--sp-pink`. Text: `--sp-cream`. Border: 3px solid `--sp-ink`. Radius: `--sp-r-l`.
- Padding: 18px 28px. Type: `Bagel Fat One` 22 / 22.
- Shadow: `--sp-shadow-l`. Transform: `rotate(-2deg)` (sticker affect).
- **Pressed:** transform `rotate(0deg) translate(2px, 2px)`, shadow steps down to `--sp-shadow-s`.
- **Disabled:** bg `--sp-cream`, text `--sp-ink-soft` at 40% opacity, no shadow.

**Secondary — Share / Scope pill (active)**
- Bg: `--sp-mint` or `--sp-blue`. Text: `--sp-ink`. Border: 2px solid `--sp-ink`. Radius: pill.
- Padding: 8px 14px. Type: Hanken 800 / 13.
- Shadow: `--sp-shadow-s`.
- **Pressed:** translate(1px, 1px), shadow → none.

**Tertiary — Scope pill (inactive), date pill**
- Bg: `--sp-cream`. Text: `--sp-ink`. Border: 2px solid `--sp-ink`. Shadow: `--sp-shadow-s`.

**Destructive (spec'd, unused in v1)**
- Bg: `--sp-red` `#FF5A4F`. Text: `--sp-cream`. Same border/shadow as primary. Reserved for "delete answer" flow.

## 11. Inputs

**Answer input**
- Bg: `#FFFFFF` (slightly brighter than cream for contrast). Border: 3px solid `--sp-ink`. Radius: `--sp-r-m`.
- Padding: 18px 20px. Type: Hanken 700 / 17.
- Shadow: `--sp-shadow-m`.
- **Peel-corner detail:** top-right 22px is clip-pathed off and overlaid with a `--sp-lemon-2` triangle flap (CSS `::after`).
- **Placeholder:** "your take?" — `rgba(26,26,26,0.45)`, weight 700.
- **Focused state:** shadow `--sp-shadow-l` + 4px solid `--sp-pink` outline, offset 2px.
- **Filled state:** identical to default, value shown in `--sp-ink`.
- **Error state:** border + outline → `--sp-red`. Helper text: `Hanken 700 / 12`, color `--sp-red`.

## 12. Cluster bubble

Every cluster is a peel-off sticker.

- **Shape:** rounded rectangle (border-radius from scale: `--sp-r-m` default, `--sp-r-l` for XL/L).
- **Fill:** rotates through `--sp-mint`, `--sp-lemon`, `--sp-blue`, `#FFD7E8` (pink-pastel). Self-cluster overrides to `--sp-pink` solid.
- **Border:** 2px solid `--sp-ink` (S/XS) or 3px (M/L/XL).
- **Shadow:** S `--sp-shadow-s`; M/L `--sp-shadow-m`; XL `--sp-shadow-l` (self uses XL shadow always).
- **Font-size formula:** discrete buckets from `count / maxCount`:
  - `≥0.85` → XL 44px (only `c_ai` qualifies)
  - `0.40–0.84` → L 30px
  - `0.20–0.39` → M 22px
  - `0.08–0.19` → S 16px
  - `<0.08` → XS 13px
- **Rotation:** each bubble gets a deterministic rotation in `[-4°, +4°]`.
- **Self-highlight:** hot-pink fill + 3px ink border + `--sp-shadow-l` + a `YOU` tab sticker (lemon-yellow, rotated -12°, anchored top-left) + subtle 4s wobble loop.
- **Layout strategy:** manually placed positions in `index.html` (a tuned packed layout for 349×~720 inner canvas). Top cluster (`AI`) is gravitationally central (x≈76, y≈110). The rest pack radially outward by size bucket. For production: replace with d3-cloud / Phyllotaxis spiral seeded by `id` for stable layouts.

## 13. Leaderboard row

- **Container:** sticker tile — bg `#FFF`, border 2px ink, radius `--sp-r-m`, padding 12px 14px, shadow `--sp-shadow-s`. Rows are full-width inside the screen gutter.
- **Layout:** rank (32px column, Bagel 22) → avatar circle (36px, initial in Bagel 14, mint fill) → main column (handle Hanken 800 / 15, streak label Space Grotesk 600 / 10 with flame SVG) → score Bagel 20.
- **Rank format:** zero-padded ("01", "04", "10").
- **#1 crown:** an overlay sticker (`--sp-pink` bg, cream text, Bagel 12, rotate -8°) anchored top-left (-14px / -10px). Reads "★ #1". The row itself also upgrades to bg `--sp-lemon-2`, 3px border, `--sp-shadow-m`.
- **Self row (rank 4 / levin):** bg `--sp-pink`, cream text, 3px border, `--sp-shadow-m`. Plus a "YOU" tab sticker (lemon, top-right, rotate +4°).
- **Streak indicator:** SVG flame + "N-day streak" in mono micro.

## 14. Archive tile

- **Container:** polaroid-sticker — bg `#FFF`, border 2px ink, radius `--sp-r-m`, padding `28px 12px 12px` (extra top for the date tab), shadow `--sp-shadow-s`, min-height 130px.
- **Date tab:** anchored top-left (-10px / 10px). Ink-filled rectangle (radius 6px), cream uppercase mono 700 / 10, letter-spacing 0.16em.
- **Per-tile rotation:** odd tiles `-1.5°`, even tiles `+1.5°` — gives the "scattered photo" feel.
- **Question copy:** Hanken 700 / 10.5 / 1.25, color `--sp-ink-soft`.
- **Verdict:** Bagel `Fat One` 18 / 0.95, rotating between `--sp-pink` and `--sp-ink` per tile to keep rhythm.
- **Count:** Space Grotesk 700 / 9, uppercase, letter-spacing 0.14em, `--sp-ink-soft`.
- **Banner-ad stub** (after tile #4): full-width lemon sticker, Bagel 14 "drop incoming ★", small "SPONSORED" mono label, ink "TAP" pill CTA, rotate -1°.

## 15. Tab bar

- **Container:** cream-paper pill, 3px ink border, `--sp-shadow-m`, anchored 30px from bottom inside the safe area. A short top-down fade scrim above it.
- **Tabs (in order):** Today · Friends · Board · Archive.
- **Icons:** custom 24×24 line SVG, 2px stroke, ink color — house, two stacked figures, bar chart, file box. Two-line layout: icon above 9px UPPERCASE mono label, letter-spacing 0.14em.
- **Active tab:** inverts — bg `--sp-ink`, fg `--sp-cream`, padded sideways to form a clear pill within the pill. No bounce animation on switch — color flip + 200ms ease.

## 16. Motion

| Event                  | Animation                                                                          | Duration / easing                |
|------------------------|------------------------------------------------------------------------------------|----------------------------------|
| Submit press           | Sticker tilts from `rotate(-2deg)` to `rotate(0deg) translate(2px,2px)`, shadow shrinks `--sp-shadow-l → --sp-shadow-s` | 120ms ease-out down, 200ms spring(0.5) back |
| Submit release & lock  | Confetti dot burst (6 dots, palette rotation), springs out from button center      | 600ms spring(0.4, 12)            |
| Wordcloud entry        | Each sticker pops in with `scale(0) → 1.08 → 1.0` + assigned rotation              | 600ms ease-out, stagger 25ms, sorted desc by count |
| Self-cluster idle      | Continuous `rotate(rot) ↔ rotate(rot + 2deg)` wobble                                | 4000ms ease-in-out, infinite     |
| Top cluster reveal     | After answer submitted: top cluster scales `1 → 1.15 → 1.0` once                   | 700ms spring(0.35, 10)           |
| Tab switch             | Active pill color flip, no slide                                                   | 200ms ease-out                   |
| Leaderboard climb      | Row swaps order with a vertical translate + 1° tilt mid-flight                     | 450ms ease-in-out                |
| Counter tick           | "12,847" digit roll-up when a new answer lands                                     | 400ms ease-out per digit         |
| Pulse dot (live count) | `scale(1) ↔ scale(1.2)`                                                            | 1800ms ease-in-out, infinite     |

All motion respects `prefers-reduced-motion: reduce` → kill wobble, kill confetti, keep color flips.

## 17. Iconography

Custom inline SVG, 2px stroke, 24×24 grid, square caps, round joins, ink color `--sp-ink`. No icon libraries. The system is small (tab bar 4 icons, share icon, flame, crown, sparkle ★). Each icon is hand-drawn to feel sticker-cut, not Material/Lucide-generic.

## 18. Illustration / decoration

- **Paper texture:** repeating radial-gradient noise (`radial-gradient(rgba(26,26,26,0.08) 1px, transparent 1px) 6px 6px`) at 45% opacity, screen-wide.
- **Halftone dot grid:** page background uses two stacked radial-dot grids (14px & 28px) at low alpha for the editorial cream-paper feel.
- **Sparkle stars (★):** used sparingly as eyebrow accents on screen titles ("today's drop ★", "tap a sticker ★"). Bagel One renders them inline.
- **Peel-corner triangle:** clip-path on the input field, with a lemon flap on top revealing "underneath" — the only skeuomorphic detail in the system, kept to one place to stay tasteful.
- **Confetti dots:** reserved for submit-success motion; never static decoration.
- **No emoji confetti, no gradient blobs, no rounded-everything.** Restraint is the difference between Sticker Pop and slop.

## 19. Sounds / haptics

- `submit_press` — short woody tap, soft haptic (UIImpactFeedbackStyle.medium).
- `submit_lock` — paper-tear + chime cluster, success haptic (UINotificationFeedbackType.success).
- `reveal_top_cluster` — confetti pop, light haptic.
- `leaderboard_climb` — single bell chime, medium haptic.
- `tab_switch` — silent, light haptic.
- `streak_milestone` — drum hit + heavy haptic (only on 7/30/100-day streaks).

## 20. Voice & microcopy

**Button labels**
- "DROP IT" (primary submit)
- "lock it in"
- "SHARE"
- "see yesterday's verdict"
- "give it another go"

**Empty states**
- "no drops yet — you're early ★"
- "your archive is brand new. come back tomorrow."
- "no friends here yet. invite the group chat."

**Error toasts**
- "couldn't drop that — try again?"
- "you already locked in today. come back at 6:34 ★"
- "offline. we'll save it when you're back."

**Other in-direction copy used on screens:**
"your take?" (placeholder) · "12,847 votes and counting" · "the verdict so far" · "the board ★" · "the archive" · "drop incoming ★" · "tap a sticker for stories ★" · "hold 3 sec to lock it in ★"

## 21. Accessibility

- **Contrast:** Ink-on-cream 16.1:1 (AAA). All sticker fills paired with ink text are ≥7:1. Cream-on-pink for submit is 3.3:1 — passes AA at the 22px Bagel size used.
- **Dynamic Type:** all px values map to scaled units in RN (`PixelRatio.getFontScale()`). Bagel One holds shape up to 200% scale; line-height set in `em` for body/label fonts so it grows with text.
- **Reduced motion:** wobble, confetti, and counter rollups disabled when `prefers-reduced-motion: reduce`. Pulse-dot kept (1.05 instead of 1.2) since it carries a "live" signal.
- **Focus:** 4px hot-pink outline on every focusable surface (already shown on the input). Native focus visible always.
- **Dark mode:** **not supported in v1** by design — Sticker Pop is a daylight aesthetic. Auto-fallback: identical light treatment regardless of system setting. Documented limitation, not a bug.

## 22. Why this for Relatably

**Product values amplified.** Relatably is a daily ritual built on lighthearted opinions and aggregated wordclouds. Sticker Pop turns the ritual into a *physical* one — you peel a sticker off the sheet, you press it down (with the 3-second dwell), and your sticker lives on the cluster wall with everyone else's. The wordcloud isn't a chart, it's a friendship bracelet of stickers. That conceptual model is harder to compete with than another monochrome poll app.

**Audience pulled in.** Gen Z is fluent in maximalist, ironic-but-warm Y2K. Duolingo proved a chunky cartoon brand can scale to 80M DAU without feeling childish; Imprint proved cream paper + chunky type reads as "premium" to that same audience. By choosing this language, Relatably visibly opts out of the "another black-on-toxic-lime hackathon app" cohort the current UI lives in. The brand says "we know who we are and we're not embarrassed about it" — which is itself a Gen-Z value.

**Risks accepted.** (1) Sticker Pop reads as **playful**, which can clip the ceiling on monetization (premium tiers, brand ads) — we mitigate with a single dignified ink/cream baseline so an ad slot like the lemon banner reads as editorial-funny, not Chuck-E-Cheese. (2) Light-only is a real opinion — some users will ask for dark mode. The answer is "Sticker Pop is a daylight app; for night-mode aesthetic, build a different brand." (3) The rotation/wobble system risks feeling chaotic at scale — we cap rotation at ±4°, wobble at ±1°, and reserve the busiest treatment (the peel corner) for exactly one element per screen.

## 23. Implementation note

Stack: pure React Native + `react-native-svg` + Reanimated 3 for spring/wobble — no NativeBase, no UI Kitten. Bagel Fat One, Hanken Grotesk, and Space Grotesk loaded via `expo-font`. Hard-offset shadows ship as `shadowColor + shadowOffset + shadowRadius:0 + shadowOpacity:1` on iOS (the rare iOS-shadow setup where the design intentionally wants the offset visible). Layout values come 1:1 from the `--sp-*` tokens in this doc, exported as a `tokens.ts` module.
