# QA notes — overnight build

All 7 mockups visually verified via headless Chrome at 1600×1000 viewport.
Full-page screenshots in this folder. Server: `localhost:5173`.

## Coverage

| # | Direction       | Screenshot                  | Console errors | Notes |
|---|-----------------|-----------------------------|----------------|-------|
| 0 | Gallery         | `00-gallery-full.jpeg`      | none           | all 7 iframes load eagerly so the full comparison fits in one view |
| 1 | Sticker Pop     | `01-sticker-pop.jpeg`       | none           | drop-shadow stickers render cleanly, rotation variance applied |
| 2 | Editorial Daily | `02-editorial-daily.jpeg`   | none           | drop-cap "W" renders correctly (a11y tree shows "W hat's" — purely a screen-reader representation of the floated span, visually fine) |
| 3 | Glass Status    | `03-glass-status.jpeg`      | none           | **fix applied**: removed duplicate " LEFT" suffix on time-remaining ticker — was showing "21H 42M LEFT LEFT" |
| 4 | Bubble Chat     | `04-bubble-chat.jpeg`       | none           | iMessage-style chat bubbles + tails work; uses European thousand separators ("14.203") — locale choice, not a bug |
| 5 | Brutalist Raw   | `05-brutalist-raw.jpeg`     | none           | typographic wordcloud + bracket-bracket terminal look intact |
| 6 | Anime Playful   | `06-anime-playful.jpeg`     | none           | 3px cel-shaded outlines + diagonal cuts + speed lines + gold aura all rendering |
| 7 | Premium Luxe    | `07-premium-luxe.jpeg`      | none           | hairlines + Cormorant italic + champagne accents render at intended restraint |

## Known production-side concerns

These are flagged in the agents' status reports and addressed in OVERVIEW.md:

1. **Wordcloud layout function** — five of seven mockups hand-tuned 20-cluster positions to fit the seed data. Production needs a deterministic packer (recommend d3-cloud spiral for Sticker Pop / Bubble Chat / Glass Status / Premium Luxe; a typographic page composer for Editorial / Brutalist; a manga-panel grid for Anime Playful).
2. **Cluster text width** — production cluster strings may be longer than seed (`"the new york times"` vs `"AI"`). Each direction needs a truncation / wrap policy.
3. **Submit-button dwell-guard visual** — each direction's DESIGN.md describes the intended treatment for the 3-second hold.

## Bug fixes applied in QA pass

- `03-glass-status/index.html:986` — `${tl} LEFT` → `${tl}` (removed duplicate suffix).
- `index.html:505` — removed `loading="lazy"` on preview iframes so the full gallery comparison is visible without scrolling.

## Files Levin sees on wake-up

- `mockups/index.html` — gallery (open first)
- `mockups/OVERVIEW.md` — written comparison + my recommendation
- `mockups/<NN-name>/DESIGN.md` × 7 — full design specs (ship-ready)
- `mockups/<NN-name>/index.html` × 7 — visual mockups (4 screens each)
- `mockups/shared/BRIEF.md` — the universal spec each direction was built against
- `mockups/shared/content.js` — identical seed data across all 7 (lets comparison be fair)
- `mockups/_qa/*.jpeg` — full-page screenshots from this QA pass (this folder)
