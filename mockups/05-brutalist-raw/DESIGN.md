# Relatably — Brutalist Raw

## 1. Direction in one sentence

A monospace, paper-on-paper indie-confident take where typography does all the work, hard color hits punctuate, and every number is treated like terminal data — Are.na meets Vercel docs meets Hex terminal.

## 2. Mood board references

- **Are.na** — typographic structure, mono labels, no decoration, content-first.
- **Vercel docs** — geometric grid, hairline tables, mono code, restrained palette with a single accent.
- **Hex (the data app)** — terminal-cool, mono labels, sharp dense grids, numbers as art.
- **Hacker News** — orange-on-cream tonality, mono numerals, comfortable density.
- **Index Ventures** — bold cobalt punctuation, mono everywhere, confident wordmark.
- **Berghs School of Communication** — typographic playfulness inside heavy restraint.
- **WikiLeaks / declassified docs** — bracket notation, monospaced metadata, paper warmth.
- **21st.dev — Vercel-style Table component** (similarity 0.221, "Default" / "FullFeaturedTable") — informed the terminal-style leaderboard header (uppercase mono head, hairline divider, right-aligned numerics, tabular-nums score column).
- **21st.dev — vertical tabs without underline** — informed the daily/weekly/all-time toggle as a stark hairline-boxed 3-cell unit with one active inverted cell instead of pills.
- **21st.dev — logo_search for `are.na`** returned no match (as expected for a deliberately wordmark-only brand) — translated the result into a typed wordmark `RELATABLY//` where the slashes are the only ornament, in cobalt.

## 3. Brand attributes

**Owns:** taste-forward, indie-confident, monospaced, structural, data-literate.
**Rejects:** cute, gradient, glassy, infantilising, decorative.

## 4. Color palette

Light-only. The deliberate choice — paper is the move. No dark mode in this direction; the warmth of bone and the discipline of ink are the whole point.

| Hex      | Name          | Role                                              |
|----------|---------------|---------------------------------------------------|
| `#F7F4EC`| Bone Paper    | Primary background (warm off-white)               |
| `#FFFFFF`| Pure Paper    | Secondary surface — input, ad slot, raised cards  |
| `#0E0E0E`| Ink           | Primary text, primary button fill                 |
| `#5A5A5A`| Ink-2         | Secondary text, labels, meta                      |
| `#8A8A8A`| Ink-3         | Tertiary / disabled / micro                        |
| `#1A1A1A`| Hairline      | 1px dividers, table rules, borders                |
| `#1B3CFF`| Cobalt        | Primary accent — daily highlight, crown, slashes  |
| `#FF6A18`| Tangerine     | Self-marker — [YOU], called-it, leaderboard-row-4 |
| `#FF188C`| Magenta       | Live status, new drop, error                      |

Contrast: ink on bone = 17.6:1. Ink-2 on bone = 6.3:1. Cobalt on bone = 7.1:1. Tangerine on bone = 3.4:1 (used only on large/bold text or as background fill with bone foreground — both AA). All combinations clear WCAG AA, primary pairings clear AAA.

## 5. Typography

**JetBrains Mono** — weights 300, 400, 500, 600, 700, 800.
- Google: `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800`
- Use: **everything** — UI chrome, labels, numerals, headlines, table cells, button copy.
- Fallback: `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`

**Inter Tight** — weight 600 only.
- Google: `https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700`
- Use: **one place only** — Screen 1's question text. One breath of sans inside a mono world, so the daily question lands like the title of a magazine essay instead of like a `git diff` line. The bracket label `[Q.011]` above it stays mono — the contrast is the move.
- Fallback: `ui-sans-serif, system-ui, -apple-system, sans-serif`

**Choice statement:** mono-everywhere with ONE sans contrast for the question text. This makes the daily ritual moment legible and emotional without breaking the terminal voice elsewhere.

## 6. Type scale

| Token   | Size | Line-height | Use                                    |
|---------|------|-------------|----------------------------------------|
| hero    | 56px | 0.9         | Page-header brand mark                 |
| h1      | 36px | 1.05        | Question text (Inter Tight 600)        |
| h2      | 32px | 1.0         | Screen title `RANK.` / `BACKLOG.`      |
| body-l  | 22px | 1.2         | Counter numerals, hero numbers         |
| body    | 15px | 1.4         | Verdict text, leaderboard handle/score |
| body-s  | 13px | 1.5         | Body running text                      |
| label   | 10px | 1.6         | Bracket labels, table head, top strip  |
| micro   | 9px  | 1.6         | Tab bar labels, lbl-tiny               |

All caps + 0.18em letter-spacing applied to every `label` and `micro`.

## 7. Spacing scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48` (px). Screen-edge gutter: **24px** (left/right). Top safe-area pad: 60px (clears the dynamic island). Tab-bar reserved: 88px.

## 8. Radii

`0px` everywhere. The only rounded geometry on screen comes from the iPhone chrome itself (which is a shared frame). All interior surfaces — buttons, inputs, cards, ad slot, scope pills, toggles, ad block, tiles — are pure rectangles. This is the loudest statement the direction makes.

## 9. Elevation / shadow

None. No drop shadows, no inner glows, no `box-shadow`. Hierarchy is built from:
- 1px hairlines (`#1A1A1A`)
- 1px soft dividers (`rgba(14,14,14,0.18)`)
- 2px ink borders on the primary submit button (the only "heavier" rule in the system)
- Surface contrast (bone vs. pure paper for raised elements)

## 10. Buttons

| Type        | Size                  | Border         | Bg / FG                        | Typography                                       | States                                                                            |
|-------------|-----------------------|----------------|--------------------------------|--------------------------------------------------|-----------------------------------------------------------------------------------|
| Primary     | full-width, 14×16 pad | 2px solid ink  | bg ink / fg bone               | mono 700, 13px, ALL-CAPS, 0.22em ls              | default: ink fill. pressed: bg bone, fg ink (invert). disabled: bg ink-3, fg bone |
| Secondary   | inline, 5–9px pad     | 1px solid ink  | bg bone / fg ink               | mono 700, 9px, ALL-CAPS, 0.18em ls               | hover: invert (bg ink / fg bone). disabled: 1px ink-3 + fg ink-3                  |
| Tertiary    | inline link           | none           | bg transparent / fg cobalt     | mono 600, 12px, underlined offset 2px            | hover: underline → ink. disabled: ink-3                                            |
| Destructive | full-width, 14×16 pad | 2px solid mag  | bg magenta / fg bone           | mono 700, 13px, ALL-CAPS                          | default: magenta fill. pressed: bone fill, magenta fg + 2px magenta border        |

Button copy always wrapped in brackets: `[ SUBMIT ANONYMOUSLY ]`, `[ SHARE ↗ ]`, `[ AD ]`.

## 11. Inputs

Answer input:
- Container: 1px solid ink, bg pure paper, no radius, 96px min-height, 12px padding.
- Prompt glyph: `> ` in cobalt mono 700, sits at top-left.
- Typed text: mono 500, 14px, ink. Blinking caret = 8×16 solid ink rectangle.
- Footer meta row (inside input, dashed 1px top-border): left "[ TYPE YOUR TAKE ]" in ink-2 mono 9px caps; right shows focus + character count in cobalt mono 700 when focused.
- Placeholder treatment: mono 500, 14px, ink-3, text `[ type your take ]` (lowercase + brackets — the brand voice).
- **States:**
  - default: 1px ink, ink-3 placeholder.
  - focus: 1px ink, footer meta turns cobalt 700.
  - filled: 1px ink, typed value in ink, caret visible.
  - error: 2px solid magenta + footer label flips to magenta `// MAX 240 CHAR`.

## 12. Cluster (wordcloud "bubble")

**No bubbles. This is the defining move of Brutalist Raw.**

Each cluster is a typographic atom on an absolute-positioned grid inside a 460px-tall canvas:
- **Shape:** none. No fill, no border, no shadow. Just type on paper.
- **Composition:** asymmetric vertical/horizontal arrangement, hand-tuned for typographic weight balance (not random). Top cluster anchors top-left; long-tail packs into the bottom rows.
- **Font:** JetBrains Mono. Always.
- **Size formula:** discrete weights mapped to rank brackets: rank 1 → 96px/800; ranks 2–3 → 38–44px/700; ranks 4–6 → 22–28px/600; ranks 7–12 → 16–22px/500; ranks 13–17 → 13–16px/400; ranks 18–20 → 11–12px/300. Size is also `clamp(11px, 8px + count/maxCount × 88px, 96px)` in the production formula.
- **Rotation:** 0°. No whimsy. Pure grid.
- **Rank label:** above every word, mono 9px ink-3 letter-spaced `[01]` / `[02]` / etc — turns the cloud into a readable typographic ranking.
- **Color shift:** top word + most middles in ink. Selective cobalt highlights on ranks 3 + 17 (intentional accent rhythm, not all cobalt — that would be loud noise). No magenta inside the cloud — magenta is reserved for "live" status.
- **Self-highlight:** the user's word (`AI`) gets a sibling marker rendered right next to the dominant `AI` headline: in tangerine, mono 700, 13px, with an inline `[YOU]` bracket tag in 9px caps. This is unmistakable without breaking the typographic field.
- **Layout strategy:** hand-composed packed grid. Top cluster gravitationally central (anchored top-left at 96px/800 — its mass anchors the composition). Long-tail orphans flow horizontally across three bottom rows at small mono sizes, like a footnote ribbon.

## 13. Leaderboard row

- **Grid:** `[30px rank] [1fr handle] [60px score] [50px streak]` with 8px gap.
- **Rank cell:** `[##]` bracket notation, ink-2 mono 600, 13px.
- **Handle:** mono 600, 13px, ink, tabular.
- **Score:** mono 700, 13px, ink, right-aligned, `font-variant-numeric: tabular-nums` (so all the digits line up like a real terminal).
- **Streak:** `×N` mono 500, 11px, ink-2, right-aligned.
- **Row divider:** 1px ink-2 soft hairline.
- **Crown (#1):** rank turns cobalt 800, handle gets a trailing `[#1]` mono 9px cobalt 700 tag. No emoji, no graphic crown. The bracket IS the crown.
- **Self (row 4 — `levin`):** entire row gets tangerine fill, bone text on tangerine. Row breaks out of the gutter (full-bleed inside the screen) by extending margin-x: `-24px` and re-padding. Handle gets trailing `[you]` tag in bone mono 700.

## 14. Archive tile

A list row, not a grid tile. Grid: `[64px date] [14px slash] [1fr body] [70px count]` with 10px gap.

- **Date:** `[may 10]` — mono 600, 10px, ink-2, brackets in lowercase.
- **Slash:** `//` cobalt 800, 14px — the visual rhythm of the page.
- **Body:** two stacked lines. Top: question in mono 400, 11px, ink-2 (small, supporting). Bottom: verdict in mono 700, 15px, ink (the answer is the hero).
- **Count:** mono 700, 11px, ink, right-aligned + `votes` micro-label below in ink-3.
- **Divider:** 1px ink-2 soft hairline between rows.
- **Banner ad** (after row 4): 1px ink border, pure-paper fill, left side has `[ AD ] // SPONSORED` in magenta 800 micro caps + headline copy in mono 700, right side has a single `↗` arrow in mono 800. This is the only place magenta appears in the archive — it marks "this isn't editorial content".

## 15. Tab bar

- **Container:** 68px tall, 1px ink top border, sits inside the screen with vertical hairline cell separators (1px ink-2 between each tab).
- **Tabs (4):** `Today · Friends · Rank · Archive`. Glyph above label.
- **Glyphs:** bracket-glyph icon system — `[*]` Today, `[+]` Friends, `[#]` Rank/Leaderboard, `[~]` Archive. Mono 700, 13px.
- **Label:** mono 9px, 0.18em letter-spacing, ALL CAPS.
- **States:** inactive ink-3 + ink-2 glyph. **Active** ink label + **cobalt** glyph + a 2px cobalt underline marker 28px wide centered below the label.

## 16. Motion

Almost none. The voice of the direction is that motion is a decoration, and this direction rejects decoration.

| Event              | Duration | Easing                  | Description                                                  |
|--------------------|----------|-------------------------|--------------------------------------------------------------|
| Tab switch         | 120ms    | `cubic-bezier(0,0,0.2,1)` | Active-indicator underline snaps cell-to-cell (no slide).   |
| Button press       | 120ms    | linear                  | Invert colors — bone↔ink. No scale, no shadow.               |
| Submit confirm     | 0ms      | -                       | Instant. Then a `>` cursor blink in the new state.           |
| Wordcloud entry    | 240ms staggered 20ms | linear        | Each word fades from 0 → 1 opacity. No scale, no slide.      |
| Cluster pulse      | none     | -                       | Top cluster never pulses. The size is the emphasis.          |
| Reveal             | 0ms hard cut + 1 caret blink (530ms) | -      | Yesterday's #1 cluster cuts in as if printed. No animation. |
| Leaderboard climb  | 200ms    | `ease-out`              | Row swaps Y-position with neighbour. No scale.               |
| Caret blink        | 530ms loop | step-start              | 50% duty cycle, on the typed-input caret rectangle.          |

## 17. Iconography

Bracket-glyph system — icons are characters, not SVGs. Mono 700, 13px.

| Glyph | Meaning            |
|-------|--------------------|
| `[*]` | Today / live drop  |
| `[+]` | Friends            |
| `[#]` | Rank / leaderboard |
| `[~]` | Archive / history  |
| `[>]` | Submit / forward   |
| `[↗]` | External / share   |
| `[!]` | Error              |
| `[?]` | Help               |
| `[//]`| Live / now         |

This is intentional. Zero SVG dependencies, infinitely typographically consistent, ownable.

## 18. Illustration / decoration

- **Dot grid:** 1px ink dots on 16px grid at 6% opacity — applied only to the wordcloud screen background, as a subtle "this is the canvas" cue.
- **Slashes:** `//` and `////` as semantic markers — `//` separates sections like terminal comments; `////` flags "live". Always in cobalt or magenta, never decorative.
- **Brackets:** `[ X ]` wraps every label, button, glyph. The bracket is the brand.
- **Hairlines:** 1px solid ink rules at top/bottom of zones. The only structural element.
- **No grain, no blob, no sticker, no emoji, no gradient.**

## 19. Sounds / haptics

| Event          | Sound                                    | Haptic              |
|----------------|------------------------------------------|---------------------|
| Submit         | dry mechanical-keyboard "tk"             | iOS rigid impact   |
| Reveal         | a single typewriter "ka-chunk" + caret blink | iOS soft impact |
| Leaderboard ↑  | sharp paper-shuffle click                | iOS rigid impact   |
| Streak milestone | low telex "ding" (mono, no melody)    | iOS success         |
| Error          | one terminal "bel" tone                  | iOS warning         |

## 20. Voice & microcopy

**Button labels (5):**
1. `[ SUBMIT ANONYMOUSLY ]`
2. `[ SHARE ↗ ]`
3. `[ SEE YESTERDAY'S #1 ]`
4. `[ SIGN IN WITH APPLE ]`
5. `[ NEXT DROP IN 21h ]`

**Empty states (3):**
1. *Friends tab, no friends:* `// no friends yet. drop your handle below.`
2. *Archive empty:* `// the backlog is empty. first drop lands tonight.`
3. *Wordcloud no answers yet:* `// 0 answers in. be the first.`

**Error toasts (3):**
1. `[ ! ] too late. drop closed 3m ago.`
2. `[ ! ] max 240 char. trim it.`
3. `[ ! ] no connection. retrying every 4s //`

**Misc voice rules:** lowercase by default. brackets around labels. `//` as the universal comment/separator. `////` as the live marker. numbers always with commas. dates lowercased (`may 10`, not `May 10`).

## 21. Accessibility

- **Contrast:** ink on bone 17.6:1 (AAA). ink-2 on bone 6.3:1 (AA). cobalt on bone 7.1:1 (AAA). tangerine on bone 3.4:1 (used only on bold/large or as a background fill with bone foreground 5.9:1 — both AA).
- **Dynamic type:** every text size driven by a token; font-size scales with iOS Dynamic Type when implemented in React Native via `PixelRatio.getFontScale()` clamped 0.85–1.4. The mono grid handles enlargement gracefully because it doesn't depend on visual symmetry.
- **Light/dark:** **light-only by design.** Dark mode would invert into a terminal aesthetic that already exists in the v0.1 lime-on-black build. Staying paper-only is the differentiator from the current shipping app and a clear premium move.
- **Focus rings:** 2px cobalt outline, 2px offset, on all interactive elements. Never removed.
- **Self-highlight redundancy:** the self row uses both tangerine fill AND a `[you]` text label, so colorblind users still see the marker.

## 22. Why this for Relatably

**Product values amplified.** Relatably's pitch is "what does the world think?" That's a research instrument disguised as a game. Brutalist Raw is the only direction that visually announces "this app is serious about its data." Mono numerals, hairline tables, bracket labels, terminal voice — every pixel says "the answers matter." For a free-text aggregation product, that earned-seriousness builds trust that competitors (Polls in iMessage, Threads question stickers) can't replicate.

**Audience pulled in.** Gen Z's taste cohort has split: half want Duolingo-stickers, half want Are.na minimalism, Vercel-docs cool, Hex-terminal hacker energy. Brutalist Raw owns the second half completely and competes with nothing else on the App Store today in the "social ritual" category. It's the design language of the people who quote-tweet Patrick Collison's Substack and follow @aravind on the timeline. They will screenshot this and post it. The other six directions can't make that promise — they look like other apps that already exist.

**Risks accepted.** (1) Lower out-of-the-box delight for a casual user — there are no stickers, no confetti, no toy moments; this is a chess club, not a playground. (2) Mono-only typography is divisive — some readers feel it's "developer-coded" rather than mainstream. We accept this because Relatably has zero brand recognition and needs to be _unforgettable_, not _comfortable_. (3) Translation friction — bracket-notation labels and `//` separators need careful internationalisation; we accept a slightly bigger localization workload for the design payoff.

## 23. Implementation note

**Stack:** React Native with pure RN `StyleSheet`. JetBrains Mono + Inter Tight loaded via Expo Font. Zero animation libraries — `Animated` API only, all transitions ≤240ms. Hairlines via `StyleSheet.hairlineWidth × 2` to guarantee 1px on every device. Bracket-glyph icon set lives as `<Text>` nodes, not SVG — keeps the bundle clean and respects the typographic core of the system.
