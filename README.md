# Relatably

Daily synchronized opinion ritual for Gen Z. One question per day at a globally-random moment, free-text answers aggregate into a live wordcloud, and the first person to call the eventual #1 answer is crowned "most relatable on Earth."

**Status:** Phases 1, 2, 3, and 4 shipped and tagged. Phase 5 (archive + admin tools) is next.

## Design + plans

- Spec: [`docs/superpowers/specs/2026-05-08-relatably-design.md`](docs/superpowers/specs/2026-05-08-relatably-design.md) — single source of truth for product, UX, technical architecture, monetization, growth strategy, and kill criteria.
- Phase 1 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase1-core-loop.md`](docs/superpowers/plans/2026-05-08-relatably-phase1-core-loop.md) — complete.
- Phase 2 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase2-daily-ritual.md`](docs/superpowers/plans/2026-05-08-relatably-phase2-daily-ritual.md) — complete.
- Phase 3 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase3-leaderboard-anticheat.md`](docs/superpowers/plans/2026-05-08-relatably-phase3-leaderboard-anticheat.md) — complete.
- Phase 4 plan: [`docs/superpowers/plans/2026-05-09-relatably-phase4-share-monetization.md`](docs/superpowers/plans/2026-05-09-relatably-phase4-share-monetization.md) — complete.

## Repo layout

```
api/                  Next.js 16 backend (Vercel deploy target). Vitest tests.
firebase/             Firestore Security Rules + indexes + emulator config.
firebase/functions/   Cloud Functions v2 (TypeScript). prepareNextDrop, triggerDrop, fanoutPush, moderationReview.
firebase/scripts/     Admin TS-Node CLI (seed-questions).
ios/                  Expo (React Native) iOS client. Jest + RNTL tests.
docs/superpowers/     Specs and implementation plans.
```

## Branches + tags

- `main` — initial commit
- `phase-1-core-loop` (tag `phase-1-complete`) — Firebase rework + Phase 1
- `phase-2-daily-ritual` (tag `phase-2-complete`) — Phase 2 daily ritual subsystem
- `phase-3-leaderboard-anticheat` (tag `phase-3-complete`) — Phase 3 leaderboard + anti-cheat
- `phase-4-share-monetization` (tag `phase-4-complete`) — Phase 4 share + monetization

## Stack

- iOS client: Expo (React Native), `@react-native-firebase/{app,auth,firestore,messaging}` v24
- Backend: Next.js 16 on Vercel (HTTP API write paths via Firebase Admin SDK)
- Database: Firestore (Firebase) with Security Rules (deny-by-default)
- Auth: Firebase Auth + Sign in with Apple (Phase 3)
- Realtime: Firestore listeners
- Scheduler: Cloud Functions for Firebase v2 (scheduled + Firestore document triggers)
- Push: Firebase Cloud Messaging (FCM)
- Moderation: regex blocklist (Phase 1, sync) + Perspective API tier-2 (Phase 4, async via Cloud Function)
- Cache: Upstash Redis (rate limiter Phase 3; post-drop hot reads Phase 6)
- Ads: Google AdMob (Phase 4, env-flagged)
- Install attribution: Branch.io (Phase 4, env-flagged)
- Share-card capture: `react-native-view-shot` + `expo-sharing` (Phase 4)
- Analytics: PostHog (Phase 6)
- Crash: Sentry (Phase 6)

## Tests

- `cd api && pnpm test` — 98 vitest tests (18 files; mocked Admin SDK).
- `cd firebase/functions && pnpm test` — 66 vitest tests (13 files; emulator-backed + pure-fn). Requires Java for Firestore emulator.
- `cd ios && npx jest --runInBand` — 75 jest tests (21 files; React Native Testing Library). `--runInBand` avoids parallel-worker contention on Windows.

Total: **239 tests across all 3 codebases.**

## Local dev

Firestore emulator + Next.js API:

```bash
# Terminal A — emulator
cd firebase
firebase emulators:start --only firestore,functions,auth

# Terminal B — backend
cd api
cp .env.example .env.local      # set FIREBASE_PROJECT_ID + FIRESTORE_EMULATOR_HOST=localhost:8080
pnpm dev

# Terminal C — seed scheduled questions
cd firebase/scripts
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod pnpm seed:questions

# Terminal D — drive Cloud Functions manually
cd firebase
firebase functions:shell
> prepareNextDrop()       # picks tomorrow's drop time
> triggerDrop()            # transitions question status when drop_at <= now
```

Java 21 (OpenJDK) is required for the Firestore emulator. On Windows: `winget install Microsoft.OpenJDK.21`.

## Production env flags

All third-party SDKs default off. To enable in production:

| Variable | Where | What it gates |
|---|---|---|
| `PERSPECTIVE_API_KEY` | Vercel + Firebase Functions config | Async tier-2 toxicity moderation. When unset, `moderationReview` Cloud Function stamps `tier2_reviewed_at` but skips the actual evaluation. |
| `BRANCH_REFERRAL_SECRET` | Vercel | HMAC secret for signing referral codes. When unset, `signReferralCode` returns the literal `"dev-referral.dev"`. |
| `EXPO_PUBLIC_BRANCH_KEY` | EAS env | Branch.io SDK init. When unset, share fallback URL is `https://relatably.app/?r=<code>`. |
| `EXPO_PUBLIC_ADMOB_ENABLED` | EAS env | Set to `"true"` to enable AdMob. When false (default), all 3 ad slots render the disabled placeholder. |
| `EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID` / `*_ARCHIVE_BANNER_ID` / `*_INTERSTITIAL_ID` | EAS env | Per-slot ad-unit ids. Default to AdMob's published iOS test ad units when unset. |

iOS build (Mac only):

```bash
cd ios
npx expo prebuild --platform ios
npx expo run:ios
```

## Owner

Levin Schwab — built under existing Nebengewerbe.
