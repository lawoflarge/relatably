# Relatably — Direction VII · Premium Luxe

## 1. Direction in one sentence

A daily question app reimagined as a refined evening publication — deep ink, champagne hairlines, italic serif — quiet confidence over loud color.

## 2. Mood board references

| # | Reference | What to steal |
|---|---|---|
| 1 | **Aesop** (aesop.com) | Restrained warm tones, generous white space, italic serif used sparingly, mono uppercase tracked-out micro-labels. |
| 2 | **Dior Beauty app** | Black + gold, ample air around every element, slow motion. |
| 3 | **Apple TV intro** | Restrained dark surface + thoughtful, oversized type. |
| 4 | **Cartier mobile app** | 1.25px gold-line iconography, refined serif handles, italic display. |
| 5 | **Loro Piana / Brunello Cucinelli sites** | Quiet luxury — no shouty colour, all the texture in the type. |
| 6 | **The Row mobile UI** | Minimalism that still has presence; hairlines instead of cards. |
| 7 | **Hodinkee app** | Editorial-luxury hybrid: serif headlines, mono numerals, dated index. |
| 8 | **21st.dev — Tabs with line** (`Tabs / With line`) | Hairline-underlined active tab pattern translated to champagne. |
| 9 | **21st.dev — TagCloudSelect** | Size-by-popularity tag cloud — translated from chip-fills into hairline-outlined ovals. |
| 10 | **21st.dev — First Place Leaderboard** | Idea of crown-for-#1, translated into a thin gold-line crown glyph (no avatar disc, no progress bar). |

## 3. Brand attributes

**Owns:** Restrained · Refined · Editorial · Considered · Warm.

**Rejects:** Loud · Cute · Playful-bouncy · Gradient-y · Emoji-driven.

## 4. Color palette

Dark-only direction. There is no light mode.

| Hex | Name | Role |
|---|---|---|
| `#0E0D0B` | Ink | Primary background — warm-black, never blue-black |
| `#161412` | Ink Surface | Secondary surface, one step lighter (used sparingly) |
| `rgba(200, 164, 114, 0.20)` | Champagne Hairline | 1px universal divider (and 0.35 for stronger borders) |
| `#F4EFE6` | Bone | Primary text |
| `#9C958A` | Stone | Secondary text |
| `#6B6660` | Slate Stone | Tertiary text / micro labels |
| `#C8A472` | Champagne | Primary accent — buttons, ring fills, crown, self-cluster |
| `#E0C49C` | Light Champagne | Crown / called-it / verdict highlights |
| `#BB6D5F` | Muted Terracotta | Error — never bright red |

Self-cluster + #1 cluster glow: `0 0 24px rgba(200, 164, 114, 0.40)` (pulses to 0.62 at 8s).

## 5. Typography

| Family | Google Fonts URL | Weights | Use | Fallback |
|---|---|---|---|---|
| **Cormorant Garamond** | `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500` | 300 / 400 / 500 / 400-italic / 500-italic | Display, question, archive titles, leaderboard handles, verdict values | `'Times New Roman', Georgia, serif` |
| **Inter Tight** | `https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500` | 300 / 400 / 500 | Body, hints, sub-labels | `-apple-system, BlinkMacSystemFont, sans-serif` |
| **IBM Plex Mono** | `https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400` | 300 / 400 | Mono tracked uppercase labels (section eyebrows, button labels, scores, rank numbers, dates) | `ui-monospace, SFMono-Regular, monospace` |

Italic is reserved: it always means *human voice* — questions, verdicts, names, the word "you". Roman serif (rare) means *system voice*. Mono uppercase means *metadata*.

## 6. Type scale

| Token | px | line-height | Family | Use |
|---|---|---|---|---|
| Hero (page) | 88 | 0.95 | Cormorant 400 italic | Page header only |
| Display | 42 | 1.18 | Cormorant 400 italic | Question screen headline |
| H1 | 36 | 1.05 | Cormorant 400 italic | Archive title |
| H2 | 28 | 1.15 | Cormorant 400 italic | (Reserved for nested sections) |
| Cluster XL | 36 | 1 | Cormorant 400 italic | Top wordcloud cluster |
| Cluster L | 26 | 1 | Cormorant 400 italic | Tier-2 clusters |
| Cluster M | 20 | 1 | Cormorant 400 italic | Tier-3 |
| Cluster S | 15 | 1 | Cormorant 400 italic | Tier-4 |
| Cluster XS | 12.5 | 1 | Cormorant 400 italic | Long-tail (no frame) |
| Body L | 19 | 1.25 | Cormorant 400 italic | Archive question text |
| Input | 20 | 1.2 | Cormorant 300 italic | Answer field placeholder |
| Handle | 18 | 1.1 | Cormorant 400 italic | Leaderboard handles |
| Body | 14 | 1.5 | Inter Tight 300 | Body copy, subtitles |
| Body S | 12.5 | 1.55 | Inter Tight 300 | Hints |
| Mono S | 11.5 | 1 | IBM Plex Mono 300/400, tracking 0.28em | Button labels |
| Mono | 10.5 | 1 | IBM Plex Mono 300, tracking 0.22em | Eyebrow labels |
| Mono XS | 9.5 | 1 | IBM Plex Mono 300, tracking 0.22em | Column headers, dates, counts |
| Micro | 8.5 | 1 | IBM Plex Mono 300, tracking 0.22em | Tab bar labels, partner slot |

## 7. Spacing scale

Token system, base-4. Every layout value uses these — no magic numbers.

| Token | px |
|---|---|
| s-1 | 4 |
| s-2 | 8 |
| s-3 | 12 |
| s-4 | 16 |
| s-5 | 24 |
| s-6 | 32 |
| s-7 | 40 |
| s-8 | 48 |

**Screen-edge gutter:** 36px (between s-6 and s-7 — deliberately generous to read as "luxury whitespace").
**Top safe-area pad:** 78px (Dynamic Island clearance + breathing room).
**Bottom tab-bar pad:** 110px.

## 8. Radii

| Token | px | Use |
|---|---|---|
| r-0 | 0 | Default for everything — buttons, inputs, cards, partner slot, toggles. |
| r-pill | 999 | Wordcloud cluster ovals only. |

Corner radius is deliberately the boldest restraint: 0px on rectangles is what makes this read as Aesop and not as another rounded SaaS app.

## 9. Elevation / shadow

There is *one* shadow in the whole system. Everything else is hairline + ink.

| Token | Spec | Use |
|---|---|---|
| glow-champagne | `0 0 24px rgba(200, 164, 114, 0.40)`, pulses to `0 0 38px rgba(200, 164, 114, 0.62)` at 50% of an 8s loop | Self-cluster / #1 cluster only |

No drop-shadows. No inner shadows. No glassmorphism.

## 10. Buttons

| Variant | Spec |
|---|---|
| **Primary (Champagne)** | 56px tall, full-width, `background: #C8A472`, `color: #0E0D0B`, 0 radius, label `IBM Plex Mono 400 11.5px / 0.28em tracking / UPPERCASE`. After-element: an italic em-dash `—` in serif at 60% opacity. Pressed: subtle 200ms champagne underline reveals; no fill change. Disabled: bone `#F4EFE6` at 30% opacity on top of `#161412`. |
| **Secondary (Ghost)** | 56px tall, transparent background, `1px solid rgba(200,164,114,0.35)` border, `color: #C8A472`, same mono uppercase label. |
| **Tertiary (Text)** | Mono uppercase 10.5px tracking 0.22em, `color: #C8A472`. Hover/press: 200ms champagne underline reveal under the label. |
| **Destructive** | Same as secondary but `color: #BB6D5F`, border `rgba(187,109,95,0.35)`. Never a fill. |

## 11. Inputs

**Answer input** (Question screen) — *the* input that gets the most love.
- Hairline-only field. Bottom border: `1px solid #C8A472` (full-strength champagne, not faded — to signal it's the primary action).
- No box, no fill, no top/side border.
- Eyebrow label above: `MONO 10.5px / 0.22em tracking / UPPERCASE / Stone Slate color` — "Your reflection".
- Placeholder: `Cormorant 300 italic 20px Bone` — "what's your reflection?".
- Typed text: `Cormorant 400 italic 20px Bone`.
- Blinking caret: 1px-wide × 22px-tall champagne bar, 1.2s steps blink.
- Right side: live character count `MONO 10px Slate Stone` — `0 / 240`.
- Hint row below: Inter Tight 300 12.5px Slate Stone — "Anonymous by default · 240 characters".

**Focus state**: champagne bottom border thickens to 1.5px and a single champagne dot (3px) appears at the right end.
**Filled state**: typed italic text replaces the placeholder; character count climbs.
**Error**: bottom border turns `#BB6D5F`, hint becomes muted terracotta, no shake.

## 12. Cluster bubble

Wordcloud lives on a 333×460 stage inside the 36px-gutter frame. Twenty clusters laid out in a hand-tuned organic spiral, top cluster center-high — gravitationally central as required.

| Tier | Trigger | Shape | Font | Border | Fill | Notes |
|---|---|---|---|---|---|---|
| **XL** (top) | count ≥ 2500 | pill 999r, 16/28 padding | Cormorant 400 italic 36px | `1px #C8A472` | `#C8A472` | Glow `0 0 24px rgba(200,164,114,0.4)`, pulses; count micro-label in ink |
| **L** | 1000 ≤ count < 2500 | pill, 12/22 padding | Cormorant 400 italic 26px | `1px hairline` | transparent | Mono micro count label |
| **M** | 500 ≤ count < 1000 | pill, 10/18 padding | Cormorant 400 italic 20px | `1px hairline` | transparent | Mono micro count label |
| **S** | 150 ≤ count < 500 | pill, 8/14 padding | Cormorant 400 italic 15px | `1px hairline` | transparent | Mono micro count label |
| **XS** | count < 150 | no frame, no padding | Cormorant 400 italic 12.5px | none | none | Stone color, no count — pure text whisper |

**Self-highlight** (`c_ai`, which is also the XL #1): champagne fill + glow + an italic serif "you" floating 22px above the cluster in light champagne.

**Layout strategy**: hand-positioned percentages on a 2D stage, not algorithmic packing. Top cluster fixed center-high (50%, 30%) so it always feels central. Tier-L flanks below. Tier-M corners. Tier-S mid-band. Tier-XS edges as quiet accents. Positions tuned to avoid collisions at default scale.

## 13. Leaderboard row

Refined table, not card stack.

- **Grid**: `28px / 1fr / 64px / 50px` — rank, name, score, streak.
- **Column headers**: mono uppercase 9.5px tracking 0.22em, slate-stone, hairline-strong border below.
- **Row separator**: 1px champagne hairline (between every row).
- **Rank**: mono 12px slate-stone, zero-padded ("04").
- **Handle**: Cormorant 400 italic 18px bone.
- **Score**: mono 13px bone, right-aligned, slight letter-spacing 0.06em.
- **Streak**: 9px gold-line flame icon (1.25px stroke) + mono 10px count.

**Crown (#1)**: thin gold-line crown SVG (13×9, 1.25px stroke) inline before the handle. Handle and rank shift to light champagne / champagne.

**Self-highlight (#4, "levin")**:
- 1px champagne left border (full-bleed through row).
- Subtle warm-tint background gradient (`rgba(200,164,114,0.05)` → transparent at 70%).
- Handle and rank in light champagne / champagne.
- A floating `you` label (mono uppercase 8.5px 0.28em champagne, with ink background) sits at the top-right of the row — clearly identifies you without breaking the row geometry.

## 14. Archive tile

Single-column list (deliberately not a grid — column reads more like a magazine table of contents).

Each entry:
- 22px vertical padding, hairline divider below.
- Top row: date (mono uppercase 9.5px slate-stone) on left, count (mono 9.5px stone) on right.
- Body: question in Cormorant 400 italic 19px bone, 1.25 leading.
- Verdict row: mono "VERDICT" label (9px tracking 0.24em slate-stone) + the verdict in Cormorant 400 italic 14px light champagne.

**Partner slot** (after card #4): a hairline-bordered band (top + bottom hairline only — no side borders, no fill). Mono "PARTNER" label on left, italic serif body line in stone, single champagne italic arrow on right. Deliberately reads as a polite editorial sponsor mention, not an ad.

## 15. Tab bar

Four tabs, evenly distributed. Background: vertical gradient from transparent into ink at 30% (so content scrolls behind softly). Top border: 1px champagne hairline.

Each tab:
- Icon: 18px, 1.25px stroke, line style only (`stroke-linecap: round, stroke-linejoin: round`). Slate-stone in idle.
- Label: micro mono 8.5px tracking 0.22em uppercase, slate-stone.
- **Active**: icon stroke and label flip to champagne, stroke weight bumps to 1.4. A 22×1px champagne hairline sits at the top edge of the active tab (matches Cartier-style active indicator).

Icons (line, 1.25px):
1. Today — circle with a clock hand (a quiet hourglass-as-clock metaphor).
2. Friends — two overlapping line-portrait silhouettes.
3. Leaderboard — three ascending bars.
4. Archive — a slim file-cabinet drawer.

## 16. Motion

| Moment | Spec |
|---|---|
| Screen enter | 600ms cubic-bezier(0.4, 0, 0.2, 1) — opacity 0→1, translateY 8px→0. |
| Self-cluster glow | 8s ease-in-out infinite pulse from 24px / 0.4 alpha to 38px / 0.62 alpha. |
| Input caret | 1.2s `steps(1)` blink (deliberate hard cut, not fade — feels more typographic). |
| Submit press | 200ms ease — champagne underline reveals beneath label; no scale, no fill change. |
| Tab switch | 200ms ease — color change + the 22×1px champagne hairline slides 240ms ease across to the new tab. |
| Wordcloud entry | Each cluster fades in 400ms with 30ms stagger, starting from XL outward. |
| Reveal (yesterday's winner) | 800ms — hairline draws across the question card from left to right, then verdict italic fades up. |

No spring. No bounce. No scale. The entire motion vocabulary is opacity + translateY + cross-fade.

## 17. Iconography

Custom 1.25px-stroke line system, built per-icon at 18×18 (tab bar) / 14×14 (utility). No filled icons. No duotone. No rounded-fill anywhere.

Stroke caps: round. Stroke joins: round. Colour: slate-stone (idle) or champagne (active / accent). Never bone-on-bone.

## 18. Illustration / decoration

- **Champagne hairlines** — the only universal decoration. Every section boundary, table separator, and divider is a 1px champagne-tinted hairline at 20% alpha. This *is* the design language.
- **Warm grain noise** — a near-imperceptible (3.5% alpha, overlay blend) SVG fractal-noise overlay tinted with champagne hue on every screen. Mimics the texture of expensive matte paper. Disabled on devices without overlay support — degrades gracefully.
- **Champagne dots** — 3px round, used three places only: between meta items (separator dot), under the active tab, and at the right end of the focused input (focus marker).
- **No blobs. No stickers. No emoji. No gradients (except the tab-bar fade and the self-row tint, both of which are functional, not decorative).**

## 19. Sounds / haptics

- **Submit confirm**: a very soft single tap (UIImpactFeedbackGenerator `.soft`) + a faint chime sample (one bell tone, 220ms decay).
- **Reveal (yesterday's winner)**: a longer paper-rustle sound (240ms) + `.light` haptic.
- **Leaderboard climb**: silent on rank-stay, single `.rigid` haptic on rank-up (no sound — restraint).

## 20. Voice & microcopy

**Button labels** (mono uppercase tracked):
1. `SUBMIT`
2. `RETURN TO TODAY`
3. `READ THE ARCHIVE`
4. `SIGN IN WITH APPLE`
5. `SHARE`

**Empty states** (Cormorant 400 italic):
1. Friends tab: *"a quiet room. invite someone to fill it."*
2. Archive (new user, day 1): *"the archive begins tomorrow."*
3. Leaderboard (no streak yet): *"answer to be seen."*

**Error toasts** (Cormorant italic + mono micro):
1. Network: *"we couldn't reach the floor. try once more."*
2. Already answered: *"you've already weighed in today."*
3. Empty submit: *"a reflection needs a word."*

**Other in-app phrasing**:
- "today's question · monday, 11 may"
- "your reflection"
- "submit"
- "yesterday, the world said —"
- "an archive of takes"
- "you called it"

## 21. Accessibility

- **Primary text on background**: `#F4EFE6` on `#0E0D0B` = contrast ratio **15.8:1** — passes WCAG AAA for body and AAA for large text by a wide margin.
- **Secondary text**: `#9C958A` on `#0E0D0B` = ratio **6.4:1** — passes AA for body, AAA for large.
- **Tertiary text**: `#6B6660` on `#0E0D0B` = ratio **3.4:1** — used only for micro-labels (8.5–10.5px) where AA-large still applies; reserved for non-essential metadata.
- **Champagne accent on ink**: `#C8A472` on `#0E0D0B` = ratio **7.3:1** — passes AA / AAA for body.
- **Champagne button**: ink `#0E0D0B` on champagne `#C8A472` = ratio **7.3:1** — passes AAA for the mono label size.
- **Dynamic Type**: all sizes scale with iOS Dynamic Type. The Cormorant italic display reflows; line-height stays at 1.18 so descenders don't collide.
- **Reduced Motion**: respected — the 600ms enter and the 8s self-cluster pulse both become instant.
- **Dark/light**: **dark-only**. The aesthetic is intentionally evening-publication; we do not ship a light variant. The OS light/dark switch is honoured by always rendering dark (the warm noise + champagne hold up under any ambient light).

## 22. Why this for Relatably

**Product values amplified.** Relatably is a once-a-day ritual, not a feed. Every other direction in the gauntlet leans into the social-poll energy — bright, fast, gamified. Premium Luxe says the opposite: this is the *evening read*. The italic serif question, the hairline-thin input, the slow 600ms enter — they all signal "this deserves your full attention for thirty seconds." That positioning is rare in Gen-Z apps and creates an outsized perception-of-quality moat. The wordcloud renders as a constellation of refined typographic chips, not as a chaotic word soup. The leaderboard renders as a private members' ledger, not a Kahoot scoreboard. Restraint is the product value.

**Audience pulled in.** The Gen-Z thesis is wrong if read as "everything Gen Z is loud." The same generation that made Polaroid revive, made Aesop a global $2.5b brand, made The Row a status flex, and made *Letterboxd's* serif-italic film cards a flex screenshot. There is a tier of Gen Z — the tier that screenshots and shares — that responds to *quiet luxury* far more than to confetti. Premium Luxe captures that taste exactly. It's the version of Relatably that gets posted to Are.na and Substack. It's the version a *Highsnobiety* writer would cover. It cedes a part of the audience to gain a much more shareable cohort.

**Risks accepted.** The biggest risk is reading as *too serious for a meme question app*. A daily prompt like "weirdest thing you do when you're alone?" set in 42px Cormorant italic could feel like an over-claim. We mitigate this by keeping copy lowercase and human ("yesterday, the world said —", "a reflection needs a word.") so the visual feels expensive but the voice stays friendly. Second risk: dark-only excludes light-mode preference. We accept it — the moodboard demands evening ink; a light champagne variant for v2 is possible but would be an entirely different system. Third risk: italic-heavy display type at small sizes can hurt legibility. We compensated by anchoring every italic instance to ≥14px and using Inter Tight (not italic Cormorant) for any sustained reading copy.

## 23. Implementation note

Stack: pure React Native with custom `StyleSheet` — no UI library, no NativeWind, no glass kit. The system is small enough (one accent, one shadow, three fonts, zero gradients) that abstracting it through Tailwind/Restyle would cost more than it saves. SVG icons rendered through `react-native-svg`. Fonts loaded via `expo-font` with `Cormorant_400Italic`, `Cormorant_300`, `InterTight_300/400/500`, `IBMPlexMono_300/400`. Champagne glow uses a stacked `Animated.View` with `boxShadow` polyfill via `react-native-shadow-2`.
