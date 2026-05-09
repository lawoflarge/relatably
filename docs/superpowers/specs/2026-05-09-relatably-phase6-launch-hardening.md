# Relatably — Phase 6: Launch Hardening (design spec)

**Date:** 2026-05-09
**Status:** approved (brainstorm complete)
**Predecessor:** Phase 5 — Archive + Admin (shipped, tagged `phase-5-complete`, commit `c7bb7b5`)
**Successor:** Phase 7 — Post-launch (PostHog analytics, server-rendered thumbnails, Branch first-open referral credit, Upstash leaderboard cache, friend pagination >300, App Attest, admin polish)

---

## 1. Goal

Take the functionally-complete Relatably app (Phases 1–5) and make it production-deployed, observable, kill-switched, App-Store-shippable, and battle-tested for a worldwide day-1 launch at ~1,000 concurrent submits during the global drop moment.

## 2. Definition of done

Phase 6 is complete when ALL of these are true:

1. Relatably v1.0 is **submitted to Apple App Review** for worldwide release (175 countries).
2. Cloud Functions (`prepareNextDrop`, `triggerDrop`, `fanoutPush`, `moderationReview` — 4 exported triggers; `scoreReveal` is called inline from `triggerDrop` and ships with it) are **deployed to the cloud** in `relatably-prod` Firebase project — emulator-only era ends.
3. Sentry is wired and **receiving real errors** from api/ (Vercel), firebase/functions/ (GCP), and ios/ (TestFlight build).
4. Three Firebase Remote Config kill-switches are **live and observed by code**: `drop_enabled`, `submit_rate_limit_per_min`, `leaderboard_endpoint_enabled`.
5. The three retry-vulnerable Cloud Functions (`moderationReview`, `fanoutPush`, `scoreReveal`) are **idempotent** under Cloud-Functions-platform retries.
6. `fanoutPush` runs FCM batches in **parallel** (`pLimit(10)`) instead of serial.
7. **60 hand-curated launch questions** are seeded in `relatably-prod` Firestore as `status='approved'` candidates AND `status='scheduled'` questions across the next 60 UTC days.
8. A **k6 load test** has been run at the 1,000-concurrent-submit profile against prod-staging, with p50/p95/p99 recorded in the plan addendum.
9. **All env-flag-gated SDKs are flipped on** in production: AdMob (3 ad units), Branch.io (referral signing key + iOS dashboard config), Perspective API key, Firebase Auth Google sign-in for `/admin`.
10. A **TestFlight build** has been physically dogfooded by Levin on a real iPhone with a written checklist (push delivery, Apple Sign-in, AdMob impression, Branch link, share card, archive scroll, leaderboard, friend graph).

## 3. Out of scope (deferred to Phase 7+)

These were explicitly considered and deferred:

- **PostHog analytics** — defer until v1.0 has a launch baseline of bug reports to triage first
- **Server-rendered archive thumbnails** (Sharp/Skia Cloud Function → static PNG in Cloud Storage) — Phase 5's text-string mini-bubbles are fine for v1.0
- **Image metadata referral embedding** (PNG iTXt) — share fallback uses visible `?r=<code>` URL
- **Branch deep-link first-open handler** that credits the referrer in `user_aggregates.referrals_count` — Phase 4 only generates codes; attribution measurement waits
- **Upstash Redis leaderboard cache** — premature at <1k concurrent; Remote Config circuit-breaker is the v1.0 mitigation
- **Friend leaderboard pagination beyond 300** — current cap is 10 chunks × 30 friends; cursor pagination waits
- **App Attest / DeviceCheck** — Phase 3 anti-cheat (auth + IP rate limit + shadowban + Perspective tier-2) is sufficient for v1.0; App Attest is overkill before there's a measurable cheating problem
- **Admin console polish** — bulk-create candidates from CSV, AI-assisted candidate generator, roles-table migration

## 4. Architecture decisions (locked)

### 4.1 Sentry tier
**Free tier** (5k errors/mo, 10k transactions). Sufficient for soft launch. Upgrade trigger: error volume hits 80% of free quota for 2 consecutive days post-launch.

### 4.2 Kill-switches via Firebase Remote Config
No new vendor; reuses Firebase. Three flags (string/bool, fetched on client + read server-side via Admin SDK):

| Flag | Type | Default | Effect |
|---|---|---|---|
| `drop_enabled` | bool | `true` | When `false`, `triggerDrop` exits early — no new question goes live, no FCM fanout. Lets you halt the daily ritual without a redeploy. |
| `submit_rate_limit_per_min` | int | `10` | Overrides hardcoded 10/IP/min in `api/lib/ratelimit.ts`. Drop to `2` if abuse spike. |
| `leaderboard_endpoint_enabled` | bool | `true` | When `false`, `GET /api/leaderboard` returns `503` with `Retry-After: 60`. Cuts Firestore read pressure if the leaderboard endpoint is the hot spot. |

Server-side: read with `admin.remoteConfig().getTemplate()` cached 5min in-memory. Client (iOS): Firebase Remote Config SDK with `fetchAndActivate({ minimumFetchIntervalMillis: 300_000 })`.

### 4.3 Idempotency pattern
One shared helper, three call sites:

```typescript
// firebase/functions/src/lib/idempotency.ts
export async function runOnce<T>(
  key: string,         // e.g. `moderationReview:${submissionId}`
  fn: () => Promise<T>
): Promise<T | null> {
  const ref = adminFirestore.collection("function_runs").doc(key);
  const result = await adminFirestore.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (snap.exists) return null;            // already ran — skip
    txn.set(ref, { started_at: FieldValue.serverTimestamp() });
    return "PROCEED";
  });
  if (result === null) return null;
  const value = await fn();
  await ref.update({ completed_at: FieldValue.serverTimestamp() });
  return value;
}
```

Wraps `moderationReview`, `fanoutPush`, `scoreReveal`. Cloud Functions v2 retries become safe.

### 4.4 Parallel FCM fanout
Replace serial `for (const batch of batches) { await sendEachForMulticast(batch); }` with `pLimit(10)`. Limits concurrent FCM API calls to 10 at a time — well under FCM's 500/sec server-side rate limit even at the 1k batch case. ~10x speedup at the global drop moment.

### 4.5 Load test
**Tool:** [`k6`](https://k6.io/) (single static binary, scriptable JS). Already widely used; no new infra.
**Profile:**
- 1,000 virtual users
- Each VU: register-device → submit-answer at a randomized offset within a 60-second post-drop window → fetch-yesterday → fetch-leaderboard
- Synthetic submissions tagged `is_synthetic_load_test=true` at `POST /api/submit` so a cleanup script can drop them
- Run against PROD with a `LOADTEST_BEARER` env-gated bypass header (server-side flag — `LOADTEST_TOKEN_HASH` env var on Vercel; never logged)

**Pass criteria:** p95 submit latency ≤ 1500ms, p99 ≤ 3000ms, zero 5xx errors, zero unhandled rejections in Sentry.

### 4.6 Single Firebase project
Continue with `relatably-prod` only. Load-test isolation via the `is_synthetic_load_test` flag + cleanup script. A separate `relatably-staging` project is deferred — adds ops overhead disproportionate to v1.0 risk.

### 4.7 Sentry source maps for iOS
Use `@sentry/react-native` Expo plugin. Source maps uploaded automatically as part of EAS build via the plugin's hook. Dist-versioned by EAS build number.

## 5. Workstreams + task ordering

Five lanes that can run roughly in parallel; concrete ordering enforced by task dependencies in the plan.

### Lane 1 — Backend cloud readiness (~7 tasks)
Idempotency helper + wrap 3 functions; parallel FCM fanout; Remote Config helper + `drop_enabled` gate; Sentry on Functions + api/; Cloud Functions deploy + smoke test. **Blocker:** Firebase Blaze plan upgrade (your manual step).

### Lane 2 — Account + env wiring (~4 tasks)
AdMob, Branch.io, Perspective API key, Firebase Auth Google sign-in for `/admin`. Each task = "you do the dashboard UI work + I verify env presence + I write the verification check."

### Lane 3 — Load test (~2 tasks)
k6 script + synthetic-data flag wired at `/api/submit`; baseline run with results recorded in plan addendum.

### Lane 4 — Launch content (~3 tasks)
60 launch questions drafted by me into `firebase/launch-questions.txt`; you review/edit; `seed-launch-questions.ts` script bulk-creates as approved candidates + scheduled questions across next 60 UTC days.

### Lane 5 — iOS build + App Store (~5 tasks)
iOS Sentry init + Expo plugin + sourcemap upload; EAS production profile + env injection; agent runs `eas build --platform ios --profile production` + `eas submit --platform ios` (this uploads the .ipa to App Store Connect — does NOT click "Submit for Review"); you-driven TestFlight dogfood checklist on physical iPhone; you-driven App Store Connect metadata fill + screenshots upload + clicking "Submit for Review" (matches Titi & Bina precedent — Claude has no ASC web access). Agent prepares `ios/store-assets/metadata.md` as a paste-ready reference for the ASC UI.

**Estimated total:** 21 tasks. ~5 are "your manual UI work + agent verifies" rather than pure code.

## 6. File structure

### Backend (api/)
- New: `api/src/lib/sentry.ts` — env-gated Sentry init + `captureError(err, ctx)` wrapper
- New: `api/instrumentation.ts` — Next.js 16 register hook for Sentry
- New: `api/src/lib/loadtest.ts` — `isLoadTestRequest(req)` constant-time bearer check
- Modify: `api/src/lib/ratelimit.ts` — read `submit_rate_limit_per_min` Remote Config override
- Modify: `api/src/app/api/leaderboard/route.ts` — short-circuit `503` when `leaderboard_endpoint_enabled=false`
- Modify: `api/src/app/api/submit/route.ts` — accept synthetic load-test flag when bearer matches
- Modify: `api/.env.example` — add `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `LOADTEST_TOKEN_HASH`

### Cloud Functions (firebase/functions/)
- New: `firebase/functions/src/lib/idempotency.ts` — `runOnce(key, fn)` helper
- New: `firebase/functions/src/lib/sentry.ts` — Sentry init for Functions runtime
- New: `firebase/functions/src/lib/remoteConfig.ts` — cached reader for kill-switches
- Modify: `firebase/functions/src/moderationReview.ts` — wrap in `runOnce`
- Modify: `firebase/functions/src/fanoutPush.ts` — wrap in `runOnce` + `pLimit(10)`
- Modify: `firebase/functions/src/scoreReveal.ts` — wrap in `runOnce`
- Modify: `firebase/functions/src/triggerDrop.ts` — gate on `drop_enabled` flag

### Launch content
- New: `firebase/launch-questions.txt` — 60 lines (drafted by Claude, reviewed by Levin)
- New: `firebase/scripts/seed-launch-questions.ts` — admin-SDK bulk seeder
- New: `firebase/scripts/cleanup-load-test-data.ts` — drops synthetic submissions

### iOS (ios/)
- New: `ios/src/lib/sentry.ts` — `@sentry/react-native` init, env-gated
- New: `ios/src/lib/remoteConfig.ts` — Firebase Remote Config wrapper for `drop_enabled`
- Modify: `ios/app/_layout.tsx` (or root) — Sentry init on mount
- Modify: `ios/app.json` — Sentry Expo plugin + Sentry config block
- Modify: `ios/eas.json` — production profile + env injection + Sentry sourcemap upload hook
- New: `ios/.env.production` template — production AdMob/Branch/Sentry/API URL placeholders

### Load test
- New: `loadtest/k6-drop-burst.js` — 1k VU script
- New: `loadtest/README.md` — run instructions + cleanup procedure
- New: `loadtest/results-2026-MM-DD.md` — baseline report (filled in during execution)

### App Store assets
- Referenced not generated (you have all 4 ready):
  - `ios/store-assets/icon-1024.png`
  - `ios/store-assets/screenshots/01-05.png`
  - `ios/store-assets/metadata.md` (description, keywords, subtitle, what's-new, age rating answers)
  - Privacy policy + support URLs (live at `relatably.app/privacy` + `relatably.app/support`)

## 7. Testing strategy

- **Unit tests (TDD)** for new lib code: `idempotency.ts`, `remoteConfig.ts` (both api/ and functions/), `sentry.ts` wrappers, `loadtest.ts` bearer check, `seed-launch-questions.ts` (in dry-run mode)
- **Integration tests** for the 3 wrapped functions: trigger twice with the same input, assert second invocation is a no-op
- **Integration tests** for kill-switch gates: set Remote Config flag → verify endpoint behavior changes
- **Load test** as a separate verification step, not part of the unit suite
- **No new tests for App Store metadata or EAS build** — these are external systems with their own validation

Test count target: +30–40 net-new across api/ and functions/. iOS test additions are minimal (Sentry init + Remote Config wrapper, ~5 tests).

## 8. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Firebase Blaze plan upgrade requires a credit card; if Levin delays, all of Lane 1 stalls | Plan flags this as the very first task; subsequent tasks can be implemented locally against the emulator while waiting |
| Sentry quota burns at unexpected scale on launch day | Free-tier limits are alerted at 80% by Sentry itself; Levin upgrades to Team plan if hit |
| App Review rejection (e.g., privacy policy gap, age-rating mismatch, AdMob disclosure) | Plan includes a pre-submission self-review step against Apple's common rejection list (privacy nutrition label, ATT prompt copy, third-party SDK disclosure) |
| Load test reveals the global drop moment is fragile at 1k concurrent | Remote Config kill-switches are the v1.0 lever; emergency fix = Phase 7 Upstash cache or rate-limit drop |
| `seed-launch-questions.ts` accidentally creates duplicates if run twice | Script uses deterministic IDs (`sha1(question_text)`) and `merge: true` — re-run is idempotent |
| Synthetic load-test data leaks into real leaderboards | All synthetic submissions tagged + filtered out of leaderboard scoring; cleanup script idempotent; tag filter in `scoreReveal` excludes synthetic submissions from `leaderboard_entries` writes |

## 9. Open Levin-driven items (recurring through tasks, not blockers between phases)

These are unblockable by the agent and surfaced as flagged tasks in the plan:

1. Firebase project Blaze upgrade (credit card UI)
2. AdMob account creation + 3 ad-unit IDs
3. Branch.io account + dashboard config + iOS app registration
4. Perspective API key from Google Cloud Console
5. Firebase Console: enable Google sign-in provider for `/admin`
6. Apple Developer Program: APNs cert generation + upload to Firebase Console (push delivery requires this)
7. EAS prod build + TestFlight installation on physical iPhone
8. App Store Connect: app record creation + metadata fill + screenshots upload + submission

The agent verifies each is done before subsequent dependent tasks proceed.

## 10. Success criteria (concrete, measurable)

- [ ] `firebase functions:list --project relatably-prod` shows all 5 deployed functions
- [ ] Sentry dashboard shows ≥1 test event from each of api/, functions/, ios/
- [ ] `gcloud firebase remoteconfig get` shows the 3 kill-switch flags
- [ ] Hitting `POST /api/admin/trigger-drop` 5 times in succession results in exactly ONE drop firing (idempotency proof)
- [ ] k6 baseline report shows p95 ≤ 1500ms, p99 ≤ 3000ms, 0 errors at 1k VU
- [ ] Firestore `question_candidates` collection has 60 docs with `status='approved'`
- [ ] Firestore `questions` collection has 60 docs with `status='scheduled'` and `scheduled_drop_at` spread across next 60 UTC days
- [ ] EAS Build dashboard shows a successful production iOS build with sourcemaps
- [ ] App Store Connect submission status: `Warten auf Prüfung` (or English equivalent: "Waiting for Review")
- [ ] TestFlight checklist file `ios/store-assets/dogfood-checklist.md` has all items ticked with screenshots

---

## Appendix: brainstorm decisions (for future-self context)

- **Wedge:** full launch wedge (App Store submission included)
- **PostHog:** deferred to Phase 7
- **Launch scale:** unknown — built for 1k with kill-switches
- **Geography:** worldwide day-1, English metadata, EN questions, UTC drop time
- **Assets:** all 4 (icon/screenshots/copy/privacy+support) confirmed ready by Levin
- **Launch questions:** Claude drafts 60 → Levin reviews → script seeds them
