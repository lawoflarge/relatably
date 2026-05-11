# Relatably · Direction 03 — Glass Status

## 1. Direction in one sentence

Premium dark, iridescent glass surfaces, neon violet→cyan gradient highlights — Relatably as a live opinion market.

## 2. Mood board references

- **Polymarket** — live ticker bar, mono numbers, gradient orderbook strip. Steal: top status ticker, mono numbers everywhere, "live" pink heartbeat.
- **Vercel dashboard** — black-base, geometric grids, ambient gradient glow. Steal: ambient gradient blob behind hero content, hairline borders on glass.
- **Linear** — tight type, micro-interactions, focus on speed. Steal: lowercase headlines, -0.025em tracking on display sizes, fast 200ms eases.
- **Arc browser** — colorful tabs, glass header. Steal: pill-shaped status bar, soft gradient glow on active state.
- **Cash App Stocks** — premium dark + green/red ticker. Steal: mono ranks/scores, tabular numerals, calm chrome that lets numbers speak.
- **Apple Vision Pro UI** — glass everything. Steal: 1px highlight gradient on top edge of every glass surface, backdrop blur as primary chrome.
- **Spotify Now Playing 2024** — gradient album-art glow. Steal: ambient color halo behind the wordcloud's top cluster.
- **21st.dev — Liquid Glass Card** (`/components/ui/liquid-glass-card`) — inner highlight + outer shadow stacking. Steal: layered inset highlights to keep glass from going flat.
- **21st.dev — Glass Card** (`/components/ui/glass-card`) — minimal `bg-primary-foreground/30 backdrop-blur-md` recipe. Steal: opacity + blur ratio that survives over a busy gradient background.
- **21st.dev — Stock Trends Carousel** (`/components/ui/stock-trends-carousel`) — calm mono ticker + small flame icon. Steal: the "this is a market" feeling for the leaderboard rows.
- **21st.dev — LumaBar futuristic nav** (`/components/ui/futuristic-nav`) — gradient blob behind active tab, glass pill background. Steal: active tab uses a soft gradient blob behind the icon instead of a fill.
- **21st.dev — Sliding Tabs** (`/components/ui/sliding-tabs`) — gradient indicator with blur-2xl glow underneath. Steal: gradient active-pill on Daily/Weekly/All-time toggle.

## 3. Brand attributes

**Owns:** premium, confident, live, status-coded, cinematic.
**Rejects:** cute, fluffy, retro, hand-drawn.

## 4. Color palette — dark-only

| Hex | Name | Role |
| --- | --- | --- |
| `#08090E` | Midnight indigo | Primary background |
| `#05060A` | Deeper midnight | Page outside-phone background base |
| `rgba(20,22,32,0.6)` | Glass surface | Cards, inputs, tab bar, pills (with 40px backdrop blur) |
| `rgba(28,30,42,0.7)` | Glass surface 2 | Elevated glass (modals, tooltips — not used in this mock) |
| `rgba(255,255,255,0.08)` | Hairline | 1px borders on every glass surface |
| `rgba(255,255,255,0.14)` | Hairline 2 | Border on top cluster / hover state |
| `#F5F7FA` | Text primary | Body + display |
| `#9BA1B0` | Text secondary | Labels, captions |
| `#5D6373` | Text tertiary | Mono micro-labels, disabled |
| `#7B5CFF` | Violet | Primary accent — gradient start |
| `#5CE1FF` | Cyan | Self-highlight + gradient end |
| `#FFD66B` | Gold | #1 crown only (rare) |
| `#FF4F87` | Hot pink | Live indicator heartbeat |
| `#FF6469` | Red | Error / destructive |

**Gradient (use sparingly):** `linear-gradient(135deg, #7B5CFF 0%, #5CE1FF 100%)`. Applied to brand mark, primary CTA, active pill, top cluster fill, verdict text in archive tiles, and gradient text in headlines. Nowhere else.

**Self-cluster aura:** `0 0 0 1px rgba(92,225,255,0.35), 0 0 32px rgba(92,225,255,0.45)`.

**Top-cluster aura:** `0 0 48px rgba(123,92,255,0.45), 0 0 24px rgba(92,225,255,0.3)`.

## 5. Typography

| Family | Weights | Use | Fallback |
| --- | --- | --- | --- |
| **Geist** — https://fonts.google.com/specimen/Geist | 400, 500, 600, 700 | Display + body. Lowercase only on user-facing copy. Tracking -0.025em on display, -0.01em on body. | `ui-sans-serif, system-ui, -apple-system, sans-serif` |
| **Geist Mono** — https://fonts.google.com/specimen/Geist+Mono | 400, 500 | All numbers (scores, ranks, prices, timers). All uppercase labels with 0.22em tracking. | `ui-monospace, 'SF Mono', 'JetBrains Mono', monospace` |

## 6. Type scale

| Token | px | Line-height | Used for |
| --- | --- | --- | --- |
| Hero | 64 / 1.02 | -0.03em tracking | Page header title |
| H1 | 38 / 1.08 | -0.025em | Question screen body |
| H2 | 32 / 1.06 | -0.025em | Leaderboard / Archive titles |
| Body-L | 22 / 1.15 | -0.02em | Wordcloud "the world is calling it: AI" |
| Body | 15 / 1.4 | -0.01em | Input, submit button |
| Tile-q | 11 / 1.3 | -0.005em | Archive tile question text |
| Mono-label | 10 / 1 | 0.22em uppercase | All status bars / labels |
| Mono-micro | 9 / 1 | 0.18em uppercase | Tab bar labels, ad slot |

## 7. Spacing scale

`4, 8, 12, 16, 20, 24, 32, 40` (px). Screen-edge gutter: **20px**. Phone-row gap: 36px. Page padding: 64px / 48px.

## 8. Radii

- `10px` — small chips (not used on glass)
- `14px` — cluster bubbles
- `16px` — cards, inputs, tiles, rows
- `22px` — large cards (reserved)
- `18px` — tab item pill
- `26px` — tab bar outer
- `999px` — pills (status bar, CTAs, pill toggles)

## 9. Elevation / shadow

| Name | Spec |
| --- | --- |
| Card | `0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.35)` |
| CTA | `0 14px 40px -10px rgba(123,92,255,0.55), 0 6px 20px -8px rgba(92,225,255,0.4)` |
| Glow cyan | `0 0 0 1px rgba(92,225,255,0.35), 0 0 32px rgba(92,225,255,0.35)` |
| Glow violet | `0 0 48px rgba(123,92,255,0.45)` |
| Tab bar | `0 12px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.06) inset` |
| Inner highlight | `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%)` masked to a 1px ring on every glass surface |

## 10. Buttons

### Primary — gradient pill
- Size: full-width × 56px
- Padding: 18 × 22
- Background: `linear-gradient(135deg, #7B5CFF 0%, #5CE1FF 100%)`
- Type: Geist 600, 15px, color `#0A0B12`
- Trailing affordance: 28px round chip with `↗` glyph
- Default: shadow CTA + ambient blur halo (`::after` with `filter: blur(28px); opacity: 0.45`)
- Hover: brightness 1.08, scale 1.02 (200ms ease-out)
- Pressed: brightness 0.94, scale 0.98
- Disabled: 30% opacity, no halo

### Secondary — glass pill
- Background: `rgba(20,22,32,0.6)` + 1px hairline + 40px backdrop blur
- Type: Geist 500, 13px, color `#F5F7FA`
- Default: shadow card
- Hover: border becomes `rgba(255,255,255,0.18)`

### Tertiary — text only
- Type: Geist Mono 500, 10px, 0.22em uppercase, color `#9BA1B0`
- Hover: color `#F5F7FA`

### Destructive
- Background: `rgba(255,100,105,0.10)` + 1px `#FF6469`
- Type: Geist 600, color `#FF6469`

## 11. Inputs

- Container: glass card (`rgba(20,22,32,0.6)` + 1px hairline + 40px backdrop blur), radius 16, padding 16/18.
- Label above: Geist Mono 10px, 0.22em uppercase, color `#5D6373`, e.g. `YOUR TAKE`.
- Default placeholder: Geist 500, 15px, color `#5D6373`.
- Focus: border `rgba(92,225,255,0.5)` + `0 0 0 3px rgba(92,225,255,0.12)`. Placeholder color upgrades to `#F5F7FA`. A 2px × 17px cyan caret with `0 0 8px var(--cyan)` glow blinks at 1.1s steps.
- Filled: value in Geist 500, 15px, color `#F5F7FA`.
- Error: border `#FF6469`, helper text in Geist Mono 10px below.

## 12. Cluster bubble (wordcloud)

- **Shape:** rounded rect, radius 14, padding 7×12, inline-flex with 6px gap between label and count.
- **Default fill:** `rgba(20,22,32,0.6)` + 1px `rgba(255,255,255,0.08)` + 40px backdrop blur + `0 4px 14px rgba(0,0,0,0.3)`.
- **Label type:** Geist 500, color `#F5F7FA`, tracking -0.01em.
- **Count type:** Geist Mono 500, 0.6em of label size, color `#5D6373`.
- **Size formula:** `font-size = 14 + (count / maxCount) * 38` → range 14px – 52px.
- **Top cluster (also self in this dataset):** gradient fill `linear-gradient(135deg, rgba(123,92,255,0.32) 0%, rgba(92,225,255,0.28) 100%)`, border bumped to `rgba(255,255,255,0.18)`, violet+cyan glow halo, and a 2s `background-position` shimmer loop. Because `c_ai` is also the user's cluster, the self treatment wins and adds the cyan ring + a tiny `you` pill in mono uppercase above the bubble.
- **Self-only highlight (when not top):** cyan border + cyan glow + gradient text.
- **Layout strategy:** hand-tuned absolute %-coordinates around a central anchor (top cluster at 50%/38%). Outer ring of mid-frequency clusters at ~22%/78%, periphery for long-tail. Behind the cloud: a `radial-gradient` ambient blob (violet→cyan, blurred 20px) at low opacity so the cluster glows feel justified.

## 13. Leaderboard row

- Card: glass surface (`rgba(20,22,32,0.6)` + 1px hairline + 40px blur), radius 16, padding 12×14, 6px vertical gap between rows.
- Grid: `32px | 1fr | auto` for rank · handle · score.
- **Rank:** Geist Mono 500, 13px, color `#5D6373`. Two-digit zero-padded (`01`, `02`, …).
- **Handle:** Geist 500, 14px, color `#F5F7FA`, tracking -0.01em. Streak appears next to handle in Geist Mono 10px with a pink dot prefix (e.g. `● 4d`).
- **Score:** Geist Mono 500, 13px, color `#F5F7FA`. Tabular.
- **#1 crown:** a 14×10 px shimmer crown sits −7px above the row, left-anchored to the rank cell. Color is a horizontal gold gradient `#FFD66B → #FFE6A0 → #FFD66B` animated at 1.8s. Rank and handle color also flip to gold on row 1.
- **Self row:** background fades from `rgba(92,225,255,0.10)` to transparent left-to-right, border tinted cyan, inset 3px left border in solid cyan, and a tiny cyan `you` pill anchored top-right (−7px). Handle color becomes `#5CE1FF`.

## 14. Archive tile

- 2-column grid, 8px gap.
- Tile: glass surface, radius 16, min-height 124px, padding 12/12/14.
- **Date:** Geist Mono 9px, 0.22em uppercase, color `#5D6373` (e.g. `MAY 10`).
- **Question:** Geist 500, 11px, color `#9BA1B0`, 1.3 line-height, tracking -0.005em.
- **Verdict:** Geist 600, 15px, gradient text (violet→cyan), tracking -0.02em — the "called it" hero.
- **Count:** Geist Mono 9px, 0.18em uppercase, color `#5D6373` (e.g. `14,203 VOTES`).
- **Hover (spec'd, not in static mock):** border highlights to `rgba(255,255,255,0.18)`, soft 24px violet glow appears underneath.
- **Ad slot:** spans both columns after tile #4. Dashed `rgba(255,255,255,0.18)` border, soft gradient tint, mono label `AD · SPONSORED SLOT · HOUSE`.

## 15. Tab bar

- Floating glass pill at the bottom of every screen (16px from edges, 30px from bottom).
- Container: `rgba(12,13,20,0.65)` + 1px hairline + 40px blur + shadow + inner highlight.
- 4 equal columns: Today · Friends · Ranked · Archive.
- Icons: custom 18×18 line icons, 1.6px stroke, rounded caps. Calendar / paired-avatars / 3-bar chart / drawer.
- Active state: icon and label become `#F5F7FA`; a soft violet→cyan gradient blob (8px blur) sits behind the icon; a 4px cyan dot with cyan glow sits 2px above the bottom edge of the pill.
- Inactive: `#5D6373`.

## 16. Motion

| Moment | Duration | Easing | Spec |
| --- | --- | --- | --- |
| Screen entry | 300ms | ease-out | Opacity 0→1, translate-y 8px→0 |
| Live dot pulse | 1.4s | ease-in-out, infinite | Scale 1→0.78→1 + opacity 1→0.45→1 |
| Top-cluster shimmer | 2s | ease-in-out, infinite | `background-position` cycles 0→100→0 across a 200% gradient |
| #1 crown shimmer | 1.8s | ease-in-out, infinite | Horizontal gold gradient pans |
| Submit hover | 200ms | ease-out | Brightness 1→1.08, scale 1→1.02, halo opacity 0.45→0.6 |
| Submit press | 120ms | ease-in | Brightness 0.94, scale 0.98 |
| Tab switch | 200ms | ease-out | Active-blob fades in/out, icon color tween |
| Wordcloud entry | 600ms staggered (24ms per bubble) | ease-out | Opacity + scale 0.92→1 from cluster center outward |
| Reveal of yesterday's verdict | 480ms | ease-out | Gradient text wipes left-to-right via mask |
| Caret blink | 1.1s | steps(1), infinite | Opacity 1↔0 |

## 17. Iconography

Custom 24×24 line-icon system. **Stroke:** 1.6px, rounded caps & joins. **Style:** geometric, single-weight, no fills. Tab icons: calendar, paired-avatars, 3-bar chart, drawer. Inline UI: a share arrow, a small chevron, a tiny flame dot. No Lucide / no Material — too generic for a status-coded brand. Numbers are mono, not pictographic.

## 18. Illustration / decoration

- **Ambient gradient blob:** violet→cyan radial gradient blurred 20px sits behind every screen's top half, very low opacity. Specifically used to motivate the cluster glows so they look like *light*, not stickers.
- **Grain:** SVG `feTurbulence` noise at `baseFrequency=0.9`, 22% alpha, applied at 6% opacity with `mix-blend-mode: overlay`. Just enough to keep the dark from feeling plastic.
- **Crown sigil:** small clipped-path crown shape, shimmer-animated, never used outside row 1.
- **No emoji, no stickers, no confetti, no 3D blobs.** The glow and the gradient do the emotional work.

## 19. Sounds / haptics

- **Submit:** `submit-tick` (subtle taut click) + medium impact haptic.
- **Reveal of yesterday's #1:** `reveal-shimmer` (soft glass tone, 600ms) + success haptic.
- **Leaderboard climb (called-it win):** `rise-chord` (ascending two-note) + heavy impact haptic.

## 20. Voice & microcopy

**Buttons:** `submit anonymously` · `share` · `reveal yesterday's verdict` · `see all rankings` · `set my drop alert`.

**Empty states:**
- Friends tab: `no one in your circle yet. invite three, the leaderboard gets spicier.`
- Archive (day not answered): `you skipped this one. verdict locked.`
- Leaderboard (rank 0): `submit a few drops to enter the rankings.`

**Error toasts:**
- Network: `signal lost. your take didn't make it — try again.`
- Late: `the window closed. catch the next drop.`
- Profanity filter: `too spicy. soften it and resend.`

## 21. Accessibility

- Primary text on background: `#F5F7FA on #08090E` → **15.7 : 1** (AAA).
- Secondary text on background: `#9BA1B0 on #08090E` → **7.3 : 1** (AAA).
- Tertiary text on background: `#5D6373 on #08090E` → **3.6 : 1** (AA Large only — reserved for ≥11px mono micro-labels with letter-spacing, not for body).
- Self-cluster cyan on background: `#5CE1FF on #08090E` → **11.2 : 1** (AAA).
- Gradient text on background: anchor color cyan is AAA; violet half clears AA. Gradient text never sits below 18px.
- Glass surfaces over the ambient blob retain ≥ 4.5:1 for body text because the blob is pre-blurred and clamped to ≤ 30% opacity.
- Dynamic Type: all body and labels scale; mono labels cap at +2 sizes to preserve uppercase rhythm. Hero question caps at 44px before wrapping increases.
- Reduce-Motion: shimmer + caret blink + pulse all drop to static state.
- Dark-only by design. A future light mode is **not** planned — the brand IS midnight.

## 22. Why this for Relatably

**Product values amplified.** Relatably's loop is global, synchronous, anonymous, and ranked — that is literally how a market behaves. A glass-status language reads the wordcloud as an orderbook, the top cluster as a price, the leaderboard as a podium, and the daily drop as a market open. The push notification isn't a chore reminder; it's a bell. By treating answers like positions and clusters like ticker rows, the design borrows the credibility of Polymarket and the calmness of Cash App Stocks without ever showing money. The product feels *consequential* — and consequential is exactly the feeling needed to convert a notification into a 6-second daily ritual.

**Audience pulled in.** Gen Z spends afternoons scrolling Polymarket, Robinhood community pages, Discord trade rooms, and Linear-styled startup dashboards. They recognise this language as "smart-internet adult" — the opposite of Snapchat. For a lighthearted opinion game, that contrast is the hook: the *form* signals seriousness while the *content* (overrated things, embarrassing songs) signals fun. The combination is what made BeReal and Polymarket post-ironic in their first six months. Crucially, the lowercase voice keeps the chrome from going cold — it's premium, not corporate.

**Risks accepted.** Glass on dark is a saturated aesthetic; the difference between Apple Vision Pro and a Behance dribble is restraint. We accept the risk that without careful taste the design could read generic-crypto. Mitigation: the gradient appears in *five* places only (brand, CTA, active pill, top cluster, verdict text); everything else is hairline-on-glass. We also accept that dark-only excludes the small "I prefer light mode" minority — a deliberate trade for ownability. Finally, an ambient gradient blob behind the wordcloud risks crushing contrast on busy clusters; the 30% opacity cap plus 40px backdrop blur keep text legible on every cluster we tested at the worst-case overlap.

## 23. Implementation note

Stack: **React Native + Reanimated 3 + Skia** for the wordcloud and ambient gradients. Glass surfaces in RN use `expo-blur` (`BlurView intensity={40} tint="dark"`) under a `View` with `backgroundColor: 'rgba(20,22,32,0.6)'` and a 1px hairline `View` overlay for the gradient top-edge highlight (since RN doesn't support `backdrop-filter` + masked borders natively). Geist + Geist Mono ship in-app via `expo-font`. No web view, no fallback — pure native to keep the 60fps shimmer loops cheap.
