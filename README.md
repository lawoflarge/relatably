# Relatably

Daily synchronized opinion ritual for Gen Z. One question per day at a globally-random moment, free-text answers aggregate into a live wordcloud, and the first person to call the eventual #1 answer is crowned "most relatable on Earth."

**Status:** Phases 1-6 live in production at <https://relatably.vercel.app>. iOS **v1.0 (build 32) is in App Review** as of 2026-06-03: resubmitted after a Guideline 1.2 (User-Generated Content) rejection with visible report/block/hide controls everywhere, a no-drop Home fallback, an 18+ rating, and deterministic reviewer notes. See `docs/superpowers/plans/` for phase history.

## Design + plans

- Visual identity spec: [`mockups/01-sticker-pop/DESIGN.md`](mockups/01-sticker-pop/DESIGN.md), Sticker Pop v1.0 (palette, typography, spacing, radii, shadow, motion, components, voice, a11y).
- All 7 explored directions: [`mockups/index.html`](mockups/index.html) (open with `python -m http.server` from `mockups/`) + [`mockups/OVERVIEW.md`](mockups/OVERVIEW.md).
- Sticker Pop implementation plan: [`docs/superpowers/plans/2026-05-11-relatably-sticker-pop-implementation.md`](docs/superpowers/plans/2026-05-11-relatably-sticker-pop-implementation.md), 22 tasks, executed via subagent-driven development on `feat/sticker-pop-ui`, merged into `main` 2026-05-11.
- Product spec: [`docs/superpowers/specs/2026-05-08-relatably-design.md`](docs/superpowers/specs/2026-05-08-relatably-design.md).
- Phase 1 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase1-core-loop.md`](docs/superpowers/plans/2026-05-08-relatably-phase1-core-loop.md), complete.
- Phase 2 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase2-daily-ritual.md`](docs/superpowers/plans/2026-05-08-relatably-phase2-daily-ritual.md), complete.
- Phase 3 plan: [`docs/superpowers/plans/2026-05-08-relatably-phase3-leaderboard-anticheat.md`](docs/superpowers/plans/2026-05-08-relatably-phase3-leaderboard-anticheat.md), complete.
- Phase 4 plan: [`docs/superpowers/plans/2026-05-09-relatably-phase4-share-monetization.md`](docs/superpowers/plans/2026-05-09-relatably-phase4-share-monetization.md), complete.
- Phase 5 plan: [`docs/superpowers/plans/2026-05-09-relatably-phase5-archive-admin.md`](docs/superpowers/plans/2026-05-09-relatably-phase5-archive-admin.md), complete.

## Repo layout

```
api/                  Next.js 16 backend (Vercel deploy target). Vitest tests.
firebase/             Firestore Security Rules + indexes + emulator config.
firebase/functions/   Cloud Functions v2 (TypeScript). prepareNextDrop, triggerDrop, fanoutPush, moderationReview.
firebase/scripts/     Admin TS-Node CLI (seed-questions, seed-launch-questions, seed-remote-config).
ios/                  Expo (React Native) iOS client. Sticker Pop UI v1.0. Jest + RNTL tests (154 passing).
mockups/              v1.0 visual-identity exploration. 7 directions × 4 screens, served via python -m http.server.
docs/superpowers/     Specs and implementation plans.
```

## Branches + tags

- `main`: Sticker Pop UI shipped; Phases 1-6 live in prod
- `phase-1-core-loop` (tag `phase-1-complete`): Firebase rework + Phase 1
- `phase-2-daily-ritual` (tag `phase-2-complete`): Phase 2 daily ritual subsystem
- `phase-3-leaderboard-anticheat` (tag `phase-3-complete`): Phase 3 leaderboard + anti-cheat
- `phase-4-share-monetization` (tag `phase-4-complete`): Phase 4 share + monetization
- `phase-5-archive-admin` (tag `phase-5-complete`): Phase 5 archive + admin console
- `phase-6-launch-hardening` (tag `phase-6-plan-seed`): Phase 6 zero-cost launch hardening
- `design/sticker-pop-mockups`: 7 design directions + chosen Sticker Pop visual identity (merged via PR #2 2026-05-11)
- `feat/sticker-pop-ui`: Sticker Pop UI implementation, 22 commits (merged via PR #1 2026-05-11)

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

- `cd api && pnpm test`: 98 vitest tests (18 files; mocked Admin SDK).
- `cd firebase/functions && pnpm test`: 66 vitest tests (13 files; emulator-backed + pure-fn). Requires Java for Firestore emulator.
- `cd ios && pnpm test`: 154 jest tests across 36 files (React Native Testing Library + Sticker Pop primitives + Phyllotaxis layout helpers).

Total: **318+ tests across all 3 codebases.**

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
| `EXPO_PUBLIC_API_URL` | **build-time env (xcodebuild / EAS)** | Backend base URL the iOS client calls. **MUST be exported as `https://relatably.vercel.app` at build time**: `ios/src/lib/api.ts` falls back to `http://localhost:3000`, so a release build without it cannot reach the backend (App Review sees "no signal" → instant reject). |

## Building & submitting to the App Store (local Mac)

Local Xcode pipeline (replaces EAS/Codemagic). The native project lives in `ios/ios/`. From `ios/ios/`:

```bash
# 1. bump ios/app.json buildNumber, then mirror it into the native Info.plist:
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion <N>" Relatably/Info.plist
rm -rf "$TMPDIR"/metro-*                                    # avoid a stale JS bundle
export EXPO_PUBLIC_API_URL=https://relatably.vercel.app     # CRITICAL — see env table above
# 2. archive (manual signing, App Store profile):
xcodebuild -workspace Relatably.xcworkspace -scheme Relatably -configuration Release -sdk iphoneos \
  -archivePath ../build/Relatably.xcarchive -destination 'generic/platform=iOS' \
  DEVELOPMENT_TEAM=R95M36AU2X CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE_SPECIFIER="Relatably Local AppStore 2026-06-01" archive
# 3. export IPA + upload:
xcodebuild -exportArchive -archivePath ../build/Relatably.xcarchive \
  -exportPath ../build/export -exportOptionsPlist ../build/export/ExportOptions.plist
xcrun altool --upload-app -f ../build/export/*.ipa -t ios \
  --apiKey 8XWLD2B2RQ --apiIssuer 538cb0d4-b8c6-4bc7-8b59-75da5d2b9411
```

Then `node scripts/asc-fill-metadata.mjs` attaches the latest VALID build + sets review notes + the 18+ rating.

**Gotchas (learned the hard way):**
- **Export `EXPO_PUBLIC_API_URL` at build time** or the app points at localhost = instant App Review reject. Verify by running the build on a Simulator and confirming it reaches the backend: the Hermes bundle is bytecode, so `grep main.jsbundle` is unreliable; use `strings -n5 | grep`.
- **A REJECTED version cannot be resubmitted via REST** (it stays bound to the old reviewSubmission → `409 ITEM_PART_OF_ANOTHER_SUBMISSION`). Do the final step in the ASC web UI: version page → "Update Review" → submission page → "Resubmit to App Review".

## Owner

Levin Schwab: built under existing Nebengewerbe.
