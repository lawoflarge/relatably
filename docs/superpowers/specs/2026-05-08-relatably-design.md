# Relatably — Design Specification

**Date:** 2026-05-08
**Status:** Design approved by Levin Schwab via brainstorming session.
**Working name:** Relatably (subject to trademark + domain verification before public launch)
**Owner:** Levin Schwab (sole founder, side-project under existing Nebengewerbe)
**Target launch window:** ~12–14 weeks from kickoff
**Version:** v1.0 (this document); v1.1 scope flagged inline

---

## 1 — Executive Summary

Relatably is a viral iOS app for Gen Z built around a single daily ritual: at one globally-synchronized random moment per day, every user receives a push with a controversial, lighthearted opinion question (e.g. *"what's the most overrated tourist trap?"*). Users type a free-text answer; the answers aggregate into a live Mentimeter-style global wordcloud where more-popular answers form bigger bubbles. To see yesterday's verdict, you must answer today's question — creating a strong daily forcing function. A leaderboard rewards users who are first globally to submit the eventual #1 answer ("👑 most relatable on Earth"). Spotify-Wrapped-style 9:16 share banners drive viral growth across TikTok / Instagram Stories / Snap. Free, ad-supported, no subscription.

The design occupies a real white space — no shipping app combines daily synchronized drop + free-text wordcloud + "first to call the verdict" leaderboard + share-banner viral loop.

---

## 2 — Locked Decisions (decision log)

| # | Decision | Choice |
|---|---|---|
| 1 | Working name | **Relatably** (verify trademark + domain pre-launch) |
| 2 | Audience & tone | Gen Z lighthearted (BuzzFeed/TikTok energy) |
| 3 | Answer format | Free-text typing → Mentimeter-style wordcloud |
| 4 | Drop timing | Globally-synchronized random within full 24h UTC (BeReal-strict) |
| 5 | Reveal mechanism | Per-user, gated on submitting today's question (yesterday's verdict reveals when you submit today) |
| 6 | Identity | Anonymous-by-default; Sign in with Apple required for leaderboard, friends, future submissions |
| 7 | Social graph | Friend graph + group leaderboards (read-only awareness, no DMs / comments / reactions) |
| 8 | Question source v1.0 | Hand-curated launch backlog (~60 Qs) + AI-assisted candidate generation, all admin-approved |
| 9 | User-submitted questions | **Deferred to v1.1** (~6 weeks post-launch) |
| 10 | Past-question archive | In v1.0 |
| 11 | Leaderboards | Daily, weekly, all-time + friend group — tiered scoring (rank + early-bird) |
| 12 | Anti-cheat | Six-layer defense (Apple sign-in, 3s dwell, IP throttle, DeviceCheck/App Attest, behavioral classifier post-launch, soft shadowban) |
| 13 | Visibility | Cannot see others' answers before submitting yourself |
| 14 | Answer normalization | Deterministic only (no LLM, $0 marginal cost). Acceptable to have similar-but-not-identical bubbles. |
| 15 | Tech stack | Expo + Next.js + Supabase + Vercel + Upstash Redis + AdMob + Expo Push + Sentry + PostHog |
| 16 | Banner generation | Client-side via `react-native-view-shot`, 9:16 vertical, three banner types |
| 17 | Monetization | Ads from day 1, three placements only — leaderboard banner, archive banner, post-reveal interstitial. **No subscription, no IAP, no cosmetics.** |
| 18 | Launch geography | English-speaking Western Gen Z primary (US/UK/CA/AU/DE/FR/NL); Asia/Australia accepted as TAM cap |

---

## 3 — Brand & Name

### Working name: Relatably

Workable but not crisp. The whole `relatable.*` namespace is occupied (`relatable.com` consumer products, `relatable.app` relationships, `relatable.me` influencer agency, `relatable.one` personal CRM); `relatably.com` is taken with unclear ownership. The "-bly" adverb form reads slightly off to native English speakers. Acceptable for development; **must verify trademark availability (US + EU) and TLD strategy before public launch**.

### Pre-launch naming TODOs

- [ ] Manual visit: confirm what's at relatably.com (parked? content site? active product?)
- [ ] Run a US TM search via USPTO and EU search via EUIPO for "Relatably" in classes 9 (mobile apps) and 41/45 (entertainment / social networking)
- [ ] Pick a TLD: `relatably.app`, `relatably.co`, `.world`, or `.io` if `.com` is unavailable
- [ ] If TM conflict found: rebrand candidates (in priority order) — Verdict, OneTake, Worldsay, Pulse, Mob, Polly

### Brand voice

- **Confident, dry, slightly chaotic** — DuoLingo / Wendy's / Liquid Death lane
- **Emoji-leaning but not infantilizing**
- **Black background + saturated single accent color** for wordcloud bubbles (lime, magenta, or electric blue — pick one and own it)
- **Wordmark in chunky modern sans** (Inter Display / General Sans / custom)
- **Tagline candidates:** *"the world is voting"* / *"one daily verdict"* / *"every day at random"*

---

## 4 — Daily Ritual UX

### The four moments

```
T = random within 24h UTC                          → Global push fires
    ↓
User opens app
    ↓
Yesterday's verdict reveal animation (~12 sec)     ← only if they answered yesterday
    ↓
Today's question screen                            ← no spoilers, no leaderboard preview
    ↓
User types + submits
    ↓
Live wordcloud screen + share banner option
    ↓
Tabs (Today / Friends / Leaderboard / Archive) unlock
    ↓
User can re-open all day, watch live cloud grow
    ↓
Tomorrow at next random drop: cycle repeats
```

### The drop (T = 0)

- Push fires globally at the same instant for all users (random time per day, uniformly across full 24h UTC)
- Notification title: `🚨 the world is voting NOW`
- Notification body: today's question text
- Tap → app opens directly to deep-link flow (yesterday-reveal, then today's question)
- Push delivery via **Expo Push Service** (APNs proxy), batched in 1k-device chunks for ~100 sec fanout to 1M devices

### Yesterday's verdict reveal animation

Plays only if the user submitted an answer yesterday. ~12 seconds, full-screen black, single accent color.

```
"Yesterday, 4,237,891 of you answered…"
    ↓
Top-10 bubbles animate in sequence #10 → #1, sized by cluster
    ↓
When user's own answer appears in top-10: glow effect
    ↓
"🌍 the world said: PISA TOWER"
    ↓
"You ranked #X — better than Y% of the world"
    ↓
If user was first globally to submit eventual #1:
    full-screen "👑 YOU CALLED IT — +1000 points" + confetti
    + auto-generated share banner with hard CTA
```

If quit mid-reveal: resumes from start next time the user opens the app (one-time per day).

### Today's question screen

- Question dominates the screen, ~36pt bold, black background
- Single text field: `type your take…`
- Live counter ticking up in real time: `1,247,392 answers so far` (Supabase Realtime WebSocket)
- Below: `answering anonymously — sign in to make the leaderboard`
- Submit button: chunky accent, **disabled until ≥1 char + ≥3-second dwell** (anti-bot)
- No leaderboard preview, no friends preview, no past archive on this screen

### Wordcloud screen (post-submit)

- User's submitted text flies into the wordcloud as a glowing bubble
- Status line: `your take: "louvre" — currently bubble #14 (138 others said this)`
- Cloud is alive: bubbles resize via Reanimated 3 animations (300ms ease)
- Submission counts streamed via Supabase Realtime, client-throttled to 500ms windows
- Bottom: `the world is voting — next drop is somewhere in the next 24h` (no countdown — preserves the random-drop suspense)
- 4-tab bottom bar appears: **Today** · **Friends** · **Leaderboard** · **Archive**
- Top-right: 1-tap **Share** button → "Today's take" banner

### Edge cases

| Case | Behavior |
|---|---|
| User opens late (T+18h) | Question still live, normal flow, cloud already large |
| User never opens that day | When they next open: brief replay of missed-day's reveal (best-effort if data still warm), then today's question |
| User answers, re-opens 4× | Sees live cloud growing each time (sticky engagement); cannot re-submit |
| User submits empty / gibberish / emoji-only | Allowed; gibberish answers stay as solo bubbles, self-resolving |
| Profanity filter triggers | Soft reject: `"that won't fly. try again."` Inline, no shame screen |
| User quits mid-reveal | Reveal restarts from beginning next open (1× per day) |
| Push delivered late / not at all | App still works on next open; cloud catches up via WebSocket |

### Friends tab

- **Hidden until user signs in with Apple**
- Locked until you've answered today's question (no spoilers)
- Once unlocked: scrolling list `@handle — "their answer"` for friends who've already submitted
- After global reveal: tab also shows a friends-only mini-wordcloud for the previous question
- **No DMs, no reactions, no comments** — read-only awareness only
- Removing a friend is silent (no notification to the removed party)

### Leaderboard tab

- Three sub-tabs: **Today** · **This week** · **All time**
- Public users only (handle + score + small flag emoji from device locale)
- Tap a row → public profile (handle, all-time score, # of "called it" wins). No follow, no DM.
- **Banner ad** between rows 10 and 11 (one of three day-1 ad placements)

### Archive tab

- Scrollable grid of past questions, each tile shows the day's #1 answer + a thumbnail of the wordcloud
- Tap → full wordcloud + read-only stats for that day
- No re-answering historical questions
- **Banner ad** every 8 archive tiles (second day-1 ad placement)
- Long-press a past question → share that historical wordcloud (additional viral surface)

### Daily app-time target

| Phase | Duration |
|---|---|
| Push → submit | ~30 sec |
| Live cloud watching | sticky, ~1–4 min/day |
| Reveal animation | ~12 sec |
| **Total daily app time** | **~2–5 min** |

This is intentionally a 2–5 minute app, not a 30-minute app. Wordle's success was built on it.

---

## 5 — Leaderboard Mechanic + Anti-Cheat

### Scoring formula

```
daily_score(user) = rank_score(answer) + early_bird_bonus(submission_time, answer)
```

#### `rank_score(answer)` — based on final position in wordcloud

| Final position | Points |
|---|---|
| #1 (the global verdict) | **1000** |
| #2 or #3 | 500 |
| Top 10 | 250 |
| Top 100 | 100 |
| Top 1% globally | 50 |
| Outside top 1% | 10 (participation) |

#### `early_bird_bonus(submission_time, answer)` — within everyone who submitted the same cluster

| Rank within your cluster | Points |
|---|---|
| First person globally to submit this answer | +500 |
| Top 1% within the cluster | +200 |
| Top 10% within the cluster | +50 |
| Else | 0 |

**Worked example.** Verdict is "Pisa Tower" (412k cluster size). User typed "Pisa Tower" at T+30sec, was the 4th globally → `1000 + 500 = 1500 points`. Same answer at T+22h, 411,995th submission → `1000 + 0 = 1000`. "Eiffel Tower" (final #4) typed at T+5min as the 80th submission → `250 + 200 = 450`.

### Three leaderboards

- **Daily** — today's score, resets at next drop
- **Weekly** — rolling 7-day cumulative, soft-resets every Monday at drop
- **All-time** — career cumulative, never resets
- **Friend group** — same three boards, scoped to "you + your friends" (BeReal-style retention loop)

Format: `#142 of 4,237,891 — @handle — score — 🇩🇪`. Tap row → public profile.

### Anti-cheat — six layered defenses

| # | Defense | Notes |
|---|---|---|
| 1 | **Sign in with Apple required for leaderboard scoring** | Anonymous answerers stay in the wordcloud but their score isn't recorded. ~1 Apple ID per device via DeviceCheck. |
| 2 | **Submission dwell ≥ 3 seconds** | Submit button disabled until 3 sec elapsed since render. Kills instant-script submission at zero UX cost. |
| 3 | **Per-IP velocity throttling** | Hard cap N=10 submissions/IP/minute via Upstash Redis sliding window. Catches IP-pool sybils. |
| 4 | **DeviceCheck + App Attest** | Native iOS APIs. Rejects emulators / simulators / jailbroken devices on leaderboard endpoints. Doesn't block answering. |
| 5 | **Behavioral classifier** | Post-launch ML on user-level features (median submit time, answer entropy, dwell). Flags outliers for shadowban review. Pipeline collects features in v1.0; model trained ~month 2. |
| 6 | **Soft shadowban** | Confirmed cheaters keep their score visible to themselves; excluded from global + friend leaderboards. No "you've been banned" feedback so they can't iterate. |

Casual cheating: stopped. Determined attackers: not stopped — can add Cloudflare Turnstile + human verification if needed.

### Visibility rules

- **Before submitting today's question:** cannot see other answers, no wordcloud preview, no leaderboard, no friends tab
- **After submitting:** live wordcloud, today's leaderboard, friends tab all unlock
- Strategic side effect: users *can* deliberately wait to submit until late (watching the live cloud), but they lose the early-bird bonus. Dominant strategy remains "submit immediately with your honest take."

### Tiebreaks

Identical scores → earlier `submitted_at` wins. Identical timestamps → handle-alphabetical. Determinism matters because leaderboard rows get screenshotted.

### Not in v1

- Streaks (Duolingo-style) — defer to v1.1
- Achievements / badges
- Country-level leaderboards (politically loaded; brief is lighthearted)

---

## 6 — Technical Architecture

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| iOS client | **Expo (React Native)** | Matches Noseprint iOS stack. EAS builds, OTA updates, Android-ready in v2. |
| Backend API | **Next.js 16 on Vercel** | Matches Cleero stack. Serverless functions for submissions, cron for drop scheduler. |
| Database | **Supabase (Postgres)** | Matches Cleero. RLS enforced, Realtime via logical replication, Auth integrated. |
| Auth | **Sign in with Apple via Supabase Auth** | Optional for participation, required for leaderboard scoring. |
| Push | **Expo Push Service** | APNs proxy, native to Expo, batched fanout. |
| Realtime | **Supabase Realtime** | Postgres logical replication → WebSocket → React Native. Drives live wordcloud. |
| Edge cache | **Upstash Redis** | Hot cluster state for 1M+ concurrent post-drop watchers. Pay-per-request. |
| Scheduler | **Vercel Cron** | Triggers daily drop at the random time computed for each day. |
| Moderation | **Perspective API** + regex blocklist | Two-tier toxicity detection. |
| Ads | **Google AdMob** via `react-native-google-mobile-ads` | Industry standard for Expo. |
| Analytics | **PostHog** | Already in toolkit. |
| Crash reporting | **Sentry** | Standard, Expo-supported. |
| Install attribution | **Branch.io** | Banner-image referrals → install tracking. |

### Data model (Postgres, simplified)

```
questions(
  id, text, status: scheduled|live|revealed,
  scheduled_drop_at timestamptz,           -- random time computed nightly
  source: curated | ai_assisted | user_submitted,
  author_user_id?, moderation_status, approved_by_admin_id?
)

users(
  id, handle?, is_public, locale,
  device_check_token (encrypted), shadowbanned, created_at
)

device_users(
  id, device_token, linked_user_id?
)                                          -- anonymous device pre-signup

submissions(
  id, question_id, user_id?, device_user_id?,
  raw_text, normalized_cluster_id?,
  submitted_at, ip_hash, dwell_ms,
  moderation_status: passed | blocked
)                                          -- monthly partition by submitted_at

answer_clusters(
  id (= sha256(question_id || normalized_text)),
  question_id, canonical_text,
  submission_count, first_submission_at,
  final_rank?, final_pct_of_total?
)

friendships(
  requester_id, accepter_id,
  status: pending | accepted | blocked,
  created_at, accepted_at
)

leaderboard_entries(
  user_id, question_id, score,
  rank_score_component, early_bird_component, daily_rank
)

user_aggregates(
  user_id, weekly_score, weekly_score_calculated_at,
  alltime_score, num_called_it_wins, best_daily_rank
)

question_candidates(                       -- v1.1 only
  id, user_id, candidate_text, status, votes_count, scheduled_for_date?
)
```

**Partitioning:** `submissions` is partitioned by month from day 1 (the only table that scales with DAU × days). Other tables are unpartitioned.

**RLS:** all tables RLS-enabled deny-by-default (matches Cleero pattern). Submission writes via `/api/submit` only (service-role); reads gated by user identity.

### Answer normalization (deterministic, no LLM, $0 marginal cost)

Single stage, ~5ms per submission:

```python
def normalize(text: str) -> str:
    text = text.strip()
    text = text.lower()
    for article in ("the ", "a ", "an "):
        if text.startswith(article):
            text = text[len(article):]
    text = text.rstrip(".!?,…")
    text = re.sub(r"\s+", " ", text)
    # optional: normalize emoji to placeholder, e.g. "🇮🇹" -> ":it_flag:"
    return text

cluster_id = sha256(question_id + normalized_text)
```

**What collapses (intentional):**
- "Italy", "italy", "ITALY", "  Italy  ", "the Italy", "italy." → 1 cluster

**What stays separate (accepted):**
- "Italy" vs "italian" vs "italian food" → 3 separate bubbles
- "Pisa Tower" vs "leaning tower of pisa" → 2 separate bubbles

This produces slightly fragmented wordclouds but eliminates the biggest engineering risk in v1 and runs at zero marginal cost.

### Real-time wordcloud

- **Supabase Realtime** channel scoped to live `question_id`
- Client subscribes; receives streamed updates to `answer_clusters.submission_count`
- Client buffers updates over 500ms windows to avoid visual chaos
- Bubbles animate via React Native Reanimated 3, 300ms ease curves
- High-traffic mitigation: post-drop spike served from Upstash Redis cache, refreshed every 1–2 sec via Supabase trigger

### Global synchronous random drop

```
Nightly @ 00:00 UTC: pre-compute tomorrow's random drop_at (uniform 0–24h UTC)
  → Stored in questions.scheduled_drop_at

Vercel Cron @ 1-min granularity: poll for any question with status=scheduled
                                  AND scheduled_drop_at ≤ NOW()
  → Atomically:
      - Mark previous live question status → revealed
      - Compute final_rank for all answer_clusters of the previous question
      - Compute leaderboard_entries scores for all submitters
      - Mark today's question status → live
      - Trigger Expo Push fanout in 1k-device batches
      - Broadcast WebSocket event to all open clients
```

Push fanout to 1M devices: ~100 seconds total (Expo Push handles ~10k/sec). Acceptable lag.

### Banner generation (client-side)

- Render hidden React Native view (9:16, 1080×1920) → `react-native-view-shot` → PNG → native iOS share sheet
- Three banner template components (Today's take / Today's verdict / 👑 You called it)
- Embedded referral code in image metadata + visible `relatably.app` URL
- Branch.io tracks installs from banner views

### Cost estimate

| DAU | Monthly infra cost | Monthly ad revenue (blended $5 RPM, conservative) |
|---|---|---|
| 10k | ~$100 | ~$4k |
| 100k | ~$700 | ~$42k |
| 1M | ~$1k | ~$420k |

Cost is sub-linear because the heavy lifting (Realtime, Postgres, Vercel) has fixed overhead and scales gracefully on tier upgrades. **Profitable from ~5k DAU onward.**

---

## 7 — Share-Banner Growth Loop + Ad Placement

### The viral loop

```
Random push fires → submit answer → live wordcloud
    ↓
Next day: open app → yesterday's reveal plays
    ↓
"You ranked #X" → SHARE BANNER auto-generated
    ↓
1-tap to IG Story / TikTok / Snap / iMessage
    ↓
Friend sees banner → curious about today's Q
    ↓
Tap App Store badge → install → submit → cycle repeats
```

### Banner specifications

All banners are **9:16 vertical (1080×1920)**, generated client-side. Three types:

#### (1) "Today's take" banner — after submit

```
RELATABLY                 May 8, 2026

What's the most overrated tourist trap?

       ╭─────────────────╮
       │   EIFFEL TOWER  │
       ╰─────────────────╯

I said this. The world is voting now.
Drop @ random — every day. 🌍

[App Store badge]
```

#### (2) "Today's verdict" banner — after reveal animation

```
RELATABLY                 May 8, 2026

THE WORLD'S VERDICT:
PISA TOWER

  pizza      pisa tower
     [LOUVRE]    times square
  colosseum   eiffel tower

I ranked #14. Better than 87% of the world.

[App Store badge]
```

#### (3) "👑 You called it" banner — only for the global first-mover on the eventual #1

```
        👑 I CALLED IT 👑

I was the FIRST person on Earth to type
"PISA TOWER"

Today's most relatable take.
• 412,381 of you agreed •

@ick_of_the_day

RELATABLY · May 8, 2026
```

This third banner is the rarest, most-braggable artifact in the app — exactly one user globally per day gets it. The scarcity is the point.

### Auto-suggested share captions

- *"today the world said [PISA TOWER] is the most overrated tourist trap. what did you say? 🌍 drop @relatably"*
- *"i was FIRST. 👑 [PISA TOWER] = today's most relatable take on earth"*
- *"one daily question. one global verdict. random time. @relatably"*

### Share triggers

| Surface | Trigger | Pressure |
|---|---|---|
| After submit (Today's take) | Top-right pill | Soft |
| After reveal animation (Verdict) | Primary CTA at end | Medium |
| 👑 You called it | Auto-prompt full-screen modal w/ confetti | Hard |
| Archive tab | Long-press past question → share historical wordcloud | Soft |

### Ad placement (day 1)

| Placement | Type | Frequency | Why it's safe |
|---|---|---|---|
| Leaderboard tab | Native banner between rows 10/11 | Always visible on tab | Passive surface |
| Archive tab | Native banner every 8 tiles | Always visible on tab | Passive surface |
| Post-reveal interstitial | Full-screen video/static | 1× per user per day | Fires AFTER share CTA, never before. Skippable after 5 sec. |

### Explicit no-go zones for ads in v1

- Submission screen
- Live wordcloud watching
- Banner generation / share flow
- Reveal animation itself (ads only after it ends)
- 👑 You called it hero moment
- Friends tab
- Push notification frequency capped at 1 per day (no marketing pushes)

### Viral coefficient targets

- **k ≥ 0.3 by month 1** — healthy, on-trajectory
- **k < 0.2 by week 4** — share design needs re-tuning
- **k ≥ 0.6 anywhere** — BeReal-peak territory, self-sustaining growth

### Launch playbook (growth side)

| Week | Action |
|---|---|
| -1 | TestFlight to ~100–500 of Levin's Gen Z extended network. Capture qualitative banner feedback. |
| 0 | App Store live (public). Push to existing audiences (LinkedIn, IG). Don't promote heavily. |
| 2–6 | TikTok seeding: €2–10k spend on 5–50k-follower Gen Z creators for organic-feel daily-Relatably reactions. Hashtag `#relatably`. |
| Month 2 | If DAU > 10k and growth > 20%/week: pitch TechCrunch / Verge / Mashable as "BeReal of opinions." |

---

## 8 — Roadmap, Risks, and Kill Criteria

### Build roadmap (12–14 weeks)

| Phase | Weeks | Scope |
|---|---|---|
| **Pre-build** | -2 to 0 | Trademark search "Relatably". Verify relatably.com. Apple Developer enrollment. AdMob account. Hand-curate first 60 questions. Brand visual identity locked. |
| **Phase 1: Core loop** | 1–4 | Expo client scaffold, Supabase schema, Sign in with Apple, deterministic normalization, submission API, wordcloud rendering. |
| **Phase 2: Daily ritual** | 5–7 | Vercel Cron random-drop scheduler, Expo Push fanout, per-user reveal animation, push routing. |
| **Phase 3: Leaderboard + anti-cheat** | 8–9 | Scoring formula, three boards, friend graph, group leaderboards, six anti-cheat layers, profanity filter. |
| **Phase 4: Share + monetization** | 10–11 | Three banner types, share triggers, AdMob (3 placements), Branch.io install attribution. |
| **Phase 5: Archive + admin tools** | 12–13 | Archive tab, admin question-curation console, scheduled question pipeline. |
| **Phase 6: Launch hardening** | 14 | Sentry instrumentation, PostHog event tracking, load testing (simulate 100k concurrent submission burst), App Store submission, soft launch. |

### v1.1 (post-launch, ~6 weeks after public launch)

- User-submitted questions with community vote + LLM moderation pre-filter + admin review queue
- Streaks (if month-2 retention data shows it's needed)
- Android client (Expo gives most of this for free)

### Top risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Viral coefficient < 0.15 | Existential | Iterate banner design + share triggers weeks 4–6 of public launch. If still broken by week 8: pivot or sunset. |
| 2 | Daily-ritual retention crash (BeReal/HQ Trivia pattern) | Existential | Friend graph (BeReal retention), past-archive depth, eventual streak system in v1.1, fresh question source pipeline. |
| 3 | User-submitted questions moderation fails | Reputational + legal | **Deferred from v1.0 to v1.1** — single biggest risk reduction in this design. |
| 4 | Random-drop alienates non-Western Gen Z | TAM cap | Accept at launch. v2.x: regional drop times. |
| 5 | Multi-account leaderboard cheating goes viral | Reputational | Six layered defenses. Shadowban over hard-ban. Cloudflare Turnstile if needed. |
| 6 | AdMob fill rate brutal at small scale | Revenue | Expected; supplement with manual brand sponsorship (one branded daily question per week) for first 3–6 months. |
| 7 | App Store rejects user-generated content app | Launch blocker | Reporting mechanism + 24h moderation SLA + EULA acceptance. v1.0 wordcloud is text-only and moderation-filtered. |
| 8 | Push delivery to 100k+ devices fails | Engagement | Expo Push batching; pre-warm health-check 1 min before drop. WebSocket fallback for already-open clients. |
| 9 | Trademark conflict on "Relatably" | Rebrand cost | Real US/EU TM search before public launch. Backup name candidates ready. |
| 10 | Optiver compliance friction | Personal/regulatory | Existing Nebengewerbe + Optiver compliance signoff cover side projects. Confirm consumer-app-with-ads is in scope before launch. |

### Kill criteria

| Trigger | Action |
|---|---|
| k < 0.10 at week 6 of public launch | Iterate share banner + reveal once. No improvement by week 10 → sunset. |
| DAU < 5k at month 3 | Sunset. Redirect to other portfolio projects. |
| Day-7 retention < 15% by month 2 | Layer in streaks + heavier push reminders v1.1. No improvement by month 4 → sunset. |
| Single brand-PR incident (offensive question goes viral) | Immediate scope cut: revert to fully curated questions for 60 days, public statement. |
| Apple App Review rejection 2 cycles in a row | Reassess UGC moderation depth. |
| 30+ confirmed cheaters reach top-10 in any week | Pause leaderboard for 1 week. Ship Cloudflare Turnstile + behavioral classifier. |

---

## 9 — Why this could succeed

1. Genuine market gap — no shipping app combines daily synchronized random drop + free-text wordcloud + first-mover leaderboard + share banner.
2. Wordle proved daily ritual + emoji-grid share = #1 viral pattern of the decade.
3. BeReal proved random-time global synchronicity creates real FOMO + retention (until the share loop matters).
4. Spotify Wrapped proved share-banner playbook (2.1M mentions in 48hrs).
5. Mentimeter wordclouds visually arresting; nobody's pointed them at consumers.
6. Free-text answers = infinite content variety + infinite share-banner uniqueness.
7. Anonymous-by-default + opt-in public = honesty AND viral mechanics.
8. Existing Expo + Supabase + Vercel stack = fast time to ship.

## 10 — Why it could still fail

1. Daily-ritual apps have a brutal retention cliff (BeReal, HQ Trivia post-peak).
2. Free-text aggregation produces messier wordclouds than scripted MC polls (mitigated by accepting "good enough").
3. Ads-from-day-1 measurably reduce viral coefficient.
4. Sole revenue lever (ads) requires ~500k+ DAU before meaningful side income.
5. Random drop alienates Asia/Australia (~3am drops sometimes).
6. Crowded Gen Z social space — every quarter a new BeReal-clone trends and dies.

---

## 11 — Open TODOs (pre-launch checklist)

- [ ] Manual visit to relatably.com to confirm what's there
- [ ] US TM search via USPTO + EU TM search via EUIPO for "Relatably" (classes 9, 41, 45)
- [ ] Pick TLD (`relatably.app` recommended fallback)
- [ ] Lock brand visual identity: logo, wordmark, accent color, typography
- [ ] Hand-curate first 60 launch questions (Levin + Gen Z collaborator if possible)
- [ ] Apple Developer Program enrollment (if not already done under existing entity)
- [ ] AdMob account setup
- [ ] Apple App Attest + DeviceCheck capability registration
- [ ] Branch.io account + SDK integration plan
- [ ] PostHog project setup (existing org)
- [ ] Sentry project setup
- [ ] Decision: TestFlight invite list (~100–500 Gen Z friends)
- [ ] Decision: TikTok seeding budget for weeks 2–6 (suggested €2–10k)
- [ ] Confirm Nebengewerbe + Optiver compliance scope covers consumer-app-with-ads
- [ ] Privacy policy + EULA + GDPR DPA drafts

---

**End of design specification.** The next step is invoking the `superpowers:writing-plans` skill to convert this spec into a detailed implementation plan with sprint-level tasks and acceptance criteria.
