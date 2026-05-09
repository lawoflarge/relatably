# Relatably v1.0 — Phase 4 Implementation Plan (Share + Monetization)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working share + monetization subsystem where (a) three share-card types (Today's take / Today's verdict / 👑 You called it) render at 9:16 and hand off to the iOS native share sheet via `react-native-view-shot`, (b) Branch.io install attribution is wired behind an env-flag adapter, (c) AdMob banner + interstitial placements are wired behind an env-flag adapter (3 placements: leaderboard banner, archive banner, post-reveal interstitial), (d) Perspective API tier-2 toxicity moderation runs **asynchronously** as a Cloud Function trigger after submit (kept off the submit hot path), (e) `GET /api/friends` enriches uids into `{ handle, locale }` (Phase 3 follow-up), and (f) `GET /api/leaderboard?scope=friends` paginates beyond Firestore's 30-uid `in` cap (Phase 3 follow-up).

**Architecture:** All third-party SDKs (AdMob, Branch.io, Perspective API) ship behind **env-flag adapters** so the rest of the codebase compiles + tests cleanly without real accounts. Production swap = config change. Backend Next.js 16 (under `api/`) gains `POST /api/share/track` (writes a referral event + returns a Branch deep-link payload) and refactors `GET /api/friends` + `GET /api/leaderboard` to enrich/paginate. Cloud Functions (under `firebase/functions/`) gain `moderationReview` — a Firestore `onDocumentCreated` trigger on `submissions/{id}` that calls Perspective API and, on toxic verdict, flips `moderation_status='blocked'` + decrements its cluster's `submission_count`. The iOS client gains a `lib/ads.ts` adapter, a `lib/branch.ts` adapter, a `lib/shareCard.ts` (`captureRef` + native share sheet), three `ShareCard*` components, banner placements on `LeaderboardScreen` + `ArchiveScreen`, an interstitial trigger after `RevealAnimation` completes, and share-button wiring on the Wordcloud + Reveal + 👑 Called-it surfaces.

**Tech Stack:** Vercel-hosted Next.js 16 (existing), Firebase Cloud Functions v2 (existing), `react-native-google-mobile-ads` ^15 (NEW, env-flag-loaded only when AdMob enabled), `react-native-branch` ^6 (NEW, env-flag-loaded only when Branch enabled), `react-native-view-shot` ^4 (NEW, mocked in tests), `expo-sharing` ^14 (NEW), Perspective API REST (env-flag-gated, mocked in tests via `globalThis.fetch` mock), `node:crypto` HMAC (referral signing), Vitest (backend tests, mocked), Jest + React Native Testing Library (iOS tests).

**Phase 4 acceptance criteria:** A developer running `firebase emulators:start --only firestore,auth,functions` plus `pnpm dev` in `api/` should be able to:

1. `POST /api/share/track` with `{ banner_type: "todays_take", question_id, share_target: "ig_story" }` returns a `referral_code` string verifiable via `verifyReferralCode()`, and a `share_events/{id}` doc lands in Firestore with `user_id` (or `null` if anonymous).
2. `GET /api/friends` returns `{ friendships: [{ id, friend_user_id, handle, locale, status }] }` (handle + locale joined from `users`); shadowbanned friends are filtered out.
3. `GET /api/leaderboard?scope=friends&period=daily` works for users with >30 accepted friends — server chunks the friend uid list into batches of 30, queries Firestore once per chunk, merges, sorts by score desc, limits, returns.
4. After a submission lands with `moderation_status='passed'`, the `moderationReview` Cloud Function fires (emulator-driven), calls a mocked Perspective API, and on a toxic verdict (a) flips `submissions/{id}.moderation_status='blocked'` + sets `tier2_reviewed_at`, (b) decrements its `answer_clusters/{cId}.submission_count` by 1 (never below 0). On a clean verdict it just stamps `tier2_reviewed_at`.
5. iOS client compiles with `react-native-google-mobile-ads`, `react-native-branch`, `react-native-view-shot`, and `expo-sharing` added. With `EXPO_PUBLIC_ADMOB_ENABLED=false` and `EXPO_PUBLIC_BRANCH_KEY=""` (the dev defaults), all 3 ad slots render placeholders, all share triggers no-op the Branch tracking but still capture + open the share sheet, and Jest tests pass.
6. All Cloud Functions code has green Vitest tests; all backend endpoints have green Vitest tests; all iOS lib + components have green Jest tests. **Target: ≥220 tests across the 3 codebases at end of Phase 4.**

**iOS-execution acceptance (deferred to Phase 6 / Mac):** Real AdMob impression delivery, real Branch.io install-attribution validation, real `react-native-view-shot` PNG capture on a physical iOS device, real iOS share-sheet handoff. Same deferral pattern as Phases 1–3 iOS deferrals.

---

## File Structure

```
relatably/
├── api/
│   ├── package.json                                (no deps added — Perspective + Branch are pure HTTP/HMAC)
│   └── src/
│       ├── lib/
│       │   ├── perspective.ts                      (NEW: pure HTTP wrapper around Perspective API)
│       │   ├── perspective.test.ts
│       │   ├── branch.ts                           (NEW: HMAC referral codes — sign + verify)
│       │   └── branch.test.ts
│       └── app/
│           └── api/
│               ├── share/
│               │   └── track/
│               │       ├── route.ts                (NEW: POST tracks share events, returns referral_code)
│               │       └── route.test.ts
│               ├── friends/
│               │   ├── route.ts                    (modify: enrich with handle+locale, drop shadowbanned)
│               │   └── route.test.ts               (modify)
│               └── leaderboard/
│                   ├── route.ts                    (modify: chunked friend-uid pagination beyond 30)
│                   └── route.test.ts               (modify)
├── firebase/
│   ├── firestore.rules                             (modify: add share_events server-only)
│   ├── firestore.indexes.json                      (modify: add share_events index)
│   └── functions/
│       └── src/
│           ├── lib/
│           │   ├── perspective.ts                  (NEW: same HTTP wrapper, duplicated from api/ — see decision note below)
│           │   ├── perspective.test.ts
│           │   ├── moderationReview.ts             (NEW: pure composer)
│           │   └── moderationReview.test.ts
│           ├── moderationReview.ts                 (NEW: Firestore onCreate trigger wrapper)
│           ├── moderationReview.emulator.test.ts
│           └── index.ts                            (modify: export moderationReview function)
└── ios/
    ├── package.json                                (modify: add react-native-google-mobile-ads, react-native-branch, react-native-view-shot, expo-sharing)
    ├── app.json                                    (modify: add ios.config.googleMobileAdsAppId, branch plugin)
    ├── src/
    │   ├── lib/
    │   │   ├── ads.ts                              (NEW: env-flagged AdMob adapter)
    │   │   ├── ads.test.ts
    │   │   ├── branch.ts                           (NEW: env-flagged Branch.io adapter)
    │   │   ├── branch.test.ts
    │   │   ├── shareCard.ts                        (NEW: captureRef + share sheet)
    │   │   ├── shareCard.test.ts
    │   │   ├── interstitialGate.ts                 (NEW: 1/user/day cap via SecureStore)
    │   │   ├── interstitialGate.test.ts
    │   │   └── api.ts                              (modify: add trackShare client)
    │   ├── components/
    │   │   ├── BannerAdSlot.tsx                    (NEW)
    │   │   ├── BannerAdSlot.test.tsx
    │   │   ├── ShareCardTodaysTake.tsx             (NEW)
    │   │   ├── ShareCardTodaysTake.test.tsx
    │   │   ├── ShareCardVerdict.tsx                (NEW)
    │   │   ├── ShareCardVerdict.test.tsx
    │   │   ├── ShareCardCalledIt.tsx               (NEW)
    │   │   ├── ShareCardCalledIt.test.tsx
    │   │   ├── ShareButton.tsx                     (NEW: pill + sheet trigger)
    │   │   └── ShareButton.test.tsx
    │   ├── screens/
    │   │   ├── ArchiveScreen.tsx                   (NEW: Phase-5-ready scaffold + banner-every-8 ad slot)
    │   │   ├── ArchiveScreen.test.tsx
    │   │   ├── LeaderboardScreen.tsx               (modify: BannerAdSlot between rows 10/11)
    │   │   └── LeaderboardScreen.test.tsx          (modify)
    │   └── types/
    │       └── api.ts                              (modify: enriched Friendship, ShareTrackRequest)
    └── app/
        └── (tabs)/
            ├── archive.tsx                         (modify: render ArchiveScreen)
            └── index.tsx                           (modify: trigger interstitial after reveal, render ShareButton on wordcloud)
```

**Why this layout:**
- Two `perspective.ts` copies (one in `api/src/lib/`, one in `firebase/functions/src/lib/`) is a deliberate duplicate-rather-than-share choice — the two npm projects don't share code via workspace, and the helper is small (~25 lines). Keeping each project self-contained avoids a workspace refactor mid-phase.
- The iOS adapter pattern (`ads.ts`, `branch.ts`, `shareCard.ts`) keeps the underlying SDKs lazy-loaded only when env flags are set. Tests never `require('react-native-google-mobile-ads')` directly.
- Share-card components are pure render trees so they unit-test with React Native Testing Library exactly like Phase 1's `RevealAnimation`. The `captureRef` + share-sheet integration lives in `shareCard.ts` and is mocked at the lib boundary.
- `interstitialGate.ts` mirrors Phase 2's `revealStore.ts` pattern (SecureStore prefix for daily idempotency).
- `share_events` is server-only — clients never read share counts directly, the same anti-cheat reasoning as Phase 3's `leaderboard_entries`.

---

## Task Map (Phase 4 = 17 tasks across ~2 weeks)

| Task | Subject | Depends on |
|---|---|---|
| 1 | Firestore rules + indexes update for `share_events` | — |
| 2 | TDD `api/src/lib/perspective.ts` (env-gated HTTP wrapper) | — |
| 3 | TDD `firebase/functions/src/lib/perspective.ts` (duplicate) + pure `moderationReview` composer | — |
| 4 | `moderationReview` Cloud Function (Firestore onCreate trigger) + emulator test + wire in `index.ts` | 1, 3 |
| 5 | API: `GET /api/friends` handle + locale enrichment + shadowban filter | — |
| 6 | API: `GET /api/leaderboard?scope=friends` chunked pagination >30 friends | — |
| 7 | TDD `api/src/lib/branch.ts` (HMAC referral signing + verification) | — |
| 8 | API: `POST /api/share/track` endpoint | 1, 7 |
| 9 | iOS: `lib/ads.ts` env-flagged AdMob adapter + tests | — |
| 10 | iOS: `lib/branch.ts` env-flagged Branch.io adapter + tests | — |
| 11 | iOS: `lib/interstitialGate.ts` (1/user/day SecureStore cap) | — |
| 12 | iOS: `BannerAdSlot` component + wire into `LeaderboardScreen` row 10/11 | 9 |
| 13 | iOS: `ArchiveScreen` Phase-5-ready scaffold + banner-every-8 + render in tab | 9, 12 |
| 14 | iOS: 3 `ShareCard*` components (TDD pure renders) | — |
| 15 | iOS: `lib/shareCard.ts` (captureRef + share sheet + Branch tracking) + `ShareButton` component | 7, 8, 10, 14 |
| 16 | iOS: wire share triggers (wordcloud + reveal + 👑 called-it) + post-reveal interstitial | 11, 12, 15 |
| 17 | Phase 4 acceptance gate (manual emulator + iOS test sweep) | all |

---

## Pre-flight: branch + accounts + native deferrals

The agent should verify before starting Task 1:

- [ ] **Confirm branch.** Run `git branch --show-current`. If on `phase-3-leaderboard-anticheat`, cut a new branch and tag the seed:

```powershell
cd C:\Users\levin\relatably
git checkout -b phase-4-share-monetization
git tag phase-4-plan-seed
git push https://lawoflarge:<GH_TOKEN>@github.com/lawoflarge/relatably.git phase-4-share-monetization --tags
```

The `<GH_TOKEN>` is in `~/.claude/projects/C--Users-levin/memory/github_token.md` — read it once and substitute. **Do not echo the token to the conversation.** Use PowerShell, not bash — `/usr/bin/bash` does not have git on PATH on this Windows machine.

- [ ] **Confirm Java + Node versions** (same as Phases 2+3):
  - `java -version` → 21+ (Microsoft OpenJDK at `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\`).
  - `node --version` → ≥ 20.

- [ ] **Account state surfaced to Levin in plan review.** AdMob, Branch.io, and Perspective API all need accounts that don't exist yet at plan time. **Phase 4 ships with all three behind env-flags so the build stays green:**
  - `EXPO_PUBLIC_ADMOB_ENABLED=false` (default) → `BannerAdSlot` renders a 50-pt-tall placeholder; `showInterstitial()` no-ops.
  - `EXPO_PUBLIC_BRANCH_KEY=""` (default) → `lib/branch.ts` no-ops on init + share-link generation; `POST /api/share/track` still writes the `share_events` doc but skips the Branch URL roundtrip.
  - `PERSPECTIVE_API_KEY=""` (default) → `moderationReview` Cloud Function exits early (skips Perspective, just stamps `tier2_reviewed_at`). Submissions stay `passed` from Phase 1's regex blocklist alone.
  Production swap is a Vercel env var update + a single Expo EAS env update + a Firebase Functions config update. **No code change.**

- [ ] **iOS native build deferred (same as Phases 1–3).** Levin is on Windows. AdMob impressions, Branch deep-link install attribution, real `captureRef` PNG output, and the iOS share sheet all require a Mac + TestFlight. Phase 4 ships unit-tested via mocks; real-device validation is Phase 6 alongside the App Store submission.

---

## Task 1: Firestore rules + indexes update for `share_events`

**Files:**
- Modify: `firebase/firestore.rules`
- Modify: `firebase/firestore.indexes.json`

`share_events` is server-only (clients call `POST /api/share/track`; direct SDK reads of share counts would let scrapers exfiltrate referral codes). One composite index on `(user_id, created_at desc)` covers the only query pattern Phase 4 + Phase 5 will run.

- [ ] **Step 1: Replace `firebase/firestore.rules` with the Phase 4 ruleset**

Open `firebase/firestore.rules` and add a new rule block before the closing `}` of the `match /databases/{database}/documents {` block (immediately after the `question_candidates` line):

```
    // SHARE_EVENTS: server-only. Clients call POST /api/share/track which
    // writes here using Firebase Admin. Direct SDK reads would expose
    // referral codes + shareCount aggregates.
    match /share_events/{id}             { allow read, write: if false; }
```

The full Phase 4 file (replace whole file content if easier — this is the canonical version):

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /questions/{questionId} {
      allow read: if resource.data.status in ['live', 'revealed'];
      allow write: if false;
    }

    match /answer_clusters/{clusterId} {
      allow read: if exists(/databases/$(database)/documents/questions/$(resource.data.question_id))
        && get(/databases/$(database)/documents/questions/$(resource.data.question_id)).data.status in ['live', 'revealed'];
      allow write: if false;
    }

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

    match /leaderboard_entries/{entryId} { allow read, write: if false; }
    match /user_aggregates/{userId}      { allow read, write: if false; }
    match /submissions/{id}              { allow read, write: if false; }
    match /device_users/{id}             { allow read, write: if false; }
    match /friendships/{id}              { allow read, write: if false; }
    match /question_candidates/{id}     { allow read, write: if false; }
    match /share_events/{id}             { allow read, write: if false; }
  }
}
```

- [ ] **Step 2: Add the share_events index**

Open `firebase/firestore.indexes.json` and append one index inside the `"indexes"` array (before the closing `]`):

```json
    {
      "collectionGroup": "share_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
```

- [ ] **Step 3: Boot the emulator to validate parsing**

```powershell
cd C:\Users\levin\relatably\firebase
$env:PATH = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin;" + $env:PATH
firebase emulators:start --only firestore
```

Expected: emulator boots without parse errors. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\levin\relatably
git add firebase/firestore.rules firebase/firestore.indexes.json
git commit -m "feat(firestore): rules + index for share_events (Phase 4)"
```

---

## Task 2: TDD `api/src/lib/perspective.ts` (env-gated HTTP wrapper)

**Files:**
- Create: `api/src/lib/perspective.ts`
- Create: `api/src/lib/perspective.test.ts`

Pure HTTP wrapper around the Perspective API `comments:analyze` endpoint. Returns `{ verdict: 'pass' | 'block', score, skipped }`. When `PERSPECTIVE_API_KEY` is unset, `skipped: true` is returned and `verdict: 'pass'` (fail-open — never block submissions because of a misconfigured backend). Threshold defaults to 0.85 on `TOXICITY` OR 0.5 on `SEVERE_TOXICITY` (whichever fires first), per spec section 6.

- [ ] **Step 1: Write the failing test**

Create `api/src/lib/perspective.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateToxicity, __resetPerspectiveForTest } from "./perspective";

const ORIGINAL_FETCH = globalThis.fetch;

describe("evaluateToxicity", () => {
  beforeEach(() => {
    __resetPerspectiveForTest();
    process.env.PERSPECTIVE_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.PERSPECTIVE_API_KEY;
  });

  it("returns skipped:true when PERSPECTIVE_API_KEY is unset", async () => {
    delete process.env.PERSPECTIVE_API_KEY;
    __resetPerspectiveForTest();
    const r = await evaluateToxicity("anything");
    expect(r).toEqual({ verdict: "pass", score: 0, skipped: true });
  });

  it("returns block when TOXICITY >= 0.85", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.92 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.10 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("you are an idiot");
    expect(r.verdict).toBe("block");
    expect(r.score).toBeCloseTo(0.92, 2);
    expect(r.skipped).toBe(false);
  });

  it("returns block when SEVERE_TOXICITY >= 0.50", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.40 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.55 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("severe slur here");
    expect(r.verdict).toBe("block");
  });

  it("returns pass when both scores below threshold", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.20 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.score).toBeCloseTo(0.20, 2);
  });

  it("fails open (pass) when Perspective returns non-ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.skipped).toBe(true);
  });

  it("fails open (pass) when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.skipped).toBe(true);
  });

  it("posts the comment text + requestedAttributes to the API URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.10 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
        },
      }),
    });
    globalThis.fetch = mockFetch as any;
    await evaluateToxicity("italy");
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("commentanalyzer.googleapis.com");
    expect(String(url)).toContain("key=test-key");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.comment.text).toBe("italy");
    expect(body.requestedAttributes).toEqual({ TOXICITY: {}, SEVERE_TOXICITY: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
cd C:\Users\levin\relatably\api
pnpm test src/lib/perspective.test.ts
```

Expected: FAIL — `Cannot find module './perspective'`.

- [ ] **Step 3: Write the implementation**

Create `api/src/lib/perspective.ts`:

```ts
const TOXICITY_THRESHOLD = 0.85;
const SEVERE_TOXICITY_THRESHOLD = 0.50;
const ENDPOINT =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

export interface ToxicityResult {
  verdict: "pass" | "block";
  score: number;
  skipped: boolean;
}

let cachedKey: string | undefined;

export function __resetPerspectiveForTest(): void {
  cachedKey = undefined;
}

function getKey(): string {
  if (cachedKey === undefined) cachedKey = process.env.PERSPECTIVE_API_KEY ?? "";
  return cachedKey;
}

export async function evaluateToxicity(text: string): Promise<ToxicityResult> {
  const key = getKey();
  if (!key) return { verdict: "pass", score: 0, skipped: true };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        languages: ["en"],
        requestedAttributes: { TOXICITY: {}, SEVERE_TOXICITY: {} },
      }),
    });
  } catch {
    return { verdict: "pass", score: 0, skipped: true };
  }

  if (!res.ok) return { verdict: "pass", score: 0, skipped: true };

  const json = (await res.json()) as {
    attributeScores?: {
      TOXICITY?: { summaryScore: { value: number } };
      SEVERE_TOXICITY?: { summaryScore: { value: number } };
    };
  };
  const tox = json.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
  const sev = json.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value ?? 0;

  const block = tox >= TOXICITY_THRESHOLD || sev >= SEVERE_TOXICITY_THRESHOLD;
  return {
    verdict: block ? "block" : "pass",
    score: Math.max(tox, sev),
    skipped: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```powershell
pnpm test src/lib/perspective.test.ts
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\levin\relatably
git add api/src/lib/perspective.ts api/src/lib/perspective.test.ts
git commit -m "feat(api): perspective.ts env-gated toxicity wrapper (TDD)"
```

---

## Task 3: TDD `firebase/functions/src/lib/perspective.ts` + pure `moderationReview` composer

**Files:**
- Create: `firebase/functions/src/lib/perspective.ts`
- Create: `firebase/functions/src/lib/perspective.test.ts`
- Create: `firebase/functions/src/lib/moderationReview.ts`
- Create: `firebase/functions/src/lib/moderationReview.test.ts`

Two NEW files in `functions/src/lib/`:

1. **`perspective.ts`** — byte-identical copy of `api/src/lib/perspective.ts` from Task 2. Yes, this is duplication. The two npm projects don't share code via workspace. The helper is small. Keep them in sync manually if Phase 5+ touches either copy. (Explicitly accepted scope decision — see plan-gate review notes.)
2. **`moderationReview.ts`** — pure composer that takes the fetched submission's `raw_text` + `cluster_id` and returns `{ verdict: 'pass'|'block', score, skipped }`. Phase 4 keeps this thin (just delegates to `evaluateToxicity`). The composer exists so Task 4's emulator test can mock the composer rather than the fetch boundary.

- [ ] **Step 1: Write the failing perspective test**

Create `firebase/functions/src/lib/perspective.test.ts` (identical structure to Task 2's test — just adjust the import path):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateToxicity, __resetPerspectiveForTest } from "./perspective";

const ORIGINAL_FETCH = globalThis.fetch;

describe("evaluateToxicity (functions)", () => {
  beforeEach(() => {
    __resetPerspectiveForTest();
    process.env.PERSPECTIVE_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.PERSPECTIVE_API_KEY;
  });

  it("returns skipped when key unset", async () => {
    delete process.env.PERSPECTIVE_API_KEY;
    __resetPerspectiveForTest();
    const r = await evaluateToxicity("anything");
    expect(r.skipped).toBe(true);
    expect(r.verdict).toBe("pass");
  });

  it("blocks on high TOXICITY", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.91 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.10 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("you are an idiot");
    expect(r.verdict).toBe("block");
  });

  it("passes on low scores", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.10 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
  });

  it("fails open on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("net down")) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.skipped).toBe(true);
  });
});
```

- [ ] **Step 2: Run + verify FAIL**

```powershell
cd C:\Users\levin\relatably\firebase\functions
pnpm test src/lib/perspective.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Write `firebase/functions/src/lib/perspective.ts`**

Create exactly the same file as `api/src/lib/perspective.ts` (Task 2 Step 3). The full content is reproduced here so the engineer doesn't need to flip back:

```ts
const TOXICITY_THRESHOLD = 0.85;
const SEVERE_TOXICITY_THRESHOLD = 0.50;
const ENDPOINT =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

export interface ToxicityResult {
  verdict: "pass" | "block";
  score: number;
  skipped: boolean;
}

let cachedKey: string | undefined;

export function __resetPerspectiveForTest(): void {
  cachedKey = undefined;
}

function getKey(): string {
  if (cachedKey === undefined) cachedKey = process.env.PERSPECTIVE_API_KEY ?? "";
  return cachedKey;
}

export async function evaluateToxicity(text: string): Promise<ToxicityResult> {
  const key = getKey();
  if (!key) return { verdict: "pass", score: 0, skipped: true };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        languages: ["en"],
        requestedAttributes: { TOXICITY: {}, SEVERE_TOXICITY: {} },
      }),
    });
  } catch {
    return { verdict: "pass", score: 0, skipped: true };
  }

  if (!res.ok) return { verdict: "pass", score: 0, skipped: true };

  const json = (await res.json()) as {
    attributeScores?: {
      TOXICITY?: { summaryScore: { value: number } };
      SEVERE_TOXICITY?: { summaryScore: { value: number } };
    };
  };
  const tox = json.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
  const sev = json.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value ?? 0;

  const block = tox >= TOXICITY_THRESHOLD || sev >= SEVERE_TOXICITY_THRESHOLD;
  return {
    verdict: block ? "block" : "pass",
    score: Math.max(tox, sev),
    skipped: false,
  };
}
```

- [ ] **Step 4: Run + PASS**

```powershell
pnpm test src/lib/perspective.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 5: Write the failing composer test**

Create `firebase/functions/src/lib/moderationReview.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./perspective", () => ({
  evaluateToxicity: vi.fn(),
}));

import { reviewSubmission } from "./moderationReview";
import { evaluateToxicity } from "./perspective";

describe("reviewSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the perspective verdict directly when block", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "block",
      score: 0.93,
      skipped: false,
    });
    const r = await reviewSubmission({ raw_text: "you idiot" });
    expect(r).toEqual({ verdict: "block", score: 0.93, skipped: false });
  });

  it("returns pass when verdict is pass", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "pass",
      score: 0.10,
      skipped: false,
    });
    const r = await reviewSubmission({ raw_text: "italy" });
    expect(r.verdict).toBe("pass");
  });

  it("returns skipped when perspective is skipped (no API key)", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "pass",
      score: 0,
      skipped: true,
    });
    const r = await reviewSubmission({ raw_text: "italy" });
    expect(r.skipped).toBe(true);
    expect(r.verdict).toBe("pass");
  });

  it("forwards raw_text to evaluateToxicity verbatim", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "pass",
      score: 0,
      skipped: false,
    });
    await reviewSubmission({ raw_text: "  Italy  " });
    expect(evaluateToxicity).toHaveBeenCalledWith("  Italy  ");
  });
});
```

- [ ] **Step 6: FAIL**

```powershell
pnpm test src/lib/moderationReview.test.ts
```

Expected: module missing.

- [ ] **Step 7: Implement composer**

Create `firebase/functions/src/lib/moderationReview.ts`:

```ts
import { evaluateToxicity, type ToxicityResult } from "./perspective";

export interface ReviewInput {
  raw_text: string;
}

export async function reviewSubmission(input: ReviewInput): Promise<ToxicityResult> {
  return evaluateToxicity(input.raw_text);
}
```

- [ ] **Step 8: PASS**

```powershell
pnpm test src/lib/moderationReview.test.ts
```

Expected: 4 tests green.

- [ ] **Step 9: Commit**

```powershell
cd C:\Users\levin\relatably
git add firebase/functions/src/lib/perspective.ts firebase/functions/src/lib/perspective.test.ts firebase/functions/src/lib/moderationReview.ts firebase/functions/src/lib/moderationReview.test.ts
git commit -m "feat(functions): perspective + moderationReview composer (TDD)"
```

---

## Task 4: `moderationReview` Cloud Function (Firestore onCreate trigger)

**Files:**
- Create: `firebase/functions/src/moderationReview.ts`
- Create: `firebase/functions/src/moderationReview.emulator.test.ts`
- Modify: `firebase/functions/src/index.ts`

A Firestore onDocumentCreated trigger on `submissions/{id}`. When a submission lands with `moderation_status='passed'` AND `tier2_reviewed_at` is unset, the function:

1. Reads the submission's `raw_text` and `normalized_cluster_id`.
2. Calls `reviewSubmission` (Task 3).
3. If `verdict === 'block'`: in a single transaction (a) updates the submission with `moderation_status='blocked'` + `tier2_reviewed_at` + `tier2_score`, (b) decrements the cluster's `submission_count` by 1 (`FieldValue.increment(-1)`), never below 0 — Firestore `increment` is unbounded, so the function pre-reads and skips the decrement if `submission_count <= 0` (defensive — should never happen but emulator-test asserts it).
4. If `verdict === 'pass'` (including `skipped`): updates only `tier2_reviewed_at` + `tier2_score`. The cluster is untouched.

**Idempotency.** The trigger checks `tier2_reviewed_at` before doing any work. Cloud Functions retry on failure; this guard prevents double-decrement on retry.

The test uses the Firestore emulator (same pattern as `triggerDrop.test.ts`). The Perspective composer is mocked at the import boundary so we don't hit the real API.

- [ ] **Step 1: Write the failing emulator test**

Create `firebase/functions/src/moderationReview.emulator.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { initializeApp, deleteApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

vi.mock("./lib/moderationReview", () => ({
  reviewSubmission: vi.fn(),
}));

import { runModerationReview } from "./moderationReview";
import { reviewSubmission } from "./lib/moderationReview";

let firestore: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT = "demo-relatably";
  if (getApps().length === 0) initializeApp({ projectId: "demo-relatably" });
  firestore = getFirestore();
});

async function clear(coll: string) {
  const snap = await firestore.collection(coll).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await clear("submissions");
  await clear("answer_clusters");
});

describe("runModerationReview (emulator)", () => {
  it("on toxic verdict: flips submission to blocked + decrements cluster count", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "block",
      score: 0.92,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 5,
      first_submission_at: FieldValue.serverTimestamp(),
    });
    await firestore.doc("submissions/sub-1").set({
      question_id: "q1",
      raw_text: "you idiot",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
      submitted_at: FieldValue.serverTimestamp(),
    });

    await runModerationReview(firestore, "sub-1");

    const sub = await firestore.doc("submissions/sub-1").get();
    expect(sub.data()?.moderation_status).toBe("blocked");
    expect(sub.data()?.tier2_score).toBeCloseTo(0.92, 2);
    expect(sub.data()?.tier2_reviewed_at).toBeDefined();

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    expect(cluster.data()?.submission_count).toBe(4);
  });

  it("on pass verdict: only stamps tier2_reviewed_at, leaves cluster + status alone", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "pass",
      score: 0.10,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 5,
    });
    await firestore.doc("submissions/sub-2").set({
      question_id: "q1",
      raw_text: "italy",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
    });

    await runModerationReview(firestore, "sub-2");

    const sub = await firestore.doc("submissions/sub-2").get();
    expect(sub.data()?.moderation_status).toBe("passed");
    expect(sub.data()?.tier2_reviewed_at).toBeDefined();
    expect(sub.data()?.tier2_score).toBeCloseTo(0.10, 2);

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    expect(cluster.data()?.submission_count).toBe(5);
  });

  it("idempotent: a second invocation on already-reviewed submission is a no-op", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "block",
      score: 0.92,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 5,
    });
    await firestore.doc("submissions/sub-3").set({
      question_id: "q1",
      raw_text: "you idiot",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
    });

    await runModerationReview(firestore, "sub-3");
    await runModerationReview(firestore, "sub-3");

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    // Decrement happened exactly once: 5 → 4, not 5 → 4 → 3.
    expect(cluster.data()?.submission_count).toBe(4);
    // reviewSubmission only called once (second invocation hit the guard).
    expect((reviewSubmission as any).mock.calls.length).toBe(1);
  });

  it("never lets cluster count go below 0", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "block",
      score: 0.92,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 0,
    });
    await firestore.doc("submissions/sub-4").set({
      question_id: "q1",
      raw_text: "you idiot",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
    });

    await runModerationReview(firestore, "sub-4");

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    expect(cluster.data()?.submission_count).toBe(0);
  });

  it("skips when submission has moderation_status != 'passed' (already blocked elsewhere)", async () => {
    await firestore.doc("submissions/sub-5").set({
      question_id: "q1",
      raw_text: "x",
      normalized_cluster_id: "cluster-A",
      moderation_status: "blocked",
    });

    await runModerationReview(firestore, "sub-5");

    expect((reviewSubmission as any).mock.calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
$env:PATH = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin;" + $env:PATH
cd C:\Users\levin\relatably\firebase
firebase emulators:start --only firestore --project demo-relatably
```

In a second PowerShell window:

```powershell
cd C:\Users\levin\relatably\firebase\functions
pnpm test src/moderationReview.emulator.test.ts
```

Expected: FAIL — `Cannot find module './moderationReview'`.

- [ ] **Step 3: Implement `runModerationReview` + Cloud Function wrapper**

Create `firebase/functions/src/moderationReview.ts`:

```ts
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { reviewSubmission } from "./lib/moderationReview";

interface SubmissionDoc {
  question_id: string;
  raw_text: string;
  normalized_cluster_id?: string;
  moderation_status: "passed" | "blocked";
  tier2_reviewed_at?: unknown;
}

/**
 * Re-evaluates a submission with Perspective API tier-2 toxicity check.
 * Idempotent via the `tier2_reviewed_at` guard.
 *
 * Phase 4 design decision: this runs ASYNC (off the submit hot path).
 * If Perspective is slow/down, the submit endpoint is unaffected.
 */
export async function runModerationReview(
  firestore: Firestore,
  submissionId: string,
): Promise<void> {
  const subRef = firestore.doc(`submissions/${submissionId}`);
  const subSnap = await subRef.get();
  if (!subSnap.exists) return;

  const sub = subSnap.data() as SubmissionDoc;
  if (sub.moderation_status !== "passed") return;
  if (sub.tier2_reviewed_at) return;
  if (!sub.normalized_cluster_id) return;

  const verdict = await reviewSubmission({ raw_text: sub.raw_text });

  if (verdict.verdict === "pass") {
    await subRef.update({
      tier2_reviewed_at: FieldValue.serverTimestamp(),
      tier2_score: verdict.score,
    });
    return;
  }

  // Block path: transactional submission update + cluster decrement.
  const clusterRef = firestore.doc(`answer_clusters/${sub.normalized_cluster_id}`);
  await firestore.runTransaction(async (tx) => {
    const clusterSnap = await tx.get(clusterRef);
    const subRecheck = await tx.get(subRef);
    if ((subRecheck.data() as SubmissionDoc | undefined)?.tier2_reviewed_at) {
      // Concurrent retry — bail out idempotently.
      return;
    }
    tx.update(subRef, {
      moderation_status: "blocked",
      tier2_reviewed_at: FieldValue.serverTimestamp(),
      tier2_score: verdict.score,
    });
    const prevCount =
      (clusterSnap.data() as { submission_count?: number } | undefined)
        ?.submission_count ?? 0;
    if (prevCount > 0) {
      tx.update(clusterRef, {
        submission_count: FieldValue.increment(-1),
      });
    }
  });

  logger.info("moderationReview: blocked submission", {
    submissionId,
    score: verdict.score,
  });
}

/**
 * v2 Firestore trigger — fires on submission create. Async tier-2 review.
 */
export const moderationReview = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    region: "us-central1",
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    await runModerationReview(db(), submissionId);
  },
);
```

- [ ] **Step 4: Wire into `index.ts`**

Open `firebase/functions/src/index.ts` and add the export. The existing file (Phase 3) should now look like:

```ts
export { prepareNextDrop } from "./prepareNextDrop";
export { triggerDrop } from "./triggerDrop";
export { fanoutPush } from "./fanoutPush";
export { moderationReview } from "./moderationReview";
```

- [ ] **Step 5: Run test to verify it passes**

```powershell
cd C:\Users\levin\relatably\firebase\functions
pnpm test src/moderationReview.emulator.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 6: Run full functions test suite**

```powershell
pnpm test
```

Expected: All Phase 2 + Phase 3 + Phase 4 tests green. Total ≥ 62 tests.

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\levin\relatably
git add firebase/functions/src/moderationReview.ts firebase/functions/src/moderationReview.emulator.test.ts firebase/functions/src/index.ts
git commit -m "feat(functions): moderationReview onCreate trigger (Perspective tier-2, async)"
```

---

## Task 5: API — `GET /api/friends` handle + locale enrichment

**Files:**
- Modify: `api/src/app/api/friends/route.ts`
- Modify: `api/src/app/api/friends/route.test.ts`

Phase 3 ships `GET /api/friends` returning `[{ id, requester_id, accepter_id, status }]` with raw uids. Phase 4 enriches the response with the *other* party's handle + locale (computed as `friend_user_id = (uid === requester_id) ? accepter_id : requester_id`), and drops shadowbanned friends. Reuses the same per-doc `users` lookup pattern as `joinUsersAndFilterShadowbanned` in `leaderboard/route.ts`.

The new response shape (also drives Task 5b iOS type update):

```ts
{
  friendships: [{
    id: string;
    friend_user_id: string;
    handle: string | null;
    locale: string;
    status: "pending" | "accepted";
    direction: "incoming" | "outgoing";
  }]
}
```

`direction` lets the iOS `FriendsScreen` keep showing the Accept button on incoming pending requests without re-deriving from raw uids.

- [ ] **Step 1: Write the failing test**

Replace `api/src/app/api/friends/route.test.ts` entirely (it's currently a small Phase 3 file). The new file:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  const mockCollection = vi.fn();
  return {
    adminFirestore: { collection: mockCollection },
    adminAuth: { verifyIdToken: vi.fn() },
  };
});

import { GET } from "./route";
import { adminFirestore, adminAuth } from "@/lib/firebase";

const buildRequest = (auth?: string) =>
  new Request("http://localhost/api/friends", {
    method: "GET",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });

describe("GET /api/friends (enriched)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects without auth", async () => {
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it("returns enriched outgoing + incoming friendships, drops shadowbanned", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });

    // Two outgoing accepted friendships (me → A, me → SHADOW).
    const outgoingDocs = [
      { id: "f1", data: () => ({ requester_id: "me", accepter_id: "A", status: "accepted" }) },
      { id: "f3", data: () => ({ requester_id: "me", accepter_id: "SHADOW", status: "accepted" }) },
    ];
    // One incoming pending friendship (B → me).
    const incomingDocs = [
      { id: "f2", data: () => ({ requester_id: "B", accepter_id: "me", status: "pending" }) },
    ];

    const userDocs: Record<string, any> = {
      A: { exists: true, data: () => ({ handle: "alice", is_public: true, shadowbanned: false, locale: "en" }) },
      B: { exists: true, data: () => ({ handle: "bob",   is_public: true, shadowbanned: false, locale: "de" }) },
      SHADOW: { exists: true, data: () => ({ handle: "shadow", is_public: true, shadowbanned: true, locale: "en" }) },
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockImplementation(function (this: any) {
            // Distinguish outgoing vs incoming by the order of where() calls.
            // The route runs them in parallel via Promise.all, so we use call count:
            const callIndex = (this as any)._friendshipsGetCount ?? 0;
            (this as any)._friendshipsGetCount = callIndex + 1;
            // First .get() = outgoing, second = incoming. But because both queries
            // are built off the same chained mock, we use a stateful counter on
            // the module itself instead.
            return Promise.resolve({ docs: callIndex === 0 ? outgoingDocs : incomingDocs });
          }),
        };
      }
      if (name === "users") {
        return {
          doc: vi.fn((uid: string) => ({
            get: vi.fn().mockResolvedValue(userDocs[uid] ?? { exists: false }),
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(buildRequest("token-me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // SHADOW friend dropped.
    expect(body.friendships).toHaveLength(2);

    const a = body.friendships.find((f: any) => f.friend_user_id === "A");
    expect(a).toMatchObject({
      id: "f1",
      friend_user_id: "A",
      handle: "alice",
      locale: "en",
      status: "accepted",
      direction: "outgoing",
    });

    const b = body.friendships.find((f: any) => f.friend_user_id === "B");
    expect(b).toMatchObject({
      id: "f2",
      friend_user_id: "B",
      handle: "bob",
      locale: "de",
      status: "pending",
      direction: "incoming",
    });
  });

  it("drops friendships whose target user doc is missing", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });
    const outgoingDocs = [
      { id: "f1", data: () => ({ requester_id: "me", accepter_id: "GHOST", status: "accepted" }) },
    ];
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn()
            .mockResolvedValueOnce({ docs: outgoingDocs })
            .mockResolvedValueOnce({ docs: [] }),
        };
      }
      if (name === "users") {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(buildRequest("token-me"));
    const body = await res.json();
    expect(body.friendships).toHaveLength(0);
  });
});
```

> Implementation note: the test above uses `mockResolvedValueOnce` for the `friendships` `.get()` calls in the second test (cleaner than the stateful counter). Apply the same pattern to the first test if the counter approach is brittle in your CI environment — both tests assert behaviour, not call shape.

- [ ] **Step 2: Run + verify FAIL**

```powershell
cd C:\Users\levin\relatably\api
pnpm test src/app/api/friends/route.test.ts
```

Expected: tests fail because old shape mismatches (response missing `friend_user_id`, `handle`, `locale`, `direction`).

- [ ] **Step 3: Replace `api/src/app/api/friends/route.ts`**

```ts
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

interface FriendshipRow {
  id: string;
  friend_user_id: string;
  handle: string | null;
  locale: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
}

interface UserDoc {
  handle: string | null;
  is_public: boolean;
  shadowbanned: boolean;
  locale: string;
}

async function joinUser(uid: string): Promise<UserDoc | null> {
  const snap = await adminFirestore.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as UserDoc;
}

export async function GET(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = decoded.uid;

  const friendsRef = adminFirestore.collection("friendships");
  const [outgoingSnap, incomingSnap] = await Promise.all([
    friendsRef
      .where("requester_id", "==", me)
      .where("status", "in", ["pending", "accepted"])
      .get(),
    friendsRef
      .where("accepter_id", "==", me)
      .where("status", "in", ["pending", "accepted"])
      .get(),
  ]);

  const out: FriendshipRow[] = [];

  for (const d of outgoingSnap.docs) {
    const data = d.data() as { requester_id: string; accepter_id: string; status: "pending" | "accepted" };
    const u = await joinUser(data.accepter_id);
    if (!u || u.shadowbanned) continue;
    out.push({
      id: d.id,
      friend_user_id: data.accepter_id,
      handle: u.handle,
      locale: u.locale,
      status: data.status,
      direction: "outgoing",
    });
  }

  for (const d of incomingSnap.docs) {
    const data = d.data() as { requester_id: string; accepter_id: string; status: "pending" | "accepted" };
    const u = await joinUser(data.requester_id);
    if (!u || u.shadowbanned) continue;
    out.push({
      id: d.id,
      friend_user_id: data.requester_id,
      handle: u.handle,
      locale: u.locale,
      status: data.status,
      direction: "incoming",
    });
  }

  return NextResponse.json({ friendships: out });
}
```

- [ ] **Step 4: PASS**

```powershell
pnpm test src/app/api/friends/route.test.ts
```

Expected: 3 tests green.

- [ ] **Step 5: Update iOS `Friendship` type to match**

Open `ios/src/types/api.ts` and replace the `Friendship` interface:

```ts
export interface Friendship {
  id: string;
  friend_user_id: string;
  handle: string | null;
  locale: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
}
```

- [ ] **Step 6: Update iOS `FriendsScreen` + `FriendListRow` to render handle**

The Phase 3 plan flagged this — `FriendsScreen` currently renders raw `requester_id`/`accepter_id`. Open `ios/src/screens/FriendsScreen.tsx` and replace the render to use the new shape (the file is small; full rewrite):

```tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { FriendListRow } from "@/src/components/FriendListRow";
import { fetchFriends, acceptFriend } from "@/src/lib/api";
import type { Friendship } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
}

export function FriendsScreen({ isSignedIn }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    fetchFriends()
      .then((res) => setFriendships(res.friendships))
      .catch(() => setFriendships([]))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const onAccept = async (id: string) => {
    await acceptFriend(id);
    const next = await fetchFriends();
    setFriendships(next.friendships);
  };

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>sign in to see friends</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>loading…</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.root}
      data={friendships}
      keyExtractor={(f) => f.id}
      renderItem={({ item }) => (
        <FriendListRow
          friendship={item}
          onAccept={item.direction === "incoming" && item.status === "pending" ? () => onAccept(item.id) : undefined}
        />
      )}
      ListEmptyComponent={<Text style={styles.muted}>no friends yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  muted: { color: "#888", fontSize: 14, padding: 16 },
});
```

Open `ios/src/components/FriendListRow.tsx` and replace with:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Friendship } from "@/src/types/api";

interface Props {
  friendship: Friendship;
  onAccept?: () => void;
}

export function FriendListRow({ friendship, onAccept }: Props) {
  const display = friendship.handle ?? `@${friendship.friend_user_id.slice(0, 6)}`;
  return (
    <View style={styles.row}>
      <Text style={styles.handle}>{display}</Text>
      <Text style={styles.status}>{friendship.status}</Text>
      {onAccept && (
        <Pressable onPress={onAccept} style={styles.acceptBtn} role="button">
          <Text style={styles.acceptLabel}>ACCEPT</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: "#222", borderBottomWidth: 1 },
  handle: { color: "#fff", fontSize: 16, flex: 1 },
  status: { color: "#888", fontSize: 12, marginRight: 12 },
  acceptBtn: { backgroundColor: "#aaff00", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  acceptLabel: { color: "#000", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
});
```

- [ ] **Step 7: Update iOS tests for the new shape**

Open `ios/src/components/FriendListRow.test.tsx` and rewrite the tests to use the new `friendship` prop:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import { FriendListRow } from "./FriendListRow";

const baseFriendship = {
  id: "f1",
  friend_user_id: "u-2",
  handle: "alice",
  locale: "en",
  status: "accepted" as const,
  direction: "outgoing" as const,
};

describe("FriendListRow", () => {
  it("renders the handle", () => {
    const { getByText } = render(<FriendListRow friendship={baseFriendship} />);
    expect(getByText("alice")).toBeTruthy();
  });

  it("falls back to @<short-uid> when handle is null", () => {
    const f = { ...baseFriendship, handle: null };
    const { getByText } = render(<FriendListRow friendship={f} />);
    expect(getByText(/@u-2/)).toBeTruthy();
  });

  it("shows ACCEPT button only when onAccept provided", () => {
    const onAccept = jest.fn();
    const { getByText, queryByText, rerender } = render(
      <FriendListRow friendship={baseFriendship} onAccept={onAccept} />,
    );
    fireEvent.press(getByText("ACCEPT"));
    expect(onAccept).toHaveBeenCalled();

    rerender(<FriendListRow friendship={baseFriendship} />);
    expect(queryByText("ACCEPT")).toBeNull();
  });
});
```

Open `ios/src/screens/FriendsScreen.test.tsx` and rewrite (full file):

```tsx
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { FriendsScreen } from "./FriendsScreen";

jest.mock("@/src/lib/api", () => ({
  fetchFriends: jest.fn(),
  acceptFriend: jest.fn(),
}));

import { fetchFriends, acceptFriend } from "@/src/lib/api";

describe("FriendsScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows sign-in hint when not signed in", () => {
    const { getByText } = render(<FriendsScreen isSignedIn={false} />);
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  it("renders friendships from API", async () => {
    (fetchFriends as jest.Mock).mockResolvedValue({
      friendships: [
        { id: "f1", friend_user_id: "u-2", handle: "alice", locale: "en", status: "accepted", direction: "outgoing" },
      ],
    });
    const { getByText } = render(<FriendsScreen isSignedIn={true} />);
    await waitFor(() => expect(getByText("alice")).toBeTruthy());
  });

  it("calls acceptFriend on incoming-pending row Accept", async () => {
    (fetchFriends as jest.Mock).mockResolvedValueOnce({
      friendships: [
        { id: "f2", friend_user_id: "u-3", handle: "bob", locale: "de", status: "pending", direction: "incoming" },
      ],
    });
    (fetchFriends as jest.Mock).mockResolvedValueOnce({ friendships: [] });
    (acceptFriend as jest.Mock).mockResolvedValue({ id: "f2", status: "accepted" });
    const { getByText, findByText } = render(<FriendsScreen isSignedIn={true} />);
    fireEvent.press(await findByText("ACCEPT"));
    await waitFor(() => expect(acceptFriend).toHaveBeenCalledWith("f2"));
  });
});
```

- [ ] **Step 8: Run iOS tests**

```powershell
cd C:\Users\levin\relatably\ios
pnpm test
```

Expected: All Phase 1+2+3 iOS tests + the rewritten FriendsScreen + FriendListRow tests pass.

- [ ] **Step 9: Commit**

```powershell
cd C:\Users\levin\relatably
git add api/src/app/api/friends/route.ts api/src/app/api/friends/route.test.ts ios/src/types/api.ts ios/src/screens/FriendsScreen.tsx ios/src/screens/FriendsScreen.test.tsx ios/src/components/FriendListRow.tsx ios/src/components/FriendListRow.test.tsx
git commit -m "feat(api+ios): GET /api/friends handle+locale enrichment + iOS rewrite"
```

---

## Task 6: API — `GET /api/leaderboard?scope=friends` chunked pagination beyond 30 friends

**Files:**
- Modify: `api/src/app/api/leaderboard/route.ts`
- Modify: `api/src/app/api/leaderboard/route.test.ts`

Phase 3 caps friend-scope leaderboards at the first 30 friend uids (`friendUids.slice(0, 30)`) because Firestore's `in` operator caps at 30. Phase 4 chunks the friend uid list into batches of 30, runs one query per batch, merges results, sorts by score desc + submitted_at asc, applies the user-supplied `limit`.

For `daily` period (queries `leaderboard_entries`): query becomes N parallel `where("user_id", "in", chunk)` queries, scoped to the latest revealed `question_id`. Merge + sort + slice to limit.

For `weekly` / `alltime` period (queries `user_aggregates`): each chunk uses `where("__name__", "in", chunk)`. Same merge + sort + slice.

This keeps Firestore's per-query `in` cap intact and gives correct results for users with up to ~300 friends (10 chunks × 30 = 300; beyond that, Phase 5+ ships proper cursor pagination).

- [ ] **Step 1: Write the failing test (extend the existing route.test.ts)**

Open `api/src/app/api/leaderboard/route.test.ts` and append a new `describe` block at the end of the file (keep all Phase 3 tests intact):

```ts
describe("GET /api/leaderboard friend-scope chunked pagination (>30 friends)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daily scope=friends with 45 friends queries leaderboard_entries in 2 chunks", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });

    // 44 friends, plus self = 45 uids. Will chunk to 30 + 15.
    const friendUids = Array.from({ length: 44 }, (_, i) => `friend-${i}`);

    // Latest revealed question.
    const questionsCollection = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: "q-latest" }],
      }),
    };

    // Friendships.
    const friendshipsCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn()
        .mockResolvedValueOnce({ docs: friendUids.slice(0, 22).map((u, i) => ({ id: `out-${i}`, data: () => ({ accepter_id: u }) })) })
        .mockResolvedValueOnce({ docs: friendUids.slice(22).map((u, i) => ({ id: `in-${i}`, data: () => ({ requester_id: u }) })) }),
    };

    // Track which "in" chunks the route asks for.
    const inChunks: string[][] = [];

    const leaderboardCollection = {
      where: vi.fn().mockImplementation(function (this: any, field: string, op: string, val: unknown) {
        if (field === "user_id" && op === "in") inChunks.push(val as string[]);
        return this;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => {
        // Each chunk returns 1 dummy entry.
        return Promise.resolve({
          docs: [
            { data: () => ({ user_id: `chunk-uid-${inChunks.length}`, score: 100 - inChunks.length, daily_rank: inChunks.length }) },
          ],
        });
      }),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions")             return questionsCollection;
      if (name === "friendships")           return friendshipsCollection;
      if (name === "leaderboard_entries")   return leaderboardCollection;
      if (name === "users") {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ handle: "x", is_public: true, shadowbanned: false, locale: "en" }),
            }),
          })),
        };
      }
      if (name === "user_aggregates") return {};
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(
      new Request("http://localhost/api/leaderboard?scope=friends&period=daily&limit=50", {
        headers: { authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(200);
    // 45 uids → 2 chunks (30, 15).
    expect(inChunks).toHaveLength(2);
    expect(inChunks[0]).toHaveLength(30);
    expect(inChunks[1]).toHaveLength(15);

    const body = await res.json();
    // Two chunks, each returning 1 entry, both kept after sort+limit.
    expect(body.entries).toHaveLength(2);
  });

  it("weekly scope=friends chunks user_aggregates by __name__", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });
    const friendUids = Array.from({ length: 31 }, (_, i) => `friend-${i}`);

    const friendshipsCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn()
        .mockResolvedValueOnce({ docs: friendUids.map((u, i) => ({ id: `out-${i}`, data: () => ({ accepter_id: u }) })) })
        .mockResolvedValueOnce({ docs: [] }),
    };

    const inChunks: string[][] = [];
    const aggregatesCollection = {
      where: vi.fn().mockImplementation(function (this: any, field: string, op: string, val: unknown) {
        if (field === "__name__" && op === "in") inChunks.push(val as string[]);
        return this;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => {
        return Promise.resolve({ docs: [] });
      }),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships")     return friendshipsCollection;
      if (name === "user_aggregates") return aggregatesCollection;
      if (name === "users")           return { doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(
      new Request("http://localhost/api/leaderboard?scope=friends&period=weekly&limit=50", {
        headers: { authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(200);
    // 32 uids (31 friends + self) → 2 chunks (30, 2).
    expect(inChunks).toHaveLength(2);
    expect(inChunks[0]).toHaveLength(30);
    expect(inChunks[1]).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run + verify FAIL**

```powershell
cd C:\Users\levin\relatably\api
pnpm test src/app/api/leaderboard/route.test.ts
```

Expected: FAIL — Phase 3 implementation does `slice(0, 30)`.

- [ ] **Step 3: Replace `api/src/app/api/leaderboard/route.ts`**

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
const FIRESTORE_IN_CAP = 30;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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
  outgoing.docs.forEach((d: any) => out.push((d.data() as { accepter_id: string }).accepter_id));
  incoming.docs.forEach((d: any) => out.push((d.data() as { requester_id: string }).requester_id));
  return Array.from(new Set(out));
}

interface JoinedEntry {
  user_id: string;
  handle: string | null;
  score: number;
  daily_rank?: number;
  locale: string;
}

async function joinUsersAndFilterShadowbanned(
  rows: { user_id: string; score: number; daily_rank?: number }[],
): Promise<JoinedEntry[]> {
  const out: JoinedEntry[] = [];
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

    if (friendUids) {
      const chunks = chunk(friendUids, FIRESTORE_IN_CAP);
      const results = await Promise.all(
        chunks.map(async (c) => {
          const snap = await adminFirestore
            .collection("leaderboard_entries")
            .where("question_id", "==", qid)
            .where("user_id", "in", c)
            .orderBy("score", "desc")
            .orderBy("submitted_at", "asc")
            .limit(limit)
            .get();
          return snap.docs.map((d: any) => {
            const data = d.data() as LeaderboardEntryDoc;
            return { user_id: data.user_id, score: data.score, daily_rank: data.daily_rank, submitted_at_ms: data.submitted_at?.toMillis() ?? 0 };
          });
        }),
      );
      rows = results.flat()
        .sort((a, b) => b.score - a.score || a.submitted_at_ms - b.submitted_at_ms)
        .slice(0, limit)
        .map(({ user_id, score, daily_rank }) => ({ user_id, score, daily_rank }));
    } else {
      const snap = await adminFirestore
        .collection("leaderboard_entries")
        .where("question_id", "==", qid)
        .orderBy("score", "desc")
        .orderBy("submitted_at", "asc")
        .limit(limit)
        .get();
      rows = snap.docs.map((d: any) => {
        const data = d.data() as LeaderboardEntryDoc;
        return { user_id: data.user_id, score: data.score, daily_rank: data.daily_rank };
      });
    }
  } else {
    const field = period === "weekly" ? "weekly_score" : "alltime_score";

    if (friendUids) {
      const chunks = chunk(friendUids, FIRESTORE_IN_CAP);
      const results = await Promise.all(
        chunks.map(async (c) => {
          const snap = await adminFirestore
            .collection("user_aggregates")
            .where("__name__", "in", c)
            .orderBy(field, "desc")
            .limit(limit)
            .get();
          return snap.docs.map((d: any) => {
            const data = d.data() as Record<string, number>;
            return { user_id: d.id, score: data[field] ?? 0 };
          });
        }),
      );
      rows = results.flat()
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } else {
      const snap = await adminFirestore
        .collection("user_aggregates")
        .orderBy(field, "desc")
        .limit(limit)
        .get();
      rows = snap.docs.map((d: any) => {
        const data = d.data() as Record<string, number>;
        return { user_id: d.id, score: data[field] ?? 0 };
      });
    }
  }

  const entries = await joinUsersAndFilterShadowbanned(rows);
  return NextResponse.json({ entries });
}
```

- [ ] **Step 4: PASS**

```powershell
pnpm test src/app/api/leaderboard/route.test.ts
```

Expected: All Phase 3 leaderboard tests + the 2 new chunking tests pass.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\levin\relatably
git add api/src/app/api/leaderboard/route.ts api/src/app/api/leaderboard/route.test.ts
git commit -m "feat(api): leaderboard friend-scope chunked pagination beyond 30 friends"
```

---

## Task 7: TDD `api/src/lib/branch.ts` (HMAC referral signing)

**Files:**
- Create: `api/src/lib/branch.ts`
- Create: `api/src/lib/branch.test.ts`

Pure helper for signing + verifying referral codes. The codes are server-side stamps that travel inside Branch.io deep links — Branch carries them through install → first-open, and the iOS client posts them back so the server can credit the referrer. Format:

```
<base64url(payload)>.<base64url(hmac-sha256(payload, BRANCH_REFERRAL_SECRET))>
```

Where `payload = JSON.stringify({ user_id, question_id, banner_type, ts })`.

When `BRANCH_REFERRAL_SECRET` env is unset, signing returns a fixed dev token `"dev-referral.dev"` and verification accepts it (so dev/test environments work without Branch credentials).

- [ ] **Step 1: Write the failing test**

Create `api/src/lib/branch.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signReferralCode, verifyReferralCode, __resetBranchForTest } from "./branch";

describe("branch referral codes", () => {
  beforeEach(() => __resetBranchForTest());
  afterEach(() => {
    delete process.env.BRANCH_REFERRAL_SECRET;
    __resetBranchForTest();
  });

  it("signs a payload and verifies it round-trips", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1700000000000,
    });
    expect(code).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const decoded = verifyReferralCode(code);
    expect(decoded).toEqual({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1700000000000,
    });
  });

  it("returns null when signature is tampered with", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1,
    });
    const [payload] = code.split(".");
    expect(verifyReferralCode(`${payload}.tampered_sig`)).toBeNull();
  });

  it("returns null on malformed code", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    expect(verifyReferralCode("not-a-code")).toBeNull();
    expect(verifyReferralCode("")).toBeNull();
  });

  it("uses dev fallback when BRANCH_REFERRAL_SECRET unset", () => {
    delete process.env.BRANCH_REFERRAL_SECRET;
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1,
    });
    expect(code).toBe("dev-referral.dev");
    expect(verifyReferralCode("dev-referral.dev")).toEqual({
      user_id: null,
      question_id: null,
      banner_type: null,
      ts: 0,
      dev: true,
    });
  });

  it("treats null user_id as anonymous referral (still signed)", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: null,
      question_id: "q-1",
      banner_type: "verdict",
      ts: 42,
    });
    const decoded = verifyReferralCode(code);
    expect(decoded).toMatchObject({ user_id: null, banner_type: "verdict" });
  });
});
```

- [ ] **Step 2: FAIL**

```powershell
cd C:\Users\levin\relatably\api
pnpm test src/lib/branch.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement**

Create `api/src/lib/branch.ts`:

```ts
import { createHmac } from "node:crypto";

export type BannerType = "todays_take" | "verdict" | "called_it";

export interface ReferralPayload {
  user_id: string | null;
  question_id: string;
  banner_type: BannerType;
  ts: number;
}

export interface VerifiedReferral {
  user_id: string | null;
  question_id: string | null;
  banner_type: BannerType | null;
  ts: number;
  dev?: boolean;
}

let cachedSecret: string | undefined;

export function __resetBranchForTest(): void {
  cachedSecret = undefined;
}

function getSecret(): string {
  if (cachedSecret === undefined) cachedSecret = process.env.BRANCH_REFERRAL_SECRET ?? "";
  return cachedSecret;
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer | null {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + padding, "base64");
  } catch {
    return null;
  }
}

export function signReferralCode(payload: ReferralPayload): string {
  const secret = getSecret();
  if (!secret) return "dev-referral.dev";
  const json = JSON.stringify(payload);
  const payloadEncoded = b64urlEncode(json);
  const sig = createHmac("sha256", secret).update(payloadEncoded).digest();
  return `${payloadEncoded}.${b64urlEncode(sig)}`;
}

export function verifyReferralCode(code: string): VerifiedReferral | null {
  if (code === "dev-referral.dev") {
    return { user_id: null, question_id: null, banner_type: null, ts: 0, dev: true };
  }
  const secret = getSecret();
  if (!secret) return null;
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [payloadEncoded, sigEncoded] = parts;
  const expectedSig = b64urlEncode(
    createHmac("sha256", secret).update(payloadEncoded).digest(),
  );
  // Constant-time compare via length check + char-by-char.
  if (expectedSig.length !== sigEncoded.length) return null;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ sigEncoded.charCodeAt(i);
  }
  if (diff !== 0) return null;

  const decoded = b64urlDecode(payloadEncoded);
  if (!decoded) return null;
  try {
    const obj = JSON.parse(decoded.toString("utf8")) as ReferralPayload;
    return {
      user_id: obj.user_id ?? null,
      question_id: obj.question_id,
      banner_type: obj.banner_type,
      ts: obj.ts,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: PASS**

```powershell
pnpm test src/lib/branch.test.ts
```

Expected: 5 tests green.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\levin\relatably
git add api/src/lib/branch.ts api/src/lib/branch.test.ts
git commit -m "feat(api): branch.ts HMAC referral code signer + verifier (TDD)"
```

---

## Task 8: API — `POST /api/share/track` endpoint

**Files:**
- Create: `api/src/app/api/share/track/route.ts`
- Create: `api/src/app/api/share/track/route.test.ts`

Endpoint receives `{ banner_type, question_id, share_target }` from iOS after a share is initiated. Auth-optional — anonymous users get `user_id: null` in the share_event doc + a dev referral code (still useful for "did the install attribute" telemetry, just without a user-level referrer credit).

Writes to `share_events/{auto-id}` and returns `{ referral_code }`.

```
share_events/{id}:
  user_id?: string,         // null if anonymous
  question_id: string,
  banner_type: 'todays_take' | 'verdict' | 'called_it',
  share_target: 'ig_story' | 'tiktok' | 'snap' | 'imessage' | 'system',
  referral_code: string,
  created_at: serverTimestamp,
  ip_hash: string,
```

- [ ] **Step 1: Write the failing test**

Create `api/src/app/api/share/track/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
  },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminFirestore, adminAuth } from "@/lib/firebase";

const buildRequest = (body: unknown, auth?: string) =>
  new Request("http://localhost/api/share/track", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe("POST /api/share/track", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
  });

  it("rejects malformed body", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects unsupported banner_type", async () => {
    const res = await POST(
      buildRequest({ banner_type: "billboard", question_id: "q1", share_target: "ig_story" }),
    );
    expect(res.status).toBe(400);
  });

  it("anonymous: writes share_event with user_id null + returns referral_code", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockReturnValue({
      doc: vi.fn(() => ({ id: "share-1", set: setMock })),
    });

    const res = await POST(
      buildRequest({ banner_type: "todays_take", question_id: "q1", share_target: "ig_story" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.referral_code).toBe("string");
    expect(body.referral_code.length).toBeGreaterThan(0);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        question_id: "q1",
        banner_type: "todays_take",
        share_target: "ig_story",
        referral_code: body.referral_code,
      }),
    );
  });

  it("authed: writes share_event with user_id from token", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "u-99" });
    const setMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockReturnValue({
      doc: vi.fn(() => ({ id: "share-2", set: setMock })),
    });

    await POST(
      buildRequest(
        { banner_type: "verdict", question_id: "q2", share_target: "tiktok" },
        "good-token",
      ),
    );
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u-99", banner_type: "verdict" }),
    );
  });

  it("never persists raw IP — only ip_hash sha256 hex", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockReturnValue({
      doc: vi.fn(() => ({ id: "share-3", set: setMock })),
    });

    await POST(
      buildRequest({ banner_type: "called_it", question_id: "q3", share_target: "imessage" }),
    );
    const writtenDoc = setMock.mock.calls[0][0];
    expect(writtenDoc.ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(writtenDoc.ip_hash).not.toBe("1.2.3.4");
  });
});
```

- [ ] **Step 2: FAIL**

```powershell
pnpm test src/app/api/share/track/route.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement**

Create `api/src/app/api/share/track/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { signReferralCode } from "@/lib/branch";

const TrackSchema = z.object({
  banner_type: z.enum(["todays_take", "verdict", "called_it"]),
  question_id: z.string().min(1),
  share_target: z.enum(["ig_story", "tiktok", "snap", "imessage", "system"]),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = TrackSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const decoded = await requireAuth(req);
  const userId = decoded?.uid ?? null;
  const ipHash = hashIp(req);

  const referralCode = signReferralCode({
    user_id: userId,
    question_id: parsed.question_id,
    banner_type: parsed.banner_type,
    ts: Date.now(),
  });

  const docRef = adminFirestore.collection("share_events").doc();
  await docRef.set({
    user_id: userId,
    question_id: parsed.question_id,
    banner_type: parsed.banner_type,
    share_target: parsed.share_target,
    referral_code: referralCode,
    created_at: FieldValue.serverTimestamp(),
    ip_hash: ipHash,
  });

  return NextResponse.json({ referral_code: referralCode });
}
```

- [ ] **Step 4: PASS**

```powershell
pnpm test src/app/api/share/track/route.test.ts
```

Expected: 5 tests green.

- [ ] **Step 5: Run full backend suite**

```powershell
cd C:\Users\levin\relatably\api
pnpm test
```

Expected: all 78 (Phase 3) + ~20 new = ≥98 tests green.

- [ ] **Step 6: Commit**

```powershell
cd C:\Users\levin\relatably
git add api/src/app/api/share/track/route.ts api/src/app/api/share/track/route.test.ts
git commit -m "feat(api): POST /api/share/track endpoint (anonymous + authed)"
```

---

## Task 9: iOS — `lib/ads.ts` env-flagged AdMob adapter

**Files:**
- Create: `ios/src/lib/ads.ts`
- Create: `ios/src/lib/ads.test.ts`
- Modify: `ios/package.json` (add `react-native-google-mobile-ads`)
- Modify: `ios/app.json` (add `ios.config.googleMobileAdsAppId` placeholder)

`lib/ads.ts` is the boundary that wraps `react-native-google-mobile-ads`. Three exports:

1. `isAdsEnabled(): boolean` — reads `EXPO_PUBLIC_ADMOB_ENABLED === "true"`.
2. `getAdUnitId(slot: 'leaderboard_banner' | 'archive_banner' | 'post_reveal_interstitial'): string` — returns the slot's ad unit id from env (`EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID` etc.) or the AdMob test ad unit id when not in production.
3. `loadInterstitialOnce(): Promise<{ show: () => Promise<void>; dispose: () => void } | null>` — loads + returns a controller for an interstitial. Returns `null` when ads are disabled.

The native SDK is dynamically imported only when `isAdsEnabled()` is true, so test environments don't blow up on missing native module bindings.

- [ ] **Step 1: Add the dep to `ios/package.json`**

Open `ios/package.json` and add to `dependencies`:

```json
"react-native-google-mobile-ads": "^15.0.0",
```

Add the package to `transformIgnorePatterns` in the existing jest config — change the regex to:

```
"node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@react-native-firebase/.*|expo-apple-authentication|react-native-google-mobile-ads|react-native-branch|react-native-view-shot|expo-sharing))"
```

(Adds 4 packages — google-mobile-ads + branch + view-shot + expo-sharing — at once, since later tasks need them too. Saves a `pnpm install` round-trip.)

Add to `dependencies` (also appended now to avoid multi-install):

```json
"react-native-branch": "^6.0.0",
"react-native-view-shot": "^4.0.0",
"expo-sharing": "~14.0.0",
```

Run install:

```powershell
cd C:\Users\levin\relatably\ios
pnpm install
```

Expected: lock file updates, no errors.

- [ ] **Step 2: Update `ios/app.json` placeholders**

Open `ios/app.json` and modify the `ios` block + `plugins` array. The full updated file:

```json
{
  "expo": {
    "name": "Relatably",
    "slug": "relatably",
    "version": "0.1.0",
    "orientation": "portrait",
    "scheme": "relatably",
    "userInterfaceStyle": "dark",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "co.relatably.app",
      "googleServicesFile": "./GoogleService-Info.plist",
      "usesAppleSignIn": true,
      "config": {
        "googleMobileAdsAppId": "ca-app-pub-3940256099942544~1458002511"
      },
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"],
        "SKAdNetworkItems": [
          { "SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork" }
        ]
      }
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      "expo-apple-authentication",
      [
        "react-native-google-mobile-ads",
        {
          "iosAppId": "ca-app-pub-3940256099942544~1458002511"
        }
      ],
      "react-native-branch",
      [
        "expo-build-properties",
        {
          "ios": {
            "useFrameworks": "static"
          }
        }
      ],
      "expo-secure-store"
    ]
  }
}
```

> Note: `ca-app-pub-3940256099942544~1458002511` is Google's published **iOS test app id** for AdMob (safe to commit, intended for development). When Levin gets a real AdMob account, this id is swapped via env-driven app config or a direct edit.

- [ ] **Step 3: Write the failing ads.ts test**

Create `ios/src/lib/ads.test.ts`:

```ts
import { isAdsEnabled, getAdUnitId, loadInterstitialOnce, __resetAdsForTest } from "./ads";

describe("ads adapter", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    delete process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID;
    delete process.env.EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID;
    delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
    __resetAdsForTest();
  });

  it("isAdsEnabled is false by default", () => {
    expect(isAdsEnabled()).toBe(false);
  });

  it("isAdsEnabled is true only when EXPO_PUBLIC_ADMOB_ENABLED === 'true'", () => {
    process.env.EXPO_PUBLIC_ADMOB_ENABLED = "true";
    __resetAdsForTest();
    expect(isAdsEnabled()).toBe(true);

    process.env.EXPO_PUBLIC_ADMOB_ENABLED = "false";
    __resetAdsForTest();
    expect(isAdsEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_ADMOB_ENABLED = "1";
    __resetAdsForTest();
    expect(isAdsEnabled()).toBe(false);
  });

  it("getAdUnitId returns AdMob test unit when env unset", () => {
    expect(getAdUnitId("leaderboard_banner")).toBe("ca-app-pub-3940256099942544/2934735716");
    expect(getAdUnitId("archive_banner")).toBe("ca-app-pub-3940256099942544/2934735716");
    expect(getAdUnitId("post_reveal_interstitial")).toBe("ca-app-pub-3940256099942544/4411468910");
  });

  it("getAdUnitId returns env-driven id when set", () => {
    process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID = "ca-app-pub-1111/leaderboard";
    __resetAdsForTest();
    expect(getAdUnitId("leaderboard_banner")).toBe("ca-app-pub-1111/leaderboard");
  });

  it("loadInterstitialOnce returns null when ads disabled", async () => {
    const r = await loadInterstitialOnce();
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 4: FAIL**

```powershell
cd C:\Users\levin\relatably\ios
pnpm test src/lib/ads.test.ts
```

Expected: module missing.

- [ ] **Step 5: Implement `ios/src/lib/ads.ts`**

```ts
type Slot = "leaderboard_banner" | "archive_banner" | "post_reveal_interstitial";

const TEST_BANNER = "ca-app-pub-3940256099942544/2934735716";
const TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/4411468910";

let cachedEnabled: boolean | undefined;

export function __resetAdsForTest(): void {
  cachedEnabled = undefined;
}

export function isAdsEnabled(): boolean {
  if (cachedEnabled === undefined) {
    cachedEnabled = process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";
  }
  return cachedEnabled;
}

export function getAdUnitId(slot: Slot): string {
  switch (slot) {
    case "leaderboard_banner":
      return process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID ?? TEST_BANNER;
    case "archive_banner":
      return process.env.EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID ?? TEST_BANNER;
    case "post_reveal_interstitial":
      return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? TEST_INTERSTITIAL;
  }
}

export interface InterstitialController {
  show: () => Promise<void>;
  dispose: () => void;
}

export async function loadInterstitialOnce(): Promise<InterstitialController | null> {
  if (!isAdsEnabled()) return null;
  // Lazy-load native module so test environments don't load it.
  const mod = await import("react-native-google-mobile-ads");
  const InterstitialAd = mod.InterstitialAd;
  const AdEventType = mod.AdEventType;
  const interstitial = InterstitialAd.createForAdRequest(getAdUnitId("post_reveal_interstitial"), {
    requestNonPersonalizedAdsOnly: true,
  });
  const loaded = new Promise<void>((resolve) => {
    const unsub = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      unsub();
      resolve();
    });
  });
  interstitial.load();
  await loaded;
  return {
    show: () => interstitial.show(),
    dispose: () => {
      // SDK manages its own teardown; no explicit dispose needed.
    },
  };
}
```

- [ ] **Step 6: PASS**

```powershell
pnpm test src/lib/ads.test.ts
```

Expected: 5 tests green.

- [ ] **Step 7: Run iOS lint to confirm no type errors**

```powershell
pnpm lint
```

Expected: no errors. (Lint may warn on the dynamic import — that's fine.)

- [ ] **Step 8: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/package.json ios/pnpm-lock.yaml ios/app.json ios/src/lib/ads.ts ios/src/lib/ads.test.ts
git commit -m "feat(ios): ads.ts env-flagged AdMob adapter (TDD) + native deps"
```

---

## Task 10: iOS — `lib/branch.ts` env-flagged Branch.io adapter

**Files:**
- Create: `ios/src/lib/branch.ts`
- Create: `ios/src/lib/branch.test.ts`

Wraps `react-native-branch`. Three exports:

1. `isBranchEnabled(): boolean` — `EXPO_PUBLIC_BRANCH_KEY != ""`.
2. `initBranch(): Promise<void>` — calls `branch.init()` (no-op when disabled).
3. `createBranchUniversalLink(opts): Promise<string | null>` — generates a deep link from a referral code; returns `null` when disabled (callers fall back to `relatably.app` URL with `?r=<code>` query string — see Task 15).

Same lazy-loading pattern as ads.ts. Tests don't actually require the native module.

- [ ] **Step 1: Failing test**

Create `ios/src/lib/branch.test.ts`:

```ts
import { isBranchEnabled, initBranch, createBranchUniversalLink, __resetBranchForTest } from "./branch";

describe("branch adapter", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_BRANCH_KEY;
    __resetBranchForTest();
  });

  it("isBranchEnabled is false by default", () => {
    expect(isBranchEnabled()).toBe(false);
  });

  it("isBranchEnabled is true when key set", () => {
    process.env.EXPO_PUBLIC_BRANCH_KEY = "key_live_abc";
    __resetBranchForTest();
    expect(isBranchEnabled()).toBe(true);
  });

  it("initBranch is a no-op when disabled (no throw)", async () => {
    await expect(initBranch()).resolves.toBeUndefined();
  });

  it("createBranchUniversalLink returns null when disabled", async () => {
    const r = await createBranchUniversalLink({
      referral_code: "abc.def",
      banner_type: "todays_take",
      question_id: "q1",
    });
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: FAIL**

```powershell
pnpm test src/lib/branch.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement `ios/src/lib/branch.ts`**

```ts
let cachedEnabled: boolean | undefined;

export function __resetBranchForTest(): void {
  cachedEnabled = undefined;
}

export function isBranchEnabled(): boolean {
  if (cachedEnabled === undefined) {
    cachedEnabled = (process.env.EXPO_PUBLIC_BRANCH_KEY ?? "") !== "";
  }
  return cachedEnabled;
}

export async function initBranch(): Promise<void> {
  if (!isBranchEnabled()) return;
  const branch = (await import("react-native-branch")).default;
  await branch.subscribe(() => {
    // Phase 4 leaves install-attribution params unhandled — Phase 6 will
    // deep-link them into the today flow + credit the referrer.
  });
}

export interface UniversalLinkOpts {
  referral_code: string;
  banner_type: "todays_take" | "verdict" | "called_it";
  question_id: string;
}

export async function createBranchUniversalLink(
  opts: UniversalLinkOpts,
): Promise<string | null> {
  if (!isBranchEnabled()) return null;

  const branch = (await import("react-native-branch")).default;
  const branchUniversalObject = await branch.createBranchUniversalObject(
    `relatably/share/${opts.banner_type}/${opts.question_id}`,
    {
      title: "Relatably — daily verdict",
      contentMetadata: {
        customMetadata: {
          referral_code: opts.referral_code,
          banner_type: opts.banner_type,
          question_id: opts.question_id,
        },
      },
    },
  );
  const linkProperties = { feature: "share", channel: opts.banner_type };
  const controlParams = {
    $desktop_url: "https://relatably.app",
    $ios_deepview: "default_template",
  };
  const { url } = await branchUniversalObject.generateShortUrl(linkProperties, controlParams);
  return url;
}
```

- [ ] **Step 4: PASS**

```powershell
pnpm test src/lib/branch.test.ts
```

Expected: 4 tests green.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/lib/branch.ts ios/src/lib/branch.test.ts
git commit -m "feat(ios): branch.ts env-flagged Branch.io adapter (TDD)"
```

---

## Task 11: iOS — `lib/interstitialGate.ts` (1/user/day SecureStore cap)

**Files:**
- Create: `ios/src/lib/interstitialGate.ts`
- Create: `ios/src/lib/interstitialGate.test.ts`

Mirrors Phase 2's `revealStore.ts`: SecureStore-backed daily idempotency. Two exports:

1. `hasShownInterstitialFor(questionId): Promise<boolean>` — returns true if we've already shown the interstitial for this question_id (i.e., today).
2. `markInterstitialShownFor(questionId): Promise<void>` — stamps the SecureStore key.

Key prefix `interstitial_seen_<questionId>` matches Phase 2's `reveal_seen_<questionId>` convention.

- [ ] **Step 1: Failing test**

Create `ios/src/lib/interstitialGate.test.ts`:

```ts
import { hasShownInterstitialFor, markInterstitialShownFor } from "./interstitialGate";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";

describe("interstitialGate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns false when SecureStore has no entry", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await hasShownInterstitialFor("q-1")).toBe(false);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("interstitial_seen_q-1");
  });

  it("returns true when SecureStore has the key", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("1");
    expect(await hasShownInterstitialFor("q-1")).toBe(true);
  });

  it("marks the SecureStore key", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    await markInterstitialShownFor("q-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("interstitial_seen_q-1", "1");
  });
});
```

- [ ] **Step 2: FAIL → Implement**

Create `ios/src/lib/interstitialGate.ts`:

```ts
import * as SecureStore from "expo-secure-store";

const PREFIX = "interstitial_seen_";

export async function hasShownInterstitialFor(questionId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${PREFIX}${questionId}`);
  return v === "1";
}

export async function markInterstitialShownFor(questionId: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}${questionId}`, "1");
}
```

- [ ] **Step 3: PASS**

```powershell
cd C:\Users\levin\relatably\ios
pnpm test src/lib/interstitialGate.test.ts
```

Expected: 3 tests green.

- [ ] **Step 4: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/lib/interstitialGate.ts ios/src/lib/interstitialGate.test.ts
git commit -m "feat(ios): interstitialGate 1/user/day cap (TDD)"
```

---

## Task 12: iOS — `BannerAdSlot` component + wire into `LeaderboardScreen` row 10/11

**Files:**
- Create: `ios/src/components/BannerAdSlot.tsx`
- Create: `ios/src/components/BannerAdSlot.test.tsx`
- Modify: `ios/src/screens/LeaderboardScreen.tsx`
- Modify: `ios/src/screens/LeaderboardScreen.test.tsx`

`BannerAdSlot` renders one of two states:

1. **Disabled (`isAdsEnabled() === false`)** — a 50-pt-tall placeholder `<View testID="banner-ad-slot-disabled">` with subtle dim background. Useful for layout testing.
2. **Enabled** — a `<BannerAd>` from `react-native-google-mobile-ads` configured with `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` and the slot's ad unit id from `getAdUnitId(slot)`.

Tests run in disabled mode only (the native module isn't loaded).

`LeaderboardScreen` injects the slot at index 10 by interleaving an ad row into the FlatList data. Render path: rows 0–9 → ad row → rows 10–N. The test asserts the disabled-state `testID` appears between the 10th and 11th leaderboard row when ≥11 entries exist.

- [ ] **Step 1: Failing BannerAdSlot test**

Create `ios/src/components/BannerAdSlot.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { BannerAdSlot } from "./BannerAdSlot";

describe("BannerAdSlot", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    // Force-reset cached env in ads.ts. We import here only when needed
    // because the test doesn't otherwise depend on the module.
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
  });

  it("renders disabled placeholder when ads off", () => {
    const { getByTestId } = render(<BannerAdSlot slot="leaderboard_banner" />);
    expect(getByTestId("banner-ad-slot-disabled")).toBeTruthy();
  });

  it("placeholder is fixed height (50pt) for predictable layout", () => {
    const { getByTestId } = render(<BannerAdSlot slot="archive_banner" />);
    const node = getByTestId("banner-ad-slot-disabled");
    const flat = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style)
      : node.props.style;
    expect(flat.height).toBe(50);
  });
});
```

- [ ] **Step 2: FAIL → Implement**

Create `ios/src/components/BannerAdSlot.tsx`:

```tsx
import { View, StyleSheet } from "react-native";
import { isAdsEnabled, getAdUnitId } from "@/src/lib/ads";

interface Props {
  slot: "leaderboard_banner" | "archive_banner";
}

export function BannerAdSlot({ slot }: Props) {
  if (!isAdsEnabled()) {
    return <View testID="banner-ad-slot-disabled" style={styles.placeholder} />;
  }
  // Lazy-loaded only when ads enabled — keeps test env clean.
  const { BannerAd, BannerAdSize } = require("react-native-google-mobile-ads");
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getAdUnitId(slot)}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 4, backgroundColor: "#000" },
  placeholder: { height: 50, backgroundColor: "#0a0a0a", marginVertical: 4 },
});
```

- [ ] **Step 3: PASS**

```powershell
cd C:\Users\levin\relatably\ios
pnpm test src/components/BannerAdSlot.test.tsx
```

Expected: 2 tests green.

- [ ] **Step 4: Modify `LeaderboardScreen.tsx` to inject the ad row**

Open `ios/src/screens/LeaderboardScreen.tsx`. The Phase 3 file uses a plain `<FlatList>` keyed by `user_id`. Phase 4 interleaves an ad row at index 10. Replace the `FlatList` block (lines ~70-83) with a discriminated-union row model:

The full updated file:

```tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { LeaderboardRow } from "@/src/components/LeaderboardRow";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
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

type ListRow =
  | { kind: "entry"; entry: LeaderboardEntry; rank: number }
  | { kind: "ad"; key: "banner-row" };

function interleaveAd(entries: LeaderboardEntry[]): ListRow[] {
  const rows: ListRow[] = entries.map((entry, i) => ({
    kind: "entry" as const,
    entry,
    rank: entry.daily_rank ?? i + 1,
  }));
  if (entries.length >= 11) rows.splice(10, 0, { kind: "ad", key: "banner-row" });
  return rows;
}

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

  const rows = interleaveAd(entries);

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
          data={rows}
          keyExtractor={(r) => (r.kind === "ad" ? r.key : r.entry.user_id)}
          renderItem={({ item }) => {
            if (item.kind === "ad") return <BannerAdSlot slot="leaderboard_banner" />;
            return (
              <LeaderboardRow
                rank={item.rank}
                handle={item.entry.handle}
                score={item.entry.score}
                locale={item.entry.locale}
              />
            );
          }}
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

- [ ] **Step 5: Update `LeaderboardScreen.test.tsx`**

Append a new `describe` block to `ios/src/screens/LeaderboardScreen.test.tsx`:

```tsx
describe("LeaderboardScreen ad row injection", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
    jest.clearAllMocks();
  });

  it("injects banner ad row at index 10 when there are >=11 entries", async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      user_id: `u-${i}`,
      handle: `user${i}`,
      score: 1000 - i,
      daily_rank: i + 1,
      locale: "en",
    }));
    (require("@/src/lib/api").fetchLeaderboard as jest.Mock).mockResolvedValue({ entries });

    const { findByTestId } = render(<LeaderboardScreen isSignedIn={false} />);
    expect(await findByTestId("banner-ad-slot-disabled")).toBeTruthy();
  });

  it("does NOT inject ad row when fewer than 11 entries", async () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      user_id: `u-${i}`,
      handle: `user${i}`,
      score: 1000 - i,
      daily_rank: i + 1,
      locale: "en",
    }));
    (require("@/src/lib/api").fetchLeaderboard as jest.Mock).mockResolvedValue({ entries });

    const { queryByTestId, findByText } = render(<LeaderboardScreen isSignedIn={false} />);
    await findByText("user0");
    expect(queryByTestId("banner-ad-slot-disabled")).toBeNull();
  });
});
```

> The Phase 3 test file already mocks `@/src/lib/api`. If the existing mock isn't preserved across describe blocks, copy the existing top-level `jest.mock("@/src/lib/api", ...)` to apply to the whole file.

- [ ] **Step 6: PASS**

```powershell
pnpm test src/screens/LeaderboardScreen.test.tsx src/components/BannerAdSlot.test.tsx
```

Expected: all green.

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/components/BannerAdSlot.tsx ios/src/components/BannerAdSlot.test.tsx ios/src/screens/LeaderboardScreen.tsx ios/src/screens/LeaderboardScreen.test.tsx
git commit -m "feat(ios): BannerAdSlot + LeaderboardScreen row 10/11 injection (TDD)"
```

---

## Task 13: iOS — `ArchiveScreen` Phase-5-ready scaffold + banner-every-8

**Files:**
- Create: `ios/src/screens/ArchiveScreen.tsx`
- Create: `ios/src/screens/ArchiveScreen.test.tsx`
- Modify: `ios/app/(tabs)/archive.tsx`

Phase 5 ships the real archive (past questions grid + tile screen). Phase 4 ships a minimal scaffold:

- Renders an empty grid placeholder ("Archive coming soon — past verdicts will appear here").
- The grid layout already injects a `BannerAdSlot slot="archive_banner"` after every 8 tiles (mocked via a `tiles` prop that defaults to `[]` for Phase 4).
- Phase 5 will replace the empty default with a real archive query + tile data, and the ad-injection logic will already be in place.

This gives Phase 4 monetization at-the-tab-level coverage without depending on Phase 5 archive content.

- [ ] **Step 1: Failing test**

Create `ios/src/screens/ArchiveScreen.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { ArchiveScreen } from "./ArchiveScreen";

describe("ArchiveScreen", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
  });

  it("shows empty-state copy when no tiles", () => {
    const { getByText } = render(<ArchiveScreen tiles={[]} />);
    expect(getByText(/coming soon/i)).toBeTruthy();
  });

  it("does not render any ad slots when 0 tiles", () => {
    const { queryAllByTestId } = render(<ArchiveScreen tiles={[]} />);
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(0);
  });

  it("injects an ad slot after every 8 tiles", () => {
    const tiles = Array.from({ length: 17 }, (_, i) => ({
      question_id: `q-${i}`,
      verdict_text: `verdict ${i}`,
      thumbnail: null,
    }));
    const { queryAllByTestId } = render(<ArchiveScreen tiles={tiles} />);
    // 17 tiles → 2 ad slots (after tile 8, after tile 16).
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(2);
  });

  it("does not inject ad slot when exactly 7 tiles", () => {
    const tiles = Array.from({ length: 7 }, (_, i) => ({
      question_id: `q-${i}`,
      verdict_text: "x",
      thumbnail: null,
    }));
    const { queryAllByTestId } = render(<ArchiveScreen tiles={tiles} />);
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: FAIL → Implement**

Create `ios/src/screens/ArchiveScreen.tsx`:

```tsx
import { Fragment } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";

export interface ArchiveTile {
  question_id: string;
  verdict_text: string;
  thumbnail: string | null;
}

interface Props {
  tiles?: ArchiveTile[];
}

type Row =
  | { kind: "tile"; tile: ArchiveTile; index: number }
  | { kind: "ad"; key: string };

function interleaveAds(tiles: ArchiveTile[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < tiles.length; i++) {
    rows.push({ kind: "tile", tile: tiles[i], index: i });
    if ((i + 1) % 8 === 0) rows.push({ kind: "ad", key: `archive-banner-${i + 1}` });
  }
  return rows;
}

export function ArchiveScreen({ tiles = [] }: Props) {
  if (tiles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>archive coming soon — past verdicts will appear here.</Text>
      </View>
    );
  }
  const rows = interleaveAds(tiles);
  return (
    <FlatList
      style={styles.root}
      data={rows}
      keyExtractor={(r) => (r.kind === "ad" ? r.key : r.tile.question_id)}
      renderItem={({ item }) => {
        if (item.kind === "ad") return <BannerAdSlot slot="archive_banner" />;
        return (
          <View style={styles.tile}>
            <Text style={styles.tileVerdict}>{item.tile.verdict_text}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 32 },
  muted: { color: "#888", fontSize: 14, textAlign: "center" },
  tile: { padding: 16, borderBottomColor: "#222", borderBottomWidth: 1 },
  tileVerdict: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
```

- [ ] **Step 3: Replace `ios/app/(tabs)/archive.tsx`**

Currently a Phase-3 placeholder. Replace with:

```tsx
import { ArchiveScreen } from "@/src/screens/ArchiveScreen";

export default function ArchiveTab() {
  return <ArchiveScreen />;
}
```

- [ ] **Step 4: PASS**

```powershell
cd C:\Users\levin\relatably\ios
pnpm test src/screens/ArchiveScreen.test.tsx
```

Expected: 4 tests green.

- [ ] **Step 5: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/screens/ArchiveScreen.tsx ios/src/screens/ArchiveScreen.test.tsx ios/app/(tabs)/archive.tsx
git commit -m "feat(ios): ArchiveScreen scaffold + banner-every-8 (Phase-5-ready, TDD)"
```

---

## Task 14: iOS — 3 ShareCard components (TDD pure renders)

**Files:**
- Create: `ios/src/components/ShareCardTodaysTake.tsx`
- Create: `ios/src/components/ShareCardTodaysTake.test.tsx`
- Create: `ios/src/components/ShareCardVerdict.tsx`
- Create: `ios/src/components/ShareCardVerdict.test.tsx`
- Create: `ios/src/components/ShareCardCalledIt.tsx`
- Create: `ios/src/components/ShareCardCalledIt.test.tsx`

Three pure React Native components that render the 9:16 share-card view trees from spec section 7. Each is given its data via props; no fetching, no side effects. They're rendered offscreen by `lib/shareCard.ts` (Task 15), captured to PNG via `react-native-view-shot`, and handed to the iOS share sheet.

All three share these constants:

```ts
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const ACCENT = "#aaff00";  // matches Phase 1 SubmitButton accent
const BG = "#000";
```

- [ ] **Step 1: Failing test for ShareCardTodaysTake**

Create `ios/src/components/ShareCardTodaysTake.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { ShareCardTodaysTake } from "./ShareCardTodaysTake";

describe("ShareCardTodaysTake", () => {
  it("renders the question + the user's answer + brand wordmark", () => {
    const { getByText } = render(
      <ShareCardTodaysTake
        questionText="What's the most overrated tourist trap?"
        userAnswer="EIFFEL TOWER"
        date="May 8, 2026"
      />,
    );
    expect(getByText("RELATABLY")).toBeTruthy();
    expect(getByText("May 8, 2026")).toBeTruthy();
    expect(getByText(/most overrated tourist trap/)).toBeTruthy();
    expect(getByText("EIFFEL TOWER")).toBeTruthy();
  });

  it("uppercases the user answer", () => {
    const { getByText } = render(
      <ShareCardTodaysTake
        questionText="q?"
        userAnswer="eiffel tower"
        date="May 8, 2026"
      />,
    );
    expect(getByText("EIFFEL TOWER")).toBeTruthy();
  });

  it("uses 1080x1920 dimensions", () => {
    const { getByTestId } = render(
      <ShareCardTodaysTake questionText="q?" userAnswer="x" date="d" />,
    );
    const root = getByTestId("share-card-todays-take");
    const flat = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(flat.width).toBe(1080);
    expect(flat.height).toBe(1920);
  });
});
```

- [ ] **Step 2: FAIL → Implement**

Create `ios/src/components/ShareCardTodaysTake.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Props {
  questionText: string;
  userAnswer: string;
  date: string;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const ACCENT = "#aaff00";

export function ShareCardTodaysTake({ questionText, userAnswer, date }: Props) {
  return (
    <View testID="share-card-todays-take" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>RELATABLY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.question}>{questionText}</Text>
      <View style={styles.answerBox}>
        <Text style={styles.answerText}>{userAnswer.toUpperCase()}</Text>
      </View>
      <Text style={styles.tagline}>I said this. The world is voting now.</Text>
      <Text style={styles.cta}>drop @ random — every day. 🌍</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: "#000", padding: 96, justifyContent: "space-between" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#fff", fontSize: 56, fontWeight: "900", letterSpacing: 2 },
  date: { color: "#888", fontSize: 36, fontWeight: "600" },
  question: { color: "#fff", fontSize: 64, fontWeight: "800", lineHeight: 80, marginTop: 96 },
  answerBox: { borderColor: ACCENT, borderWidth: 6, padding: 64, alignItems: "center", justifyContent: "center", borderRadius: 32 },
  answerText: { color: ACCENT, fontSize: 96, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  tagline: { color: "#fff", fontSize: 40, fontWeight: "600", textAlign: "center" },
  cta: { color: "#888", fontSize: 36, textAlign: "center" },
});
```

- [ ] **Step 3: PASS**

```powershell
pnpm test src/components/ShareCardTodaysTake.test.tsx
```

Expected: 3 tests green.

- [ ] **Step 4: Failing test for ShareCardVerdict**

Create `ios/src/components/ShareCardVerdict.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { ShareCardVerdict } from "./ShareCardVerdict";

describe("ShareCardVerdict", () => {
  const baseProps = {
    verdictText: "PISA TOWER",
    topClusters: [
      { canonical_text: "pizza", final_rank: 2 },
      { canonical_text: "louvre", final_rank: 3 },
      { canonical_text: "colosseum", final_rank: 4 },
    ],
    userRank: 14,
    percentile: 87,
    date: "May 8, 2026",
  };

  it("shows verdict + user rank + percentile", () => {
    const { getByText } = render(<ShareCardVerdict {...baseProps} />);
    expect(getByText("PISA TOWER")).toBeTruthy();
    expect(getByText(/I ranked #14/)).toBeTruthy();
    expect(getByText(/Better than 87%/)).toBeTruthy();
  });

  it("shows up to 6 satellite clusters", () => {
    const tooMany = Array.from({ length: 10 }, (_, i) => ({
      canonical_text: `c${i}`,
      final_rank: i + 2,
    }));
    const { queryAllByTestId } = render(
      <ShareCardVerdict {...baseProps} topClusters={tooMany} />,
    );
    expect(queryAllByTestId("verdict-satellite")).toHaveLength(6);
  });

  it("falls back when userRank is null (anonymous)", () => {
    const { getByText, queryByText } = render(
      <ShareCardVerdict {...baseProps} userRank={null} percentile={null} />,
    );
    expect(getByText(/sign in next time/i)).toBeTruthy();
    expect(queryByText(/I ranked/)).toBeNull();
  });
});
```

- [ ] **Step 5: FAIL → Implement**

Create `ios/src/components/ShareCardVerdict.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Cluster {
  canonical_text: string;
  final_rank: number;
}

interface Props {
  verdictText: string;
  topClusters: Cluster[];
  userRank: number | null;
  percentile: number | null;
  date: string;
}

const ACCENT = "#aaff00";

export function ShareCardVerdict({ verdictText, topClusters, userRank, percentile, date }: Props) {
  const satellites = topClusters.slice(0, 6);
  return (
    <View testID="share-card-verdict" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>RELATABLY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.label}>THE WORLD&apos;S VERDICT:</Text>
      <Text style={styles.verdict}>{verdictText.toUpperCase()}</Text>
      <View style={styles.satellites}>
        {satellites.map((c) => (
          <Text key={c.canonical_text} testID="verdict-satellite" style={styles.satellite}>
            {c.canonical_text}
          </Text>
        ))}
      </View>
      {userRank !== null && percentile !== null ? (
        <Text style={styles.rankLine}>
          I ranked #{userRank}. Better than {percentile}% of the world.
        </Text>
      ) : (
        <Text style={styles.rankLine}>sign in next time to claim a rank.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 1080, height: 1920, backgroundColor: "#000", padding: 96, justifyContent: "space-between" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#fff", fontSize: 56, fontWeight: "900", letterSpacing: 2 },
  date: { color: "#888", fontSize: 36, fontWeight: "600" },
  label: { color: "#fff", fontSize: 48, fontWeight: "700", letterSpacing: 1 },
  verdict: { color: ACCENT, fontSize: 144, fontWeight: "900", letterSpacing: 4, textAlign: "left" },
  satellites: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  satellite: { color: "#888", fontSize: 40, fontWeight: "600" },
  rankLine: { color: "#fff", fontSize: 40, fontWeight: "600" },
});
```

- [ ] **Step 6: PASS**

```powershell
pnpm test src/components/ShareCardVerdict.test.tsx
```

Expected: 3 tests green.

- [ ] **Step 7: Failing test for ShareCardCalledIt**

Create `ios/src/components/ShareCardCalledIt.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { ShareCardCalledIt } from "./ShareCardCalledIt";

describe("ShareCardCalledIt", () => {
  const props = {
    verdictText: "pisa tower",
    clusterCount: 412381,
    handle: "ick_of_the_day",
    date: "May 8, 2026",
  };

  it("renders the 👑 emoji + uppercased verdict + handle", () => {
    const { getByText } = render(<ShareCardCalledIt {...props} />);
    expect(getByText(/I CALLED IT/)).toBeTruthy();
    expect(getByText("PISA TOWER")).toBeTruthy();
    expect(getByText("@ick_of_the_day")).toBeTruthy();
  });

  it("formats cluster_count with thousands separators", () => {
    const { getByText } = render(<ShareCardCalledIt {...props} />);
    expect(getByText(/412,381/)).toBeTruthy();
  });

  it("falls back when handle is null", () => {
    const { getByText } = render(<ShareCardCalledIt {...props} handle={null} />);
    expect(getByText("@anonymous")).toBeTruthy();
  });
});
```

- [ ] **Step 8: FAIL → Implement**

Create `ios/src/components/ShareCardCalledIt.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Props {
  verdictText: string;
  clusterCount: number;
  handle: string | null;
  date: string;
}

const ACCENT = "#aaff00";

export function ShareCardCalledIt({ verdictText, clusterCount, handle, date }: Props) {
  const display = handle ? `@${handle}` : "@anonymous";
  const formatted = clusterCount.toLocaleString("en-US");
  return (
    <View testID="share-card-called-it" style={styles.card}>
      <Text style={styles.crown}>👑 I CALLED IT 👑</Text>
      <Text style={styles.lede}>I was the FIRST person on Earth to type</Text>
      <Text style={styles.verdict}>{verdictText.toUpperCase()}</Text>
      <Text style={styles.subhead}>Today&apos;s most relatable take.</Text>
      <Text style={styles.count}>• {formatted} of you agreed •</Text>
      <Text style={styles.handle}>{display}</Text>
      <Text style={styles.brandLine}>RELATABLY · {date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 1080, height: 1920, backgroundColor: "#000", padding: 96, justifyContent: "center", alignItems: "center" },
  crown: { color: ACCENT, fontSize: 80, fontWeight: "900", letterSpacing: 2, marginBottom: 64 },
  lede: { color: "#fff", fontSize: 48, fontWeight: "600", textAlign: "center", marginBottom: 32 },
  verdict: { color: ACCENT, fontSize: 144, fontWeight: "900", textAlign: "center", letterSpacing: 4, marginBottom: 64 },
  subhead: { color: "#fff", fontSize: 40, fontWeight: "600", textAlign: "center" },
  count: { color: "#888", fontSize: 36, fontWeight: "500", textAlign: "center", marginVertical: 32 },
  handle: { color: "#fff", fontSize: 56, fontWeight: "800", textAlign: "center", marginTop: 96 },
  brandLine: { color: "#666", fontSize: 32, fontWeight: "600", textAlign: "center", marginTop: 32 },
});
```

- [ ] **Step 9: PASS**

```powershell
pnpm test src/components/ShareCardCalledIt.test.tsx
```

Expected: 3 tests green.

- [ ] **Step 10: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/components/ShareCardTodaysTake.tsx ios/src/components/ShareCardTodaysTake.test.tsx ios/src/components/ShareCardVerdict.tsx ios/src/components/ShareCardVerdict.test.tsx ios/src/components/ShareCardCalledIt.tsx ios/src/components/ShareCardCalledIt.test.tsx
git commit -m "feat(ios): 3 ShareCard components (Today's take + Verdict + Called it, TDD)"
```

---

## Task 15: iOS — `lib/shareCard.ts` + `ShareButton` component + `trackShare` API client

**Files:**
- Create: `ios/src/lib/shareCard.ts`
- Create: `ios/src/lib/shareCard.test.ts`
- Create: `ios/src/components/ShareButton.tsx`
- Create: `ios/src/components/ShareButton.test.tsx`
- Modify: `ios/src/lib/api.ts` (add `trackShare` client)
- Modify: `ios/src/types/api.ts` (add `ShareTrackRequest` + `ShareTrackResponse`)

`shareCard.ts` orchestrates: (1) hits `POST /api/share/track` to get a referral code, (2) optionally generates a Branch link from the code, (3) captures the referenced view via `react-native-view-shot.captureRef` to a temporary PNG, (4) opens the iOS share sheet via `expo-sharing`. The view to capture is created by the caller (the parent screen renders a hidden 1080×1920 ShareCard offscreen + passes its ref).

The function `shareCardImage(opts)` is the single export. It mocks cleanly because (a) `captureRef` is the only native-only call and we mock `react-native-view-shot` at module level, (b) `Sharing.shareAsync` is mocked from `expo-sharing`.

`ShareButton` is a top-right pill `<Pressable role="button">` that delegates to `shareCardImage`.

- [ ] **Step 1: Add types**

Open `ios/src/types/api.ts` and append:

```ts
export type BannerType = "todays_take" | "verdict" | "called_it";
export type ShareTarget = "ig_story" | "tiktok" | "snap" | "imessage" | "system";

export interface ShareTrackRequest {
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
}

export interface ShareTrackResponse {
  referral_code: string;
}
```

- [ ] **Step 2: Add `trackShare` client to `ios/src/lib/api.ts`**

Append (preserves all Phase 1+2+3 exports):

```ts
import type { ShareTrackRequest, ShareTrackResponse } from "../types/api";

export async function trackShare(req: ShareTrackRequest): Promise<ShareTrackResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/share/track`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`trackShare: ${res.status}`);
  return res.json();
}
```

(Update `import` line at top: `import type { ..., ShareTrackRequest, ShareTrackResponse } from "../types/api";`.)

- [ ] **Step 3: Failing test for shareCard.ts**

Create `ios/src/lib/shareCard.test.ts`:

```ts
import { shareCardImage } from "./shareCard";
import type React from "react";

jest.mock("react-native-view-shot", () => ({
  __esModule: true,
  captureRef: jest.fn(),
  default: { captureRef: jest.fn() },
}));
jest.mock("expo-sharing", () => ({
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/src/lib/api", () => ({
  trackShare: jest.fn(),
}));
jest.mock("@/src/lib/branch", () => ({
  isBranchEnabled: jest.fn(() => false),
  createBranchUniversalLink: jest.fn(),
}));

import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { trackShare } from "@/src/lib/api";
import { createBranchUniversalLink, isBranchEnabled } from "@/src/lib/branch";

const fakeRef: React.RefObject<unknown> = { current: { __dummy: true } };

describe("shareCardImage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls trackShare, captures the ref, opens share sheet", async () => {
    (trackShare as jest.Mock).mockResolvedValue({ referral_code: "abc.def" });
    (captureRef as jest.Mock).mockResolvedValue("file:///tmp/share.png");
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

    await shareCardImage({
      viewRef: fakeRef,
      banner_type: "todays_take",
      question_id: "q1",
      share_target: "system",
    });

    expect(trackShare).toHaveBeenCalledWith({
      banner_type: "todays_take",
      question_id: "q1",
      share_target: "system",
    });
    expect(captureRef).toHaveBeenCalledWith(fakeRef, expect.objectContaining({
      format: "png",
      quality: 1,
    }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///tmp/share.png",
      expect.any(Object),
    );
  });

  it("uses Branch deep link when enabled, falls back to relatably.app URL otherwise", async () => {
    (trackShare as jest.Mock).mockResolvedValue({ referral_code: "abc.def" });
    (captureRef as jest.Mock).mockResolvedValue("file:///tmp/share.png");
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

    // Branch enabled path:
    (isBranchEnabled as jest.Mock).mockReturnValue(true);
    (createBranchUniversalLink as jest.Mock).mockResolvedValue("https://relatably.app.link/abc");
    const branchResult = await shareCardImage({
      viewRef: fakeRef,
      banner_type: "verdict",
      question_id: "q2",
      share_target: "tiktok",
    });
    expect(branchResult.shareUrl).toBe("https://relatably.app.link/abc");

    // Branch disabled path:
    (isBranchEnabled as jest.Mock).mockReturnValue(false);
    (createBranchUniversalLink as jest.Mock).mockResolvedValue(null);
    const fallbackResult = await shareCardImage({
      viewRef: fakeRef,
      banner_type: "verdict",
      question_id: "q2",
      share_target: "tiktok",
    });
    expect(fallbackResult.shareUrl).toBe("https://relatably.app/?r=abc.def");
  });

  it("throws when sharing not available", async () => {
    (trackShare as jest.Mock).mockResolvedValue({ referral_code: "x" });
    (captureRef as jest.Mock).mockResolvedValue("file:///tmp/x.png");
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      shareCardImage({
        viewRef: fakeRef,
        banner_type: "called_it",
        question_id: "q3",
        share_target: "system",
      }),
    ).rejects.toThrow(/sharing not available/i);
  });
});
```

- [ ] **Step 4: FAIL → Implement**

Create `ios/src/lib/shareCard.ts`:

```ts
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type React from "react";
import { trackShare } from "@/src/lib/api";
import { isBranchEnabled, createBranchUniversalLink } from "@/src/lib/branch";
import type { BannerType, ShareTarget } from "@/src/types/api";

export interface ShareCardOpts {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
}

export interface ShareCardResult {
  referral_code: string;
  shareUrl: string;
  pngUri: string;
}

export async function shareCardImage(opts: ShareCardOpts): Promise<ShareCardResult> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing not available on this device");
  }

  const { referral_code } = await trackShare({
    banner_type: opts.banner_type,
    question_id: opts.question_id,
    share_target: opts.share_target,
  });

  let shareUrl = `https://relatably.app/?r=${encodeURIComponent(referral_code)}`;
  if (isBranchEnabled()) {
    const branchUrl = await createBranchUniversalLink({
      referral_code,
      banner_type: opts.banner_type,
      question_id: opts.question_id,
    });
    if (branchUrl) shareUrl = branchUrl;
  }

  const pngUri = await captureRef(opts.viewRef, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });

  await Sharing.shareAsync(pngUri, {
    mimeType: "image/png",
    dialogTitle: "Share to…",
    UTI: "public.png",
  });

  return { referral_code, shareUrl, pngUri };
}
```

- [ ] **Step 5: PASS**

```powershell
pnpm test src/lib/shareCard.test.ts
```

Expected: 3 tests green.

- [ ] **Step 6: Failing test for ShareButton**

Create `ios/src/components/ShareButton.test.tsx`:

```tsx
import { render, fireEvent } from "@testing-library/react-native";
import { ShareButton } from "./ShareButton";

jest.mock("@/src/lib/shareCard", () => ({
  shareCardImage: jest.fn(),
}));
import { shareCardImage } from "@/src/lib/shareCard";

describe("ShareButton", () => {
  beforeEach(() => jest.clearAllMocks());

  it("invokes shareCardImage on press with the given opts", async () => {
    (shareCardImage as jest.Mock).mockResolvedValue({ referral_code: "x" });
    const ref = { current: { __dummy: true } };
    const { getByRole } = render(
      <ShareButton
        viewRef={ref as any}
        banner_type="todays_take"
        question_id="q1"
        share_target="system"
        label="share"
      />,
    );
    fireEvent.press(getByRole("button"));
    // shareCardImage is async; let microtasks run.
    await Promise.resolve();
    expect(shareCardImage).toHaveBeenCalledWith({
      viewRef: ref,
      banner_type: "todays_take",
      question_id: "q1",
      share_target: "system",
    });
  });

  it("renders the given label", () => {
    const { getByText } = render(
      <ShareButton
        viewRef={{ current: null } as any}
        banner_type="todays_take"
        question_id="q1"
        share_target="system"
        label="🚀 share"
      />,
    );
    expect(getByText("🚀 share")).toBeTruthy();
  });
});
```

- [ ] **Step 7: FAIL → Implement**

Create `ios/src/components/ShareButton.tsx`:

```tsx
import { Pressable, Text, StyleSheet } from "react-native";
import type React from "react";
import { shareCardImage } from "@/src/lib/shareCard";
import type { BannerType, ShareTarget } from "@/src/types/api";

interface Props {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
  label: string;
}

export function ShareButton({ viewRef, banner_type, question_id, share_target, label }: Props) {
  const onPress = async () => {
    try {
      await shareCardImage({ viewRef, banner_type, question_id, share_target });
    } catch (e) {
      console.warn("share failed", e);
    }
  };
  return (
    <Pressable role="button" onPress={onPress} style={styles.btn}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: "#aaff00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  label: { color: "#000", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
});
```

- [ ] **Step 8: PASS + run iOS suite**

```powershell
pnpm test src/components/ShareButton.test.tsx
pnpm test
```

Expected: all iOS tests green.

- [ ] **Step 9: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/types/api.ts ios/src/lib/api.ts ios/src/lib/shareCard.ts ios/src/lib/shareCard.test.ts ios/src/components/ShareButton.tsx ios/src/components/ShareButton.test.tsx
git commit -m "feat(ios): shareCard.ts + ShareButton + trackShare client (TDD)"
```

---

## Task 16: iOS — wire share triggers (wordcloud + reveal + 👑 called-it) + post-reveal interstitial

**Files:**
- Modify: `ios/src/screens/WordcloudScreen.tsx`
- Modify: `ios/src/components/RevealAnimation.tsx`
- Modify: `ios/app/(tabs)/index.tsx`

This task wires the three share surfaces from spec section 7 + the post-reveal interstitial.

### Surface 1: Wordcloud "Today's take" share pill

`WordcloudScreen` currently takes `clusters`, `selfClusterId`, `totalCount`. Add `questionId`, `userAnswer`, `dateLabel` and render an offscreen `ShareCardTodaysTake` (positioned absolute, off-canvas) plus a top-right `ShareButton` that captures it.

### Surface 2: RevealAnimation "Verdict" share CTA at end

`RevealAnimation` renders the per-cluster animation; on completion it calls `onComplete`. Phase 4 adds (a) an offscreen `ShareCardVerdict` rendered after `phase === "verdict"`, (b) a "share verdict" button next to the existing CTA. The button calls `shareCardImage` with `banner_type: "verdict"`.

### Surface 3: 👑 Called-it modal

When `Yesterday.self_cluster_id` matches the #1 final cluster, show a full-screen modal at the end of `RevealAnimation` with a `ShareCardCalledIt` rendered offscreen + a "share to claim" hard CTA. (Phase 4 detection: API returns top_clusters with `final_rank=1`. If `self_cluster_id === topClusters[0].id`, the user called it.)

### Surface 4: Post-reveal interstitial

Inside `index.tsx`'s `handleRevealComplete`, after `markRevealSeen` and before `loadQuestion`, check the interstitial gate. If unshown for this question_id and `loadInterstitialOnce` returns a controller, await `controller.show()`, mark it shown, then continue. All wrapped in try/catch so a failed ad load doesn't block the today flow.

Because Phase 4 doesn't have a separate `RevealAnimation` re-test plan, the changes here are pragmatic: minimal new render branches + one new test in `index.test.tsx` for the interstitial gate.

> Many of the wires below are surgical edits. The plan shows the new code blocks in full so they're copy-pastable.

- [ ] **Step 1: Modify `WordcloudScreen.tsx` to add the share pill**

Open `ios/src/screens/WordcloudScreen.tsx`. The Phase 1 file accepts only `clusters`, `selfClusterId`, `totalCount`. Add the new optional share props and render path. The full updated component (preserve any existing styling not shown):

```tsx
import { useRef } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { ClusterBubble } from "@/src/components/ClusterBubble";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardTodaysTake } from "@/src/components/ShareCardTodaysTake";

export interface Cluster {
  id: string;
  canonical_text: string;
  submission_count: number;
}

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
  questionId?: string;
  questionText?: string;
  userAnswer?: string;
  dateLabel?: string;
}

export function WordcloudScreen({
  clusters,
  selfClusterId,
  totalCount,
  questionId,
  questionText,
  userAnswer,
  dateLabel,
}: Props) {
  const cardRef = useRef<View>(null);

  return (
    <View style={styles.root}>
      {questionId && questionText && userAnswer && dateLabel && (
        <View style={styles.shareBar}>
          <ShareButton
            viewRef={cardRef as any}
            banner_type="todays_take"
            question_id={questionId}
            share_target="system"
            label="🌍 share"
          />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.cloud}>
        {clusters.map((c) => (
          <ClusterBubble
            key={c.id}
            text={c.canonical_text}
            count={c.submission_count}
            total={totalCount}
            highlight={c.id === selfClusterId}
          />
        ))}
      </ScrollView>
      {questionId && questionText && userAnswer && dateLabel && (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <View ref={cardRef} collapsable={false}>
            <ShareCardTodaysTake
              questionText={questionText}
              userAnswer={userAnswer}
              date={dateLabel}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  shareBar: { position: "absolute", top: 60, right: 16, zIndex: 10 },
  cloud: { padding: 16, alignItems: "center", paddingTop: 100 },
  offscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
```

- [ ] **Step 2: Modify `RevealAnimation.tsx` to render share CTAs after verdict**

Open `ios/src/components/RevealAnimation.tsx`. The Phase 2 file plays the 12-sec sequential reveal then calls `onComplete`. Phase 4 adds: at end-of-reveal, render a "share verdict" CTA + (when `selfClusterId === topClusters[0]?.id`) a "👑 share called-it" CTA. Both use offscreen `ShareCardVerdict` / `ShareCardCalledIt` instances captured by ref.

This is the surgical addition (assumes Phase 2 component exposes a final-state branch — if not, edit minimally to add one). Show the FULL updated render for clarity:

```tsx
import { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ClusterBubble } from "@/src/components/ClusterBubble";
import { ShareCardVerdict } from "@/src/components/ShareCardVerdict";
import { ShareCardCalledIt } from "@/src/components/ShareCardCalledIt";
import { shareCardImage } from "@/src/lib/shareCard";

interface RevealCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

interface Props {
  questionId?: string;
  questionText: string;
  clusters: RevealCluster[];
  selfClusterId: string | null;
  selfHandle?: string | null;
  dateLabel?: string;
  onComplete: () => void;
  intervalMs?: number;
}

export function RevealAnimation({
  questionId,
  questionText,
  clusters,
  selfClusterId,
  selfHandle = null,
  dateLabel = "",
  onComplete,
  intervalMs = 1000,
}: Props) {
  const [step, setStep] = useState(0);
  const total = Math.min(10, clusters.length);
  const verdictRef = useRef<View>(null);
  const calledItRef = useRef<View>(null);

  useEffect(() => {
    if (step >= total) return;
    const t = setInterval(() => setStep((s) => s + 1), intervalMs);
    return () => clearInterval(t);
  }, [step, total, intervalMs]);

  const visible = clusters.slice(0, step).reverse();
  const verdict = clusters[0];
  const userRank =
    selfClusterId
      ? clusters.findIndex((c) => c.id === selfClusterId) + 1 || null
      : null;
  const userPercentile =
    userRank !== null
      ? Math.max(0, Math.min(100, Math.floor(((clusters.length - userRank + 1) / clusters.length) * 100)))
      : null;
  const calledIt = !!selfClusterId && verdict?.id === selfClusterId;

  const onShareVerdict = async () => {
    if (!questionId) return;
    try {
      await shareCardImage({
        viewRef: verdictRef as any,
        banner_type: "verdict",
        question_id: questionId,
        share_target: "system",
      });
    } catch (e) {
      console.warn("share verdict failed", e);
    }
  };

  const onShareCalledIt = async () => {
    if (!questionId) return;
    try {
      await shareCardImage({
        viewRef: calledItRef as any,
        banner_type: "called_it",
        question_id: questionId,
        share_target: "system",
      });
    } catch (e) {
      console.warn("share called-it failed", e);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>🌍 the world said: {verdict?.canonical_text ?? "…"}</Text>
      <View style={styles.list}>
        {visible.map((c) => (
          <ClusterBubble
            key={c.id}
            text={c.canonical_text}
            count={c.submission_count}
            total={c.submission_count}
            highlight={c.id === selfClusterId}
          />
        ))}
      </View>

      {step >= total && (
        <View style={styles.cta}>
          <Pressable role="button" onPress={onShareVerdict} style={styles.shareBtn}>
            <Text style={styles.shareLabel}>SHARE THE VERDICT</Text>
          </Pressable>
          {calledIt && (
            <Pressable role="button" onPress={onShareCalledIt} style={[styles.shareBtn, styles.crownBtn]}>
              <Text style={styles.shareLabel}>👑 SHARE — YOU CALLED IT</Text>
            </Pressable>
          )}
          <Pressable role="button" onPress={onComplete} style={styles.continueBtn}>
            <Text style={styles.continueLabel}>continue →</Text>
          </Pressable>
        </View>
      )}

      {/* Offscreen capture targets */}
      {questionId && (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <View ref={verdictRef} collapsable={false}>
            <ShareCardVerdict
              verdictText={verdict?.canonical_text ?? ""}
              topClusters={clusters.slice(1, 7).map((c) => ({
                canonical_text: c.canonical_text,
                final_rank: c.final_rank,
              }))}
              userRank={userRank}
              percentile={userPercentile}
              date={dateLabel}
            />
          </View>
          <View ref={calledItRef} collapsable={false}>
            <ShareCardCalledIt
              verdictText={verdict?.canonical_text ?? ""}
              clusterCount={verdict?.submission_count ?? 0}
              handle={selfHandle}
              date={dateLabel}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", padding: 24, paddingTop: 80 },
  intro: { color: "#aaff00", fontSize: 24, fontWeight: "800", marginBottom: 24, textAlign: "center" },
  list: { flex: 1 },
  cta: { gap: 12, paddingVertical: 16 },
  shareBtn: { backgroundColor: "#aaff00", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999, alignItems: "center" },
  crownBtn: { backgroundColor: "#fff" },
  shareLabel: { color: "#000", fontWeight: "900", letterSpacing: 1 },
  continueBtn: { paddingVertical: 12, alignItems: "center" },
  continueLabel: { color: "#888", fontSize: 14 },
  offscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
```

> The Phase 2 `RevealAnimation.test.tsx` may fail if its assertions hardcode the exact prop set or the absence of CTAs. Update the existing tests to pass `questionId={undefined}` so the new CTAs / offscreen branches don't render. Targeted change to keep the Phase-2 test green: add `questionId` (optional) — when undefined, skip rendering the cta / offscreen blocks. Already done above (`{questionId && ...}` guard).

- [ ] **Step 3: Wire interstitial trigger in `app/(tabs)/index.tsx`**

Open `ios/app/(tabs)/index.tsx`. Phase 3 has `handleRevealComplete` which calls `markRevealSeen` then `loadQuestion`. Phase 4 inserts the interstitial step. New imports + new `handleRevealComplete`:

```tsx
import { hasShownInterstitialFor, markInterstitialShownFor } from "@/src/lib/interstitialGate";
import { loadInterstitialOnce } from "@/src/lib/ads";
```

Replace the existing `handleRevealComplete`:

```tsx
const handleRevealComplete = useCallback(async () => {
  if (yesterday) {
    await markRevealSeen(yesterday.id);
    try {
      const alreadyShown = await hasShownInterstitialFor(yesterday.id);
      if (!alreadyShown) {
        const controller = await loadInterstitialOnce();
        if (controller) {
          await controller.show();
          await markInterstitialShownFor(yesterday.id);
        }
      }
    } catch (e) {
      console.warn("interstitial failed", e);
    }
  }
  loadQuestion();
}, [yesterday, loadQuestion]);
```

Also update the `<RevealAnimation>` render to pass `questionId` so the new share CTAs activate:

```tsx
{phase === "reveal" && yesterday && (
  <RevealAnimation
    questionId={yesterday.id}
    questionText={yesterday.text}
    clusters={yesterday.top_clusters}
    selfClusterId={yesterday.self_cluster_id}
    onComplete={handleRevealComplete}
  />
)}
```

(The `dateLabel` prop is intentionally left empty here — Phase 5 wires real date formatting from the question's `revealed_at`.)

Also wire share props to `WordcloudScreen` after submit:

```tsx
{phase === "wordcloud" && question && (
  <WordcloudScreen
    clusters={clusters}
    selfClusterId={selfClusterId}
    totalCount={totalCount}
    questionId={question.id}
    questionText={question.text}
    userAnswer={text}
    dateLabel={new Date().toISOString().slice(0, 10)}
  />
)}
```

- [ ] **Step 4: Add an iOS test that verifies interstitial gate is consulted**

There is no existing `ios/app/(tabs)/index.test.tsx`. Skipping a new test on the tab file (full-tree integration test would re-mock too much). Instead, the unit-level coverage of `interstitialGate` (Task 11) + `loadInterstitialOnce` (Task 9 — null when disabled) + the gate logic (cap = 1/user/day) constitutes the acceptance signal. Real interstitial display is Phase 6.

> If the executor wants belt-and-braces coverage, the relevant assertion is: `hasShownInterstitialFor` is called once with `yesterday.id`. That can live in a thin React Native test if needed; otherwise skip.

- [ ] **Step 5: Run the full iOS suite**

```powershell
cd C:\Users\levin\relatably\ios
pnpm test
```

Expected: all Phase 1+2+3+4 iOS tests green. Total ≥ 70 tests on iOS side.

- [ ] **Step 6: Run TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: no type errors. Fixes if any: usually missing imports or prop-shape drift in the WordcloudScreen / RevealAnimation files. If `WordcloudScreen.test.tsx` exists with the old prop shape, update it to pass `questionId={undefined}` (no share props) and assert the share button is NOT rendered.

- [ ] **Step 7: Commit**

```powershell
cd C:\Users\levin\relatably
git add ios/src/screens/WordcloudScreen.tsx ios/src/components/RevealAnimation.tsx ios/app/(tabs)/index.tsx
git commit -m "feat(ios): wire share triggers (wordcloud/verdict/called-it) + post-reveal interstitial"
```

---

## Task 17: Phase 4 acceptance gate (manual emulator + iOS test sweep)

**Files:** none (verification only)

This task is the executor + Levin checkpoint. It does not write code; it confirms the build is shippable.

- [ ] **Step 1: Run the full backend suite + functions suite**

```powershell
cd C:\Users\levin\relatably\api
pnpm test

cd C:\Users\levin\relatably\firebase\functions
pnpm test

cd C:\Users\levin\relatably\ios
pnpm test
```

Expected: 3 green test runs. Sum total ≥ 220 tests across all 3 codebases.

- [ ] **Step 2: Boot emulator + run the manual checklist**

```powershell
$env:PATH = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin;" + $env:PATH
cd C:\Users\levin\relatably\firebase
firebase emulators:start --only firestore,auth,functions
```

In a second window:

```powershell
cd C:\Users\levin\relatably\api
pnpm dev
```

Then run the manual smoke test from another shell (replace `<TOKEN>` with an emulator-forged token from http://localhost:4000/auth):

```powershell
# (a) anonymous share track returns referral code + writes share_event
curl.exe -X POST http://localhost:3000/api/share/track `
  -H "content-type: application/json" `
  -d '{"banner_type":"todays_take","question_id":"q-test","share_target":"ig_story"}'

# Expected: 200 + {"referral_code":"<code>"}
# Verify in Emulator UI: share_events collection has 1 doc with user_id=null

# (b) authed share track persists user_id
curl.exe -X POST http://localhost:3000/api/share/track `
  -H "content-type: application/json" `
  -H "authorization: Bearer <TOKEN>" `
  -d '{"banner_type":"verdict","question_id":"q-test","share_target":"tiktok"}'

# Expected: 200 + new code; share_events doc has user_id=<uid from token>

# (c) friends enrichment returns handle + locale
curl.exe -X GET http://localhost:3000/api/friends `
  -H "authorization: Bearer <TOKEN>"

# Expected: { friendships: [{ id, friend_user_id, handle, locale, status, direction }] }

# (d) leaderboard with a forged 31+ friends test scenario:
# Manually create 31 friendships in Emulator UI for the signed-in uid,
# 5 with leaderboard_entries for the latest revealed question.
curl.exe "http://localhost:3000/api/leaderboard?period=daily&scope=friends&limit=50" `
  -H "authorization: Bearer <TOKEN>"

# Expected: entries returned merged from 2 chunked queries (30+1).
```

Then trigger the moderation review path:

```powershell
# (e) Submit a toxic comment (should fail Phase 1 regex first)
curl.exe -X POST http://localhost:3000/api/submit `
  -H "content-type: application/json" `
  -d '{"question_id":"q-live","device_token":"d1","raw_text":"kys","dwell_ms":5000}'

# Expected: 400 (regex blocked it before tier-2 even runs)

# (f) Submit something that bypasses regex but trips Perspective
# (only possible if PERSPECTIVE_API_KEY is set — Phase 4 default has it unset).
# When unset, submission is created passed; moderationReview function fires;
# it skips Perspective and just stamps tier2_reviewed_at.

# Expected: in Emulator UI, submissions/<id> has tier2_reviewed_at + moderation_status='passed'.
```

- [ ] **Step 3: TypeScript + ESLint sanity sweep**

```powershell
cd C:\Users\levin\relatably\api;            pnpm lint
cd C:\Users\levin\relatably\firebase\functions; pnpm build
cd C:\Users\levin\relatably\ios;            pnpm lint
cd C:\Users\levin\relatably\ios;            npx tsc --noEmit
```

Expected: no errors anywhere.

- [ ] **Step 4: Tag + push the Phase 4 ship**

```powershell
cd C:\Users\levin\relatably
git tag phase-4-complete
git push https://lawoflarge:<GH_TOKEN>@github.com/lawoflarge/relatably.git phase-4-share-monetization --tags
```

- [ ] **Step 5: Update memory file**

Edit `C:\Users\levin\.claude\projects\C--Users-levin\memory\project_relatably.md`:

- Bump status line to "Phase 4 complete 2026-05-XX (date of ship)".
- Add a "Phase 4 — Share + Monetization (shipped …)" section mirroring the Phase 1/2/3 sections: list each commit, explicit spec deviations, Phase 4 follow-ups flagged for Phase 5/6.
- Update the phase-plan table.

> Memory update is a small dedicated edit — not new content here, just align with the actual ship state.

---

## Phase 4 follow-ups deferred to Phase 5 / Phase 6

These items are explicitly **out of scope for Phase 4** and have plan stubs in the appropriate later phase:

| Item | Phase | Why deferred |
|---|---|---|
| Real AdMob impressions on a physical iPhone | 6 | Needs Mac + AdMob account. Phase 4 ships the adapter behind `EXPO_PUBLIC_ADMOB_ENABLED`. |
| Real Branch.io install attribution validation | 6 | Needs Branch.io account + Mac. Adapter is wired; production swap is one env var. |
| Real Perspective API key | 4 (post-merge) | Account/key is a pure env-var swap; no code change. Levin can set `PERSPECTIVE_API_KEY` in Vercel + Firebase Functions config when ready. |
| Branch.io install handler that deep-links a referrer credit into the today flow | 6 | Phase 4 just generates + signs codes. Phase 6 reads them on first-open + bumps `user_aggregates.referrals_count`. |
| Archive grid real content (past questions + thumbnails) | 5 | Phase 4 ships the empty scaffold + ad-injection logic; Phase 5 fills tiles. |
| `react-native-view-shot` real-device validation | 6 | Cannot validate PNG output from CI. |
| Leaderboard cache via Upstash Redis (post-drop spike) | 6 | Cost optimization, not feature. |
| Behavioral classifier model training | post-launch | Pipeline collects features in Phases 1+3; model trained ~month 2. |
| Pagination beyond ~300 friends | 5+ | Friend graph in v1.0 expected to be small. |
| `scoreReveal` idempotency guard (Phase 3 leftover) | 6 | Hardening item. |
| `fanoutPush` idempotency + pLimit (Phase 2 leftover) | 6 | Hardening item. |

---

## Self-Review notes

**Spec coverage check (section 7):**
- "(1) Today's take banner — after submit" → Task 14 + Task 16 wordcloud share pill ✅
- "(2) Today's verdict banner — after reveal animation" → Task 14 + Task 16 reveal CTA ✅
- "(3) 👑 You called it banner — only for global first-mover" → Task 14 + Task 16 conditional CTA ✅
- "All banners 9:16 vertical (1080×1920), generated client-side" → Task 14 dimensions enforced via test ✅
- "Branch.io tracks installs from banner views" → Task 7 + Task 8 + Task 10 + Task 15 ✅
- "Three banner template components" → Task 14 ✅
- "Native iOS share sheet" → Task 15 via `expo-sharing` ✅
- "Embedded referral code in image metadata + visible relatably.app URL" → referral code in URL via `?r=`; image metadata embedding deferred to Phase 6 (not blocking) ⚠️ (acceptable — visible URL ships now, EXIF embedding is a polish item)

**Spec coverage check (section 6 — moderation):**
- "Perspective API + regex blocklist. Two-tier toxicity detection." → Task 2 + Task 3 + Task 4 ✅ (regex is Phase 1; Perspective tier-2 ships async in Phase 4)

**Spec coverage check (section 7 — ad placements):**
- "Leaderboard tab: native banner between rows 10/11" → Task 12 ✅
- "Archive tab: native banner every 8 tiles" → Task 13 ✅
- "Post-reveal interstitial: 1× per user per day, after share CTA, skippable after 5 sec" → Task 11 + Task 16 ✅ ("skippable after 5 sec" is AdMob's default for interstitial ads — no extra code needed)

**Phase 3 follow-ups marked for Phase 4:**
- Perspective API tier-2 → Tasks 2-4 ✅
- `GET /api/friends` handle enrichment → Task 5 ✅
- Friend leaderboard pagination >30 → Task 6 ✅

**Type consistency:**
- `BannerType = "todays_take" | "verdict" | "called_it"` defined once in `api/src/lib/branch.ts` and once in `ios/src/types/api.ts`. **They must stay in lockstep.** If a future task adds a 4th banner type, update both.
- `ShareTarget = "ig_story" | "tiktok" | "snap" | "imessage" | "system"` defined in `ios/src/types/api.ts` and constrained by Zod enum in `api/src/app/api/share/track/route.ts`. **Must match.**
- `Friendship` shape (`{ id, friend_user_id, handle, locale, status, direction }`) defined in `ios/src/types/api.ts` and matched by `api/src/app/api/friends/route.ts` response. **Confirmed identical in Task 5.**

**Placeholder scan:** No "TBD", "implement later", "fill in details" remain. Every task has executable code.

---

**End of Phase 4 implementation plan.**






