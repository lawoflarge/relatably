# Relatably · 7 Design Directions — Overview

**Built:** 2026-05-11 overnight · **Mockups:** http://localhost:5173/

Seven competing visual languages for Relatably 1.0. Same screens, same seed
data, same iPhone frame — only the design language changes. This document
synthesizes them into a single decision.

---

## TL;DR

> **Pick #1 Sticker Pop.** It matches your locked brief
> (Gen-Z lighthearted, BuzzFeed/TikTok energy) more precisely than any
> other direction, produces screenshot-shareable App Store assets out of
> the box, and is the most ownable look in the seven — nothing else on
> the iOS daily-question shelf looks like it.
>
> **Runner-up: #4 Bubble Chat.** Safer, warmer, "Hinge for opinions"
> coded. Pick this if you want low-risk and aren't sure Sticker Pop
> ages with you past launch.
>
> **Wildcard: #3 Glass Status.** Picks up only if you want Relatably to
> read as competitive/status-driven (the climb-the-leaderboard moment).
> Best as a *hybrid* — borrow its Leaderboard screen treatment into
> Sticker Pop's language.

Full reasoning under "Recommendation" below.

---

## Comparison matrix

| # | Direction         | Vibe                  | Display font          | Audience read                 | Brief fit | Ownability | Screenshot pop | Risk                              |
|---|-------------------|-----------------------|-----------------------|-------------------------------|-----------|------------|----------------|-----------------------------------|
| 1 | Sticker Pop       | playful · loud · friendly     | Bagel Fat One         | Gen-Z mass market             | **9 / 10**| **9 / 10** | **10 / 10**    | reads too young for status        |
| 2 | Editorial Daily   | mature · slow · ownable       | Source Serif 4 italic | Substack-coded Gen-Z          | 4 / 10    | 8 / 10     | 6 / 10         | too literary for impulse-tap      |
| 3 | Glass Status      | premium · live · cool         | Geist                 | tech-fluent prosumer Gen-Z    | 6 / 10    | 7 / 10     | 8 / 10         | could read generic crypto         |
| 4 | Bubble Chat       | warm · soft · social          | Hanken Grotesk        | Hinge/Geneva-coded Gen-Z      | **8 / 10**| 6 / 10     | 7 / 10         | risk of feeling done-before       |
| 5 | Brutalist Raw     | sharp · indie · confident     | JetBrains Mono        | design-fluent Gen-Z           | 3 / 10    | **10 / 10**| 8 / 10         | reads "art project"; narrow       |
| 6 | Anime Playful     | loud · gamified · charged     | Bowlby One            | anime/gamer-adjacent Gen-Z    | 7 / 10    | 9 / 10     | 9 / 10         | culturally narrow                 |
| 7 | Premium Luxe      | quiet · refined · craft       | Cormorant Garamond    | aesthetic-driven Gen-Z        | 2 / 10    | 8 / 10     | 5 / 10         | tonal mismatch with brief         |

Scores are subjective — they're meant to spark disagreement, not settle it.
Brief fit = how well the direction maps onto "Gen-Z lighthearted, BuzzFeed/TikTok energy."

---

## Direction-by-direction read

### 01 — Sticker Pop
**One-line:** Y2K maximalist sticker book on cream paper. Every surface is peelable. Duolingo confidence taken seriously.

**Stack:** Bagel Fat One (display) · Hanken Grotesk (body) · Space Grotesk (mono).
Palette: `#FFF7E8` cream / `#1A1A1A` ink / `#FF4FA3` hot pink / `#FFD43B` lemon / `#7AE6C3` mint / `#7BC8F6` baby blue.

**Why it wins for Relatably**
- *Most aligned with the locked product brief.* Gen Z, lighthearted, BuzzFeed/TikTok energy translates literally to Sticker Pop. No interpretation gap.
- *Screenshot economics.* The drop moment, the wordcloud, the "you called it" reveal — each screen is loud enough to stop a TikTok scroll. App Store screenshots, share cards, push-notification thumbnails — all benefit.
- *Ownable.* Nothing on the daily-question shelf looks like this. Most competitors default to clean-sans + lime-or-purple-accent — Sticker Pop visibly refuses that.
- *Holds visual hierarchy under load.* Stickers scale gracefully with cluster counts — a 3,000-vote sticker is just a bigger sticker. The system already lives in the wordcloud's native medium.

**Why it could lose**
- *Reads young.* If Relatably grows past 22yo it may feel babyish; need to test against the "30-year-old who downloaded BeReal" cohort.
- *Doesn't carry status moments.* The leaderboard wants to feel like winning — stickers feel like *cute* winning. Mitigation: hybrid in Glass Status's leaderboard treatment (see Hybrid section below).
- *Production complexity.* Hard-offset shadows + slight per-sticker rotation = a lot of platform-specific work in React Native (no easy `clip-path: polygon()`, manual shadow-without-blur via offset Views).

**21st.dev refs pulled:** chunky sticker button, leaderboard row mobile, wordcloud bubble cluster, mobile tab bar bottom nav.

---

### 02 — Editorial Daily
**One-line:** NYT magazine on warm newsprint. Italic serif headlines, oxblood accent, typographic wordcloud — the daily ritual as a published issue.

**Stack:** Source Serif 4 (display, italic) · IBM Plex Sans (body) · JetBrains Mono (labels).
Palette: `#F4ECDD` cream / `#FFFFFF` white / `#161413` ink / `#C8392B` oxblood / `#B8902A` marigold / `#5C5852` subtext.

**Why it's tempting**
- *Beautiful.* If Relatably wants a press kit, this direction's hero is a Tumblr post about itself.
- *Treats the daily drop as ritual.* The "today's daily" framing maps onto what BeReal does well — once a day, take it seriously.
- *Ages with you.* Won't look dated in 2030.

**Why it loses**
- *Misaligned with brief.* The locked product brief is BuzzFeed/TikTok energy, not Substack. This direction skews older and more literate than the Gen-Z mass that downloads from a TikTok screenshot.
- *Typographic wordcloud is a production trap.* The mockup hand-tunes 20 cluster positions. Production needs a real layout composer that handles 200+ clusters at variable counts — hard, expensive, and degrades to "vertical list" on bad days.
- *Hard to monetize.* The brief says ads from day one. A vermillion-on-cream layout reads luxurious — banner ads will look like food poisoning.

**Verdict:** Don't pick this for Relatably 1.0. Bank it for "Relatably Stories" (a possible v1.x weekly-roundup product).

---

### 03 — Glass Status
**One-line:** Midnight base, iridescent glass, neon gradient ticker. Polymarket × Linear × Cash App Pro — makes the daily question feel like a market.

**Stack:** Geist + Geist Mono. Tight tracking, lowercase copy.
Palette: `#08090E` midnight / `#7B5CFF` → `#5CE1FF` violet→cyan gradient / `#FFD66B` gold / `#FF4F87` live pink / `#F5F7FA` bone.

**Why it's tempting**
- *Premium feel.* Looks like a status app. The leaderboard climb feels like winning.
- *Tech-cohort signaling.* If your seed launch is on Twitter/X tech, this direction reads native.
- *Live-ticker treatment.* The "12,847 votes · 87 countries" line is a real selling point.

**Why it loses standalone**
- *Tonal mismatch with the brief.* The shipping product is lighthearted Gen-Z; Glass Status reads serious-money. The "what's the worst pizza topping" question feels weird in a Polymarket frame.
- *Crypto association.* Iridescent gradient + dark midnight + mono numbers + ticker = NFT app to a chunk of your audience. Mitigated by tight restraint, but the cliché is one bad screenshot away.

**Why it wins hybridized.** This direction's Leaderboard screen is the single best Leaderboard in the seven. Lift it into Sticker Pop's language — and you get cute everywhere except the moment that should feel like winning. See **Hybrid Strategy** below.

---

### 04 — Bubble Chat
**One-line:** Pastel group-chat warmth. Cluster bubbles are iMessage. Of all 7, the most literal reading of the name "Relatably."

**Stack:** Hanken Grotesk + DM Serif Display (italic accents) + DM Mono.
Palette: `#FBF8F3` paper / `#1F1A24` ink / `#F5A3B7` rose / `#C8B5FF` lavender (self) / `#A0E3C8` mint / `#FFCBA0` peach.

**Why it's strong**
- *Brand-name fit.* "Relatably" wants soft warmth — Bubble Chat delivers literally. The cluster-as-chat-bubble metaphor explains the product to a new user in two seconds.
- *Safe.* Lowest production risk of any direction. Soft-shadow + rounded-pill = trivial to ship cleanly in React Native.
- *Group-chat coding.* Maps onto how Gen Z actually discusses things — in iMessage with friends.

**Why it's the runner-up not the winner**
- *Done-before.* Hinge, Geneva, Lapse, BeReal verified, post-2023 Telegram — all close enough that "another pastel chat-bubble UI" doesn't move a needle.
- *Less screenshot pop.* The drop moment is muted. The wordcloud feels conversational, not eventful. App Store assets will be pretty but not stop-the-scroll.

**Verdict:** Pick this if you want to ship without risk and accept "premium-default" as the ceiling.

---

### 05 — Brutalist Raw
**One-line:** Bone paper, monospace everywhere, cobalt + tangerine. Are.na meets Vercel docs meets a Bloomberg terminal.

**Stack:** JetBrains Mono everywhere + Inter Tight (sans) used only for the question hero.
Palette: `#F7F4EC` bone / `#0E0E0E` ink / `#1B3CFF` cobalt / `#FF6A18` tangerine (self) / `#FF188C` magenta.

**Why it's tempting**
- *Most ownable of the seven.* No iOS daily-question app looks like this. Differentiation is automatic.
- *Designer respect.* The Twitter design crowd will hand you a like.

**Why it loses for Relatably**
- *Narrow audience.* Reads "art project" to a mass-market Gen Z. The product brief is mass-friendly, not designer-aligned.
- *Reads cold.* "Relatably" is a warm name. Brutalist is a cold language. The brand and the language are in tension.
- *Banner ads will fight it.* Plex Mono + hairline grid + sponsored placement = visual war.

**Verdict:** A great direction for a SaaS B2B product. Wrong vibe for a viral consumer drop.

---

### 06 — Anime Playful
**One-line:** Cel-shaded panels, 3px black outlines, diagonal cut corners, speed lines. Persona 5 menus × Splatoon × Sailor Moon.

**Stack:** Bowlby One (display) · Nunito (body) · IBM Plex Mono (mono).
Palette: `#0F0E1A` indigo night · `#FF3B5C` candy red · `#FFEA29` neon yellow · `#7FF5C4` mint · `#FFB628` gold-aura · `#C2A1FF` lavender · `#5BB3FF` sky.

**Why it's tempting**
- *Screenshot pop.* Highest screenshot-per-cm in the seven. The drop moment lands.
- *Owns the moment.* The "you called it" gold aura is the strongest "win" graphic in the set.

**Why it loses for Relatably**
- *Cultural specificity.* Anime UI to anime-adjacent audiences is fluent; to everyone else it reads as a video-game app. Relatably's audience is broader than that cohort.
- *Hand-split title typography.* The Question screen relies on splitting the question into 3 color-coded clauses (`OVERRATED` red / `INTERNET` yellow / `RIGHT NOW?` mint) — that requires linguistic logic to run on arbitrary daily questions. Hard to automate without it occasionally producing nonsense.

**Verdict:** Best non-winner. Could be a great alt-skin in v1.x ("Hard Mode" or "Anime Pack"). Don't ship as the default.

---

### 07 — Premium Luxe
**One-line:** Deep ink, champagne hairlines, italic Cormorant headlines. Aesop × Dior × Cartier.

**Stack:** Cormorant Garamond (display, italic) · Inter Tight (body, weight 300) · IBM Plex Mono (tracked labels).
Palette: `#0E0D0B` ink / `#161412` surface / `#F4EFE6` bone / `#C8A472` champagne / `#E0C49C` light champagne / `#9C958A` text-2.

**Why it's interesting**
- *Differentiation.* Nobody in the daily-question shelf looks like Aesop. Pure ownability.
- *Reads expensive.* Premium feel maps onto premium ad inventory if you ever scale that side.

**Why it loses for Relatably**
- *Brief mismatch.* You explicitly want lighthearted/BuzzFeed/TikTok energy. This direction is the OPPOSITE — quiet luxury, italic seriousness. "what's the worst pizza topping" in 48px italic Cormorant reads as parody.
- *Ad fit zero.* AdMob banner inside a champagne-hairline frame is offensive.

**Verdict:** Wrong product. Save the language for an unrelated v3 idea.

---

## Recommendation

### Primary: Pick #1 Sticker Pop

Three reasons compound:

1. **Brief alignment.** The Relatably product spec — Gen-Z, lighthearted, BuzzFeed/TikTok energy — maps onto Sticker Pop without interpretation. Every other direction is a *redirection* of the brief (more mature, more premium, more designer-coded). Sticker Pop is the *literal* read.

2. **Marketing-asset economics.** Relatably's growth loop runs on:
   (a) **App Store screenshot** → drives organic install
   (b) **Push-notification thumbnail** → re-engages
   (c) **Share-card image** (post-reveal) → drives invites via Branch.io
   Sticker Pop wins all three. The screenshots are loud; the thumbnails are recognizable at 64px; the share cards demand a TikTok stitch.

3. **Ownability.** Three years from now, BeReal-format competitors will exist. The one with a real, distinct visual language outlives the ones with "clean and modern" UIs. Sticker Pop is the closest thing in the seven to a *recognizable Relatably look* — peelable stickers + Bagel Fat One question + hot-pink-on-cream is a fingerprint.

### Hybrid strategy (the boldest play)

If you want the best possible Relatably, pick Sticker Pop **and lift Glass Status's Leaderboard treatment for the Leaderboard screen only**. Justification:

- The Leaderboard is the *only* screen in the app where the dominant emotion should be "I'm winning at something cool," not "I'm having fun."
- Sticker Pop owns the daily ritual (Question, Wordcloud) and the archive (look-back warmth).
- Glass Status owns the climb (Leaderboard).
- Both languages share a hot-pink heartbeat (`#FF4FA3` Sticker Pop / `#FF4F87` Glass Status — close enough to bridge).

The risk: tonal whiplash between tabs. The reward: Relatably has *two* moods — cute by day, cool by climb. That's how Snapchat layered Cameos vs. Snap Map without breaking.

### If you don't pick Sticker Pop

Pick **#4 Bubble Chat**. It is the lowest-risk shippable direction and the most literal interpretation of the brand name. The downside is a ceiling: you ship a perfectly-fine pastel app that doesn't *win* attention, only earns it.

Do NOT pick #2 (Editorial), #5 (Brutalist), or #7 (Premium Luxe) for v1.0 — they are tonally misaligned with the locked product brief. They are great directions for *different* products.

### If you want a wildcard

Pick **#6 Anime Playful** if your seed audience is anime-adjacent (Discord, Twitch, TikTok cosplay-side). It's the most screenshot-explosive direction after Sticker Pop, but with narrower cultural reach.

---

## Cross-cutting design risks to plan around

Every direction except Brutalist Raw and Editorial Daily made one of two
shortcuts in the mockup that production will need to solve:

### 1. Wordcloud layout

Five of the seven directions hand-tuned cluster positions to look good with
*this specific* 20-cluster seed. In production, the wordcloud takes arbitrary
data daily — 50+ clusters, wildly variable counts, multi-line cluster text.

**You will need a wordcloud layout function.** Two options:

- **Spiral packer (d3-cloud-style):** stable, well-trodden, but produces a
  somewhat predictable shape. Works well for Glass Status, Sticker Pop,
  Bubble Chat, Premium Luxe.
- **Force-directed packer:** organic-looking, harder to seed deterministically,
  but pays off for Sticker Pop's "slapped-on-paper" effect.

Editorial Daily and Anime Playful are the trickiest production-side because
they want non-circular layouts (typographic page / manga panel grid). If you
pick one of those, plan for ≥1 sprint of layout-engine work.

### 2. Cluster text width

The seed data has short cluster strings (`AI`, `tiktok`, `crypto`). Real-world
data will include `the new york times` and `it depends on the context`. Every
direction needs a cluster-bubble that gracefully handles wide strings —
either by truncation at N characters, by wrapping with a max-2-line policy,
or by font-size-floor + ellipsis.

Sticker Pop and Bubble Chat handle this naturally (their stickers/bubbles
already wrap). Editorial and Brutalist need explicit truncation rules. Glass
Status needs an ellipsis policy at small sizes.

### 3. Submit-button dwell guard

Phase 1 spec has a 3-second-dwell-guard on submit. Every direction needs to
*show* the user the wait. Sticker Pop's submit shadow filling in over 3s is
charming. Glass Status's gradient progress around the button is sharp.
Premium Luxe's hairline fill is restrained. Bubble Chat could use a small
chat-style typing-indicator. Brutalist could use a mono countdown
`[ 03 // SUBMIT ]` → `[ 00 // SUBMIT ]`.

State the chosen approach in your implementation plan.

---

## Files

- `mockups/index.html` — gallery (this is what you opened)
- `mockups/shared/content.js` — seed data (question, clusters, leaderboard, archive). Identical across all 7.
- `mockups/shared/phone-frame.css` — iPhone-15-Pro chrome. Identical across all 7.
- `mockups/shared/BRIEF.md` — universal spec each direction was built against.
- `mockups/<NN-name>/index.html` — direction mockup (4 phone-frames in a row).
- `mockups/<NN-name>/DESIGN.md` — full design spec (palette, type, spacing, buttons, components, motion, voice, a11y, implementation note). Each DESIGN.md is shippable as-is into a React Native implementation plan.

---

## Next step

Open `http://localhost:5173/` (server should already be running). Skim all 7.
Pick one (or a primary + secondary). Tell me which number(s) and I'll convert
that DESIGN.md into a React Native implementation plan via
`/superpowers:writing-plans` — including the cluster-layout-function
sub-problem.

If you remix (e.g., Sticker Pop + Glass Status leaderboard), tell me
which screens belong to which direction; I'll merge cleanly so you don't
ship a Frankenstein.
