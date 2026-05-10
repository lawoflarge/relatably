# Relatably — Design Language Mockups

Seven distinct visual directions for Relatably 1.0. Each mockup renders the
same four canonical screens (Question, Wordcloud, Leaderboard, Archive) with
identical seed content so you can compare apples-to-apples.

## View

From this directory:

```powershell
python -m http.server 5173
```

Then open `http://localhost:5173/` for the gallery, or jump directly to a
direction:

| # | Direction         | Path                                     |
|---|-------------------|------------------------------------------|
| 1 | Sticker Pop       | `/01-sticker-pop/`                       |
| 2 | Editorial Daily   | `/02-editorial-daily/`                   |
| 3 | Glass Status      | `/03-glass-status/`                      |
| 4 | Bubble Chat       | `/04-bubble-chat/`                       |
| 5 | Brutalist Raw     | `/05-brutalist-raw/`                     |
| 6 | Anime Playful     | `/06-anime-playful/`                     |
| 7 | Premium Luxe      | `/07-premium-luxe/`                      |

## Structure

```
mockups/
├─ index.html              # gallery (compare all 7)
├─ OVERVIEW.md             # side-by-side written comparison
├─ shared/
│  ├─ content.js           # seed data (question, clusters, leaderboard, archive)
│  ├─ phone-frame.css      # consistent iPhone-15-Pro frame across all 7
│  └─ reset.css            # minimal reset
└─ NN-direction-name/
   ├─ index.html           # the mockup (4 phone frames in a row)
   └─ DESIGN.md            # full design spec (palette, type, spacing, components)
```

## Picking a direction

1. Open `index.html` and skim all 7.
2. Open each direction's full mockup.
3. Read its `DESIGN.md` for the spec.
4. Read `OVERVIEW.md` for trade-offs and a recommendation.
