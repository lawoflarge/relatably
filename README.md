# Relatably

Daily synchronized opinion ritual for Gen Z. One question per day at a globally-random moment, free-text answers aggregate into a live wordcloud, and the first person to call the eventual #1 answer is crowned "most relatable on Earth."

**Status:** Phases 1 + 2 shipped and tagged. Phase 3 (leaderboard + anti-cheat) up next.

## Design + plans

- Spec: [`docs/superpowers/specs/2026-05-08-relatably-design.md`](docs/superpowers/specs/2026-05-08-relatably-design.md) — single source of truth for product, UX, technical architecture, monetization, growth strategy, and kill criteria.
- Phase 1 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase1-core-loop.md`](docs/superpowers/plans/2026-05-08-relatably-phase1-core-loop.md) — complete.
- Phase 2 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase2-daily-ritual.md`](docs/superpowers/plans/2026-05-08-relatably-phase2-daily-ritual.md) — complete.

## Repo layout

```
api/                  Next.js 16 backend (Vercel deploy target). Vitest tests.
firebase/             Firestore Security Rules + indexes + emulator config.
firebase/functions/   Cloud Functions v2 (TypeScript). prepareNextDrop, triggerDrop, fanoutPush.
firebase/scripts/     Admin TS-Node CLI (seed-questions).
ios/                  Expo (React Native) iOS client. Jest + RNTL tests.
docs/superpowers/     Specs and implementation plans.
```

## Branches + tags

- `main` — initial commit
- `phase-1-core-loop` (tag `phase-1-complete`) — Firebase rework + Phase 1
- `phase-2-daily-ritual` (tag `phase-2-complete`) — Phase 2 daily ritual subsystem

## Stack

- iOS client: Expo (React Native), `@react-native-firebase/{app,auth,firestore,messaging}` v24
- Backend: Next.js 16 on Vercel (HTTP API write paths via Firebase Admin SDK)
- Database: Firestore (Firebase) with Security Rules (deny-by-default)
- Auth: Firebase Auth + Sign in with Apple (Phase 3)
- Realtime: Firestore listeners
- Scheduler: Cloud Functions for Firebase v2 (scheduled + Firestore document triggers)
- Push: Firebase Cloud Messaging (FCM)
- Cache: Upstash Redis (post-drop hot reads, Phase 6)
- Ads: Google AdMob (Phase 4)
- Analytics: PostHog (Phase 6)
- Crash: Sentry (Phase 6)
- Install attribution: Branch.io (Phase 4)

## Tests

- `cd firebase/functions && pnpm test` — 25 vitest tests (6 files; emulator-backed + pure-fn). Requires Java for Firestore emulator.
- `cd api && pnpm test` — 34 vitest tests (6 files; mocked Admin SDK).
- `cd ios && pnpm test` — 15 jest tests (4 files; React Native Testing Library).

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

iOS build (Mac only):

```bash
cd ios
npx expo prebuild --platform ios
npx expo run:ios
```

## Owner

Levin Schwab — built under existing Nebengewerbe.
