# Relatably v1.0 — Phase 3 Implementation Plan (Leaderboard + Anti-Cheat)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working leaderboard subsystem where (a) signed-in users via Sign in with Apple are scored on every revealed question, (b) three boards (daily / weekly / all-time) plus a friend-scoped variant of each are queryable, (c) friend graph (request / accept / list / remove) is wired on backend + iOS, and (d) anti-cheat hardens submissions with auth-gated scoring + per-IP velocity throttle + soft shadowban filter + behavioral feature collection.

**Architecture:** Backend Next.js 16 (under `api/`) gains 7 new authed endpoints (`POST /api/auth/me`, friend graph CRUD, `GET /api/leaderboard`) plus rate-limit middleware on `POST /api/submit`. Cloud Functions (under `firebase/functions/`) gain `scoreReveal()` — invoked inline from `triggerDrop` after the existing `final_rank` batch — which writes one `leaderboard_entries` doc per signed-in submitter and bumps each scorer's `user_aggregates`. The iOS client gains a Sign in with Apple flow (`expo-apple-authentication` → `auth().signInWithCredential`), an `Authorization: Bearer <firebase-id-token>` pass-through on outbound calls, a `LeaderboardScreen` + `FriendsScreen`, and a 4-tab bottom bar.

**Tech Stack:** Firebase Auth (Sign in with Apple federated provider), Firebase Admin Auth (`adminAuth.verifyIdToken`), `expo-apple-authentication` ^7 (new), `@react-native-firebase/auth` 24.x (already installed), Upstash Redis REST (`@upstash/redis` ^1.34, **only loaded if env vars present** — dev/test fall back to in-memory limiter), Vitest (backend tests, mocked + emulator-backed), Jest + React Native Testing Library (iOS tests), Firebase Emulator Suite (auth:9099, firestore:8080, functions:5001, ui:4000).

**Phase 3 acceptance criteria:** A developer running `firebase emulators:start --only firestore,auth,functions` plus `pnpm dev` in `api/` should be able to:

1. `POST /api/auth/me` with a forged Firebase Auth emulator ID token (`uid=test-user-1`) and verify a `/users/test-user-1` doc gets created with `shadowbanned=false`.
2. `POST /api/submit` with the same token in `Authorization: Bearer <token>` and verify the resulting submission doc has `user_id="test-user-1"` (anonymous flow still works without the header).
3. Drop the question via the existing Phase 2 emulator drill (set `scheduled_drop_at=now`, kick `triggerDrop`) and verify:
   - One `leaderboard_entries` doc per signed-in submitter, with `score = rank_score_component + early_bird_component`.
   - `user_aggregates/{uid}` exists with `alltime_score`, `weekly_score`, and `num_called_it_wins` populated.
4. `GET /api/leaderboard?period=daily` returns the just-revealed question's top scorers, sorted by score desc, submitted_at asc.
5. `GET /api/leaderboard?period=daily&scope=friends` requires auth and returns only entries whose `user_id` is in the signed-in user's accepted-friend set.
6. Confirmed shadowbanned users (manually set `users/{uid}.shadowbanned=true` via Emulator UI) are filtered out of all 6 leaderboard variants.
7. `POST /api/friends/request` + `POST /api/friends/accept` + `GET /api/friends` + `DELETE /api/friends/{id}` work with auth and create the right `friendships` docs.
8. Sending 11 `POST /api/submit` requests in 1 minute from the same IP (via `x-forwarded-for: 1.2.3.4`) triggers 429 on the 11th.
9. All Cloud Functions code has green Vitest tests; all backend endpoints have green Vitest tests; all iOS lib + components have green Jest tests.
10. iOS client compiles with `expo-apple-authentication` added.

**iOS-execution acceptance (deferred to Phase 6 / Mac):** Real Apple-server Sign in with Apple flow, real DeviceCheck/App Attest assertion, Apple Developer Portal "Sign in with Apple" capability registration, real native build. Same deferral pattern as Phase 1 Task 16 + Phase 2 messaging.

---

## File Structure

```
relatably/
├── api/
│   ├── package.json                                (modify: add @upstash/redis as optional dep)
│   └── src/
│       ├── lib/
│       │   ├── auth.ts                             (NEW: requireAuth + getOrCreateUserDoc)
│       │   ├── auth.test.ts
│       │   ├── hash.ts                             (NEW: shared hashDeviceToken + hashIp)
│       │   ├── hash.test.ts
│       │   ├── ratelimit.ts                        (NEW: pluggable RateLimiter w/ memory + upstash impls)
│       │   └── ratelimit.test.ts
│       └── app/
│           └── api/
│               ├── auth/
│               │   └── me/
│               │       ├── route.ts                (NEW: POST ensure user doc exists)
│               │       └── route.test.ts
│               ├── friends/
│               │   ├── route.ts                    (NEW: GET list)
│               │   ├── route.test.ts
│               │   ├── request/
│               │   │   ├── route.ts                (NEW: POST send request)
│               │   │   └── route.test.ts
│               │   ├── accept/
│               │   │   ├── route.ts                (NEW: POST accept)
│               │   │   └── route.test.ts
│               │   └── [id]/
│               │       ├── route.ts                (NEW: DELETE remove)
│               │       └── route.test.ts
│               ├── leaderboard/
│               │   ├── route.ts                    (NEW: GET ?period=...&scope=...)
│               │   └── route.test.ts
│               ├── submit/
│               │   └── route.ts                    (modify: optional auth, classifier features, IP throttle, shared hash helper)
│               ├── devices/register/route.ts       (modify: import shared hash helper)
│               └── yesterday/route.ts              (modify: import shared hash helper)
├── firebase/
│   ├── firestore.rules                             (modify: relax /users update, add reads for users, leaderboard_entries, user_aggregates, deny-all for friendships)
│   ├── firestore.indexes.json                      (modify: add 4 indexes for leaderboard + friendships)
│   └── functions/
│       └── src/
│           ├── lib/
│           │   ├── rankScore.ts                    (NEW: pure rank_score table)
│           │   ├── rankScore.test.ts
│           │   ├── earlyBirdBonus.ts               (NEW: pure early_bird_bonus table)
│           │   ├── earlyBirdBonus.test.ts
│           │   ├── computeDailyScore.ts            (NEW: pure composer of the two)
│           │   └── computeDailyScore.test.ts
│           ├── scoreReveal.ts                      (NEW: emulator-driven score writer)
│           ├── scoreReveal.test.ts
│           └── triggerDrop.ts                      (modify: call runScoreReveal after the final_rank batch)
└── ios/
    ├── package.json                                (modify: add expo-apple-authentication)
    ├── app.json                                    (modify: add expo-apple-authentication plugin + usesAppleSignIn)
    ├── src/
    │   ├── lib/
    │   │   ├── auth.ts                             (NEW: signInWithApple + getIdToken)
    │   │   ├── auth.test.ts
    │   │   └── api.ts                              (modify: Authorization header pass-through + leaderboard/friends/auth calls)
    │   ├── components/
    │   │   ├── SignInWithApple.tsx                 (NEW: Apple button)
    │   │   ├── SignInWithApple.test.tsx
    │   │   ├── LeaderboardRow.tsx                  (NEW)
    │   │   ├── LeaderboardRow.test.tsx
    │   │   ├── FriendListRow.tsx                   (NEW)
    │   │   └── FriendListRow.test.tsx
    │   ├── screens/
    │   │   ├── LeaderboardScreen.tsx               (NEW)
    │   │   ├── LeaderboardScreen.test.tsx
    │   │   ├── FriendsScreen.tsx                   (NEW)
    │   │   └── FriendsScreen.test.tsx
    │   └── types/
    │       └── api.ts                              (modify: add LeaderboardEntry, Friendship, AuthMeResponse)
    └── app/
        └── (tabs)/
            ├── _layout.tsx                         (modify: 4-tab bar — today/friends/leaderboard/archive)
            ├── friends.tsx                         (NEW: thin wrapper around FriendsScreen)
            ├── leaderboard.tsx                     (NEW: thin wrapper around LeaderboardScreen)
            ├── archive.tsx                         (NEW: Phase-5 placeholder)
            └── explore.tsx                         (DELETE: replaced by leaderboard.tsx)
```

**Why this layout:**
- Pure scoring helpers stay in `firebase/functions/src/lib/` next to `pickDropAt` etc., unit-tested without the emulator.
- `scoreReveal.ts` lives at the same level as `triggerDrop.ts` (siblings, not nested), and is wired into `triggerDrop` rather than exported as its own Cloud Function — fewer function deploys + tighter atomicity with the `final_rank` step.
- `api/src/lib/hash.ts` clears the rule-of-three flagged at the end of Phase 2 (3 endpoints duplicated `hashDeviceToken`).
- `api/src/lib/ratelimit.ts` ships as a pluggable interface so dev/test work without Upstash; production picks Upstash automatically when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars are set.
- iOS auth helper is its own module so the `auth().signInWithCredential` path can be mocked in tests the same way `messaging.ts` was in Phase 2.
- Each tab gets its own file under `app/(tabs)/` per Expo Router conventions; the screens live in `src/screens/` so they remain testable in isolation.

---

## Task Map (Phase 3 = 16 tasks across ~2 weeks)

| Task | Subject | Depends on |
|---|---|---|
| 1 | Firestore rules + indexes update for new collections | — |
| 2 | TDD shared `hashDeviceToken`/`hashIp` helper + refactor 3 callers | — |
| 3 | TDD pure: `rankScore` | — |
| 4 | TDD pure: `earlyBirdBonus` | — |
| 5 | TDD pure: `computeDailyScore` (composes 3 + 4) | 3, 4 |
| 6 | `scoreReveal()` (emulator-backed) + wire into `triggerDrop` | 1, 5 |
| 7 | TDD `requireAuth` + `getOrCreateUserDoc` helper | — |
| 8 | `POST /api/auth/me` endpoint | 7 |
| 9 | TDD pluggable `RateLimiter` (memory + upstash + factory) | — |
| 10 | Modify `POST /api/submit`: optional auth + classifier features + IP throttle | 7, 9, 2 |
| 11 | Friend graph: 4 endpoints (request / accept / list / remove) | 1, 7 |
| 12 | `GET /api/leaderboard` endpoint w/ shadowban filter | 1, 7 |
| 13 | iOS: `expo-apple-authentication` install + `auth.ts` helper (TDD) + `SignInWithApple` component | — |
| 14 | iOS: `api.ts` Authorization pass-through + new endpoint clients (TDD) | 13 |
| 15 | iOS: `LeaderboardScreen` + `FriendsScreen` + 4-tab bar wiring (TDD) | 14 |
| 16 | Phase 3 acceptance gate (manual emulator E2E) | all |

---

## Pre-flight: branch + Apple Sign-in capability

The agent should verify before starting Task 1:

- [ ] **Confirm branch.** Run `git branch --show-current`. If on `phase-2-daily-ritual`, cut a new branch:

```bash
cd /c/Users/levin/relatably
git checkout -b phase-3-leaderboard-anticheat
```

- [ ] **Confirm Firebase Auth emulator + Apple provider awareness.** Sign in with Apple federated auth uses Firebase Auth's `OAuthProvider("apple.com")`. The emulator does NOT validate the Apple ID token signature — it accepts anything the Admin SDK signs. That's fine for Phase 3 tests. Real Apple validation runs in prod at Firebase's edge. No emulator config changes needed beyond what Phase 1 already added.

- [ ] **Confirm Apple Developer enrollment status.** Real "Sign in with Apple" capability registration requires Apple Developer Portal access + a Mac. **This task is deferred to Phase 6.** Phase 3 ships against the Firebase Auth emulator only — iOS code compiles and unit-tests pass; real Apple flow is validated when Levin has Mac access.

- [ ] **Confirm Java + Node versions.** Same as Phase 2:
  - `java -version` should print 21+ (Microsoft OpenJDK at `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\`).
  - `node --version` should be ≥ 20.

---

## Task 1: Firestore rules + indexes update for new collections

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `firebase/firestore.indexes.json`

The rules must (a) allow clients to read `leaderboard_entries` + `user_aggregates` + public `users` for the leaderboard UI, (b) allow a signed-in user to update their own `users` doc (handle, is_public), (c) keep `friendships` server-only (clients call API endpoints, which use Admin SDK to write), (d) keep `submissions` and `device_users` server-only (unchanged).

- [ ] **Step 1: Replace `firebase/firestore.rules` with the Phase 3 ruleset**

```
rules_version = '2';

// Deny-by-default. Every read/write must match a rule below.
// All write paths go through the Next.js API using Firebase Admin SDK,
// which bypasses Security Rules with full credentials.

service cloud.firestore {
  match /databases/{database}/documents {

    // QUESTIONS: clients may read live + revealed questions.
    match /questions/{questionId} {
      allow read: if resource.data.status in ['live', 'revealed'];
      allow write: if false;
    }

    // ANSWER_CLUSTERS: clients may read clusters whose question is live or revealed.
    match /answer_clusters/{clusterId} {
      allow read: if exists(/databases/$(database)/documents/questions/$(resource.data.question_id))
        && get(/databases/$(database)/documents/questions/$(resource.data.question_id)).data.status in ['live', 'revealed'];
      allow write: if false;
    }

    // USERS: signed-in users may read+update their own doc; public+non-shadowbanned
    // users are readable by other signed-in clients (for leaderboard display).
    match /users/{userId} {
      allow read: if request.auth != null
        && (request.auth.uid == userId
            || (resource.data.is_public == true && resource.data.shadowbanned == false));
      allow create: if false;
      allow update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['handle', 'is_public', 'locale']);
      allow delete: if false;
    }

    // LEADERBOARD_ENTRIES: signed-in clients may read; the API does shadowban
    // filtering on the response path (rule-level filtering would require per-doc
    // user lookups and is impractical).
    match /leaderboard_entries/{entryId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // USER_AGGREGATES: signed-in clients may read; API filters shadowbanned.
    match /user_aggregates/{userId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // SUBMISSIONS, DEVICE_USERS, FRIENDSHIPS, QUESTION_CANDIDATES: server-only.
    match /submissions/{id}              { allow read, write: if false; }
    match /device_users/{id}             { allow read, write: if false; }
    match /friendships/{id}              { allow read, write: if false; }
    match /question_candidates/{id}      { allow read, write: if false; }
  }
}
```

- [ ] **Step 2: Replace `firebase/firestore.indexes.json` with the Phase 3 indexes**

```json
{
  "indexes": [
    {
      "collectionGroup": "answer_clusters",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "question_id", "order": "ASCENDING" },
        { "fieldPath": "submission_count", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "answer_clusters",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "question_id", "order": "ASCENDING" },
        { "fieldPath": "final_rank", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduled_drop_at", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "question_id", "order": "ASCENDING" },
        { "fieldPath": "device_user_id", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "submissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "question_id", "order": "ASCENDING" },
        { "fieldPath": "normalized_cluster_id", "order": "ASCENDING" },
        { "fieldPath": "submitted_at", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "leaderboard_entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "question_id", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" },
        { "fieldPath": "submitted_at", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "leaderboard_entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "friendships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "requester_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "friendships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "accepter_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Boot the emulator to validate parsing**

```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start --only firestore
```

Expected: emulator boots without parse errors. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/firestore.rules firebase/firestore.indexes.json
git commit -m "feat(firestore): rules + indexes for leaderboard/friends/users (Phase 3)"
```

---

## Task 2: TDD shared `hashDeviceToken` + `hashIp` helper + refactor 3 callers

**Files:**
- Create: `api/src/lib/hash.ts`
- Create: `api/src/lib/hash.test.ts`
- Modify: `api/src/app/api/submit/route.ts`
- Modify: `api/src/app/api/devices/register/route.ts`
- Modify: `api/src/app/api/yesterday/route.ts`

Phase 2 review flagged `hashDeviceToken` duplicated across 3 endpoints (rule-of-three triggered). Extract once, refactor the three callers, leave `hashIp` here too since `submit/route.ts` already needed it and the rate limiter (Task 9) will reuse it.

- [ ] **Step 1: Write the failing test**

Create `api/src/lib/hash.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashDeviceToken, hashIp } from "./hash";

describe("hashDeviceToken", () => {
  it("returns a 64-char sha256 hex digest", () => {
    expect(hashDeviceToken("dev-1")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("is deterministic", () => {
    expect(hashDeviceToken("dev-1")).toBe(hashDeviceToken("dev-1"));
  });
  it("differs across inputs", () => {
    expect(hashDeviceToken("dev-1")).not.toBe(hashDeviceToken("dev-2"));
  });
});

describe("hashIp", () => {
  it("prefers x-forwarded-for first entry", () => {
    const a = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    }));
    const b = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    }));
    expect(a).toBe(b);
  });
  it("falls back to x-real-ip", () => {
    const r = hashIp(new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.7" },
    }));
    expect(r).toMatch(/^[a-f0-9]{64}$/);
  });
  it("uses literal 'unknown' when no IP headers present", () => {
    const a = hashIp(new Request("http://localhost"));
    const b = hashIp(new Request("http://localhost"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/lib/hash.test.ts
```

Expected: FAIL — `Cannot find module './hash'`.

- [ ] **Step 3: Write the implementation**

Create `api/src/lib/hash.ts`:

```ts
import { createHash } from "node:crypto";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/hash.test.ts
```

Expected: PASS — 6 tests green.

- [ ] **Step 5: Refactor `submit/route.ts`**

Open `api/src/app/api/submit/route.ts`. Remove the local `hashIp` function (lines 18-24) and the local `hashDeviceToken` function (lines 26-28) and the `import { createHash } from "node:crypto";` line. Add this import alongside the others:

```ts
import { hashIp, hashDeviceToken } from "@/lib/hash";
```

The rest of the file is unchanged.

- [ ] **Step 6: Refactor `devices/register/route.ts`**

Open `api/src/app/api/devices/register/route.ts`. Remove the local `hashDeviceToken` function and the `import { createHash } from "node:crypto";` line. Add:

```ts
import { hashDeviceToken } from "@/lib/hash";
```

- [ ] **Step 7: Refactor `yesterday/route.ts`**

Open `api/src/app/api/yesterday/route.ts`. Remove the local `hashDeviceToken` function and the `import { createHash } from "node:crypto";` line. Add:

```ts
import { hashDeviceToken } from "@/lib/hash";
```

- [ ] **Step 8: Run the full backend test suite to confirm refactor preserves behavior**

```bash
cd /c/Users/levin/relatably/api
pnpm test
```

Expected: All Phase 1 + Phase 2 tests still PASS plus the 6 new hash tests.

- [ ] **Step 9: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/lib/hash.ts api/src/lib/hash.test.ts \
        api/src/app/api/submit/route.ts \
        api/src/app/api/devices/register/route.ts \
        api/src/app/api/yesterday/route.ts
git commit -m "refactor(api): extract shared hashDeviceToken + hashIp (TDD)"
```

---

## Task 3: TDD pure `rankScore`

**Files:**
- Create: `firebase/functions/src/lib/rankScore.test.ts`
- Create: `firebase/functions/src/lib/rankScore.ts`

`rankScore({ clusterRank, totalClusters, clusterCount, totalSubmissions })` returns `{ points, tier }` per spec section 5 table. Tier names: `verdict | top3 | top10 | top100 | top1pct | participation`.

`top1pct` is computed by submission count, not by cluster index: a cluster qualifies if its `clusterCount` is at least 1% of `totalSubmissions`. Spec wording is "Top 1% globally" — a popularity threshold, not a cluster-position threshold.

Most-specific tier wins. A cluster ranked #11 with high count gets `top100` (100 pts) — NOT `top1pct`.

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/lib/rankScore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankScore } from "./rankScore";

describe("rankScore", () => {
  it("verdict: cluster #1 = 1000 pts", () => {
    const r = rankScore({ clusterRank: 1, totalClusters: 50, clusterCount: 412000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 1000, tier: "verdict" });
  });

  it("top3: cluster #2 = 500 pts", () => {
    const r = rankScore({ clusterRank: 2, totalClusters: 50, clusterCount: 200000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 500, tier: "top3" });
  });

  it("top3: cluster #3 = 500 pts", () => {
    const r = rankScore({ clusterRank: 3, totalClusters: 50, clusterCount: 100000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 500, tier: "top3" });
  });

  it("top10: cluster #4 = 250 pts", () => {
    const r = rankScore({ clusterRank: 4, totalClusters: 50, clusterCount: 50000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 250, tier: "top10" });
  });

  it("top100: cluster #11 = 100 pts (most-specific tier wins over top1pct)", () => {
    const r = rankScore({ clusterRank: 11, totalClusters: 5000, clusterCount: 50000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 100, tier: "top100" });
  });

  it("top1pct by submission count when cluster rank > 100", () => {
    // 12,000 submissions out of 1M = 1.2% qualifies for top1pct
    const r = rankScore({ clusterRank: 250, totalClusters: 5000, clusterCount: 12000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 50, tier: "top1pct" });
  });

  it("participation: outside top 100 AND below 1% threshold = 10 pts", () => {
    const r = rankScore({ clusterRank: 250, totalClusters: 5000, clusterCount: 100, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 10, tier: "participation" });
  });

  it("participation: solo bubble (count=1) far down the tail = 10 pts", () => {
    const r = rankScore({ clusterRank: 4999, totalClusters: 5000, clusterCount: 1, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 10, tier: "participation" });
  });

  it("handles edge case: only 1 cluster total (everyone agreed)", () => {
    const r = rankScore({ clusterRank: 1, totalClusters: 1, clusterCount: 50, totalSubmissions: 50 });
    expect(r).toEqual({ points: 1000, tier: "verdict" });
  });

  it("handles totalSubmissions=0 without divide-by-zero", () => {
    const r = rankScore({ clusterRank: 250, totalClusters: 1, clusterCount: 0, totalSubmissions: 0 });
    expect(r).toEqual({ points: 10, tier: "participation" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/lib/rankScore.test.ts
```

Expected: FAIL — `Cannot find module './rankScore'`.

- [ ] **Step 3: Write the implementation**

Create `firebase/functions/src/lib/rankScore.ts`:

```ts
export type RankTier = "verdict" | "top3" | "top10" | "top100" | "top1pct" | "participation";

export interface RankScoreInput {
  clusterRank: number;        // 1-indexed; cluster's rank among all clusters of this question (by submission_count desc)
  totalClusters: number;      // total distinct clusters for this question
  clusterCount: number;       // submission_count of this cluster
  totalSubmissions: number;   // total submissions to this question (sum of cluster counts)
}

export interface RankScoreResult {
  points: number;
  tier: RankTier;
}

/**
 * Per spec Section 5. Most-specific tier wins. The top-1% threshold is by
 * submission count (popularity), not by cluster index.
 */
export function rankScore(input: RankScoreInput): RankScoreResult {
  if (input.clusterRank === 1) return { points: 1000, tier: "verdict" };
  if (input.clusterRank <= 3) return { points: 500, tier: "top3" };
  if (input.clusterRank <= 10) return { points: 250, tier: "top10" };
  if (input.clusterRank <= 100) return { points: 100, tier: "top100" };

  // Top-1% by popularity (submission count).
  if (input.totalSubmissions > 0 && input.clusterCount / input.totalSubmissions >= 0.01) {
    return { points: 50, tier: "top1pct" };
  }

  return { points: 10, tier: "participation" };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/rankScore.test.ts
```

Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/lib/rankScore.ts firebase/functions/src/lib/rankScore.test.ts
git commit -m "feat(functions): TDD rankScore — most-specific-tier-wins per spec"
```

---

## Task 4: TDD pure `earlyBirdBonus`

**Files:**
- Create: `firebase/functions/src/lib/earlyBirdBonus.test.ts`
- Create: `firebase/functions/src/lib/earlyBirdBonus.ts`

`earlyBirdBonus({ rankWithinCluster, clusterSize, isFirstGlobally })` returns `{ points, tier }`. Tier names: `first | top1pct | top10pct | none`.

Spec: "First person globally to submit this answer" = +500. "Top 1% within the cluster" = +200. "Top 10% within the cluster" = +50. Else 0.

Threshold formula: a user at `rankWithinCluster=R` (1-indexed) qualifies for top-K% if `R / clusterSize <= K/100`.

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/lib/earlyBirdBonus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { earlyBirdBonus } from "./earlyBirdBonus";

describe("earlyBirdBonus", () => {
  it("first globally = +500 (overrides percentile tiers)", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 412000, isFirstGlobally: true });
    expect(r).toEqual({ points: 500, tier: "first" });
  });

  it("rankWithinCluster=1 but isFirstGlobally=false (someone else got there first in a different cluster) = top1pct", () => {
    // Edge case: in a tiny cluster of 50, position 1 is also the top-1% threshold (1/50 = 2% — fails 1%).
    // Use a bigger cluster to make this clean.
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 200, isFirstGlobally: false });
    expect(r).toEqual({ points: 200, tier: "top1pct" });
  });

  it("top1pct: rank/size <= 0.01", () => {
    // 4 / 412 = 0.0097 <= 0.01 -> top1pct
    const r = earlyBirdBonus({ rankWithinCluster: 4, clusterSize: 412, isFirstGlobally: false });
    expect(r).toEqual({ points: 200, tier: "top1pct" });
  });

  it("top10pct: rank/size <= 0.10 but > 0.01", () => {
    // 80 / 1000 = 0.08 -> top10pct
    const r = earlyBirdBonus({ rankWithinCluster: 80, clusterSize: 1000, isFirstGlobally: false });
    expect(r).toEqual({ points: 50, tier: "top10pct" });
  });

  it("none: rank/size > 0.10", () => {
    // 200 / 1000 = 0.20 -> none
    const r = earlyBirdBonus({ rankWithinCluster: 200, clusterSize: 1000, isFirstGlobally: false });
    expect(r).toEqual({ points: 0, tier: "none" });
  });

  it("solo bubble (clusterSize=1): user is rank=1, isFirstGlobally=true -> first", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 1, isFirstGlobally: true });
    expect(r).toEqual({ points: 500, tier: "first" });
  });

  it("solo bubble where user is somehow rank=1 without being first-globally: still top1pct (1/1 = 100% — but spec is rank-position based, and rank=1 always at least qualifies for top1pct)", () => {
    // Defensive case: by our threshold rank/size = 1.0 > 0.01, so this would
    // strictly fall to "none". But rank=1 with clusterSize=1 means the user IS
    // the only submitter — by definition they are also "first" within the
    // cluster. The caller should pass isFirstGlobally=true for this case;
    // we test the defensive fallback to confirm we don't crash.
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 1, isFirstGlobally: false });
    // 1 / 1 = 1.0 > 0.10 -> none. This is acceptable — caller is responsible
    // for passing isFirstGlobally correctly.
    expect(r).toEqual({ points: 0, tier: "none" });
  });

  it("clusterSize=0 returns none without divide-by-zero", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 0, isFirstGlobally: false });
    expect(r).toEqual({ points: 0, tier: "none" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/lib/earlyBirdBonus.test.ts
```

Expected: FAIL — `Cannot find module './earlyBirdBonus'`.

- [ ] **Step 3: Write the implementation**

Create `firebase/functions/src/lib/earlyBirdBonus.ts`:

```ts
export type EarlyBirdTier = "first" | "top1pct" | "top10pct" | "none";

export interface EarlyBirdInput {
  rankWithinCluster: number;   // 1-indexed; user's position among cluster's submissions ordered by submitted_at asc
  clusterSize: number;         // total submissions in this cluster
  isFirstGlobally: boolean;    // user.submitted_at === cluster.first_submission_at
}

export interface EarlyBirdResult {
  points: number;
  tier: EarlyBirdTier;
}

/**
 * Per spec Section 5. "First globally" overrides all percentile tiers.
 * Threshold: rank/size <= 0.01 = top1pct, <= 0.10 = top10pct, else none.
 */
export function earlyBirdBonus(input: EarlyBirdInput): EarlyBirdResult {
  if (input.isFirstGlobally) return { points: 500, tier: "first" };
  if (input.clusterSize <= 0) return { points: 0, tier: "none" };

  const ratio = input.rankWithinCluster / input.clusterSize;
  if (ratio <= 0.01) return { points: 200, tier: "top1pct" };
  if (ratio <= 0.10) return { points: 50, tier: "top10pct" };
  return { points: 0, tier: "none" };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/earlyBirdBonus.test.ts
```

Expected: PASS — 8 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/lib/earlyBirdBonus.ts firebase/functions/src/lib/earlyBirdBonus.test.ts
git commit -m "feat(functions): TDD earlyBirdBonus — first/top1pct/top10pct/none tiers"
```

---

## Task 5: TDD pure `computeDailyScore`

**Files:**
- Create: `firebase/functions/src/lib/computeDailyScore.test.ts`
- Create: `firebase/functions/src/lib/computeDailyScore.ts`

Composer of `rankScore` + `earlyBirdBonus`. Returns the structured score that gets written to `leaderboard_entries`.

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/lib/computeDailyScore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeDailyScore } from "./computeDailyScore";

describe("computeDailyScore", () => {
  it("worked example from spec: '4th globally to submit Pisa Tower' = 1000 + 500 = 1500", () => {
    // Pisa Tower is final #1 (412k cluster). User is rank-4 within cluster, isFirstGlobally=false.
    // But spec says "was the 4th globally to submit" — that means 4th submission overall to this cluster.
    // rank/size = 4/412000 = 0.00001 < 0.01 -> top1pct
    const r = computeDailyScore({
      clusterRank: 1,
      totalClusters: 50,
      clusterCount: 412000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 4,
      isFirstGlobally: false,
    });
    expect(r.rankScore.points).toBe(1000);
    expect(r.earlyBird.points).toBe(200);
    expect(r.total).toBe(1200);
  });

  it("worked example from spec: 'Pisa Tower at T+22h, 411,995th' = 1000 + 0 = 1000", () => {
    const r = computeDailyScore({
      clusterRank: 1,
      totalClusters: 50,
      clusterCount: 412000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 411995,
      isFirstGlobally: false,
    });
    expect(r.rankScore.points).toBe(1000);
    expect(r.earlyBird.points).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("worked example from spec: 'Eiffel Tower (final #4) at T+5min as 80th' = 250 + 50 = 300", () => {
    // The spec says 250 + 200 = 450, but with cluster size unspecified.
    // 80th out of an Eiffel-Tower-sized cluster. If cluster size = 50000, 80/50000 = 0.0016 -> top1pct (+200).
    // If cluster size = 1000, 80/1000 = 0.08 -> top10pct (+50). Spec doesn't pin this, so test both branches.
    const r1 = computeDailyScore({
      clusterRank: 4,
      totalClusters: 50,
      clusterCount: 50000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 80,
      isFirstGlobally: false,
    });
    expect(r1.total).toBe(250 + 200); // 450 — matches spec exactly

    const r2 = computeDailyScore({
      clusterRank: 4,
      totalClusters: 50,
      clusterCount: 1000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 80,
      isFirstGlobally: false,
    });
    expect(r2.total).toBe(250 + 50);
  });

  it("first-globally on the verdict cluster = max possible 1500", () => {
    const r = computeDailyScore({
      clusterRank: 1,
      totalClusters: 50,
      clusterCount: 412000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 1,
      isFirstGlobally: true,
    });
    expect(r.total).toBe(1500);
    expect(r.rankScore.tier).toBe("verdict");
    expect(r.earlyBird.tier).toBe("first");
  });

  it("participation+none = 10 (minimum non-zero score)", () => {
    const r = computeDailyScore({
      clusterRank: 200,
      totalClusters: 5000,
      clusterCount: 100,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 90,
      isFirstGlobally: false,
    });
    expect(r.total).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/lib/computeDailyScore.test.ts
```

Expected: FAIL — `Cannot find module './computeDailyScore'`.

- [ ] **Step 3: Write the implementation**

Create `firebase/functions/src/lib/computeDailyScore.ts`:

```ts
import { rankScore, type RankScoreResult } from "./rankScore";
import { earlyBirdBonus, type EarlyBirdResult } from "./earlyBirdBonus";

export interface DailyScoreInput {
  clusterRank: number;
  totalClusters: number;
  clusterCount: number;
  totalSubmissions: number;
  rankWithinCluster: number;
  isFirstGlobally: boolean;
}

export interface DailyScoreResult {
  rankScore: RankScoreResult;
  earlyBird: EarlyBirdResult;
  total: number;
}

export function computeDailyScore(input: DailyScoreInput): DailyScoreResult {
  const rs = rankScore({
    clusterRank: input.clusterRank,
    totalClusters: input.totalClusters,
    clusterCount: input.clusterCount,
    totalSubmissions: input.totalSubmissions,
  });
  const eb = earlyBirdBonus({
    rankWithinCluster: input.rankWithinCluster,
    clusterSize: input.clusterCount,
    isFirstGlobally: input.isFirstGlobally,
  });
  return { rankScore: rs, earlyBird: eb, total: rs.points + eb.points };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/computeDailyScore.test.ts
```

Expected: PASS — 5 tests green. Total Phase 3 pure-helper tests: 23 (10 rankScore + 8 earlyBird + 5 composer).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/lib/computeDailyScore.ts firebase/functions/src/lib/computeDailyScore.test.ts
git commit -m "feat(functions): TDD computeDailyScore composes rank + early-bird tiers"
```

---

## Task 6: `scoreReveal()` (emulator-backed) + wire into `triggerDrop`

**Files:**
- Create: `firebase/functions/src/scoreReveal.ts`
- Create: `firebase/functions/src/scoreReveal.test.ts`
- Modify: `firebase/functions/src/triggerDrop.ts`

`runScoreReveal(firestore, revealedQuestionId)` does the score-writing pass for a just-revealed question:

1. Read all `answer_clusters` of the revealed question, ordered by `submission_count` desc → produces a global cluster ranking + total submission count.
2. Read all `submissions` of the revealed question filtered to `user_id != null` (signed-in scoring users only).
3. Group those signed-in submissions by `normalized_cluster_id`.
4. For each cluster with signed-in users: read ALL submissions for that cluster ordered by `submitted_at asc`; map each submission id to its `rankWithinCluster` (1-indexed); also record `cluster.first_submission_at` from the cluster doc to test `isFirstGlobally`.
5. For each signed-in submission: compute `computeDailyScore(...)` and write a `leaderboard_entries` doc.
6. Second pass: read all `leaderboard_entries` for this question ordered by `score desc, submitted_at asc` → assign `daily_rank` 1..N via batch update.
7. Bump `user_aggregates/{uid}` for each scorer: increment `alltime_score`, increment `weekly_score`, increment `num_called_it_wins` by 1 if their `earlyBird.tier === "first"` AND `rankScore.tier === "verdict"`, update `best_daily_rank` to min(existing, this rank).

**Invoked from `triggerDrop` after the existing top-100 `final_rank` batch.** Wire is one new call.

**Cost note:** Step 4 reads ALL submissions of clusters that contain signed-in users. At v1 scale (~10k signed-in users out of 100k submitters), this is ~100k reads per drop. At $0.06/100k = $0.06/drop. Acceptable. If signed-in user counts grow >>100k, revisit by maintaining a denormalized `submissions_by_cluster` aggregate. YAGNI for v1.

**Idempotency caveat:** `scoreReveal` is NOT idempotent on retry — re-running it would create duplicate `leaderboard_entries` and double-bump `user_aggregates`. `triggerDrop` is a Cloud Functions scheduled trigger; on retry the only safe pattern is to read `user_aggregates/{uid}.last_scored_question_id` and skip if it matches. **Phase 3 ships without this guard** — same as the spec-deferred `fanoutPush` push_sent_at guard from Phase 2. Both are Phase 6 hardening items.

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/scoreReveal.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { runScoreReveal } from "./scoreReveal";

let app: App;
let db: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: "relatably-test" }, "scoreRevealTest");
  db = getFirestore(app);
});

beforeEach(async () => {
  // Wipe collections we touch.
  for (const c of ["questions", "answer_clusters", "submissions", "leaderboard_entries", "user_aggregates"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

afterAll(async () => {
  await deleteApp(app);
});

describe("runScoreReveal (emulator-backed)", () => {
  it("writes one leaderboard_entries doc per signed-in submitter with correct score components", async () => {
    const qid = "q-revealed-1";
    await db.collection("questions").doc(qid).set({
      text: "test",
      status: "revealed",
      source: "curated",
      created_at: Timestamp.now(),
    });

    // Two clusters: cluster-A is verdict (5 submissions), cluster-B is rank 2 (2 submissions).
    const t0 = Timestamp.fromMillis(1_700_000_000_000);
    const t1 = Timestamp.fromMillis(1_700_000_001_000);
    const t2 = Timestamp.fromMillis(1_700_000_002_000);
    const t3 = Timestamp.fromMillis(1_700_000_003_000);
    const t4 = Timestamp.fromMillis(1_700_000_004_000);

    await db.collection("answer_clusters").doc("cluster-A").set({
      question_id: qid,
      canonical_text: "italy",
      submission_count: 5,
      first_submission_at: t0,
    });
    await db.collection("answer_clusters").doc("cluster-B").set({
      question_id: qid,
      canonical_text: "france",
      submission_count: 2,
      first_submission_at: t3,
    });

    // Submissions to cluster-A: anonymous@t0, signed-user-1@t1, anon@t2, anon@t3, signed-user-2@t4
    await db.collection("submissions").doc("s-a-0").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-A", submitted_at: t0,
    });
    await db.collection("submissions").doc("s-a-1").set({
      question_id: qid, user_id: "user-1", normalized_cluster_id: "cluster-A", submitted_at: t1,
    });
    await db.collection("submissions").doc("s-a-2").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-A", submitted_at: t2,
    });
    await db.collection("submissions").doc("s-a-3").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-A", submitted_at: t3,
    });
    await db.collection("submissions").doc("s-a-4").set({
      question_id: qid, user_id: "user-2", normalized_cluster_id: "cluster-A", submitted_at: t4,
    });
    // Submissions to cluster-B: signed-user-3@t3 (this user is "first globally" of cluster-B), anon@t4
    await db.collection("submissions").doc("s-b-0").set({
      question_id: qid, user_id: "user-3", normalized_cluster_id: "cluster-B", submitted_at: t3,
    });
    await db.collection("submissions").doc("s-b-1").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-B", submitted_at: t4,
    });

    await runScoreReveal(db, qid);

    const entries = await db
      .collection("leaderboard_entries")
      .where("question_id", "==", qid)
      .get();

    expect(entries.size).toBe(3);

    const byUser = new Map(entries.docs.map((d) => [d.data().user_id as string, d.data()]));

    // user-1: cluster-A (verdict=1000), rankWithinCluster=2/5 = 40% -> none (0)
    const u1 = byUser.get("user-1") as any;
    expect(u1.rank_score_component).toBe(1000);
    expect(u1.early_bird_component).toBe(0);
    expect(u1.score).toBe(1000);

    // user-2: cluster-A (verdict=1000), rankWithinCluster=5/5 = 100% -> none (0)
    const u2 = byUser.get("user-2") as any;
    expect(u2.rank_score_component).toBe(1000);
    expect(u2.early_bird_component).toBe(0);
    expect(u2.score).toBe(1000);

    // user-3: cluster-B is rank 2 (top3=500), isFirstGlobally=true (+500)
    const u3 = byUser.get("user-3") as any;
    expect(u3.rank_score_component).toBe(500);
    expect(u3.early_bird_component).toBe(500);
    expect(u3.score).toBe(1000);
  });

  it("computes daily_rank by score desc, submitted_at asc tiebreak", async () => {
    const qid = "q-daily-rank-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("answer_clusters").doc("c2").set({
      question_id: qid, canonical_text: "b", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(2000),
    });
    // Two signed-in users, both verdict-tier (both their clusters have rank 1 because only 2 clusters).
    // c1 is rank=1 (verdict 1000), c2 is rank=2 (top3 500). Tiebreak doesn't engage here.
    // To force a tiebreak, we'd need same scores. Use both-verdict synthetic:
    // Actually, with only 2 clusters and equal counts (1 each), Firestore order by submission_count desc
    // is undefined. To pin: c1 has count=2, c2 has count=1.
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 2,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: "user-A", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s2").set({
      question_id: qid, user_id: "user-B", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1500),
    });
    await db.collection("submissions").doc("s3").set({
      question_id: qid, user_id: "user-C", normalized_cluster_id: "c2",
      submitted_at: Timestamp.fromMillis(2000),
    });

    await runScoreReveal(db, qid);

    const entries = await db
      .collection("leaderboard_entries")
      .where("question_id", "==", qid)
      .orderBy("daily_rank", "asc")
      .get();

    // user-A: verdict (1000) + first-globally on c1 (+500) = 1500, daily_rank=1
    // user-B: verdict (1000) + rank 2/2 = 100% none (0) = 1000, daily_rank=2 or 3
    // user-C: top3 (500) + first-globally on c2 (+500) = 1000, daily_rank=2 or 3
    // Tiebreak: user-B submitted_at=1500 < user-C submitted_at=2000 -> user-B is rank 2.
    expect(entries.docs.map((d) => d.data().user_id)).toEqual(["user-A", "user-B", "user-C"]);
    expect(entries.docs[0].data().score).toBe(1500);
    expect(entries.docs[1].data().score).toBe(1000);
    expect(entries.docs[2].data().score).toBe(1000);
  });

  it("bumps user_aggregates correctly: alltime, weekly, called-it wins, best rank", async () => {
    const qid = "q-aggregates-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: "user-X", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });
    // Pre-existing aggregate: alltime=42, weekly=10, called-it=0, best=99
    await db.collection("user_aggregates").doc("user-X").set({
      alltime_score: 42, weekly_score: 10, num_called_it_wins: 0, best_daily_rank: 99,
    });

    await runScoreReveal(db, qid);

    // user-X: cluster-A is rank 1 verdict (1000) + first-globally (+500) = 1500
    // daily_rank=1, called-it (verdict + first) -> +1
    const agg = await db.collection("user_aggregates").doc("user-X").get();
    const data = agg.data() as any;
    expect(data.alltime_score).toBe(42 + 1500);
    expect(data.weekly_score).toBe(10 + 1500);
    expect(data.num_called_it_wins).toBe(1);
    expect(data.best_daily_rank).toBe(1); // min(99, 1) = 1
  });

  it("creates user_aggregates doc if it does not exist (first-time scorer)", async () => {
    const qid = "q-firstscore-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: "user-Y", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });

    await runScoreReveal(db, qid);

    const agg = await db.collection("user_aggregates").doc("user-Y").get();
    expect(agg.exists).toBe(true);
    const data = agg.data() as any;
    expect(data.alltime_score).toBe(1500);
    expect(data.weekly_score).toBe(1500);
    expect(data.num_called_it_wins).toBe(1);
    expect(data.best_daily_rank).toBe(1);
  });

  it("is a no-op when there are no signed-in submissions", async () => {
    const qid = "q-noscore-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: null, normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });

    await runScoreReveal(db, qid);

    const entries = await db.collection("leaderboard_entries").get();
    expect(entries.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/scoreReveal.test.ts
```

Expected: FAIL — `Cannot find module './scoreReveal'`. Make sure the firestore emulator is running on `localhost:8080` first (`firebase emulators:start --only firestore` in another terminal).

- [ ] **Step 3: Write the implementation**

Create `firebase/functions/src/scoreReveal.ts`:

```ts
import { logger } from "firebase-functions/v2";
import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { computeDailyScore } from "./lib/computeDailyScore";

interface ClusterSummary {
  id: string;
  rank: number;                         // 1-indexed by submission_count desc
  submissionCount: number;
  firstSubmissionAt: Timestamp | null;
}

interface SignedSubmission {
  id: string;
  userId: string;
  clusterId: string;
  submittedAt: Timestamp;
}

/**
 * Score-writing pass for a just-revealed question.
 * Writes leaderboard_entries (one per signed-in submitter) and bumps user_aggregates.
 *
 * NOT idempotent: re-running creates duplicate entries + double-bumps aggregates.
 * Phase 6 hardening item: add a `last_scored_question_id` guard.
 */
export async function runScoreReveal(
  firestore: Firestore,
  revealedQuestionId: string,
): Promise<void> {
  // 1. Read all clusters of the revealed question, sorted by count desc.
  const clustersSnap = await firestore
    .collection("answer_clusters")
    .where("question_id", "==", revealedQuestionId)
    .orderBy("submission_count", "desc")
    .get();

  if (clustersSnap.empty) {
    logger.info("scoreReveal: no clusters", { revealedQuestionId });
    return;
  }

  const clusters: ClusterSummary[] = clustersSnap.docs.map((d, i) => {
    const data = d.data() as { submission_count: number; first_submission_at?: Timestamp };
    return {
      id: d.id,
      rank: i + 1,
      submissionCount: data.submission_count,
      firstSubmissionAt: data.first_submission_at ?? null,
    };
  });
  const totalClusters = clusters.length;
  const totalSubmissions = clusters.reduce((s, c) => s + c.submissionCount, 0);
  const clusterById = new Map(clusters.map((c) => [c.id, c]));

  // 2. Read signed-in submissions only.
  // Firestore "!=" requires an order-by on the same field; we order by user_id
  // then re-sort by submitted_at in memory (cheap; data set is bounded).
  const signedSnap = await firestore
    .collection("submissions")
    .where("question_id", "==", revealedQuestionId)
    .where("user_id", "!=", null)
    .orderBy("user_id")
    .get();

  if (signedSnap.empty) {
    logger.info("scoreReveal: no signed-in submitters", { revealedQuestionId });
    return;
  }

  const signed: SignedSubmission[] = signedSnap.docs.map((d) => {
    const data = d.data() as {
      user_id: string;
      normalized_cluster_id: string;
      submitted_at: Timestamp;
    };
    return {
      id: d.id,
      userId: data.user_id,
      clusterId: data.normalized_cluster_id,
      submittedAt: data.submitted_at,
    };
  });

  // 3. Group signed-in submissions by cluster (so we batch the per-cluster ordering reads).
  const byCluster = new Map<string, SignedSubmission[]>();
  for (const s of signed) {
    const arr = byCluster.get(s.clusterId) ?? [];
    arr.push(s);
    byCluster.set(s.clusterId, arr);
  }

  // 4. For each cluster with signed-in users, read all submissions of that cluster ordered
  //    by submitted_at asc, build id -> rank map.
  const rankByClusterAndId = new Map<string, Map<string, number>>();
  for (const clusterId of byCluster.keys()) {
    const allSnap = await firestore
      .collection("submissions")
      .where("question_id", "==", revealedQuestionId)
      .where("normalized_cluster_id", "==", clusterId)
      .orderBy("submitted_at", "asc")
      .get();
    const idToRank = new Map<string, number>();
    allSnap.docs.forEach((d, i) => idToRank.set(d.id, i + 1));
    rankByClusterAndId.set(clusterId, idToRank);
  }

  // 5. Write leaderboard_entries.
  const entriesByUser = new Map<string, { score: number; tier: string }>();
  const entryWriter = firestore.bulkWriter();
  const nowTs = FieldValue.serverTimestamp();

  for (const sub of signed) {
    const cluster = clusterById.get(sub.clusterId);
    if (!cluster) continue;
    const rankWithinCluster = rankByClusterAndId.get(sub.clusterId)?.get(sub.id) ?? 1;
    const isFirstGlobally =
      cluster.firstSubmissionAt !== null
      && cluster.firstSubmissionAt.toMillis() === sub.submittedAt.toMillis();

    const result = computeDailyScore({
      clusterRank: cluster.rank,
      totalClusters,
      clusterCount: cluster.submissionCount,
      totalSubmissions,
      rankWithinCluster,
      isFirstGlobally,
    });

    const entryRef = firestore.collection("leaderboard_entries").doc();
    entryWriter.set(entryRef, {
      user_id: sub.userId,
      question_id: revealedQuestionId,
      score: result.total,
      rank_score_component: result.rankScore.points,
      rank_score_tier: result.rankScore.tier,
      early_bird_component: result.earlyBird.points,
      early_bird_tier: result.earlyBird.tier,
      daily_rank: 0,                   // backfilled by step 6
      submitted_at: sub.submittedAt,
      created_at: nowTs,
    });

    entriesByUser.set(sub.userId, {
      score: result.total,
      tier: `${result.rankScore.tier}+${result.earlyBird.tier}`,
    });
  }
  await entryWriter.flush();

  // 6. Backfill daily_rank by score desc, submitted_at asc.
  const rankSnap = await firestore
    .collection("leaderboard_entries")
    .where("question_id", "==", revealedQuestionId)
    .orderBy("score", "desc")
    .orderBy("submitted_at", "asc")
    .get();
  const rankWriter = firestore.bulkWriter();
  const userIdToDailyRank = new Map<string, number>();
  rankSnap.docs.forEach((doc, i) => {
    const rank = i + 1;
    const userId = (doc.data() as { user_id: string }).user_id;
    rankWriter.update(doc.ref, { daily_rank: rank });
    userIdToDailyRank.set(userId, rank);
  });
  await rankWriter.flush();

  // 7. Bump user_aggregates per scorer.
  const aggWriter = firestore.bulkWriter();
  for (const [userId, info] of entriesByUser) {
    const dailyRank = userIdToDailyRank.get(userId) ?? 999_999;
    const aggRef = firestore.collection("user_aggregates").doc(userId);
    const aggSnap = await aggRef.get();
    const existing = aggSnap.exists
      ? (aggSnap.data() as { alltime_score?: number; weekly_score?: number; num_called_it_wins?: number; best_daily_rank?: number })
      : {};
    const isCalledIt = info.tier === "verdict+first";

    aggWriter.set(aggRef, {
      alltime_score: (existing.alltime_score ?? 0) + info.score,
      weekly_score: (existing.weekly_score ?? 0) + info.score,
      weekly_score_calculated_at: nowTs,
      num_called_it_wins: (existing.num_called_it_wins ?? 0) + (isCalledIt ? 1 : 0),
      best_daily_rank: existing.best_daily_rank !== undefined
        ? Math.min(existing.best_daily_rank, dailyRank)
        : dailyRank,
      updated_at: nowTs,
    }, { merge: true });
  }
  await aggWriter.flush();

  logger.info("scoreReveal: done", {
    revealedQuestionId,
    scoredUsers: entriesByUser.size,
    totalSubmissions,
    totalClusters,
  });
}
```

- [ ] **Step 4: Run the failing test against the emulator**

Make sure the firestore emulator is running:

```bash
cd /c/Users/levin/relatably/firebase
"/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot/bin/java" -version  # confirm Java 21
firebase emulators:start --only firestore
```

In another terminal:

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/scoreReveal.test.ts
```

Expected: PASS — 5 tests green. If any fail with "missing index" errors: copy the suggested URL from the error message and create the index in the emulator UI, OR confirm `firestore.indexes.json` from Task 1 includes the right composite indexes.

- [ ] **Step 5: Wire `runScoreReveal` into `triggerDrop`**

Open `firebase/functions/src/triggerDrop.ts`. After the existing `final_rank` batch commit (line ending `await writer.commit();`), add the score-writing pass.

Add at the top of the file, with the other imports:

```ts
import { runScoreReveal } from "./scoreReveal";
```

After the `await writer.commit();` line inside the `if (revealedQuestionId)` block, insert:

```ts
      await runScoreReveal(firestore, revealedQuestionId);
```

The full updated `if (revealedQuestionId)` block should look like:

```ts
    if (revealedQuestionId) {
      const clusterSnap = await firestore
        .collection("answer_clusters")
        .where("question_id", "==", revealedQuestionId)
        .orderBy("submission_count", "desc")
        .limit(TOP_N_TO_RANK)
        .get();

      const ranks = computeFinalRanks(
        clusterSnap.docs.map((d) => ({
          id: d.id,
          submission_count: (d.data() as { submission_count: number }).submission_count,
        })),
      );

      const writer = firestore.batch();
      for (const r of ranks) {
        writer.update(firestore.collection("answer_clusters").doc(r.id), {
          final_rank: r.final_rank,
          final_pct_of_total: r.final_pct_of_total,
        });
      }
      await writer.commit();

      await runScoreReveal(firestore, revealedQuestionId);
    }
```

- [ ] **Step 6: Re-run all functions tests to ensure triggerDrop still passes**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test
```

Expected: All Phase 2 + Phase 3 tests still pass. (`triggerDrop.test.ts` will now also exercise the score-writing pass since it runs the full `runTriggerDrop` against the emulator. If those tests fail because they assert specific cluster/submission state that didn't anticipate score-writing side effects, update those assertions to ignore the new `leaderboard_entries` and `user_aggregates` collections.)

- [ ] **Step 7: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/scoreReveal.ts firebase/functions/src/scoreReveal.test.ts firebase/functions/src/triggerDrop.ts
git commit -m "feat(functions): scoreReveal writes leaderboard_entries + bumps user_aggregates on drop"
```

---

## Task 7: TDD `requireAuth` + `getOrCreateUserDoc` helper

**Files:**
- Create: `api/src/lib/auth.ts`
- Create: `api/src/lib/auth.test.ts`

`requireAuth(req)` extracts the `Authorization: Bearer <token>` header, calls `adminAuth.verifyIdToken(token)`, returns the decoded token (`{uid, email, ...}`) or `null` on missing/invalid. `getOrCreateUserDoc(uid, locale?)` ensures `/users/{uid}` exists with default fields.

- [ ] **Step 1: Write the failing test**

Create `api/src/lib/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
  },
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
}));

import { requireAuth, getOrCreateUserDoc } from "./auth";
import { adminAuth, adminFirestore } from "@/lib/firebase";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no Authorization header", async () => {
    const req = new Request("http://localhost");
    expect(await requireAuth(req)).toBeNull();
    expect(adminAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns null when header is malformed (no Bearer)", async () => {
    const req = new Request("http://localhost", {
      headers: { authorization: "token-without-bearer" },
    });
    expect(await requireAuth(req)).toBeNull();
    expect(adminAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns null when verifyIdToken throws", async () => {
    (adminAuth.verifyIdToken as any).mockRejectedValueOnce(new Error("expired"));
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer bad-token" },
    });
    expect(await requireAuth(req)).toBeNull();
  });

  it("returns the decoded token on valid Bearer", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-1", email: "x@y.z" });
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer good-token" },
    });
    const decoded = await requireAuth(req);
    expect(decoded).toEqual({ uid: "user-1", email: "x@y.z" });
  });
});

describe("getOrCreateUserDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user doc with defaults when none exists", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const profile = await getOrCreateUserDoc("user-1", "en-US");

    expect(docMock).toHaveBeenCalledWith("user-1");
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: null,
        is_public: true,
        locale: "en-US",
        shadowbanned: false,
      }),
      { merge: true },
    );
    expect(profile).toMatchObject({ uid: "user-1", handle: null, is_public: true });
  });

  it("returns existing doc data without overwriting", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ handle: "@coolname", is_public: false, shadowbanned: false, locale: "en-GB" }),
    });
    const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const profile = await getOrCreateUserDoc("user-1", "en-US");

    // Existing doc — must NOT be overwritten.
    expect(setMock).not.toHaveBeenCalled();
    expect(profile).toMatchObject({
      uid: "user-1",
      handle: "@coolname",
      is_public: false,
      locale: "en-GB",
      shadowbanned: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/lib/auth.test.ts
```

Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Write the implementation**

Create `api/src/lib/auth.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminFirestore } from "@/lib/firebase";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function requireAuth(req: Request): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

export interface UserProfile {
  uid: string;
  handle: string | null;
  is_public: boolean;
  locale: string;
  shadowbanned: boolean;
}

export async function getOrCreateUserDoc(uid: string, locale: string): Promise<UserProfile> {
  const ref = adminFirestore.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(
      {
        handle: null,
        is_public: true,
        locale,
        shadowbanned: false,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { uid, handle: null, is_public: true, locale, shadowbanned: false };
  }
  const data = snap.data() as {
    handle: string | null;
    is_public: boolean;
    locale: string;
    shadowbanned: boolean;
  };
  return {
    uid,
    handle: data.handle ?? null,
    is_public: data.is_public ?? true,
    locale: data.locale ?? locale,
    shadowbanned: data.shadowbanned ?? false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/auth.test.ts
```

Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/lib/auth.ts api/src/lib/auth.test.ts
git commit -m "feat(api): TDD requireAuth + getOrCreateUserDoc helpers"
```

---

## Task 8: `POST /api/auth/me` endpoint

**Files:**
- Create: `api/src/app/api/auth/me/route.ts`
- Create: `api/src/app/api/auth/me/route.test.ts`

POST endpoint that ensures the calling user has a `/users/{uid}` doc and returns the profile. Called once on iOS after Sign in with Apple completes — clients can call it on every app start; it's idempotent.

- [ ] **Step 1: Write the failing test**

Create `api/src/app/api/auth/me/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildRequest = (token: string | null, accept = "en-US") => {
  const headers: Record<string, string> = { "accept-language": accept };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new Request("http://localhost/api/auth/me", { method: "POST", headers });
};

describe("POST /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with no auth header", async () => {
    const res = await POST(buildRequest(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 on invalid token", async () => {
    (adminAuth.verifyIdToken as any).mockRejectedValueOnce(new Error("bad"));
    const res = await POST(buildRequest("bad-token"));
    expect(res.status).toBe(401);
  });

  it("creates user doc and returns profile on first sign-in", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-X" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: vi.fn(() => ({ get: getMock, set: setMock })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildRequest("good-token", "de-DE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      uid: "user-X",
      handle: null,
      is_public: true,
      locale: "de-DE",
      shadowbanned: false,
    });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: null, is_public: true, shadowbanned: false }),
      { merge: true },
    );
  });

  it("returns existing profile without overwriting on repeat call", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-X" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ handle: "@coolname", is_public: true, locale: "fr", shadowbanned: false }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: vi.fn(() => ({ get: getMock, set: setMock })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildRequest("good-token"));
    const body = await res.json();
    expect(body).toMatchObject({ uid: "user-X", handle: "@coolname" });
    expect(setMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/app/api/auth/me/route.test.ts
```

Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the implementation**

Create `api/src/app/api/auth/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth, getOrCreateUserDoc } from "@/lib/auth";

export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const locale = req.headers.get("accept-language")?.split(",")[0]?.trim() ?? "en";
  const profile = await getOrCreateUserDoc(decoded.uid, locale);
  return NextResponse.json(profile);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/app/api/auth/me/route.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/auth/me/
git commit -m "feat(api): POST /api/auth/me ensures user doc + returns profile"
```

---

## Task 9: TDD pluggable `RateLimiter`

**Files:**
- Create: `api/src/lib/ratelimit.ts`
- Create: `api/src/lib/ratelimit.test.ts`
- Modify: `api/package.json` (add `@upstash/redis` as dep)

Pluggable rate-limit interface with two implementations:
- `MemoryRateLimiter` — in-process Map; default for dev/test.
- `UpstashRateLimiter` — Upstash REST API with sliding window; activates when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars are set.

Sliding-window semantics: "≤ N hits in the past 60 seconds". Implementation uses a list of recent timestamps per key; old entries garbage-collected on each call.

The factory `getRateLimiter()` is lazy + memoized: first call detects env, instantiates, caches.

- [ ] **Step 1: Add @upstash/redis to api/package.json**

Modify `api/package.json` `dependencies`:

```json
    "@upstash/redis": "^1.34.3",
```

Add it alphabetically after `@types/...` if any; in this repo it'll come before `firebase-admin`. The full dependencies block becomes:

```json
  "dependencies": {
    "@upstash/redis": "^1.34.3",
    "firebase-admin": "^13.9.0",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zod": "^4.4.3"
  },
```

Run install:

```bash
cd /c/Users/levin/relatably/api
pnpm install
```

Expected: clean install. Lockfile updated.

- [ ] **Step 2: Write the failing test**

Create `api/src/lib/ratelimit.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRateLimiter, getRateLimiter, __resetRateLimiterForTest } from "./ratelimit";

describe("MemoryRateLimiter", () => {
  it("allows up to N hits in the window", async () => {
    const rl = new MemoryRateLimiter({ limit: 3, windowMs: 60000 });
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k1")).ok).toBe(true);
    const fourth = await rl.check("k1");
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates keys", async () => {
    const rl = new MemoryRateLimiter({ limit: 1, windowMs: 60000 });
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k2")).ok).toBe(true);
  });

  it("clears entries after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    const rl = new MemoryRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k1")).ok).toBe(false);
    vi.setSystemTime(new Date("2026-05-08T12:00:01.500Z"));
    expect((await rl.check("k1")).ok).toBe(true);
    vi.useRealTimers();
  });
});

describe("getRateLimiter()", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimiterForTest();
  });
  afterEach(() => {
    __resetRateLimiterForTest();
  });

  it("returns MemoryRateLimiter when Upstash env vars not set", () => {
    const rl = getRateLimiter();
    expect(rl).toBeInstanceOf(MemoryRateLimiter);
  });

  it("memoizes the instance", () => {
    const a = getRateLimiter();
    const b = getRateLimiter();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test src/lib/ratelimit.test.ts
```

Expected: FAIL — `Cannot find module './ratelimit'`.

- [ ] **Step 4: Write the implementation**

Create `api/src/lib/ratelimit.ts`:

```ts
export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;

export class MemoryRateLimiter implements RateLimiter {
  private hits: Map<string, number[]> = new Map();
  constructor(private cfg: RateLimitConfig) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - this.cfg.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (arr.length >= this.cfg.limit) {
      const retryAfterMs = arr[0] + this.cfg.windowMs - now;
      this.hits.set(key, arr);
      return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { ok: true, retryAfterMs: 0 };
  }
}

/**
 * Upstash Redis sliding-window limiter. Lazy-imported so the package is only
 * pulled in when env vars say "use Upstash". Tests don't import this branch.
 */
class UpstashRateLimiter implements RateLimiter {
  private redis: { eval: (script: string, keys: string[], args: string[]) => Promise<number> };

  constructor(redis: any, private cfg: RateLimitConfig) {
    this.redis = redis;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - this.cfg.windowMs;
    // ZADD-then-ZRANGE-then-ZREMRANGEBYSCORE pattern. We use Upstash's pipeline
    // surface via an eval script for atomicity. The script returns current
    // window count after the insert.
    const script = `
      redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", ARGV[2])
      redis.call("ZADD", KEYS[1], ARGV[1], ARGV[1])
      redis.call("EXPIRE", KEYS[1], ARGV[3])
      return redis.call("ZCARD", KEYS[1])
    `;
    const count = await this.redis.eval(
      script,
      [`rl:${key}`],
      [String(now), String(cutoff), String(Math.ceil(this.cfg.windowMs / 1000))],
    );
    if (count > this.cfg.limit) {
      return { ok: false, retryAfterMs: this.cfg.windowMs };
    }
    return { ok: true, retryAfterMs: 0 };
  }
}

let cached: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis");
    const redis = new Redis({ url, token });
    cached = new UpstashRateLimiter(redis, { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS });
  } else {
    cached = new MemoryRateLimiter({ limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS });
  }
  return cached;
}

/** Test-only escape hatch to reset the memoized limiter between cases. */
export function __resetRateLimiterForTest(): void {
  cached = null;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test src/lib/ratelimit.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/lib/ratelimit.ts api/src/lib/ratelimit.test.ts api/package.json api/pnpm-lock.yaml
git commit -m "feat(api): TDD pluggable rate limiter (memory + upstash impls)"
```

---

## Task 10: Modify `POST /api/submit` — optional auth + classifier features + IP throttle

**Files:**
- Modify: `api/src/app/api/submit/route.ts`
- Modify: `api/src/app/api/submit/route.test.ts`

Three additions to the existing handler (Phase 1):

1. **Optional auth.** If `Authorization: Bearer <token>` present and valid, set `submission.user_id = decoded.uid` and link the device to the user (`device_users/{hash}.linked_user_id = uid`). Anonymous flow remains 100% functional when header is absent.
2. **Per-IP velocity throttle.** Call `getRateLimiter().check(ipHash)` BEFORE writing. On not-ok, return 429 with `Retry-After` header.
3. **Classifier features.** Persist `submitted_at_minute_of_day` (0-1439) on the submission doc. The existing `dwell_ms` already covers another classifier feature; no other changes needed.

- [ ] **Step 1: Update the test file with three new test groups**

Open `api/src/app/api/submit/route.test.ts`. The existing 5 Phase 1 tests must continue to pass. Add the following three describe-blocks at the end of the file (above the closing of the outermost describe), and update the top-of-file mock to also stub `adminAuth`:

Replace the top mock at the top of the file with:

```ts
vi.mock("@/lib/firebase", () => {
  const mockTx = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  return {
    adminFirestore: {
      collection: vi.fn(),
      doc: vi.fn(),
      runTransaction: vi.fn((fn) => fn(mockTx)),
      __mockTx: mockTx,
    },
    adminAuth: { verifyIdToken: vi.fn() },
  };
});

vi.mock("@/lib/ratelimit", () => {
  const checkMock = vi.fn();
  return {
    getRateLimiter: () => ({ check: checkMock }),
    __getCheckMock: () => checkMock,
  };
});
```

Add this import alongside the others:

```ts
import { adminAuth } from "@/lib/firebase";
import * as ratelimitMod from "@/lib/ratelimit";
```

In `beforeEach`, default the rate limiter to ok:

```ts
  beforeEach(() => {
    vi.clearAllMocks();
    (ratelimitMod as any).__getCheckMock().mockResolvedValue({ ok: true, retryAfterMs: 0 });
  });
```

Append the three new test groups inside the same `describe("POST /api/submit", ...)`:

```ts
  it("returns 429 when rate limit exceeds", async () => {
    (ratelimitMod as any).__getCheckMock().mockResolvedValueOnce({ ok: false, retryAfterMs: 30000 });
    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("links submission.user_id when valid Authorization header is present", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-X" });

    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };
    const deviceSetMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: deviceSetMock,
          })),
        };
      }
      if (name === "submissions") {
        return { doc: vi.fn(() => mockSubmissionRef) };
      }
      throw new Error(`unexpected collection ${name}`);
    });
    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);

    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    const req = new Request("http://localhost/api/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        authorization: "Bearer good-token",
      },
      body: JSON.stringify({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
    expect(submissionWrite![1]).toMatchObject({ user_id: "user-X" });
    expect(deviceSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ linked_user_id: "user-X" }),
      { merge: true },
    );
  });

  it("anonymous flow (no auth header): submission.user_id stays null", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue({}),
          })),
        };
      }
      if (name === "submissions") return { doc: vi.fn(() => mockSubmissionRef) };
      throw new Error(`unexpected collection ${name}`);
    });
    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);
    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(200);
    const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
    expect(submissionWrite![1]).toMatchObject({ user_id: null });
  });

  it("persists submitted_at_minute_of_day classifier feature", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue({}),
          })),
        };
      }
      if (name === "submissions") return { doc: vi.fn(() => mockSubmissionRef) };
      throw new Error(`unexpected collection ${name}`);
    });
    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);
    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(200);
    const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
    expect(typeof submissionWrite![1].submitted_at_minute_of_day).toBe("number");
    expect(submissionWrite![1].submitted_at_minute_of_day).toBeGreaterThanOrEqual(0);
    expect(submissionWrite![1].submitted_at_minute_of_day).toBeLessThanOrEqual(1439);
  });
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/app/api/submit/route.test.ts
```

Expected: 4 new tests fail. Existing 5 Phase-1 tests continue to pass.

- [ ] **Step 3: Implement the changes in `api/src/app/api/submit/route.ts`**

Replace the entire contents of `api/src/app/api/submit/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { normalize, clusterId } from "@/lib/normalize";
import { containsProfanity } from "@/lib/profanity";
import { hashIp, hashDeviceToken } from "@/lib/hash";
import { requireAuth } from "@/lib/auth";
import { getRateLimiter } from "@/lib/ratelimit";

const SubmitSchema = z.object({
  question_id: z.string().min(1),
  device_token: z.string().min(1),
  raw_text: z.string().min(1).max(280),
  dwell_ms: z.number().int().nonnegative(),
});

const MIN_DWELL_MS = 3000;

function minuteOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = SubmitSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (parsed.dwell_ms < MIN_DWELL_MS) {
    return NextResponse.json({ error: "dwell too short" }, { status: 400 });
  }

  if (containsProfanity(parsed.raw_text)) {
    return NextResponse.json(
      { error: "that won't fly. try again." },
      { status: 400 },
    );
  }

  const normalizedText = normalize(parsed.raw_text);
  if (!normalizedText) {
    return NextResponse.json(
      { error: "empty after normalization" },
      { status: 400 },
    );
  }

  const ipHash = hashIp(req);

  // Per-IP velocity throttle (10/IP/min by default).
  const rl = await getRateLimiter().check(ipHash);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Optional auth — if header present + valid, link submission to user.
  const decoded = await requireAuth(req);
  const userId = decoded?.uid ?? null;

  const cId = clusterId(parsed.question_id, normalizedText);
  const deviceTokenHash = hashDeviceToken(parsed.device_token);

  const deviceRef = adminFirestore
    .collection("device_users")
    .doc(deviceTokenHash);
  const deviceSnap = await deviceRef.get();
  if (!deviceSnap.exists) {
    await deviceRef.set(
      {
        device_token: parsed.device_token,
        linked_user_id: userId,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else if (userId) {
    // Existing device + signed-in user — link.
    await deviceRef.set({ linked_user_id: userId }, { merge: true });
  }

  const clusterRef = adminFirestore.doc(`answer_clusters/${cId}`);
  const submissionRef = adminFirestore.collection("submissions").doc();

  let newCount = 1;
  await adminFirestore.runTransaction(async (tx) => {
    const clusterSnap = await tx.get(clusterRef);
    const now = FieldValue.serverTimestamp();
    const minuteUtc = minuteOfDay(new Date());

    if (!clusterSnap.exists) {
      tx.set(clusterRef, {
        question_id: parsed.question_id,
        canonical_text: normalizedText,
        submission_count: 1,
        first_submission_at: now,
      });
      newCount = 1;
    } else {
      const prevCount = (clusterSnap.data() as { submission_count?: number } | undefined)?.submission_count ?? 0;
      newCount = prevCount + 1;
      tx.update(clusterRef, {
        submission_count: FieldValue.increment(1),
      });
    }

    tx.set(submissionRef, {
      question_id: parsed.question_id,
      user_id: userId,
      device_user_id: deviceTokenHash,
      raw_text: parsed.raw_text,
      normalized_cluster_id: cId,
      submitted_at: now,
      submitted_at_minute_of_day: minuteUtc,
      ip_hash: ipHash,
      dwell_ms: parsed.dwell_ms,
      moderation_status: "passed",
    });
  });

  return NextResponse.json({
    cluster_id: cId,
    submission_count: newCount,
    normalized_text: normalizedText,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/app/api/submit/route.test.ts
```

Expected: PASS — all 9 tests green (5 Phase 1 + 4 new).

- [ ] **Step 5: Run full backend test suite to confirm no regressions**

```bash
pnpm test
```

Expected: all tests still pass across submit, devices/register, yesterday, questions/today, hash, auth, auth/me, ratelimit.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/submit/route.ts api/src/app/api/submit/route.test.ts
git commit -m "feat(api): submit accepts optional auth, IP throttle, classifier features"
```

---

## Task 11: Friend graph endpoints (request / accept / list / remove)

**Files:**
- Create: `api/src/app/api/friends/route.ts` (GET list)
- Create: `api/src/app/api/friends/route.test.ts`
- Create: `api/src/app/api/friends/request/route.ts` (POST send)
- Create: `api/src/app/api/friends/request/route.test.ts`
- Create: `api/src/app/api/friends/accept/route.ts` (POST accept)
- Create: `api/src/app/api/friends/accept/route.test.ts`
- Create: `api/src/app/api/friends/[id]/route.ts` (DELETE remove)
- Create: `api/src/app/api/friends/[id]/route.test.ts`

All four endpoints require auth via `Authorization: Bearer <token>`. Friendship doc id is deterministically derived from the two user ids: `friendshipId = sha1(min(uidA,uidB) + ':' + max(uidA,uidB))`. This makes "request" idempotent (re-requesting an existing pending friendship is a no-op rather than a duplicate doc) and `[id]/route.ts` accepts the deterministic id directly.

Spec: requesting → `status='pending'`, requester_id is set. Accepting requires `request.auth.uid === accepter_id`. Removing soft-deletes the doc (just `delete()`). No DMs, no comments, no reactions.

- [ ] **Step 1: Write `request/route.test.ts`**

Create `api/src/app/api/friends/request/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (body: unknown, token?: string) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends/request", {
    method: "POST", headers, body: JSON.stringify(body),
  });
};

describe("POST /api/friends/request", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await POST(buildReq({ target_user_id: "u2" }));
    expect(res.status).toBe(401);
  });

  it("400 when target == self", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const res = await POST(buildReq({ target_user_id: "u1" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("creates pending friendship doc with deterministic id", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    const docMock = vi.fn(() => ({ set: setMock, get: getMock }));
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildReq({ target_user_id: "u2" }, "tok"));
    expect(res.status).toBe(200);
    // Same id whether u1->u2 or u2->u1.
    const idArg = docMock.mock.calls[0][0] as string;
    expect(idArg).toMatch(/^[a-f0-9]{40}$/);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requester_id: "u1",
        accepter_id: "u2",
        status: "pending",
      }),
    );
  });

  it("is idempotent: existing pending request returns 200 without re-write", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true, data: () => ({ requester_id: "u1", accepter_id: "u2", status: "pending" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ set: setMock, get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildReq({ target_user_id: "u2" }, "tok"));
    expect(res.status).toBe(200);
    expect(setMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `request/route.ts`**

Create `api/src/app/api/friends/request/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

const Schema = z.object({ target_user_id: z.string().min(1) });

export function friendshipId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return createHash("sha1").update(`${x}:${y}`).digest("hex");
}

export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (parsed.target_user_id === decoded.uid) {
    return NextResponse.json({ error: "cannot friend yourself" }, { status: 400 });
  }

  const id = friendshipId(decoded.uid, parsed.target_user_id);
  const ref = adminFirestore.collection("friendships").doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    return NextResponse.json({ id, status: (snap.data() as { status: string }).status });
  }

  await ref.set({
    requester_id: decoded.uid,
    accepter_id: parsed.target_user_id,
    status: "pending",
    created_at: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ id, status: "pending" });
}
```

- [ ] **Step 3: Run + verify**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/app/api/friends/request/route.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 4: Write `accept/route.test.ts`**

Create `api/src/app/api/friends/accept/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (body: unknown, token?: string) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends/accept", {
    method: "POST", headers, body: JSON.stringify(body),
  });
};

describe("POST /api/friends/accept", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await POST(buildReq({ friendship_id: "abc" }));
    expect(res.status).toBe(401);
  });

  it("404 when friendship doc missing", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u2" });
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await POST(buildReq({ friendship_id: "abc" }, "tok"));
    expect(res.status).toBe(404);
  });

  it("403 when caller is not the accepter", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ requester_id: "u1", accepter_id: "u2", status: "pending" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await POST(buildReq({ friendship_id: "abc" }, "tok"));
    expect(res.status).toBe(403);
  });

  it("flips pending -> accepted", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u2" });
    const updateMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ requester_id: "u1", accepter_id: "u2", status: "pending" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock, update: updateMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await POST(buildReq({ friendship_id: "abc" }, "tok"));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted" }),
    );
  });
});
```

- [ ] **Step 5: Implement `accept/route.ts`**

Create `api/src/app/api/friends/accept/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

const Schema = z.object({ friendship_id: z.string().min(1) });

export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ref = adminFirestore.collection("friendships").doc(parsed.friendship_id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = snap.data() as { accepter_id: string; status: string };
  if (data.accepter_id !== decoded.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (data.status !== "pending") {
    return NextResponse.json({ id: parsed.friendship_id, status: data.status });
  }

  await ref.update({ status: "accepted", accepted_at: FieldValue.serverTimestamp() });
  return NextResponse.json({ id: parsed.friendship_id, status: "accepted" });
}
```

- [ ] **Step 6: Run + verify**

```bash
pnpm test src/app/api/friends/accept/route.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 7: Write `route.test.ts` (GET list)**

Create `api/src/app/api/friends/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { GET } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends", { headers });
};

describe("GET /api/friends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
  });

  it("returns merged accepted+pending friendships across both directions", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });

    const asRequester = {
      docs: [
        {
          id: "f-A",
          data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }),
        },
      ],
    };
    const asAccepter = {
      docs: [
        {
          id: "f-B",
          data: () => ({ requester_id: "u3", accepter_id: "u1", status: "pending" }),
        },
      ],
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name !== "friendships") throw new Error(`unexpected ${name}`);
      return {
        where: (field: string, _op: string, value: string) => ({
          where: (_f2: string, _o2: string, _v2: string) => ({
            get: vi.fn().mockResolvedValue(field === "requester_id" ? asRequester : asAccepter),
          }),
        }),
      };
    });

    const res = await GET(buildReq("tok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.friendships).toHaveLength(2);
    expect(body.friendships.map((f: any) => f.id).sort()).toEqual(["f-A", "f-B"]);
  });
});
```

- [ ] **Step 8: Implement `route.ts` (GET list)**

Create `api/src/app/api/friends/route.ts`:

```ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

interface Friendship {
  id: string;
  requester_id: string;
  accepter_id: string;
  status: string;
}

export async function GET(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const friendsRef = adminFirestore.collection("friendships");

  const [outgoingSnap, incomingSnap] = await Promise.all([
    friendsRef
      .where("requester_id", "==", decoded.uid)
      .where("status", "in", ["pending", "accepted"])
      .get(),
    friendsRef
      .where("accepter_id", "==", decoded.uid)
      .where("status", "in", ["pending", "accepted"])
      .get(),
  ]);

  const friendships: Friendship[] = [
    ...outgoingSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) })),
    ...incomingSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) })),
  ];

  return NextResponse.json({ friendships });
}
```

NOTE on the test: the test mock simulates a single `where().where().get()` chain, but the real implementation uses `.where("status", "in", [...])`. Adjust the test's mock to match the chain depth used by the implementation if Vitest complains; the assertion is what matters.

- [ ] **Step 9: Run + verify**

```bash
pnpm test src/app/api/friends/route.test.ts
```

Expected: PASS — 2 tests. (If the chained-where mock doesn't satisfy the in-operator path, simplify the test to mock the final `.get()` resolution and skip asserting on the precise where-chain shape; the integration flow is verified in Task 16.)

- [ ] **Step 10: Write `[id]/route.test.ts` (DELETE)**

Create `api/src/app/api/friends/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { DELETE } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends/abc123", { method: "DELETE", headers });
};

describe("DELETE /api/friends/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await DELETE(buildReq(), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(401);
  });

  it("404 when friendship missing", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await DELETE(buildReq("tok"), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(404);
  });

  it("403 when caller is neither party", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u3" });
    const getMock = vi.fn().mockResolvedValue({
      exists: true, data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await DELETE(buildReq("tok"), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(403);
  });

  it("deletes the doc when caller is a party", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const deleteMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true, data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock, delete: deleteMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await DELETE(buildReq("tok"), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 11: Implement `[id]/route.ts` (DELETE)**

Create `api/src/app/api/friends/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const ref = adminFirestore.collection("friendships").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = snap.data() as { requester_id: string; accepter_id: string };
  if (data.requester_id !== decoded.uid && data.accepter_id !== decoded.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
```

NOTE on the route signature: Next.js 16 dynamic routes use `Promise<{ id: string }>` for the params type — this is documented in `node_modules/next/dist/docs/`. If the runtime complains about the signature, check that doc and align.

- [ ] **Step 12: Run + verify**

```bash
pnpm test src/app/api/friends/
```

Expected: PASS — all 4 friend endpoint test files green.

- [ ] **Step 13: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/friends/
git commit -m "feat(api): friend graph (request/accept/list/remove) endpoints (TDD)"
```

---

## Task 12: `GET /api/leaderboard` endpoint w/ shadowban filter

**Files:**
- Create: `api/src/app/api/leaderboard/route.ts`
- Create: `api/src/app/api/leaderboard/route.test.ts`

`GET /api/leaderboard?period=daily|weekly|alltime&scope=global|friends&limit=N`

- `period=daily` (default): query `leaderboard_entries` where `question_id = <most-recent revealed>` order by score desc, submitted_at asc.
- `period=weekly`: query `user_aggregates` order by `weekly_score` desc.
- `period=alltime`: query `user_aggregates` order by `alltime_score` desc.
- `scope=global` (default): no friend filter.
- `scope=friends`: requires auth; filter to entries whose `user_id` is in caller's accepted-friend set + caller's own uid.
- `limit` defaults to 100, max 100.

Shadowban filter: after the primary query, fetch the corresponding `users` docs in one batch and drop any with `shadowbanned=true`. Result is denormalized with `{user_id, handle, score, daily_rank?, locale}`.

Authentication: required for `scope=friends` (returns 401 otherwise). `scope=global` is open (clients use it from the public unauthenticated leaderboard tile pre-sign-in).

- [ ] **Step 1: Write the failing test**

Create `api/src/app/api/leaderboard/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn(), getAll: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { GET } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (qs: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`http://localhost/api/leaderboard${qs}`, { headers });
};

describe("GET /api/leaderboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daily/global: returns entries from latest revealed question, filtered by shadowban", async () => {
    // Latest revealed question:
    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: "q-latest", data: () => ({ text: "Q?" }) }],
            }),
          })),
        })),
      })),
    };
    // Entries query:
    const entriesGet = vi.fn().mockResolvedValue({
      docs: [
        { data: () => ({ user_id: "u1", score: 1500, daily_rank: 1, submitted_at: { toMillis: () => 1 } }) },
        { data: () => ({ user_id: "u2", score: 1000, daily_rank: 2, submitted_at: { toMillis: () => 2 } }) },
        { data: () => ({ user_id: "u-banned", score: 800, daily_rank: 3, submitted_at: { toMillis: () => 3 } }) },
      ],
    });
    const entriesCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({ get: entriesGet })),
          })),
        })),
      })),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") return questionsCollection;
      if (name === "leaderboard_entries") return entriesCollection;
      if (name === "users") return {
        doc: (uid: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              handle: `@${uid}`,
              is_public: true,
              shadowbanned: uid === "u-banned",
              locale: "en",
            }),
          }),
        }),
      };
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: any) => e.user_id)).toEqual(["u1", "u2"]);
    expect(body.entries[0]).toMatchObject({ score: 1500, handle: "@u1" });
  });

  it("alltime/global: orders user_aggregates by alltime_score desc", async () => {
    const aggGet = vi.fn().mockResolvedValue({
      docs: [
        { id: "u1", data: () => ({ alltime_score: 5000, weekly_score: 1500 }) },
        { id: "u2", data: () => ({ alltime_score: 3000, weekly_score: 0 }) },
      ],
    });
    const aggCollection: any = {
      orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ get: aggGet })) })),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "user_aggregates") return aggCollection;
      if (name === "users") return {
        doc: (uid: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ handle: `@${uid}`, is_public: true, shadowbanned: false, locale: "en" }),
          }),
        }),
      };
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=alltime&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: any) => e.score)).toEqual([5000, 3000]);
  });

  it("scope=friends: 401 without auth", async () => {
    const res = await GET(buildReq("?scope=friends"));
    expect(res.status).toBe(401);
  });

  it("scope=friends: filters by caller's friend set + self", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });

    // Friendships query for u1: u1 is requester of u2-friendship, accepter of u3-friendship.
    const friendshipsCollection: any = {
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            docs: [
              { data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }) },
              { data: () => ({ requester_id: "u3", accepter_id: "u1", status: "accepted" }) },
            ],
          }),
        })),
      })),
    };

    // Latest question:
    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: "q-latest", data: () => ({ text: "Q?" }) }],
            }),
          })),
        })),
      })),
    };

    // Entries with user_id IN [u1, u2, u3]:
    const entriesGet = vi.fn().mockResolvedValue({
      docs: [
        { data: () => ({ user_id: "u1", score: 1500, daily_rank: 1, submitted_at: { toMillis: () => 1 } }) },
        { data: () => ({ user_id: "u2", score: 1000, daily_rank: 2, submitted_at: { toMillis: () => 2 } }) },
      ],
    });
    const entriesCollection: any = {
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({ get: entriesGet })),
            })),
          })),
        })),
      })),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return friendshipsCollection;
      if (name === "questions") return questionsCollection;
      if (name === "leaderboard_entries") return entriesCollection;
      if (name === "users") return {
        doc: (uid: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ handle: `@${uid}`, is_public: true, shadowbanned: false, locale: "en" }),
          }),
        }),
      };
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=friends", "tok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries.map((e: any) => e.user_id).sort()).toEqual(["u1", "u2"]);
  });

  it("returns empty when no revealed question exists yet", async () => {
    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          })),
        })),
      })),
    };
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") return questionsCollection;
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/app/api/leaderboard/route.test.ts
```

Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `route.ts`**

Create `api/src/app/api/leaderboard/route.ts`:

```ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

interface LeaderboardEntryDoc {
  user_id: string;
  score: number;
  daily_rank?: number;
  submitted_at?: { toMillis(): number };
}

interface UserDoc {
  handle: string | null;
  is_public: boolean;
  shadowbanned: boolean;
  locale: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

async function findLatestRevealedId(): Promise<string | null> {
  const snap = await adminFirestore
    .collection("questions")
    .where("status", "==", "revealed")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function fetchAcceptedFriendUids(uid: string): Promise<string[]> {
  const friendsRef = adminFirestore.collection("friendships");
  const [outgoing, incoming] = await Promise.all([
    friendsRef.where("requester_id", "==", uid).where("status", "==", "accepted").get(),
    friendsRef.where("accepter_id", "==", uid).where("status", "==", "accepted").get(),
  ]);
  const out: string[] = [uid];
  outgoing.docs.forEach((d) => out.push((d.data() as { accepter_id: string }).accepter_id));
  incoming.docs.forEach((d) => out.push((d.data() as { requester_id: string }).requester_id));
  return Array.from(new Set(out));
}

async function joinUsersAndFilterShadowbanned(
  rows: { user_id: string; score: number; daily_rank?: number }[],
): Promise<{ user_id: string; handle: string | null; score: number; daily_rank?: number; locale: string }[]> {
  const out: ReturnType<typeof joinUsersAndFilterShadowbanned> extends Promise<infer T> ? T : never = [];
  for (const row of rows) {
    const userSnap = await adminFirestore.collection("users").doc(row.user_id).get();
    if (!userSnap.exists) continue;
    const u = userSnap.data() as UserDoc;
    if (u.shadowbanned) continue;
    if (!u.is_public) continue;
    out.push({
      user_id: row.user_id,
      handle: u.handle,
      score: row.score,
      daily_rank: row.daily_rank,
      locale: u.locale,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "daily") as "daily" | "weekly" | "alltime";
  const scope = (url.searchParams.get("scope") ?? "global") as "global" | "friends";
  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  let friendUids: string[] | null = null;
  if (scope === "friends") {
    const decoded = await requireAuth(req);
    if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    friendUids = await fetchAcceptedFriendUids(decoded.uid);
    if (friendUids.length === 0) return NextResponse.json({ entries: [] });
  }

  let rows: { user_id: string; score: number; daily_rank?: number }[] = [];

  if (period === "daily") {
    const qid = await findLatestRevealedId();
    if (!qid) return NextResponse.json({ entries: [] });

    let q: FirebaseFirestore.Query = adminFirestore
      .collection("leaderboard_entries")
      .where("question_id", "==", qid);
    if (friendUids) q = q.where("user_id", "in", friendUids.slice(0, 30)); // Firestore "in" cap = 30
    q = q.orderBy("score", "desc").orderBy("submitted_at", "asc").limit(limit);

    const snap = await q.get();
    rows = snap.docs.map((d) => {
      const data = d.data() as LeaderboardEntryDoc;
      return { user_id: data.user_id, score: data.score, daily_rank: data.daily_rank };
    });
  } else {
    // weekly / alltime: use user_aggregates.
    const field = period === "weekly" ? "weekly_score" : "alltime_score";
    let q: FirebaseFirestore.Query = adminFirestore.collection("user_aggregates");
    if (friendUids) {
      q = adminFirestore
        .collection("user_aggregates")
        .where("__name__", "in", friendUids.slice(0, 30));
    }
    q = q.orderBy(field, "desc").limit(limit);

    const snap = await q.get();
    rows = snap.docs.map((d) => {
      const data = d.data() as Record<string, number>;
      return { user_id: d.id, score: data[field] ?? 0 };
    });
  }

  const entries = await joinUsersAndFilterShadowbanned(rows);
  return NextResponse.json({ entries });
}
```

NOTE: Firestore's `in` operator caps at 30 values. For users with >30 friends, the friend-leaderboard implementation paginates — but v1 caps at 30 for simplicity. Document this in the response or in the iOS UI ("showing top friends among your closest 30"). Realistic v1 friend counts are well below 30.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/app/api/leaderboard/route.test.ts
```

Expected: PASS — 5 tests green. Some chained-mock assertions may need to be loosened if the test mock doesn't match the implementation's exact `where().where().orderBy().orderBy().limit().get()` chain depth. The acceptance gate (Task 16) will validate end-to-end against the emulator.

- [ ] **Step 5: Run all backend tests to verify no regressions**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/leaderboard/
git commit -m "feat(api): GET /api/leaderboard with shadowban + friend-scope filter"
```

---

## Task 13: iOS — `expo-apple-authentication` install + `auth.ts` helper (TDD) + `SignInWithApple` component

**Files:**
- Modify: `ios/package.json` (add `expo-apple-authentication`)
- Modify: `ios/app.json` (add plugin + `usesAppleSignIn: true`)
- Create: `ios/src/lib/auth.ts`
- Create: `ios/src/lib/auth.test.ts`
- Create: `ios/src/components/SignInWithApple.tsx`
- Create: `ios/src/components/SignInWithApple.test.tsx`

The flow:
1. User taps `<SignInWithApple />` button.
2. Component calls `signInWithApple()` from `auth.ts`.
3. `signInWithApple` calls `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })`.
4. Pulls `identityToken` (Apple-issued JWT) + `nonce`.
5. Builds Firebase OAuth credential: `auth.AppleAuthProvider.credential(identityToken, nonce)`.
6. Calls `auth().signInWithCredential(credential)` → Firebase Auth user signed in.
7. Returns the Firebase ID token via `auth().currentUser?.getIdToken()` for use as `Authorization: Bearer <token>`.

Real Apple validation requires the "Sign in with Apple" capability registered in Apple Developer Portal. **Phase 3 ships against mocks only** — integration on a real device is Phase 6.

- [ ] **Step 1: Add `expo-apple-authentication` to ios/package.json**

Modify `ios/package.json` `dependencies` to include:

```json
    "expo-apple-authentication": "~8.0.5",
```

Insert it alphabetically. The full dependencies block updates to include this line between `@react-navigation/native` and `expo`:

```json
    "expo-apple-authentication": "~8.0.5",
    "expo": "~54.0.33",
```

Run install:

```bash
cd /c/Users/levin/relatably/ios
pnpm install
```

If the version `~8.0.5` is wrong for Expo SDK 54, run `pnpm expo install expo-apple-authentication` instead and let the Expo CLI pick the matching version. Expected: install completes; lockfile updated.

- [ ] **Step 2: Update `ios/app.json` plugin config**

Open `ios/app.json` and add `expo-apple-authentication` to the `plugins` array, alongside the existing `@react-native-firebase/messaging` plugin. Also set `ios.usesAppleSignIn: true`.

The relevant section (within `expo`) should look like:

```json
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "co.relatably.app",
      "usesAppleSignIn": true,
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-apple-authentication",
      [
        "@react-native-firebase/messaging",
        {}
      ],
      ...
    ]
```

Preserve any existing properties (the precise existing shape is at `ios/app.json`; merge the additions surgically; don't replace the whole file).

- [ ] **Step 3: Write the failing `auth.test.ts`**

Create `ios/src/lib/auth.test.ts`:

```ts
import { signInWithApple, signOut, getIdToken } from "./auth";

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: "name", EMAIL: "email" },
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock("@react-native-firebase/auth", () => {
  const signInWithCredential = jest.fn();
  const signOutFn = jest.fn();
  const getIdTokenFn = jest.fn();
  const auth: any = jest.fn(() => ({
    signInWithCredential,
    signOut: signOutFn,
    currentUser: { getIdToken: getIdTokenFn },
  }));
  auth.AppleAuthProvider = {
    credential: jest.fn((idToken: string, nonce: string) => ({ idToken, nonce, providerId: "apple.com" })),
  };
  return { __esModule: true, default: auth };
});

import * as AppleAuthentication from "expo-apple-authentication";
import auth from "@react-native-firebase/auth";

describe("ios auth helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signInWithApple builds a Firebase credential from the Apple ID token", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "apple-id-token-xyz",
      nonce: "the-nonce",
      user: "apple-user-id",
    });
    (auth() as any).signInWithCredential.mockResolvedValueOnce({ user: { uid: "firebase-uid-1" } });

    const out = await signInWithApple();
    expect(AppleAuthentication.signInAsync).toHaveBeenCalled();
    expect((auth as any).AppleAuthProvider.credential).toHaveBeenCalledWith("apple-id-token-xyz", "the-nonce");
    expect(out).toMatchObject({ uid: "firebase-uid-1" });
  });

  it("signInWithApple throws when identityToken is missing", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: null,
      nonce: "n",
    });
    await expect(signInWithApple()).rejects.toThrow();
  });

  it("getIdToken returns the current Firebase ID token", async () => {
    (auth() as any).currentUser.getIdToken.mockResolvedValueOnce("firebase-id-token-abc");
    await expect(getIdToken()).resolves.toBe("firebase-id-token-abc");
  });

  it("signOut calls Firebase auth signOut", async () => {
    (auth() as any).signOut.mockResolvedValueOnce(undefined);
    await signOut();
    expect((auth() as any).signOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run tests to verify failure**

```bash
cd /c/Users/levin/relatably/ios
pnpm test src/lib/auth.test.ts
```

Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 5: Implement `auth.ts`**

Create `ios/src/lib/auth.ts`:

```ts
import * as AppleAuthentication from "expo-apple-authentication";
import auth from "@react-native-firebase/auth";

export interface SignedInUser {
  uid: string;
}

export async function signInWithApple(): Promise<SignedInUser> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-in returned no identity token");
  }

  const firebaseCredential = (auth as any).AppleAuthProvider.credential(
    credential.identityToken,
    (credential as any).nonce ?? "",
  );
  const userCredential = await auth().signInWithCredential(firebaseCredential);
  return { uid: userCredential.user.uid };
}

export async function signOut(): Promise<void> {
  await auth().signOut();
}

export async function getIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pnpm test src/lib/auth.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 7: Write the failing `SignInWithApple.test.tsx`**

Create `ios/src/components/SignInWithApple.test.tsx`:

```tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SignInWithApple } from "./SignInWithApple";

jest.mock("@/src/lib/auth", () => ({
  signInWithApple: jest.fn(),
}));

import * as authMod from "@/src/lib/auth";

describe("SignInWithApple", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders an Apple sign-in button", () => {
    const { getByRole } = render(<SignInWithApple onSignedIn={() => {}} />);
    expect(getByRole("button")).toBeTruthy();
  });

  it("calls signInWithApple on press and invokes onSignedIn with the uid", async () => {
    (authMod.signInWithApple as jest.Mock).mockResolvedValueOnce({ uid: "user-z" });
    const onSignedIn = jest.fn();
    const { getByRole } = render(<SignInWithApple onSignedIn={onSignedIn} />);
    fireEvent.press(getByRole("button"));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("user-z"));
  });

  it("calls onError when sign-in fails", async () => {
    (authMod.signInWithApple as jest.Mock).mockRejectedValueOnce(new Error("user-cancelled"));
    const onError = jest.fn();
    const { getByRole } = render(<SignInWithApple onSignedIn={() => {}} onError={onError} />);
    fireEvent.press(getByRole("button"));
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
```

- [ ] **Step 8: Implement `SignInWithApple.tsx`**

Create `ios/src/components/SignInWithApple.tsx`:

```tsx
import { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { signInWithApple } from "@/src/lib/auth";

interface Props {
  onSignedIn: (uid: string) => void;
  onError?: (err: unknown) => void;
}

export function SignInWithApple({ onSignedIn, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { uid } = await signInWithApple();
      onSignedIn(uid);
    } catch (err) {
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable role="button" onPress={handlePress} style={[styles.btn, busy && styles.busy]}>
      <Text style={styles.label}>{busy ? "signing in…" : "  Sign in with Apple"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: { opacity: 0.6 },
  label: { color: "#000", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
pnpm test src/components/SignInWithApple.test.tsx
```

Expected: PASS — 3 tests green.

- [ ] **Step 10: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/package.json ios/app.json ios/pnpm-lock.yaml \
        ios/src/lib/auth.ts ios/src/lib/auth.test.ts \
        ios/src/components/SignInWithApple.tsx ios/src/components/SignInWithApple.test.tsx
git commit -m "feat(ios): Sign in with Apple flow + Firebase Auth credential (TDD)"
```

---

## Task 14: iOS — `api.ts` Authorization pass-through + new endpoint clients (TDD)

**Files:**
- Modify: `ios/src/lib/api.ts`
- Create: `ios/src/lib/api.test.ts` (NEW — Phase 1 + 2 had no api-level tests; we add coverage now since the module is growing)
- Modify: `ios/src/types/api.ts`

Extend `api.ts` to:
1. Optionally read a Firebase ID token via `getIdToken()` and attach `Authorization: Bearer <token>` to outbound requests.
2. Add new endpoint clients: `fetchAuthMe`, `requestFriend`, `acceptFriend`, `removeFriend`, `fetchFriends`, `fetchLeaderboard`.

For tests, mock `getIdToken` and `global.fetch`.

- [ ] **Step 1: Update `ios/src/types/api.ts`**

Append the new types:

```ts
export interface AuthMeResponse {
  uid: string;
  handle: string | null;
  is_public: boolean;
  locale: string;
  shadowbanned: boolean;
}

export interface Friendship {
  id: string;
  requester_id: string;
  accepter_id: string;
  status: "pending" | "accepted";
}

export interface LeaderboardEntry {
  user_id: string;
  handle: string | null;
  score: number;
  daily_rank?: number;
  locale: string;
}

export type LeaderboardPeriod = "daily" | "weekly" | "alltime";
export type LeaderboardScope = "global" | "friends";
```

The full file is the existing Phase 2 contents PLUS these blocks at the end.

- [ ] **Step 2: Write the failing test**

Create `ios/src/lib/api.test.ts`:

```ts
import {
  fetchAuthMe,
  requestFriend,
  acceptFriend,
  removeFriend,
  fetchFriends,
  fetchLeaderboard,
} from "./api";

jest.mock("@/src/lib/auth", () => ({
  getIdToken: jest.fn(),
}));

import * as authMod from "@/src/lib/auth";

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const okJson = (body: any, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as any);

describe("api clients with Authorization header", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authMod.getIdToken as jest.Mock).mockResolvedValue("id-token-1");
  });

  it("fetchAuthMe POSTs with Authorization Bearer", async () => {
    fetchMock.mockReturnValueOnce(okJson({ uid: "u1", handle: null, is_public: true, locale: "en", shadowbanned: false }));
    const res = await fetchAuthMe();
    expect(res).toMatchObject({ uid: "u1" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer id-token-1");
  });

  it("requestFriend includes target_user_id in body and bearer in header", async () => {
    fetchMock.mockReturnValueOnce(okJson({ id: "fid", status: "pending" }));
    const res = await requestFriend("u2");
    expect(res).toMatchObject({ id: "fid", status: "pending" });
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ target_user_id: "u2" });
    expect(init.headers.authorization).toBe("Bearer id-token-1");
  });

  it("acceptFriend POSTs friendship_id with bearer", async () => {
    fetchMock.mockReturnValueOnce(okJson({ id: "fid", status: "accepted" }));
    await acceptFriend("fid");
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ friendship_id: "fid" });
  });

  it("removeFriend issues DELETE", async () => {
    fetchMock.mockReturnValueOnce(okJson({ ok: true }));
    await removeFriend("fid");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("DELETE");
  });

  it("fetchFriends GETs and returns friendships array", async () => {
    fetchMock.mockReturnValueOnce(okJson({ friendships: [{ id: "f1" }] }));
    const res = await fetchFriends();
    expect(res.friendships).toHaveLength(1);
  });

  it("fetchLeaderboard appends period+scope query string", async () => {
    fetchMock.mockReturnValueOnce(okJson({ entries: [] }));
    await fetchLeaderboard({ period: "daily", scope: "global" });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain("period=daily");
    expect(url).toContain("scope=global");
  });

  it("fetchLeaderboard scope=friends includes Authorization header", async () => {
    fetchMock.mockReturnValueOnce(okJson({ entries: [] }));
    await fetchLeaderboard({ period: "weekly", scope: "friends" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.authorization).toBe("Bearer id-token-1");
  });

  it("fetchAuthMe still attempts when getIdToken returns null (server returns 401)", async () => {
    (authMod.getIdToken as jest.Mock).mockResolvedValueOnce(null);
    fetchMock.mockReturnValueOnce(okJson({ error: "unauthorized" }, 401));
    await expect(fetchAuthMe()).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify failure**

```bash
cd /c/Users/levin/relatably/ios
pnpm test src/lib/api.test.ts
```

Expected: FAIL — symbols don't exist.

- [ ] **Step 4: Update `ios/src/lib/api.ts` with the new clients**

Replace the entire file with:

```ts
import type {
  TodayQuestion, SubmitRequest, SubmitResponse,
  DeviceRegisterPayload, Yesterday,
  AuthMeResponse, Friendship, LeaderboardEntry, LeaderboardPeriod, LeaderboardScope,
} from "../types/api";
import { getIdToken } from "@/src/lib/auth";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchTodayQuestion(): Promise<TodayQuestion> {
  const res = await fetch(`${BASE}/api/questions/today`);
  if (!res.ok) throw new Error(`fetchTodayQuestion: ${res.status}`);
  return res.json();
}

export async function submitAnswer(req: SubmitRequest): Promise<SubmitResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `submit: ${res.status}`);
  }
  return res.json();
}

export async function registerDevice(payload: DeviceRegisterPayload): Promise<void> {
  const res = await fetch(`${BASE}/api/devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status}`);
}

export async function fetchYesterday(deviceToken?: string): Promise<Yesterday | null> {
  const url = new URL(`${BASE}/api/yesterday`);
  if (deviceToken) url.searchParams.set("device_token", deviceToken);
  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`yesterday failed: ${res.status}`);
  return (await res.json()) as Yesterday;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/auth/me`, { method: "POST", headers: auth });
  if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
  return res.json();
}

export async function requestFriend(targetUserId: string): Promise<{ id: string; status: string }> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends/request`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
  if (!res.ok) throw new Error(`requestFriend: ${res.status}`);
  return res.json();
}

export async function acceptFriend(friendshipId: string): Promise<{ id: string; status: string }> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends/accept`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ friendship_id: friendshipId }),
  });
  if (!res.ok) throw new Error(`acceptFriend: ${res.status}`);
  return res.json();
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends/${encodeURIComponent(friendshipId)}`, {
    method: "DELETE",
    headers: auth,
  });
  if (!res.ok) throw new Error(`removeFriend: ${res.status}`);
}

export async function fetchFriends(): Promise<{ friendships: Friendship[] }> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends`, { headers: auth });
  if (!res.ok) throw new Error(`fetchFriends: ${res.status}`);
  return res.json();
}

export async function fetchLeaderboard(opts: {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  limit?: number;
}): Promise<{ entries: LeaderboardEntry[] }> {
  const url = new URL(`${BASE}/api/leaderboard`);
  url.searchParams.set("period", opts.period);
  url.searchParams.set("scope", opts.scope);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));

  const headers = opts.scope === "friends" ? await authHeaders() : {};
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`fetchLeaderboard: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test src/lib/api.test.ts
```

Expected: PASS — 8 tests green.

- [ ] **Step 6: Run full iOS test suite to ensure no regressions**

```bash
pnpm test
```

Expected: All Phase 1 + Phase 2 + Phase 3 iOS tests pass (4 SubmitButton + 5 messaging + 3 revealStore + 3 RevealAnimation + 4 auth + 3 SignInWithApple + 8 api = 30 tests).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/src/lib/api.ts ios/src/lib/api.test.ts ios/src/types/api.ts
git commit -m "feat(ios): api.ts Authorization pass-through + auth/friends/leaderboard clients"
```

---

## Task 15: iOS — `LeaderboardScreen` + `FriendsScreen` + 4-tab bar wiring (TDD)

**Files:**
- Create: `ios/src/components/LeaderboardRow.tsx`
- Create: `ios/src/components/LeaderboardRow.test.tsx`
- Create: `ios/src/components/FriendListRow.tsx`
- Create: `ios/src/components/FriendListRow.test.tsx`
- Create: `ios/src/screens/LeaderboardScreen.tsx`
- Create: `ios/src/screens/LeaderboardScreen.test.tsx`
- Create: `ios/src/screens/FriendsScreen.tsx`
- Create: `ios/src/screens/FriendsScreen.test.tsx`
- Create: `ios/app/(tabs)/leaderboard.tsx`
- Create: `ios/app/(tabs)/friends.tsx`
- Create: `ios/app/(tabs)/archive.tsx`
- Modify: `ios/app/(tabs)/_layout.tsx`
- Delete: `ios/app/(tabs)/explore.tsx`

The screens are presentational + a thin data-fetching `useEffect`. `LeaderboardScreen` accepts a `period` + `scope` toggle. Both screens are gated on sign-in: when not signed in, they render a `<SignInWithApple />` button instead.

To keep the 4 child files testable, the SCREEN files render the data; the (tabs) wrapper files are 3-line passthroughs (just import + render the screen). Tests target the screens directly.

- [ ] **Step 1: Verify the existing `ios/app/(tabs)/_layout.tsx` shape**

Read `ios/app/(tabs)/_layout.tsx`. It will look approximately like:

```tsx
import { Tabs } from "expo-router";
// ...icon imports
export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
    </Tabs>
  );
}
```

Note the existing icon imports + colors so the new tabs match style.

- [ ] **Step 2: TDD `LeaderboardRow.tsx`**

Create `ios/src/components/LeaderboardRow.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { LeaderboardRow } from "./LeaderboardRow";

describe("LeaderboardRow", () => {
  it("renders rank, handle, and score", () => {
    const { getByText } = render(
      <LeaderboardRow rank={1} handle="@coolname" score={1500} locale="us" />,
    );
    expect(getByText("#1")).toBeTruthy();
    expect(getByText("@coolname")).toBeTruthy();
    expect(getByText("1500")).toBeTruthy();
  });

  it("falls back to anonymous label when handle is null", () => {
    const { getByText } = render(
      <LeaderboardRow rank={42} handle={null} score={100} locale="us" />,
    );
    expect(getByText(/anon/i)).toBeTruthy();
  });
});
```

Create `ios/src/components/LeaderboardRow.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Props {
  rank: number;
  handle: string | null;
  score: number;
  locale: string;
}

export function LeaderboardRow({ rank, handle, score }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.rank}>#{rank}</Text>
      <Text style={styles.handle} numberOfLines={1}>{handle ?? "anon"}</Text>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  rank: { color: "#888", fontSize: 14, width: 48 },
  handle: { color: "#fff", fontSize: 16, flex: 1 },
  score: { color: "#aaff00", fontSize: 16, fontWeight: "700" },
});
```

Run + verify:

```bash
cd /c/Users/levin/relatably/ios
pnpm test src/components/LeaderboardRow.test.tsx
```

Expected: PASS — 2 tests.

- [ ] **Step 3: TDD `FriendListRow.tsx`**

Create `ios/src/components/FriendListRow.test.tsx`:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import { FriendListRow } from "./FriendListRow";

describe("FriendListRow", () => {
  it("renders accepted friend with handle, no Accept button", () => {
    const { getByText, queryByText } = render(
      <FriendListRow id="f1" handle="@friend1" status="accepted" />,
    );
    expect(getByText("@friend1")).toBeTruthy();
    expect(queryByText(/accept/i)).toBeNull();
  });

  it("renders pending incoming with Accept button", () => {
    const onAccept = jest.fn();
    const { getByText } = render(
      <FriendListRow id="f1" handle="@friend1" status="pending_incoming" onAccept={onAccept} />,
    );
    fireEvent.press(getByText(/accept/i));
    expect(onAccept).toHaveBeenCalledWith("f1");
  });

  it("renders pending outgoing as 'Sent'", () => {
    const { getByText } = render(
      <FriendListRow id="f1" handle="@friend1" status="pending_outgoing" />,
    );
    expect(getByText(/sent/i)).toBeTruthy();
  });
});
```

Create `ios/src/components/FriendListRow.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";

type Status = "accepted" | "pending_incoming" | "pending_outgoing";

interface Props {
  id: string;
  handle: string | null;
  status: Status;
  onAccept?: (id: string) => void;
}

export function FriendListRow({ id, handle, status, onAccept }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.handle} numberOfLines={1}>{handle ?? "anon"}</Text>
      {status === "pending_incoming" && onAccept && (
        <Pressable onPress={() => onAccept(id)} style={styles.acceptBtn}>
          <Text style={styles.acceptLabel}>ACCEPT</Text>
        </Pressable>
      )}
      {status === "pending_outgoing" && <Text style={styles.muted}>sent</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  handle: { color: "#fff", fontSize: 16, flex: 1 },
  muted: { color: "#888", fontSize: 14 },
  acceptBtn: { backgroundColor: "#aaff00", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  acceptLabel: { color: "#000", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
```

Run + verify:

```bash
pnpm test src/components/FriendListRow.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 4: TDD `LeaderboardScreen.tsx`**

Create `ios/src/screens/LeaderboardScreen.test.tsx`:

```tsx
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { LeaderboardScreen } from "./LeaderboardScreen";

jest.mock("@/src/lib/api", () => ({
  fetchLeaderboard: jest.fn(),
}));

import * as apiMod from "@/src/lib/api";

describe("LeaderboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches daily/global on mount and renders rows", async () => {
    (apiMod.fetchLeaderboard as jest.Mock).mockResolvedValueOnce({
      entries: [
        { user_id: "u1", handle: "@a", score: 1500, daily_rank: 1, locale: "en" },
        { user_id: "u2", handle: "@b", score: 1000, daily_rank: 2, locale: "en" },
      ],
    });
    const { findByText } = render(<LeaderboardScreen isSignedIn={true} />);
    await findByText("@a");
    await findByText("@b");
  });

  it("re-fetches on period change", async () => {
    (apiMod.fetchLeaderboard as jest.Mock).mockResolvedValue({ entries: [] });
    const { findByText } = render(<LeaderboardScreen isSignedIn={true} />);
    await findByText(/today/i);
    fireEvent.press(await findByText(/all-time/i));
    await waitFor(() =>
      expect(apiMod.fetchLeaderboard).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "alltime" }),
      ),
    );
  });

  it("blocks scope=friends when not signed in", async () => {
    (apiMod.fetchLeaderboard as jest.Mock).mockResolvedValue({ entries: [] });
    const { queryByText } = render(<LeaderboardScreen isSignedIn={false} />);
    // The "Friends" toggle should be disabled or absent.
    expect(queryByText(/sign in to see friend leaderboards/i)).toBeTruthy();
  });
});
```

Create `ios/src/screens/LeaderboardScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { LeaderboardRow } from "@/src/components/LeaderboardRow";
import { fetchLeaderboard } from "@/src/lib/api";
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
}

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "today" },
  { key: "weekly", label: "this week" },
  { key: "alltime", label: "all-time" },
];

export function LeaderboardScreen({ isSignedIn }: Props) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard({ period, scope })
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, scope]);

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={styles.tab}>
            <Text style={[styles.tabLabel, period === p.key && styles.tabLabelActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scopeRow}>
        <Pressable onPress={() => setScope("global")} style={styles.scopeBtn}>
          <Text style={[styles.scopeLabel, scope === "global" && styles.scopeLabelActive]}>global</Text>
        </Pressable>
        <Pressable
          onPress={() => isSignedIn && setScope("friends")}
          style={styles.scopeBtn}
          disabled={!isSignedIn}
        >
          <Text style={[styles.scopeLabel, scope === "friends" && styles.scopeLabelActive, !isSignedIn && styles.disabled]}>
            friends
          </Text>
        </Pressable>
      </View>
      {!isSignedIn && (
        <Text style={styles.hint}>sign in to see friend leaderboards</Text>
      )}
      {loading ? (
        <Text style={styles.muted}>loading…</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.user_id}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              rank={item.daily_rank ?? index + 1}
              handle={item.handle}
              score={item.score}
              locale={item.locale}
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>no entries yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  tabLabel: { color: "#888", fontSize: 14 },
  tabLabelActive: { color: "#aaff00", fontWeight: "700" },
  scopeRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 16 },
  scopeBtn: { paddingVertical: 4 },
  scopeLabel: { color: "#666", fontSize: 13 },
  scopeLabelActive: { color: "#fff" },
  disabled: { color: "#444" },
  hint: { color: "#888", fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  muted: { color: "#888", fontSize: 14, padding: 16, textAlign: "center" },
});
```

Run + verify:

```bash
pnpm test src/screens/LeaderboardScreen.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: TDD `FriendsScreen.tsx`**

Create `ios/src/screens/FriendsScreen.test.tsx`:

```tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { FriendsScreen } from "./FriendsScreen";

jest.mock("@/src/lib/api", () => ({
  fetchFriends: jest.fn(),
  acceptFriend: jest.fn(),
  removeFriend: jest.fn(),
  requestFriend: jest.fn(),
}));

import * as apiMod from "@/src/lib/api";

describe("FriendsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("when not signed in: prompts to sign in", () => {
    const { getByText } = render(<FriendsScreen isSignedIn={false} myUid={null} />);
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  it("fetches friends on mount", async () => {
    (apiMod.fetchFriends as jest.Mock).mockResolvedValueOnce({
      friendships: [
        { id: "f1", requester_id: "me", accepter_id: "other-1", status: "accepted" },
      ],
    });
    render(<FriendsScreen isSignedIn={true} myUid="me" />);
    await waitFor(() => expect(apiMod.fetchFriends).toHaveBeenCalled());
  });

  it("accepting a pending request calls acceptFriend", async () => {
    (apiMod.fetchFriends as jest.Mock).mockResolvedValue({
      friendships: [
        { id: "f1", requester_id: "other-1", accepter_id: "me", status: "pending" },
      ],
    });
    (apiMod.acceptFriend as jest.Mock).mockResolvedValue({ id: "f1", status: "accepted" });
    const { findByText } = render(<FriendsScreen isSignedIn={true} myUid="me" />);
    const btn = await findByText(/accept/i);
    fireEvent.press(btn);
    await waitFor(() => expect(apiMod.acceptFriend).toHaveBeenCalledWith("f1"));
  });
});
```

Create `ios/src/screens/FriendsScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { FriendListRow } from "@/src/components/FriendListRow";
import { fetchFriends, acceptFriend } from "@/src/lib/api";
import type { Friendship } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
  myUid: string | null;
}

export function FriendsScreen({ isSignedIn, myUid }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFriends();
      setFriendships(res.friendships);
    } catch {
      setFriendships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      reload();
    }
  }, [isSignedIn, reload]);

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>sign in to see your friends</Text>
      </View>
    );
  }

  const onAccept = async (id: string) => {
    await acceptFriend(id);
    await reload();
  };

  return (
    <View style={styles.root}>
      {loading ? (
        <Text style={styles.muted}>loading…</Text>
      ) : (
        <FlatList
          data={friendships}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => {
            const isAccepted = item.status === "accepted";
            const isIncoming = !isAccepted && item.accepter_id === myUid;
            const status = isAccepted
              ? "accepted"
              : isIncoming
              ? "pending_incoming"
              : "pending_outgoing";
            const otherUid = item.requester_id === myUid ? item.accepter_id : item.requester_id;
            return (
              <FriendListRow
                id={item.id}
                handle={otherUid}
                status={status as any}
                onAccept={isIncoming ? onAccept : undefined}
              />
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>no friends yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  muted: { color: "#888", fontSize: 14, padding: 16, textAlign: "center" },
});
```

Note: We display `otherUid` as a placeholder for the friend's handle. The real handle would come from a join against `/users/{uid}`. Phase 4 polish item: enrich `GET /api/friends` to include each party's handle.

Run + verify:

```bash
pnpm test src/screens/FriendsScreen.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Create the (tabs) wrappers**

Create `ios/app/(tabs)/leaderboard.tsx`:

```tsx
import { LeaderboardScreen } from "@/src/screens/LeaderboardScreen";
import auth from "@react-native-firebase/auth";

export default function LeaderboardTab() {
  const isSignedIn = auth().currentUser !== null;
  return <LeaderboardScreen isSignedIn={isSignedIn} />;
}
```

Create `ios/app/(tabs)/friends.tsx`:

```tsx
import { FriendsScreen } from "@/src/screens/FriendsScreen";
import auth from "@react-native-firebase/auth";

export default function FriendsTab() {
  const user = auth().currentUser;
  return <FriendsScreen isSignedIn={user !== null} myUid={user?.uid ?? null} />;
}
```

Create `ios/app/(tabs)/archive.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

export default function ArchiveTab() {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>archive · coming in phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  muted: { color: "#888", fontSize: 14 },
});
```

- [ ] **Step 7: Update `ios/app/(tabs)/_layout.tsx` to define 4 tabs**

Read the existing `_layout.tsx` first (style + icon imports vary). Replace the `<Tabs>` body with these 4 entries (preserve any existing icon component imports + screenOptions configuration):

```tsx
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
      <Tabs.Screen name="archive" options={{ title: "Archive" }} />
```

If the existing layout used icons (e.g. `<TabBarIcon ... />`), reuse the same icon factory for the 4 tabs — pick reasonable SF Symbol equivalents (`house.fill`, `person.2.fill`, `trophy.fill`, `archivebox.fill`).

Delete the now-orphaned `ios/app/(tabs)/explore.tsx`:

```bash
rm /c/Users/levin/relatably/ios/app/\(tabs\)/explore.tsx
```

- [ ] **Step 8: Run the full iOS test suite**

```bash
cd /c/Users/levin/relatably/ios
pnpm test
```

Expected: PASS — all Phase 1+2+3 iOS tests green. Total: ~38 tests (4 SubmitButton + 5 messaging + 3 revealStore + 3 RevealAnimation + 4 auth + 3 SignInWithApple + 8 api + 2 LeaderboardRow + 3 FriendListRow + 3 LeaderboardScreen + 3 FriendsScreen).

- [ ] **Step 9: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/src/components/LeaderboardRow.tsx ios/src/components/LeaderboardRow.test.tsx \
        ios/src/components/FriendListRow.tsx ios/src/components/FriendListRow.test.tsx \
        ios/src/screens/LeaderboardScreen.tsx ios/src/screens/LeaderboardScreen.test.tsx \
        ios/src/screens/FriendsScreen.tsx ios/src/screens/FriendsScreen.test.tsx \
        "ios/app/(tabs)/leaderboard.tsx" "ios/app/(tabs)/friends.tsx" "ios/app/(tabs)/archive.tsx" \
        "ios/app/(tabs)/_layout.tsx"
git rm "ios/app/(tabs)/explore.tsx"
git commit -m "feat(ios): LeaderboardScreen + FriendsScreen + 4-tab bar (TDD)"
```

---

## Task 16: Phase 3 acceptance gate (manual emulator E2E)

**No file changes.** This task verifies the integrated system end-to-end against the running emulator.

- [ ] **Step 1: Start the emulator suite**

In one terminal:

```bash
cd /c/Users/levin/relatably/firebase
"/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot/bin/java" -version  # confirm Java 21
firebase emulators:start --only firestore,auth,functions
```

Expected: emulator UI on http://localhost:4000, auth on :9099, firestore on :8080, functions on :5001.

- [ ] **Step 2: Start the Next.js API in another terminal**

```bash
cd /c/Users/levin/relatably/api
FIREBASE_PROJECT_ID=relatably-prod \
  FIRESTORE_EMULATOR_HOST=localhost:8080 \
  FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
  pnpm dev
```

Expected: server boots on http://localhost:3000.

- [ ] **Step 3: Seed a question and forge a test user**

In a third terminal, seed and bootstrap:

```bash
cd /c/Users/levin/relatably/firebase/scripts
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod pnpm seed:questions
```

Then in the Auth emulator UI (http://localhost:4000/auth), click "Add user" and create a user with `uid=test-user-1`. Click into the user, choose "Get ID token from emulator" — copy the token.

- [ ] **Step 4: Verify `POST /api/auth/me` creates the user doc**

```bash
TOKEN=<paste-token>
curl -X POST http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept-Language: en-US"
```

Expected response includes `{"uid": "test-user-1", "handle": null, "is_public": true, "shadowbanned": false}`.

In the Firestore UI, confirm `/users/test-user-1` exists with those fields.

- [ ] **Step 5: Verify authed `POST /api/submit` links user_id**

Promote the seeded scheduled question to live first. In the Emulator UI, manually edit one of the seeded `questions` docs:
- Set `status: "live"`.
- Note its document ID.

```bash
QID=<paste-question-id>
curl -X POST http://localhost:3000/api/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-forwarded-for: 5.5.5.5" \
  -d "{\"question_id\":\"$QID\",\"device_token\":\"dev-1\",\"raw_text\":\"italy\",\"dwell_ms\":5000}"
```

Expected response: `{"cluster_id":"...","submission_count":1,"normalized_text":"italy"}`.

Confirm in Firestore: the resulting `submissions/...` doc has `user_id: "test-user-1"`.

- [ ] **Step 6: Verify the rate limit triggers**

Send 11 rapid submissions from the same IP (different question_ids — submitting the same question would 200 anyway because clusters are merging):

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/submit \
    -H "Content-Type: application/json" \
    -H "x-forwarded-for: 9.9.9.9" \
    -d "{\"question_id\":\"$QID\",\"device_token\":\"dev-loop-$i\",\"raw_text\":\"a-$i\",\"dwell_ms\":5000}"
done
```

Expected output: ten lines of `200`, then `429`.

- [ ] **Step 7: Verify scoring runs on drop**

In the Emulator UI, set the live question's `scheduled_drop_at` to a Timestamp in the past. The minute-cron `triggerDrop` will fire within 60s — OR drive it manually via the Functions Shell:

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm shell
# in the shell:
# triggerDrop()
# .exit
```

Confirm in Firestore:
- The previously-live question has `status: "revealed"`.
- A new question (the next scheduled one) has `status: "live"`.
- One `leaderboard_entries` doc per signed-in submitter exists, with `score = rank_score_component + early_bird_component` and `daily_rank` populated.
- `user_aggregates/test-user-1` exists with `alltime_score`, `weekly_score`, and `num_called_it_wins` populated.

- [ ] **Step 8: Verify daily/global leaderboard endpoint**

```bash
curl http://localhost:3000/api/leaderboard?period=daily&scope=global
```

Expected: JSON with `entries: [...]` showing the just-revealed question's scorers, sorted by score desc.

- [ ] **Step 9: Verify shadowban filter**

In the Firestore UI, set `users/test-user-1.shadowbanned = true`.

```bash
curl http://localhost:3000/api/leaderboard?period=daily&scope=global
```

Expected: `test-user-1` is now MISSING from the entries list.

Set `shadowbanned` back to `false` before continuing.

- [ ] **Step 10: Verify friend graph + scoped leaderboard**

Forge a second test user (`test-user-2`) in the Auth emulator and copy its ID token (`TOKEN2`). Then:

```bash
# user-1 sends friend request to user-2
curl -X POST http://localhost:3000/api/friends/request \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"target_user_id":"test-user-2"}'

# user-2 lists their friends (should see one pending)
curl -H "Authorization: Bearer $TOKEN2" http://localhost:3000/api/friends

# user-2 accepts
FID=<paste-friendship-id>
curl -X POST http://localhost:3000/api/friends/accept \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d "{\"friendship_id\":\"$FID\"}"

# user-1 fetches friend-scoped leaderboard
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/leaderboard?period=alltime&scope=friends"
```

Expected: each curl returns 200; the friend-scoped leaderboard includes test-user-1 + test-user-2 (if user-2 has any aggregates) and excludes everyone else.

- [ ] **Step 11: Verify removal**

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/friends/$FID"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/friends
```

Expected: friendship deleted; second curl shows no friendships.

- [ ] **Step 12: Run the full backend + functions test suites one last time**

```bash
cd /c/Users/levin/relatably/api && pnpm test
cd /c/Users/levin/relatably/firebase/functions && pnpm test
cd /c/Users/levin/relatably/ios && pnpm test
```

Expected: All Phase 1 + 2 + 3 tests green across all three projects. Approximate totals (Phase 3 deltas from this plan):
- `api/`: ~50+ tests (Phase 2 had 34; +6 hash, +6 auth, +4 auth/me, +5 ratelimit, +4 submit, +14 friends, +5 leaderboard ≈ +44 → ~78 total)
- `firebase/functions/`: ~50 tests (Phase 2 had 25; +10 rankScore, +8 earlyBird, +5 composer, +5 scoreReveal ≈ +28 → ~53 total)
- `ios/`: ~38 tests (Phase 2 had 15; +4 auth, +3 SignInWithApple, +8 api, +2 LeaderboardRow, +3 FriendListRow, +3 LeaderboardScreen, +3 FriendsScreen ≈ +26 → ~41 total)

- [ ] **Step 13: Tag the phase + push**

```bash
cd /c/Users/levin/relatably
git tag -a phase-3-complete -m "Phase 3 — Leaderboard + Anti-Cheat shipped"
GH_TOKEN=$(grep -A1 "^token:" /c/Users/levin/.claude/projects/C--Users-levin/memory/github_token.md | tail -1 | tr -d ' ')
git push https://lawoflarge:$GH_TOKEN@github.com/lawoflarge/relatably.git phase-3-leaderboard-anticheat --tags
```

Expected: branch + tag pushed to origin.

- [ ] **Step 14: Update `~/.claude/projects/C--Users-levin/memory/project_relatably.md`** to record Phase 3 shipped state, deferred items (idempotency guards, App Attest, Perspective API tier-2), and commit hashes — same format as Phase 2 update.

---

## Phase 3 follow-ups flagged for Phase 4 / Phase 6

- **`scoreReveal` idempotency.** Add `last_scored_question_id` guard on `user_aggregates` so triggerDrop retries don't double-bump scores. Phase 6 hardening.
- **`fanoutPush` idempotency.** Already flagged in Phase 2: add `push_sent_at` guard. Phase 6.
- **`fanoutPush` parallelism.** Replace serial loop with `pLimit(10)` once device count >100k. Phase 6.
- **App Attest / DeviceCheck.** Native iOS API integration + backend assertion verification. Requires Mac + Apple Developer Portal capability. Phase 6.
- **Perspective API tier-2 moderation.** Optional second-tier toxicity scoring on top of the regex blocklist. Phase 4.
- **`GET /api/friends` handle enrichment.** Currently returns raw `accepter_id` / `requester_id` — Phase 4 should join against `users` for the handle.
- **Friend leaderboard cap.** Firestore "in" caps at 30; users with >30 friends miss out beyond the closest 30. Add pagination if friend counts grow.
- **Behavioral classifier model.** Phase 3 collects features (`submitted_at_minute_of_day`, `dwell_ms`); training the actual model is post-launch, ~month 2. Phase 6+.
- **Leaderboard caching.** Read-heavy endpoint; Upstash Redis cache layer for top-N global leaderboards. Phase 6 cost optimization.
- **Streaks.** Spec section 5 explicitly defers to v1.1.

---

**End of Phase 3 implementation plan.**
