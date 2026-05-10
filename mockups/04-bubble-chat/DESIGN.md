# Relatably · Direction 04 — Bubble Chat

## 1. Direction in one sentence
Soft pastel group-chat warmth — Relatably as a friendly daily message from the world, rendered in rounded grotesque, springy bubbles, and a dusty-rose send button.

## 2. Mood board references
- **Hinge** — soft pastel cards, big rounded buttons, generous whitespace. Steal: pill buttons + warm paper background.
- **Geneva** — warm bubble-chat aesthetic where the app *is* the message thread. Steal: chat-room layout as a primary surface.
- **Lapse** — dreamy pastel warmth, hand-feel. Steal: the willingness to use real italic serif for personality.
- **iMessage reactions** — round bubble UI, color-coded sender. Steal: incoming-left / outgoing-right metaphor as a visual encoding.
- **Telegram pastel themes** — colored chat bubbles per cluster. Steal: tints (not opaque pastels) so density stays legible.
- **BeReal** — pastel accents on a confident neutral. Steal: restraint — only 4 pastels, not the whole rainbow.
- **Mubi mobile** — restrained warm cinematics, type-driven. Steal: serifs used sparingly for emotional accents.
- **21st.dev: Chat Interface (similarity 0.6)** — tail-rounded bubbles with directional radius. Used the asymmetric border-radius idea on `.q-bubble` and `.wc-bubble`.
- **21st.dev: First Place Leaderboard** — round avatar + crown overlay + rank pill. Translated to a single-row format with pastel rank circles.
- **21st.dev: Input with end inline button** — inline circular send button. Reshaped to a pill input with a 40px gradient circle send.
- **21st.dev: Modern Mobile Menu** — pill-active tab pattern. Used as basis for the floating pill tab bar.

## 3. Brand attributes
**Owns:** warm, friendly, human-sized, soft, conversational.
**Rejects:** edgy, clinical, dark-mode-default, neon, brutalist.

## 4. Color palette
*Direction is light-only* — designed for paper-warm rendering. (A dark variant is possible later but the warmth is load-bearing.)

| Hex       | Name              | Role |
|-----------|-------------------|------|
| `#FBF8F3` | paper             | background |
| `#FFFFFF` | surface           | bubbles, cards, tabbar |
| `#1F1A24` | ink               | primary text, active tab, logo mark |
| `#2E2733` | ink-soft          | high-emphasis on tinted surfaces |
| `#6B6473` | subtext           | meta, timestamps, secondary copy |
| `#F5A3B7` | dusty rose        | primary accent — top cluster, send, #1 rank |
| `#E78AA0` | rose-deep         | send-button gradient end, serif accents |
| `#A0E3C8` | mint              | live indicator, #2 rank, success |
| `#C8B5FF` | lavender          | self-highlight (you), input focus ring |
| `#B49CFF` | lavender-deep     | self score, focused caret |
| `#FFCBA0` | peach             | time, #3 rank, streak flame |
| `#F08585` | error             | invalid state |
| `#FDE7EC` | rose tint         | count chip, archive accent tint |
| `#E6F8EF` | mint tint         | scope-on pill, archive accent tint |
| `#EDE5FF` | lavender tint     | self-row background, status banner |
| `#FFEBD7` | peach tint        | time card icon halo, archive accent |

## 5. Typography

### Hanken Grotesk (display + body)
- Google Fonts: <https://fonts.google.com/specimen/Hanken+Grotesk>
- Weights: 500 / 600 / 700 / 800
- Use: every UI string except the rare serif accent and monospace meta.
- Fallback: `'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif`

### DM Serif Display (accent)
- Google Fonts: <https://fonts.google.com/specimen/DM+Serif+Display>
- Weights: 400 / 400-italic
- Use: VERY sparingly. Verdict words in archive, "—AI" emphasis in status banner, italicized words in the question text and the page title. Never structural.
- Fallback: `'DM Serif Display', Georgia, serif`

### DM Mono (numbers + meta)
- Google Fonts: <https://fonts.google.com/specimen/DM+Mono>
- Weights: 400 / 500
- Use: timestamps, counts, "TIME LEFT", percentages, streak counts, ad bug.
- Fallback: `'DM Mono', ui-monospace, 'SF Mono', Menlo, monospace`

## 6. Type scale
| Token   | px / lh             | Family · Weight     | Use |
|---------|---------------------|---------------------|-----|
| hero    | 84 / 78 (0.92)      | Hanken 800 / Serif italic 400 | page title |
| h1      | 30 / 34 (1.12)      | Hanken 700          | Question text |
| h2      | 26 / 25 (0.95)      | Hanken 800          | Leaderboard / Archive titles |
| h3      | 22 / 22             | Hanken 800          | Wordcloud title |
| body-l  | 19 / 28 (1.45)      | Hanken 500          | header subtitle |
| body    | 15 / 22             | Hanken 600          | input text, lb-name, ar-q |
| body-s  | 13 / 16 (1.25)      | Hanken 600          | archive question |
| label   | 12 / 14             | Hanken 600          | period segment, pill chips |
| micro   | 10–11 / 12          | DM Mono 500         | timestamps, counts, tab labels |
| atom    | 8–9 / 12            | DM Mono 500 / Hanken 700 | ad bug, you-tag |
| cluster-XL | 56 / 52         | Hanken 800          | top-cluster word "AI" |
| verdict | 16 / 17             | DM Serif Display italic 400 | archive verdicts |

## 7. Spacing scale
4-step kernel scale, all spacing pulled from this set:
- `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`
- Screen-edge gutter: **22px** (Question), **18–20px** (Cloud / LB / Archive). Tabbar pads `12px` from frame edge.

## 8. Radii
| Token    | Value   | Used on |
|----------|---------|---------|
| pill     | 999px   | buttons, segments, count chips, tabbar, send |
| input    | 28px    | answer input |
| bubble   | 22px    | wordcloud bubbles (with directional 8px tail corner) |
| card     | 24px    | (reserved) |
| tile     | 18–20px | archive tiles, lb rows, time card |
| logo     | 18px    | header logo mark |

## 9. Elevation / shadow
| Token        | Spec |
|--------------|------|
| `--shadow-soft` | `0 8px 24px rgba(31, 26, 36, 0.06)` — every bubble, tile, row |
| `--shadow-lift` | `0 12px 32px rgba(31, 26, 36, 0.10)` — tabbar, self-row, top cluster |
| send glow    | `0 6px 14px rgba(231, 138, 160, 0.45)` — send button only |
| lavender glow | `0 10px 18px rgba(180, 156, 255, 0.40)` — self-cluster mini bubble |
| top-cluster  | `0 12px 24px rgba(231, 138, 160, 0.30)` — only the dominant rose bubble |

## 10. Buttons
- **Primary (Send)** — 40px round, rose→rose-deep gradient, white up-arrow, send-glow shadow. Pressed: `transform: scale(0.96)` then springs back to 1.0 via `cubic-bezier(0.34, 1.56, 0.64, 1)` 250ms. Disabled: 60% opacity, no shadow.
- **Secondary (pill segment)** — `padding 7px 14px`, Hanken 600 12/14, pill radius. Default: `rgba(31,26,36,0.06)` track + subtext. On: ink fill + paper text + `0 4px 10px rgba(31,26,36,0.20)`.
- **Tertiary (icon button)** — 36px circle, surface fill, ink icon, `--shadow-soft`. Hover/press: scale 0.95.
- **Destructive** — same shape as primary, fill `#F08585`, white icon. Reserved for delete confirmation.

## 11. Inputs
**Answer input (the only input in v1):**
- Container: `padding 6px 6px 6px 18px`, radius 28, white fill, `--shadow-soft` + 2px lavender inset ring (the focus state is the default — it's always the active surface).
- Text: Hanken 600, 15px, ink.
- Placeholder: same size, ink @ 100% (we treat the placeholder as a literal "type a take" call to action, not greyed-out micro-copy).
- Caret: 2px wide, lavender-deep, 1Hz blink.
- Filled: same; submit-eligible state is signalled by send button going full opacity.
- Error: replace lavender ring with `#F08585`, add micro toast above input.

## 12. Cluster bubble
**Shape:** rounded rectangle, base radius 22px. ONE corner is collapsed to 8px to form the iMessage tail — bottom-left for incoming clusters, bottom-right for outgoing (self).

**Fill / border:** all bubbles are FILLED pastel tints (`v-rose`, `v-mint`, `v-peach`, `v-lavender`, `v-white`). No borders — separation comes from shadow + tint contrast against the paper background. The `v-rose-d` solid is reserved for the secondary attention-grabber (e.g. cluster #2).

**Shadow:**
- S/M bubbles: `--shadow-soft`.
- Top cluster: `0 12px 24px rgba(231, 138, 160, 0.30)`.
- Self cluster (mini lavender): `0 10px 18px rgba(180, 156, 255, 0.40)`.

**Font-size formula:** `size = clamp(10, 12 + 56 * (count / maxCount), 56)px`. Top cluster overrides to a fixed display 56px. Hand-tuned override map in the JS so the layout reads.

**Self-highlight:** the AI cluster is BOTH #1 and the user's submission. We dual-encode it:
- The dominant top cluster shows the word "AI" with a crown badge + "matches your call" microcopy.
- A separate small lavender outgoing bubble ("you called it ♥") sits adjacent, in the right rail, in self-lavender — so even at a glance, the lavender color rule for "you" holds.

**Layout strategy:** chat-room. Vertical flow. Incoming bubbles anchor left, outgoing anchor right, mid-size float-mixed. Positions hand-tuned for 393×759 canvas. NOT a force-directed cloud — the readability win is in the chat metaphor, not packing density.

## 13. Leaderboard row
- Row: white surface, 18px radius, `--shadow-soft`, `padding 10px 12px`, 6px vertical gap.
- Grid: `34px rank | 1fr handle | auto score`.
- **Rank cell:** 28px circle. #1 rose / #2 mint / #3 peach / 4–10 grey-tint. Hanken 700 13px ink.
- **Crown:** 16px ink circle floating top-right of rank #1, rose icon inside. Only on row 1.
- **Handle block:** 26px round pastel avatar (cycled palette) + name in Hanken 600 14/15 ink + streak line in DM Mono 9 / peach flame dot.
- **Score:** DM Mono 500 14, ink. Right-aligned.
- **Self-highlight (row 4 — levin):** lavender-tint → deeper lavender vertical gradient fill, 1px lavender border, `--shadow-lift`, score recolored to lavender-deep. A `YOU` pill (deep lavender, white text, DM Mono 8 uppercase) sits inline after the handle.

## 14. Archive tile
- Surface: white, 18px radius, `--shadow-soft`, `padding 12px 14px 12px 18px`.
- 5px-wide pastel left edge accent strip (rose / mint / lavender / peach cycled).
- Top meta row: date (DM Mono 10 uppercase subtext) ↔ count (DM Mono 9).
- Question: Hanken 600 13px ink.
- Verdict: DM Serif Display italic 16px in the accent's mid-tone (e.g. `#B5475D` for rose). Wrapped in straight double-quotes.
- Banner-ad stub after tile #4: dashed border, ink AD bug, ink title in Hanken 600 12, mono sub.

## 15. Tab bar
- Floating pill, white fill, `--shadow-lift`, 12px from left/right edge, 22px from bottom (above home indicator).
- 4 items in order: **Today · Friends · Leaderboard · Archive** (chat-bubble · users · star · book icons).
- Inactive: 22px ink-line icons, subtext color.
- Active: ink fill round 60×44 → paper-color icon, plus a 4px ink dot 10px below — the "you are here" anchor. Mono micro-label appears below active tab only.

## 16. Motion
| Event | Duration | Easing | Notes |
|-------|----------|--------|-------|
| Submit (send press) | 250ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | scale 0.96 → 1.0 spring overshoot |
| Cluster entry | 250ms each, 60ms stagger | same spring | scale 0 → 1, fade in |
| Top-cluster reveal | 400ms | same spring | scale 0.7 → 1.0, plus crown rotate 0→6° |
| Cluster pulse (live) | 1.8s loop | `ease-out` | mint live-dot expanding halo |
| Tab switch | 200ms | `ease-in-out` | slide 8px + fade |
| Caret blink | 1s loop | `steps(1)` | 50% opacity flip |
| Input focus | 180ms | `ease-out` | ring opacity 0.7 → 1.0 |
| Lb row enter | 220ms, 40ms stagger | same spring | translateY 12px → 0, fade |

## 17. Iconography
- Custom inline SVG, **outlined**, 2px stroke (`stroke-width: 2`–`2.2`), round caps + joins.
- 22px in the tab bar, 18px in icon buttons, 14–16px inline in chips and status icons.
- The crown is the only filled icon — it's a brand element, not a UI element.
- Style: feather/lucide-adjacent, but rounder corners (matches the bubble vocabulary).

## 18. Illustration / decoration
- **Page background:** four soft radial gradients (rose top-left, lavender top-right, mint bottom, paper base) — looks like a paper sketch lit by 4 colored bulbs. NOT a solid color, not a hard mesh.
- **Logo mark:** 56px ink-filled rounded square containing a chat bubble silhouette with three colored dots inside (rose / lavender / mint). Wordmark "relatably." with a rose period — the dot is the brand.
- **No stickers, no emoji confetti, no grain, no patterns.** Restraint is the move; the chat metaphor does the heavy lifting.

## 19. Sounds / haptics
- Submit: `submit_pop.caf` — a single soft "boop." Haptic `UIImpactFeedbackGenerator(.light)`.
- Reveal: `reveal_chime.caf` — three-note pastel arpeggio. Haptic `.medium`.
- Leaderboard climb: `rank_up.caf` — quick rising blip. Haptic `.soft` rigid.
- Bubble tap: silent. Haptic `.selection`.
- Live ticker: silent (visual mint pulse only).

## 20. Voice & microcopy

**Buttons (5):**
1. `send`
2. `share take`
3. `see the cloud`
4. `tap to call it`
5. `keep streak alive`

**Empty states (3):**
1. *No friends yet:* "no friends in here yet. invite one — it gets better with company."
2. *No archive:* "nothing in the archive. tomorrow's the first one — see you at the drop."
3. *Pre-submit cloud:* "type a take to see what the world thinks."

**Error toasts (3):**
1. *Network:* "couldn't send. check your connection?"
2. *Duplicate cluster:* "we already heard that one from you — try a different angle."
3. *Past window:* "this question's closed. catch the next drop at 6:34 PM UTC."

**Headers / chrome:**
- App-as-sender name: `relatably`
- Live indicator: `live · 12,847 takes · 87 countries`
- Self confirmation pill: `you called it ♥`
- Status banner: `your take is in — AI`
- Time card: `time left · 21h 42m`

## 21. Accessibility

**Contrast (WCAG):**
- Ink `#1F1A24` on paper `#FBF8F3` → **15.2 : 1** (AAA, body and headlines).
- Subtext `#6B6473` on paper `#FBF8F3` → **5.1 : 1** (AA at 11px+).
- Ink on rose `#F5A3B7` → 8.4 : 1 (AAA — top cluster word stays ink, never white).
- Ink on lavender `#C8B5FF` → 7.6 : 1 (AAA — self row + self bubble).
- Ink on mint `#A0E3C8` → 9.1 : 1 (AAA).
- DM Mono subtext on tints (10px) — minimum 4.6:1; we keep mono at 10px+ and ink-soft on weakest tints.

**Dynamic type:**
- Hanken Grotesk scales linearly via UIKit Dynamic Type. Hero / cluster-XL clamped at 1.2× max (text-overflow shouldn't break the chat-room layout). Body, label, micro scale to 1.4× without clipping.

**Dark/light:**
- v1.0 ships LIGHT-ONLY. Dark is on roadmap as a "midnight bubble" variant — ink-near-black `#1F1A24` background, paper-warm text, same pastels desaturated 15%. Deliberately not v1 — the brand's warmth depends on paper.

**Motion:**
- All spring animations respect `prefers-reduced-motion: reduce` → cross-fade only, 120ms ease-out, no scale/translate.

**Hit targets:**
- All interactive elements ≥ 40×40 (send is exactly 40, tab items 60×44, icon buttons 36 within a 44 padded touch zone).

## 22. Why this for Relatably

**Product values amplified.** Relatably is a *daily message from the world*. The chat-bubble metaphor isn't metaphorical — it's literal. The question arrives as an incoming message; your take goes out as the right-aligned reply; the cluster of everyone's takes is the room talking back. The interaction model and the visual model collapse into one, which is the highest possible coherence for a single-feature daily app. Every other direction is decorating a feed; Bubble Chat *is* the product.

**Audience pulled in.** Gen Z lives in iMessage, Snapchat, Geneva, Discord. The unspoken expectation is that "social" looks like "chat." A wordcloud reframed as a chat room (incoming/outgoing/tail/avatar dot) makes the app feel intimately familiar from frame one — the question screen is indistinguishable from the lockscreen push, the cloud is the group chat scrolling, the leaderboard is "your friends just got a notification." The pastel palette + DM Serif Display italics are the Lapse/Mubi/BeReal vibe that signals "this is *for me*, not for marketers."

**Risks accepted.** (1) The chat-room cloud is the hardest to scale beyond ~30 clusters — past that we'd need horizontal scroll or zoomable canvas. We accept this: the 95% case is 20-30 clusters and a hand-tuned layout reads better than auto-packed for that range. (2) Pastels can collapse into "soft = unserious" if the type system slips. Hanken Grotesk 800 + DM Mono numerics carry the weight; lose discipline there and it goes Pinterest mood-board. (3) The dual-encoding of "AI is both #1 and yours" requires two visual moves at once (rose top cluster + lavender mini bubble); if AI weren't simultaneously top-and-self, only one would fire — we lean into the rare-but-best case. (4) Light-only narrows the OLED-saver crowd, but the warmth is non-negotiable for this direction's identity. A dark variant is a v1.1 problem.

## 23. Implementation note
Stack: pure React Native StyleSheet for the four screens. Hanken Grotesk + DM Serif Display + DM Mono shipped in `assets/fonts/` and registered via `react-native-asset`. Cluster bubble = a `<Pressable>` with `borderBottomLeftRadius: 8` (incoming) or `borderBottomRightRadius: 8` (outgoing) — no SVG bubble paths needed. Wordcloud positions computed once on the JS thread from cluster counts and a deterministic layout function (max 20 nodes — fast). Springs via Reanimated 3 `withSpring({damping: 14, stiffness: 220})`. No `expo-blur`, no glass — the chat metaphor wants opaque surfaces.
