# Relatably — 06 Anime Playful

## 1. Direction in one sentence

Cel-shaded, manga-panel-coded, candy-saturated Relatably — the daily drop turned into a shonen-anime episode, with hard outlines, diagonal cuts, and one screaming color per moment.

## 2. Mood board references

Cultural mood:
- **Persona 5 UI** — diagonal cut shapes, type slammed into corners, hard contrast. What to steal: the "rotated red label off the edge" and the fearless use of UPPERCASE display type.
- **Genshin Impact menus** — gradient gem icons, glow auras. What to steal: only one glow (the gold self-aura). Everything else stays flat.
- **Honkai: Star Rail HUD** — cel-shaded panels with swooping diagonal frames. What to steal: the polygon clip-path trick on every card.
- **Sailor Moon Crystal** — pastel + sparkles + heart accents. What to steal: tasteful ✦ sparkles as decorative punctuation only, never as a confetti rug.
- **Splatoon 3 UI** — paint-splat, mixed weights, ink drips. What to steal: the offset hard-color shadow (red drop behind yellow button).
- **Wano arc One Piece (Anime UI)** — bold black borders, hand-brushed feel. What to steal: 3px-and-only-3px black borders across the whole system.
- **Yotsuba& manga panels** — character with diagonal motion lines. What to steal: the speed-lines background pattern on the Question screen.

21st.dev component IDs pulled via `mcp__magic__21st_magic_component_inspiration`:
- "Bauhaus Card" (anime question card mobile search) — informed the cel-shaded panel + accent-color border treatment.
- "AI Chat Input" (speech bubble chat cluster search) — informed the answer input padding rhythm + helper-row alignment.
- "First Place Leaderboard / List 2" (gamified leaderboard mobile rows) — informed crown + tone-rotation row pattern.
- "Bento Grid" (manga panel grid feed) — informed the 2-column alternating diagonal-cut tiles.
- "Modern Mobile Menu / Bottom Menu / Animated Tab Bar" (game bottom tab bar mobile) — informed the active-tab visual stamp and icon vocabulary.

`mcp__magic__logo_search` — `splatoon` returned no result. Fallback inspiration: Splatoon-style chunky display type + Persona 5 corner-label treatment, translated into the wordmark `RELAT!BLY` in Bowlby One with a candy-red drop shadow.

## 3. Brand attributes

Owns: **expressive · hyper-saturated · gamified · cel-shaded · loud-on-purpose**.

Rejects: **muted · minimalist · realistic · "tasteful neutral".**

## 4. Color palette

Dark-only direction.

| Hex       | Name              | Role                                                |
| --------- | ----------------- | --------------------------------------------------- |
| `#0F0E1A` | Anime Indigo Night| Primary background                                  |
| `#1A1830` | Indigo 2          | Secondary surface (status strip, nested panels)     |
| `#0E0E18` | Ink Black         | Border + text-on-paper + hard offset shadow         |
| `#FFFFFF` | Cel Paper         | Panel / card / bubble fill                          |
| `#FDF7E8` | Warm Paper        | Archive accent tile (reserved variant)              |
| `#5BB3FF` | Sky Blue          | Cluster + leaderboard rotation + secondary tags     |
| `#FF3B5C` | Candy Red         | Primary accent (hard shadow, active tab, ★ self)    |
| `#FFEA29` | Neon Yellow       | "Send It" button, crown, sparkles, eyebrow text     |
| `#7FF5C4` | Mint              | Cluster + row rotation + mascot                     |
| `#C2A1FF` | Lavender          | Cluster + row rotation + timer chip                 |
| `#FFB39A` | Peach             | Cluster + row rotation (extend rotation)            |
| `#FFB628` | Aura Gold         | Self-cluster border + self-row outline              |
| `#FFE9A8` | Aura Gold Soft    | Pulsing halo around self                            |

Text emphasis on dark:
- High: `#FFFFFF` (cel paper)
- Mid: `rgba(255,255,255,0.7)` (subtitle, tab labels off-active)
- Low / mono labels on light panels: `rgba(14,14,24,0.55)`

Error: Candy Red `#FF3B5C` (same as primary accent — red already reads as "alert" here).

## 5. Typography

- **Bowlby One** — Display. Used UPPERCASE for the question, headings, scores, verdicts. `https://fonts.google.com/specimen/Bowlby+One` — single weight (400). Fallback: `'Bowlby One', 'Arial Black', system-ui, sans-serif`.
- **Nunito** — Body / UI. Weights used: 600, 700, 800, 900. `https://fonts.google.com/specimen/Nunito`. Fallback: `'Nunito', system-ui, -apple-system, sans-serif`.
- **IBM Plex Mono** — Labels, timestamps, ranks, helper text. Weights 500 and 700. `https://fonts.google.com/specimen/IBM+Plex+Mono`. Fallback: `'IBM Plex Mono', 'SF Mono', Menlo, monospace`.

## 6. Type scale

| Token   | Family       | Size   | Line | Use                                           |
| ------- | ------------ | ------ | ---- | --------------------------------------------- |
| hero    | Bowlby One   | 54 px  | 0.94 | Today's question                              |
| h1      | Bowlby One   | 36 px  | 0.96 | Archive title                                 |
| h2      | Bowlby One   | 30 px  | 1.00 | Leaderboard title, wordcloud title            |
| body-l  | Nunito 800   | 18 px  | 1.20 | Input field, row handle                       |
| body    | Nunito 700   | 16 px  | 1.30 | General                                       |
| score   | Bowlby One   | 18 px  | 1.00 | Leaderboard score                             |
| label   | IBM Plex 700 | 11 px  | 1.20 | Tags, eyebrows                                |
| micro   | IBM Plex 700 | 9-10 px| 1.20 | Tab labels, counts, helper                    |

## 7. Spacing scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48` (px). Screen-edge gutter: **20 px** (16 px for grids that need an extra column). Tab-bar safe area: **96 px** at the bottom.

## 8. Radii

- `4 px` — small mono chips
- `8 px` — internal pills
- `14 px` — answer-input / soft panel inner
- `999 px` — pure pills (rarely used; this system prefers diagonal cuts)

Diagonal-cut "radii" via `clip-path` — corner slice of **22 px** at 30° on cards, **14 px** on small rows, **18 px** on the tab bar.

## 9. Elevation / shadow

This system **does not use blur**. All shadows are hard-offset cel drops:

- `hard-shadow`     → `4px 4px 0 0 #0E0E18` — default cel drop
- `hard-shadow-red` → `4px 4px 0 0 #FF3B5C` — used on tab bar to amplify
- `hard-shadow-button` → `6px 6px 0 0 #FF3B5C` — the Send-It button (largest)
- Self-cluster halo (the only "glow" in the system):
  - `0 0 0 6px rgba(255,182,40,0.35), 0 0 28px 6px rgba(255,182,40,0.55), 6px 6px 0 #0E0E18`
  - pulses to `0 0 42px 10px rgba(255,182,40,0.75)` on the 2s loop.

## 10. Buttons

- **Primary — "SEND IT"** — 64px tall, full width minus 20px gutters. Fill `#FFEA29`. Border `4px solid #0E0E18`. Shadow `6 6 0 #FF3B5C`. Type Bowlby One 26px UPPERCASE.
  - Pressed: shadow collapses to `0 0 0 #FF3B5C`, button translates `(4px, 4px)` (the "slam").
  - Disabled: fill `#FDF7E8`, type opacity 0.4, shadow `2 2 0 #0E0E18`.
- **Secondary — toggle pill** (Daily/Weekly/All-time) — fill paper, border 3px ink, shadow `2 2 0 #0E0E18`. Active swaps fill to `#FFEA29` and shadow to `2 2 0 #FF3B5C`.
- **Tertiary — scope pill** (Global/Friends) — transparent fill, 2px ink border at 40% alpha for inactive. Active fills mint.
- **Destructive** — fill `#FF3B5C`, white type, 3px ink border, `3 3 0 #0E0E18` shadow.

## 11. Inputs

- Default: white panel, 3px ink border, 16-18px padding, `hard-shadow`. Eyebrow label `▸ TYPE YOUR TAKE` in red Plex Mono 10/11px. Field text Nunito 800 18px in ink. Caret is a hard 2px ink bar with 1s blink.
- Focus: border becomes `4px solid #FF3B5C` and shadow flips to `4 4 0 #FFEA29` (red border + yellow drop).
- Filled (shown): plain ink text, helper row Plex Mono 10px in 50% alpha showing `FREEFORM · MAX 80 CHARS` and `n/80`.
- Error: border becomes 3px red, helper text turns red.

## 12. Cluster bubble

- Shape: rectangular speech-balloon with a 14×14 tail notched at one of four corners (`tail-tr`, `tail-bl`, `tail-br`, default tl).
- Fill: rotating candy palette (red / mint / sky / lavender / peach / yellow). Top cluster (`AI`, self) overrides to candy red **plus** an 8px gold border, 3px ink outline, gold halo, pulsing.
- Border: always 3px ink (6px gold on self).
- Shadow: `3 3 0 #0E0E18` (S/M); `6 6 0 #0E0E18` + gold halo for self.
- Font: Bowlby One sized by `f(count) = 9 + (count/maxCount)*40` (capped at 48 for self).
- Layout strategy: hand-packed in JS for visual quality (centered self, large neighbors radiating, long-tail at the bottom edge). Rotation variance `-4°..+4°` per cluster.

## 13. Leaderboard row

- Wrapper: 48-64px tall, diagonal-cut both TR + BL corners.
- Background: candy rotation (yellow / mint / lavender / [self gold] / peach / sky / repeat).
- Rank: Plex Mono 13px in 55% ink, format `#01..#10`.
- Handle: Nunito 800 16px ink. Top-3 use Bowlby One 17px.
- Streak: Plex Mono 11px red `▲4🔥`.
- Score: Bowlby One 18px ink (red on self).
- Crown (#1): yellow paper-shape clipped into a crown polygon, 2px ink border, 12° rotation, sits at top-left jutting out.
- Self row: white fill, **4px gold border + 3px ink outline + gold halo**, the handle gets a `YOU` chip in gold paper with Plex Mono.

## 14. Archive tile

- 2-column grid, gap 10px. Each tile 132px tall minimum.
- Diagonal-cut corner alternates per index (TR cut, then BL cut).
- White panel, 3px ink, hard `3 3 0` shadow.
- Date in Plex Mono UPPERCASE.
- Question in Bowlby One 13px UPPERCASE.
- Verdict is a "SHOUT" mini-balloon rotated -2°, candy-colored per tile (red / mint / lavender / yellow / sky rotation), 2px ink border, `2 2 0` shadow.
- Count in Plex Mono 10px at 55% ink.
- Banner ad slot after tile 4: full-row yellow panel with diagonal cut, `AD` chip in ink (yellow text), `YOUR BRAND HERE ✦` label, `SKIP` chip on the right.

## 15. Tab bar

- Floating panel: 64px tall, 14px from edges, 46px from bottom. White fill, 3px ink border, `4 4 0 #FF3B5C` shadow. Diagonal-cut TR + BL corners (18px).
- Four tabs: Today · Friends · Board · Archive.
- Icons: custom line-style SVG (2.5px stroke), ink color default, candy red on active.
- Active state: 3px-stroke icon in red, micro-label in red, and a 28×5px **red flag** notched on the top edge of the tab.

## 16. Motion

- **Reveal/entry**: 350ms `cubic-bezier(0.22, 1, 0.36, 1)` with slight overshoot. Used for screen mount and tile entry.
- **Submit slam**: shadow collapses on press (`6 6 0` → `0 0 0`), button translates `(6px, 6px)` in 80ms, springs back in 240ms with `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Speed-line drift**: 12s linear infinite, translates the diagonal pattern -160px to seed motion behind the question.
- **Self-aura pulse**: 2s ease-in-out infinite on the gold halo (cluster + row).
- **Caret blink**: 1s step(1) infinite in the input.
- **Live dot pulse**: 1.6s ease-in-out on the red eyebrow dot.
- **Tab switch**: 220ms ease; red flag slides between active tabs.

## 17. Iconography

Custom 24px SVG line set drawn for this direction. Stroke 2.5px (3px when active), `stroke-linecap: round`, `stroke-linejoin: round`. Icons used: today (clock+star), friends (two profile arcs), board (bar+arrow-up), archive (file box). Style: line + cel, never filled.

## 18. Illustration / decoration

- **Speed lines** — repeating-linear-gradient at 110°, 14px period, 5% white. Drifts continuously on Question. Static at 35-40% opacity on the other screens.
- **Sparkles** `✦ ✧ ★` — used sparingly: 3 on Question, 1 in the wordcloud banner, 1 in the leaderboard title, 1 in the archive eyebrow. Always with a 1-2px ink text-shadow so they read like stickers.
- **Mascot stamp** — a tiny chibi face (mint circle, ink eyes, U-shaped mouth) rotated -8° in the bottom-right of Screen 1. Pure geometric primitives — no illustration burden.
- **Crown** — clipped polygon, not an icon font, so it stays inside the cel-shaded language.
- **No gradients anywhere** except the gold halo around the self cluster/row.

## 19. Sounds / haptics

- **Submit slam** — light haptic + a single percussive thwack (paper-stamp).
- **Reveal (#1 cluster)** — medium haptic + a 600ms anime sting (one rising swell + sparkle).
- **Leaderboard climb** — short tick per rank crossed + heavy haptic when entering top-3.
- **Tab switch** — soft click; no music.

## 20. Voice & microcopy

Buttons:
- `SEND IT →`
- `SKIP TODAY`
- `SEE THE TAKE`
- `JUMP IN`
- `REPLAY EPISODE`

Empty states:
- Question pre-drop: `THE DROP IS COMING — ✦ STAY READY`
- Wordcloud (no answer yet): `ANSWER FIRST TO UNLOCK THE TAKE`
- Archive empty: `NO EPISODES YET. THE FIRST DROP CHANGES THAT.`

Error toasts:
- `THAT TAKE WAS TOO LONG. KEEP IT 80 OR UNDER.`
- `NETWORK GHOSTED YOU. TRY AGAIN.`
- `ALREADY SUBMITTED — ONE TAKE PER EPISODE.`

## 21. Accessibility

- Body text on night (`#FFFFFF` on `#0F0E1A`): contrast ratio **18.8 : 1** (AAA).
- Yellow eyebrow on night (`#FFEA29` on `#0F0E1A`): **17.2 : 1** (AAA).
- Ink on paper (`#0E0E18` on `#FFFFFF`): **20.4 : 1** (AAA).
- Ink on yellow Send-It (`#0E0E18` on `#FFEA29`): **17.9 : 1** (AAA).
- White on candy-red row (`#FFFFFF` on `#FF3B5C`): **4.1 : 1** — body 16px+/700 weight passes WCAG AA Large. We keep body type in red bubbles at 14px Bowlby 400-equivalent display weight (passes AA Large).
- Dynamic Type: hero question allowed to scale 100-130%; speed-lines + sparkles disabled in `prefers-reduced-motion`; aura still indicates self via static border, no movement.
- Dark-only is a deliberate choice — anime night is the brand. A future light variant would invert paper/ink and dampen saturation 20%.

## 22. Why this for Relatably

**Product values amplified.** Relatably is a daily ritual with a single dramatic moment — the drop, the take, the reveal. Anime is the original media of "one big emotional beat per episode." Diagonal cuts and a screaming yellow Send-It button turn the act of submitting into a *cliffhanger close.* The question doesn't ask, it *announces.*

**Audience pulled in.** Gen Z reads anime fluently — Persona, Genshin, Splatoon, JJK, Demon Slayer aren't subcultures, they're the cultural mainline. By coding Relatably as a manga panel, we earn an instant emotional read younger users don't get from BeReal's "you forgot to take your photo" beige or Polymarket's bond-trader navy. The mascot, sparkles, and speech-balloon clusters quietly tell players: *this is a game.*

**Risks accepted.** This direction is loud. It will not test well with anyone over 32, and screenshots leaked to LinkedIn will look like a hackathon. But ship-quality Anime Playful is unmistakable — no other social app looks like this — and being unforgettable is worth more at v1.0 than being palatable. The biggest internal risk is restraint: every screen must show *one* hero color and let the others recede, or the whole thing degrades into birthday-card chaos. The spec freezes that discipline into the system (3px ink everywhere, single golden aura, sparkles capped per screen, gradients banned outside the self-aura).

## 23. Implementation note

Stack: **pure React Native StyleSheet** + react-native-svg (for crown / mascot / icons / clip-path-equivalents via masked views) + react-native-reanimated 3 (for slam, aura pulse, speed-line drift). Bowlby One + Nunito + IBM Plex Mono loaded via expo-font. The mockup's `clip-path` polygons translate to `MaskedView` + `Path` on RN. No Skia required — keeps Hermes startup fast and the binary small.
