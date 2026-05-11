# Editorial Daily — DESIGN.md

## 1. Direction in one sentence

NYT-magazine-on-paper for Gen Z: a daily question shipped as a one-page newspaper, set in italic serif on warm newsprint with a single oxblood accent.

## 2. Mood board references

- **The New York Times** — masthead hierarchy, oxblood-on-black thinking, hairline rules separating everything. Steal: the column gutter rule, the italic serif decks under section heads.
- **Substack reader** — generous whitespace, serif body, trust-by-restraint. Steal: the calm reading rhythm and the lack of ornament around long text.
- **Letterboxd** — editorial tone applied to a social product. Steal: handling user-generated content (handles, scores) with the same typographic dignity as editorial copy.
- **The Daily podcast cover art** — vermillion + black + thin mono labels. Steal: the high-contrast oxblood-as-accent grammar and the small-caps label voice.
- **The Browser / Read Max newsletters** — typographic confidence without illustration. Steal: that you can carry an entire surface with type alone.
- **Are.na** — typographic minimalism with no decoration. Steal: the hairline 1px rule as the entire visual system.
- **Monocle magazine** — small caps mono labels and intentional folios ("A.1"). Steal: the page-number footers and section labels (FRONT PAGE / BACK ISSUES).
- **Aesop product labels** — italic serif over cream, single accent. Steal: the discipline of one display family + one mono label.
- **21st.dev — Customers Table Card** (similarity 1.04 in `mcp__magic__21st_magic_component_inspiration` query "editorial leaderboard hairline table") — hairline-bordered rows, tabular-nums for scores, sticky head, muted footer. Translated to NYT mono ranks + serif handles.
- **21st.dev — Responsive Masonry Layout** (query "editorial archive masonry tiles") — two-column print masonry behavior; we use a fixed 2-col grid with hairline separators instead of cards.
- **21st.dev — Wordcloud Chart (visx)** (query "typographic wordcloud magazine") — reference for cluster scaling logic by frequency. We rejected the spiral packer; we want a *composed* page, not a packed bag, so positions are art-directed.
- **21st.dev logo search** — `relatably` and `the new york times` both returned `notFound`; we built our wordmark in-house: `Relat` roman + `ably` italic oxblood, Source Serif 4 700, the only literal logotype this brand needs.

## 3. Brand attributes

**Owns:** editorial, slow, considered, ownable, mature.
**Rejects:** gamified, gradient-y, cute, busy, kid-coded.

## 4. Color palette

Direction is **light-only**. The paper *is* the brand. There is intentionally no dark variant — switching the surface to `#000` would erase the entire reading metaphor.

| Hex | Name | Role |
|-----|------|------|
| `#F4ECDD` | Newsprint Cream | Primary background. The page. |
| `#FFFFFF` | Card White | Secondary surface (banner-ad cut, only). |
| `#EAE0CC` | Paper Edge | (Reserved) for future divider treatments — currently unused on these four screens but defined so the system has it. |
| `#161413` | Ink | Primary text + 1px hairlines + Submit button fill. |
| `#2A2624` | Ink Soft | Page subtitle, secondary headlines on the gallery page. |
| `#5C5852` | Subtext | Decks, labels, secondary metadata, dim cluster words. |
| `#C8392B` | Oxblood | Primary accent — section kicker, self-cluster, input focus, self-row bar, sponsored CTA, verdict text on archive. |
| `#A22E22` | Oxblood Dark | Pressed state for the Submit button and hovered hairline-grow underlines (reserved; not used in static mockup). |
| `#B8902A` | Marigold | Crown indicator on leaderboard rank 1 only. Deliberately desaturated so it doesn't out-shout oxblood. |
| `#C8392B` | Error | Identical to oxblood. Errors are the same hot color as wins — context disambiguates. One hot color, period. |

Contrast check: Ink `#161413` on Cream `#F4ECDD` = 14.8:1. Subtext `#5C5852` on Cream = 6.2:1. Oxblood `#C8392B` on Cream = 4.9:1 (passes AA for non-large text, passes AAA for large display).

## 5. Typography

Every font loaded via Google Fonts `<link>` (variable fonts; one stylesheet request).

| Family | URL | Specimens | Use | Fallback |
|--------|-----|-----------|-----|----------|
| **Source Serif 4** | `https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..900;1,8..60,300..900` | 300 / 400-italic / 700 / 700-italic | Display headlines, question text, leaderboard handles, archive question lines, italic decks | `"Iowan Old Style", Georgia, serif` |
| **IBM Plex Sans** | `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500` | 400 / 500 / 600 / 700 | UI labels, archive verdicts (bold), focused input text | `"Helvetica Neue", Arial, sans-serif` |
| **JetBrains Mono** | `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600` | 400 / 500 / 600 | Date stamps, mono ranks `[01]`, scores, small-caps labels (tracked 0.14–0.22em), folios | `ui-monospace, "SF Mono", Menlo, monospace` |

## 6. Type scale

| Token | Family | Weight / style | Size | Line-height |
|-------|--------|----------------|------|-------------|
| hero (page wordmark) | Source Serif 4 | 700 + italic accent | 72px | 0.95 |
| question (S1) | Source Serif 4 | 400 italic | 44px | 1.04 |
| dropcap | Source Serif 4 | 700 roman | 88px | 0.85 |
| section title (S3 / S4) | Source Serif 4 | 400 italic | 30px | 1.05 |
| cloud-XL (self / top) | Source Serif 4 | 400 italic | 86px | 0.92 |
| cloud-L | Source Serif 4 | 700 | 50px | 0.92 |
| cloud-M | Source Serif 4 | 400 italic | 42px | 0.92 |
| cloud-S | Source Serif 4 / Plex Sans | 500 | 18–24px | 0.92 |
| cloud-XS | mixed | 400 | 13–17px | 0.92 |
| body-L (decks) | Source Serif 4 | 300 italic | 19–22px | 1.25–1.35 |
| body | Source Serif 4 | 400 | 15–17px | 1.18 |
| handle row | Source Serif 4 | 400 | 17px | 1.05 |
| verdict (S4) | IBM Plex Sans | 700 | 14px | 1.15 |
| label (small caps) | JetBrains Mono | 500 | 9–11px tracking 0.14–0.22em uppercase | 1.6 |
| micro / folio | JetBrains Mono | 500 | 9px tracking 0.3em | 1.0 |

## 7. Spacing scale

4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. **Screen-edge gutter inside the phone: 24px.** Page-edge gutter (around the phone row): 32px. Phone-to-phone gap: 40px.

## 8. Radii

- `0px` — default for everything. Buttons, ad block, focus underlines.
- `2px` — share button corner (the *only* radius in the design language). Anything more is rejected as un-editorial.

## 9. Elevation / shadow

There are no shadows inside the screens. The design is paper-flat. The phone frame itself carries the only shadow on the page (defined in shared `phone-frame.css`). Elevation is communicated by **hairlines** (1px `#161413`) and **double rules** (1px / 4px gap / 1px) under mastheads — pure NYT.

## 10. Buttons

| Variant | Family | Size | Padding | Default | Pressed | Disabled |
|---------|--------|------|---------|---------|---------|----------|
| **Primary (Submit)** | JetBrains Mono 600, 11px, tracking 0.22em uppercase | full-width | 17px vertical / 16px horizontal | `bg: #161413` `fg: #F4ECDD` arrow glyph `→` | `bg: #A22E22` (oxblood-dark) | `bg: #5C5852` `fg: #F4ECDD` |
| **Secondary** | JetBrains Mono 500, 10px, tracking 0.18em | inline | 10px / 14px | `bg: transparent` `border: 1px #161413` `fg: #161413` | `bg: #161413` `fg: #F4ECDD` | opacity 0.4 |
| **Tertiary (text-link)** | underline-only | inline | 0 | `fg: #C8392B` with hairline oxblood underline | underline thickens 1→2px in 200ms | `fg: #5C5852`, no underline |
| **Destructive** | Same shape as Primary; `bg: #C8392B` `fg: #F4ECDD`. Confirmation flows live on a separate screen and aren't shown in this v1 mockup. |

## 11. Inputs

The answer input is the only input in the four screens. It is **underline-only** — no box.

- **Default (empty)**: 1px `#161413` bottom border, Source Serif 4 300 italic 17px placeholder in `#5C5852`. Above it: a small-caps mono label `YOUR TAKE`.
- **Focus (shown in S1)**: bottom border switches to 1px oxblood. Text becomes IBM Plex Sans 400 16px `#161413`. A thin oxblood block caret blinks (900ms steps(2)). A live hint line below shows `▎ FOCUSED · ANSWERING ANONYMOUSLY` (left, oxblood mono micro-label) and `23 / 140` (right, mono). Underline glow-in animates over 200ms.
- **Filled (post-blur)**: 1px black underline, text becomes Source Serif 4 400 roman 17px.
- **Error**: 1px oxblood underline + a single mono micro-label line below in oxblood: `▎ TOO SHORT — TRY AGAIN`.

Placeholder treatment is deliberately italic-serif so it reads as *invitation* not *form field*.

## 12. Cluster — typographic only (no bubbles)

This direction explicitly **rejects** the bubble metaphor. The wordcloud is a poem on a page.

- **Shape:** none. Type sits directly on the paper.
- **Fill / stroke / shadow:** none.
- **Font-size formula:** `count / maxCount` is *not* used linearly. Instead the 20 clusters are hand-tiered into XL (86px) → L (50–42px) → M (30–22px) → S (20–18px) → XS (13–17px), with mixed serif italic / serif bold / sans / mono / dim treatments to create rhythm. This is the editorial choice: scale alone is a weak signal; weight + style + tone carry the rest.
- **Style mix:** top cluster italic display Source Serif 4; #2 serif bold; #3 serif italic; mid-tier alternates serif italic / sans / mono; long-tail dim subtext color.
- **Rotation:** ≤4° on a small subset (5 of 20) — typographic interest, not maximalism. Most words sit at 0°.
- **Self-highlight (`c_ai`):** oxblood text + 1px oxblood underline directly beneath the word + a small italic `← yours` tag in 12px oxblood serif, set inline. Plus a `↑ YOURS` mono footnote pinned at the bottom of the cloud panel ("3,204 of 12,847 said AI").
- **Layout strategy:** hand-tuned absolute positions on a 345×460 stage. Top word anchors the upper-left, secondary cluster (`tiktok`) acts as visual counterweight upper-right, mid-tier fills the magnetic center, long-tail recedes to the lower-edge in subtext gray. Reads top-to-bottom-left-to-right like a printed page.

## 13. Leaderboard row

Grid: `36px | 1fr | 64px | 36px` for rank / handle / score / streak.

- **Rank cell:** mono 11px `[01]` notation, color `#5C5852`. Padded to two digits.
- **Handle:** Source Serif 4 400 17px `#161413`.
- **Score:** JetBrains Mono 500 13px right-aligned, tabular-nums, `#161413`.
- **Streak:** mono 9px right-aligned; the digit in `#161413`, the `d` suffix in `#5C5852`.
- **Crown (#1):** rank cell switches to marigold `#B8902A`; a single `♚` glyph in marigold precedes the handle. No emoji, no badge.
- **Self-row (rank 4 / `levin`):** 3px-wide oxblood vertical bar pinned to the left edge of the row, a faint `rgba(200,57,43,0.04)` row tint, rank cell switches to oxblood weight 600, an italic ` — you` tag in 13px oxblood serif sits next to the handle, score colored oxblood.
- **Rows separated by:** 1px `rgba(22,20,19,0.18)` hairlines (softer than full ink — print-style, not screen-style). Last row gets the full 1px ink rule.

## 14. Archive tile

Two-column print masonry, hairlines between every tile and a vertical 1px gutter rule down the center.

- **Date stamp:** mono 9px uppercase `MAY 10 · ED.` in subtext.
- **Question:** Source Serif 4 400 italic 15px ink.
- **Verdict:** IBM Plex Sans 700 14px oxblood — the *hot* element of the tile.
- **Count:** mono 9px `14,203 VOTES` in subtext.
- **Sponsored slot (after tile #4):** spans full width, 1px ink border, white card-cut background, `SPONSORED` mono label, italic serif copy, oxblood `SUBSCRIBE →` mono CTA. Clearly different but tonally on-brand — looks like a print classified, not a banner ad.

## 15. Tab bar

Four tabs: **TODAY · FRIENDS · RANKS · ARCHIVE**.

- Style: 1px ink top border, 12px / 24px / 30px padding, cream background, mono 9px uppercase labels tracked 0.16em.
- Icons: custom 16×16 line, 1.2px stroke. Today = calendar leaf, Friends = two stacked figures, Ranks = bar chart, Archive = stacked-issue grid.
- Inactive: `#5C5852` stroke + label.
- Active: oxblood stroke + label + a 4px oxblood dot under the label.

## 16. Motion

This direction is deliberately near-still. Motion is a guest, not the host.

| Where | What | Duration | Easing |
|-------|------|----------|--------|
| Screen entry | opacity 0 + 2px translateY → settled | 320ms | ease-out |
| Submit press | bg `#161413` → `#A22E22`, scale 1 → 0.99 | 120ms | linear |
| Input focus | underline color swap + grow 1px → 1px oxblood; caret begins blink | 200ms | ease-out |
| Caret blink | opacity 1 ↔ 0 | 900ms | steps(2) |
| Wordcloud entry | static — no per-word animation. Page fades in as one element. | 0 | — |
| Cluster pulse | none. It is a printed page. | — | — |
| Tab switch | label color + dot fade-in | 180ms | ease-out |
| Reveal (yesterday's #1 unlock) | hairline rule draws left→right in 480ms, then headline fades in 240ms | 720ms total | ease-out |
| Leaderboard climb | row swap fades 240ms cross-fade — no slide, no flip | 240ms | ease-out |

## 17. Iconography

Custom 16×16 line icons, 1.2px stroke, single-color (ink default, oxblood when active). No filled variants. Drawn inline as SVG — no icon library dependency. Mono labels carry meaning that icons would otherwise overload.

## 18. Illustration / decoration

- Two-layer radial-dot newsprint texture on the page background (3px / 7px tiles, 2–3% black) — barely perceptible, just enough to give the cream paper-feel under a screenshot.
- 1px ink hairlines and the masthead double-rule (1 / 4 / 1) are the entire decorative language.
- Section markers like `— TODAY'S QUESTION —` use en-dash em-dash em-dash hugged by spaces — pure typographic ornament.
- No blobs, no stickers, no grain noise overlay, no dot grids, no patterns.

## 19. Sounds / haptics

- **submit-sent**: a single soft typewriter return (250ms, low-mid wood). Haptic: single firm tick.
- **reveal-yesterday**: paper-fold whisper (450ms, broadband decay). Haptic: long subtle rumble (200ms).
- **leaderboard-climb**: a low chime — single note, not a fanfare. Haptic: two short ticks.

## 20. Voice & microcopy

**Button labels**
- `SUBMIT ANONYMOUSLY`
- `READ THE FRONT PAGE`
- `OPEN THE ARCHIVE`
- `SHARE THIS ISSUE`
- `RESUBSCRIBE TO PUSH`

**Empty states**
- Today not yet dropped: *"the next issue is on the press. check back tonight."*
- Friends tab, no friends: *"no readers in your circle yet. invite one — the paper reads better in company."*
- Archive empty (new user): *"no back issues yet. monday's edition will be the first."*

**Error toasts**
- *"that take was a little too short. give it another line."*
- *"the front page hasn't gone to print yet. you'll see it after you submit today."*
- *"we couldn't file your answer. try again in a moment."*

## 21. Accessibility

- Primary text contrast: Ink on Cream = **14.8:1** (AAA easily).
- Secondary text contrast: Subtext on Cream = **6.2:1** (AA passes for normal text, AAA for large).
- Accent (oxblood on cream) = **4.9:1** — passes AA for normal text, AAA for ≥18pt large. Never used as the only signal: paired with weight change, underline, italic-tag, or 3px self-bar.
- Dynamic Type: scale anchors at 17px body — the system scales serif headlines linearly with the user's Dynamic Type preference; mono labels clamp at 11px max to prevent label sprawl.
- Light-only support is deliberate. If the OS is in dark mode, we still render the paper surface — the brand metaphor cannot survive an inverted palette. We acknowledge the cost and accept it.
- All icons paired with a visible mono label, so the tab bar passes "icon + text" guidance trivially.

## 22. Why this for Relatably

**Product values amplified.** Relatably is a *daily ritual*: one push, one question, one verdict. Editorial Daily literally treats it as a published edition — folios, mastheads, decks, "vol. I no. 042" — turning the ephemeral push into something that feels owned and archivable. The archive doesn't just look like a list; it reads like a back-catalog of issues. This makes the streak feel like a *subscription* the user keeps current, not a *scoreboard*.

**Audience pulled in.** Gen Z is the audience that turned vinyl, polaroid, film cameras and physical media into status objects. The same generation that scrolls TikTok also tweets photos of Substack newsletters and Are.na boards. Treating their daily takes with magazine-grade typography is a flex they recognize and screenshot. The italic serif question is meme-shaped: it photographs well, it quotes well, it's the *anti*-toxic-lime visual of the current iOS build.

**Risks accepted.** (1) This direction does not look like a "social game" at first glance — Kahoot/BeReal users may not parse the leaderboard as a competition. We accept that and lean on the verdict + crown to carry the win-state. (2) Cream + serif reads "older" to some Gen Z eyes — we're betting the *quote-Substack-on-Twitter* segment is louder than the *lime-and-emoji* segment, and that this is the direction that survives a screenshot in iMessage. (3) No dark mode is a real constraint — if the App Store reviewer expects it, we ship a `prefers-color-scheme` no-op and a tiny in-app explainer ("Relatably is a paper-first app"). The cost of supporting dark mode would be re-inventing the entire metaphor.

## 23. Implementation note

Stack: React Native with `StyleSheet` for layout and `react-native-svg` for the inline icons and the cloud underline. Source Serif 4, IBM Plex Sans, and JetBrains Mono ship as bundled `.ttf` assets and register via `expo-font` so we never depend on a network font fetch in production. The wordcloud is **not** a packed-spiral component — it is a hand-positioned `<View>` stage with absolute coordinates derived from a tiered size function (XL / L / M / S / XS) chosen per-day so each issue composes like a real front page.
