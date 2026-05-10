# Relatably Design Mockup — Shared Brief

You are designing one of seven competing visual directions for **Relatably**,
an iOS Gen-Z app shipping to App Store later this week. The founder (Levin)
is asleep. He will wake up, look at all seven, and pick one to implement.
You are building **one** direction — your specific overlay is in your task
prompt. This file is the shared spec every direction must satisfy.

---

## What Relatably is

- A single daily, globally-synchronized random-time iOS push notification.
- The push asks one lighthearted opinion question. Users type a free-text
  answer.
- Answers aggregate into a live Mentimeter-style wordcloud — clusters
  scaled by submission count.
- Per-user reveal: see yesterday's #1 cluster only after answering today's
  question.
- A leaderboard rewards being globally first to submit the eventual #1
  cluster.
- Anonymous by default. Sign in with Apple unlocks the leaderboard.
- Free, ad-supported.
- BeReal-style ritual + Mentimeter aggregation + Kahoot social-poll vibe.
- Audience: Gen Z, lighthearted "BuzzFeed/TikTok energy."

The currently-shipping iOS UI is `#000` background + toxic lime `#aaff00`
accent on default system font. It looks like a 2019 hackathon. Your job is
to give Relatably a real, ownable design language for v1.0.

---

## Deliverables — TWO files at EXACT paths

1. `C:\Users\levin\relatably\mockups\<your-folder>\index.html`
2. `C:\Users\levin\relatably\mockups\<your-folder>\DESIGN.md`

Your folder is given in your task prompt (e.g. `01-sticker-pop`).

---

## index.html structure

ONE self-contained HTML page. Layout: a horizontal row of **four**
iPhone-15-Pro frames, centered, with the direction name as a page header.
Each frame renders ONE of the four canonical Relatably screens.

### Required outer markup

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatably · <DIRECTION NAME></title>
  <link rel="stylesheet" href="../shared/reset.css">
  <link rel="stylesheet" href="../shared/phone-frame.css">
  <!-- Google Fonts <link> tags here -->
  <style>/* all your direction CSS here */</style>
</head>
<body>
  <header class="page-header">…direction name + one-line subtitle…</header>
  <main class="phone-row">
    <div>
      <div class="rb-phone …light-or-dark…">
        <div class="rb-phone-island"></div>
        <div class="rb-phone-screen" id="screen-1">…Question…</div>
        <div class="rb-phone-bar"></div>
      </div>
      <div class="rb-phone-label">01 · QUESTION</div>
    </div>
    <div>
      <div class="rb-phone …">
        <div class="rb-phone-island"></div>
        <div class="rb-phone-screen" id="screen-2">…Wordcloud…</div>
        <div class="rb-phone-bar"></div>
      </div>
      <div class="rb-phone-label">02 · WORDCLOUD</div>
    </div>
    <div>
      <div class="rb-phone …">
        <div class="rb-phone-island"></div>
        <div class="rb-phone-screen" id="screen-3">…Leaderboard…</div>
        <div class="rb-phone-bar"></div>
      </div>
      <div class="rb-phone-label">03 · LEADERBOARD</div>
    </div>
    <div>
      <div class="rb-phone …">
        <div class="rb-phone-island"></div>
        <div class="rb-phone-screen" id="screen-4">…Archive…</div>
        <div class="rb-phone-bar"></div>
      </div>
      <div class="rb-phone-label">04 · ARCHIVE</div>
    </div>
  </main>
  <script src="../shared/content.js"></script>
  <script>/* render screens from window.RELATABLY */</script>
</body>
</html>
```

### The four screens — required content

**Screen 1 — Question (the daily drop)**
- Date label `RELATABLY.meta.todayLabel` + drop time `RELATABLY.meta.dropTimeLabel`
- Time-left indicator using `RELATABLY.meta.timeLeftLabel` — visually meaningful (timer, progress ring, ticker)
- The question text `RELATABLY.question.text` — must visually DOMINATE the screen
- Live counter "12,847 answers in" using `RELATABLY.meta.totalAnswers`
- Free-text answer input — show a placeholder; also show what the focused state looks like
- Submit button (style its enabled state; the spec says a 3-second dwell-guard exists but visual is up to you)
- Tab bar at the bottom — 4 tabs (Today active)

**Screen 2 — Wordcloud (the live ritual)**
- Top strip: total answers + countries
- The wordcloud — render all 20 from `RELATABLY.clusters` in a packed/organic layout, sized by `count / maxCount`
- The user's own cluster (id `c_ai`) is unmistakably visually distinct
- Share button (top-right or floating)
- Tab bar at the bottom — Today active

**Screen 3 — Leaderboard**
- Header: three pill toggles Daily / Weekly / All-time (Daily selected)
- Scope pill: Global / Friends (Global selected)
- 10 rows from `RELATABLY.leaderboard.entries`
- Row 1 (`ace.exe`) has a crown indicator
- Row 4 (`levin`, isSelf: true) is visually distinct as "you"
- Each row: rank, handle, score, streak indicator
- Tab bar at the bottom — Leaderboard active

**Screen 4 — Archive**
- Header: archive title in your direction's voice
- 8 tiles from `RELATABLY.archive` — date, question, verdict, count
- Bonus: one banner-ad-slot stub after tile #4 (per Phase 4 monetization spec)
- Tab bar at the bottom — Archive active

### Tab bar

Four tabs in order: **Today** · **Friends** · **Leaderboard** · **Archive**.
Pick icons appropriate to your direction (line, filled, custom — your call).
Active tab is visually distinct.

### Page layout

- Page background is up to you (color / gradient / pattern), but it must
  complement, not compete with, the screens.
- Page header at top: direction name (big), one-line subtitle.
- Phone row: horizontal, centered, ~32px gap between phones. The page
  may scroll horizontally if needed.
- Use the shared `.rb-phone` class (or `.rb-phone--light` for paper
  designs). Do NOT redesign the phone frame chrome — it must be the
  same across all 7 directions for fair comparison.
- Below each phone, a label like "01 · QUESTION" using `.rb-phone-label`.

---

## DESIGN.md structure

Use these section headings in this exact order. Be exhaustive — every
value that gets used in implementation must be documented.

1. **Direction in one sentence** — pitch in <25 words.
2. **Mood board references** — 5–10 apps/sites/objects with one-line "what to steal" notes.
3. **Brand attributes** — 5 adjectives this direction owns, 3 it deliberately rejects.
4. **Color palette** — every color: hex, name, role. Include: 1 background (and optional secondary surface), 2–3 text colors at different emphasis, 1 primary accent, 1 secondary accent (for self-highlight / called-it win), 1 error. State whether direction is dark-only / light-only / both.
5. **Typography** — every font with: family name + Google Fonts URL + 4 specimen weights + intended use + fallback stack.
6. **Type scale** — explicit px for hero / h1 / h2 / body-l / body / label / micro with line-heights.
7. **Spacing scale** — 4–8 step scale in px plus screen-edge gutter value.
8. **Radii** — every radius the system uses.
9. **Elevation / shadow** — every shadow spec (offset, blur, color, opacity).
10. **Buttons** — primary, secondary, tertiary, destructive. Each spec'd with size, padding, type, color states (default / pressed / disabled).
11. **Inputs** — answer input + any other input. Default / focus / filled / error states. Placeholder treatment.
12. **Cluster bubble** — wordcloud cluster spec: shape, fill, border, shadow at S/M/L size, font-size formula, self-highlight, layout strategy.
13. **Leaderboard row** — rank cell, handle, score, streak, crown-for-#1, self-highlight.
14. **Archive tile** — visual treatment.
15. **Tab bar** — icons + active state.
16. **Motion** — every animation: reveal, submit, wordcloud entry, cluster pulse, tab switch. Duration + easing for each.
17. **Iconography** — library or custom system, style (line/filled/duotone), stroke weight.
18. **Illustration / decoration** — blobs, stickers, grain, patterns, dot grids — anything non-photographic.
19. **Sounds / haptics** — submit / reveal / leaderboard climb (just name them).
20. **Voice & microcopy** — 5 button labels + 3 empty states + 3 error toasts in this direction's voice.
21. **Accessibility** — contrast ratios for primary text-on-background, dynamic-type behavior, dark/light support.
22. **Why this for Relatably** — 3 paragraphs: product values amplified, audience pulled in, risks accepted.
23. **Implementation note** — one line: "Stack: React Native with X" or "Stack: pure RN StyleSheet because Y."

---

## Quality bar (non-negotiable)

- Every spacing value comes from your scale. No magic numbers.
- Every color comes from your palette. No one-off hex anywhere.
- Custom Google Fonts loaded via `<link>` — never rely on `system-ui`.
- The wordcloud must LOOK like a wordcloud — not a vertical list of pills. Layout is the hardest part. Invest there.
- Top cluster (`AI`) should feel gravitationally central.
- Self-cluster (`AI`, id `c_ai`) is visually unmistakable in your direction's language.
- Today's question text dominates the Question screen — this is the daily ritual moment.
- Submit button must look pressable.
- Leaderboard row 4 (`levin`, isSelf: true) reads as "you" — visually distinct from rows 1, 2, 3, 5–10.
- The four screens must feel like the same app — same type system, palette, spacing, motion.
- No AI-slop patterns: not every surface gets a gradient, not glass on glass on glass, no random emoji confetti, no over-rounded-everything, no centered-everything-with-emoji-titles, no excessive bento.

## Absolute requirements

- Write the two files at the EXACT paths above using the Write tool.
- Use ONLY copy from `window.RELATABLY` (read `../shared/content.js` first).
- Both files complete on first write — no TODOs, no placeholders.
- HTML must render correctly when served via `python -m http.server` from the `mockups/` directory.
- Do NOT modify any shared file (`reset.css`, `phone-frame.css`, `content.js`).

---

## 21st.dev design MCPs (REQUIRED to use)

Levin has the 21st.dev MCP suite installed. You MUST use these to pull
real design inspiration and component references. Load them via ToolSearch
at the start of your task:

```
ToolSearch query="select:mcp__magic__21st_magic_component_inspiration,mcp__magic__21st_magic_component_builder,mcp__magic__21st_magic_component_refiner,mcp__magic__logo_search"
```

Required uses:

1. **`mcp__magic__21st_magic_component_inspiration`** — call AT LEAST 3 times
   with searchQueries tailored to your direction. Suggested queries (adapt to
   your aesthetic):
   - "leaderboard row mobile" / "premium leaderboard"
   - "wordcloud bubbles" / "chat bubble cluster"
   - "mobile tab bar bottom nav"
   - "question prompt card mobile"
   - "archive grid tile feed"
   - whichever components your direction emphasizes (stickers, glass cards, manga panels, etc.)
   Use the JSON snippets returned to inform your component styling. You do
   not need to literally copy the code — translate the design ideas into
   your direction's language.

2. **`mcp__magic__logo_search`** — call ONCE with `queries=["relatably"]`
   in SVG format. If nothing returns (unlikely — it's a new brand), pull a
   reference logo from a vibe-adjacent brand instead (e.g., for Sticker Pop:
   "duolingo"; for Editorial Daily: "new york times"; for Glass Status:
   "polymarket"; for Bubble Chat: "geneva"; for Brutalist: "are.na"; for
   Anime: "splatoon"; for Premium Luxe: "aesop"). Use the result as
   inspiration for your own wordmark/logo treatment in the page header
   and in-app brand.

3. **`mcp__magic__21st_magic_component_builder`** (OPTIONAL but encouraged):
   if you want to scaffold a specific component (cluster bubble, leaderboard
   row, tab bar), use this. Pass:
   - `absolutePathToCurrentFile`: `C:\Users\levin\relatably\mockups\<your-folder>\index.html`
   - `absolutePathToProjectDirectory`: `C:\Users\levin\relatably\mockups`
   You will need to manually translate any React/JSX it returns into the
   vanilla HTML/CSS used in your mockup.

In your DESIGN.md section 2 (Mood board references), list the 21st.dev
component IDs/URLs you pulled inspiration from.

## Workflow

1. **Load** the 21st.dev MCPs via ToolSearch (see above).
2. **Read** `C:\Users\levin\relatably\mockups\shared\content.js` to internalize the data.
3. **Read** `C:\Users\levin\relatably\mockups\shared\phone-frame.css` to know the chrome.
4. **Inspire** — call `mcp__magic__21st_magic_component_inspiration` ≥3 times and `mcp__magic__logo_search` once. Save the references you find useful.
5. **Build** `index.html` — render the four screens from `window.RELATABLY`.
6. **Build** `DESIGN.md` — answer every section in order, including the 21st.dev sources in section 2.
7. **Return** a 5-line status: files written, font choice, palette summary, 21st.dev references used, key risk.
