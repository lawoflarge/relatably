# Relatably Phase 6 — Launch Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the functionally-complete Relatably app (Phases 1–5) and ship v1.0 to the worldwide App Store with Cloud Functions deployed, Sentry observability, three Firebase Remote Config kill-switches, idempotency hardening for the three retry-vulnerable Cloud Functions, parallel FCM fanout, a k6 load test at 1k concurrent, and 60 hand-curated launch questions seeded.

**Architecture:** Five workstreams executed in lane order (cloud readiness → accounts → load test → launch content → iOS build/App Store). Sentry on all three runtimes (Vercel api/, GCP Cloud Functions, iOS). Firebase Remote Config provides the three kill-switches without adding a vendor. Idempotency uses a shared `runOnce(key, fn)` helper backed by a `function_runs/{key}` Firestore guard doc. FCM fanout becomes parallel via `pLimit(10)`. Load test uses k6 against prod with a bearer-gated synthetic-data flag. App Store submission follows the Titi & Bina precedent — agent runs `eas build` + `eas submit` (uploads .ipa to ASC); Levin clicks "Submit for Review" in the ASC web UI.

**Tech Stack:**
- Backend: Next.js 16 (api/), Firebase Cloud Functions v2 (firebase/functions/), Firebase Admin SDK
- Observability: Sentry (free tier) — `@sentry/node` (api), `@sentry/google-cloud-serverless` (functions), `@sentry/react-native` (iOS)
- Kill-switches: Firebase Remote Config (server-side via Admin SDK, client-side via @react-native-firebase/remote-config)
- Load test: k6 (single static binary, JS-scripted)
- iOS build: Expo + EAS Build (cloud Mac); `@sentry/react-native` Expo plugin for sourcemap upload
- Spec source of truth: `docs/superpowers/specs/2026-05-09-relatably-phase6-launch-hardening.md`

---

## Scope reminders (locked from brainstorm)

- **Wedge:** full launch (App Store submission included).
- **Out of scope (Phase 7):** PostHog, server-rendered thumbnails, image-metadata referral, Branch first-open credit, Upstash leaderboard cache, friend pagination >300, App Attest, admin polish.
- **Launch scale:** built for ~1k concurrent submits with kill-switches.
- **Geography:** worldwide day-1, English metadata, EN questions, UTC drop time.
- **Assets:** Levin confirmed icon + screenshots + copy + privacy/support URL all ready.
- **Launch questions:** Claude drafts 60 → Levin reviews → script seeds them as approved candidates + 60 scheduled questions across 60 UTC days.

## Pre-flight git plan

Run from `C:\Users\levin\relatably`:

```bash
git switch phase-5-archive-admin           # current branch tip = c7bb7b5 + spec commit 54e0bd3
git pull origin phase-5-archive-admin      # ensure tip matches origin
git switch -c phase-6-launch-hardening     # cut new branch
git tag phase-6-plan-seed                  # tag the seed point
git push https://lawoflarge:<TOKEN>@github.com/lawoflarge/relatably.git phase-6-launch-hardening --tags
```

Token is in `~/.claude/projects/C--Users-levin/memory/github_token.md`.

Each task = one commit. End-of-phase: tag `phase-6-complete` + push.

## Test commands cheat sheet

- api/ tests: `cd api && pnpm vitest run` (uses `--passWithNoTests`)
- firebase/functions/ tests: `cd firebase/functions && pnpm vitest run`
- iOS tests: `cd ios && npx jest --runInBand` (NEVER use `pnpm test` — it picks up the wrong runner)
- iOS typecheck: `cd ios && npx tsc --noEmit`
- All emulators (Java 21 required): prepend `/c/Program Files/Microsoft/jdk-21.0.11.10-hotspot/bin` to PATH then `cd firebase && firebase emulators:start --only firestore,auth,functions`

## Vitest hoisting reminder

Backend tests using top-level `vi.mock(...)` with fixture references MUST wrap fixtures in `vi.hoisted()`:

```typescript
const { fakeFirestore } = vi.hoisted(() => ({
  fakeFirestore: { collection: vi.fn(), runTransaction: vi.fn() },
}));
vi.mock("@/lib/admin", () => ({ db: () => fakeFirestore }));
```

Without `vi.hoisted()`, Vitest hoists `vi.mock` above the fixture declaration and you get "Cannot access before initialization."

---

## Task ordering at a glance

| # | Task | Lane | Manual? |
|---|------|------|---------|
| 1 | Firebase project Blaze plan upgrade | 1 | YES (Levin clicks in console) |
| 2 | `lib/idempotency.ts` (functions) — `runOnce` helper | 1 | code |
| 3 | Wrap `moderationReview` in `runOnce` | 1 | code |
| 4 | Wrap `fanoutPush` in `runOnce` + parallel `pLimit(10)` | 1 | code |
| 5 | Wrap `scoreReveal` in `runOnce` | 1 | code |
| 6 | `lib/remoteConfig.ts` (functions) — cached reader | 1 | code |
| 7 | `triggerDrop` honors `drop_enabled` flag | 1 | code |
| 8 | Sentry on Cloud Functions | 1 | code + Levin creates Sentry project |
| 9 | Sentry on api/ + Next.js 16 instrumentation hook | 1 | code |
| 10 | Deploy Cloud Functions + smoke test | 1 | YES (Levin runs deploy + verifies) |
| 11 | AdMob account + EAS env wiring + verification check | 2 | YES + verify |
| 12 | Branch.io account + Vercel/EAS env + verification | 2 | YES + verify |
| 13 | Perspective API key + Functions config + verification | 2 | YES + verify |
| 14 | Firebase Auth Google sign-in for /admin + Vercel env | 2 | YES + verify |
| 15 | Submit-rate-limit Remote Config override | 1 | code |
| 16 | Leaderboard endpoint kill-switch (503 short-circuit) | 1 | code |
| 17 | k6 load script + synthetic-data bearer + cleanup script | 3 | code + Levin runs |
| 18 | 60 launch questions drafted + seed script + dry-run | 4 | code + Levin reviews + Levin runs |
| 19 | iOS Sentry SDK + init + remote config wrapper | 5 | code |
| 20 | iOS EAS production profile + env injection + sourcemap upload | 5 | code |
| 21 | EAS prod build + TestFlight upload + dogfood checklist + ASC submission | 5 | YES (Levin runs eas commands + dogfoods + clicks Submit in ASC) |

---

## Task 1: Firebase project Blaze plan upgrade

**Files:** none (this is a Levin-driven manual step + agent verification)

**Why this is first:** Cloud Functions deploy (Task 10) requires the Firebase project on the Blaze (pay-as-you-go) plan. Spark plan blocks `firebase deploy --only functions` with `HTTP Error: 400, Billing account for project 'relatably-prod' is not found.` Doing this upfront unblocks Lane 1 entirely.

- [ ] **Step 1: Levin upgrades the project**

Levin opens https://console.firebase.google.com/project/relatably-prod/usage/details and clicks **Upgrade project** → **Blaze** → attaches a billing account (credit card). Default Blaze tier comes with the same free quota as Spark; no spend until you cross it.

- [ ] **Step 2: Agent verifies the upgrade landed**

```bash
gcloud billing projects describe relatably-prod --format=json
```

Expected output contains `"billingEnabled": true`. If `gcloud` is not installed or not authenticated for `relatably-prod`, alternative check:

```bash
firebase projects:list | grep relatably-prod
```

Expected: project listed. Then attempt a no-op deploy dry-run:

```bash
cd firebase && firebase deploy --only functions --dry-run --project relatably-prod 2>&1 | head -20
```

Expected: NO billing error. (Other errors like "no functions to deploy" or "first deploy" are fine — we just need the billing gate cleared.)

- [ ] **Step 3: Commit a marker doc**

Create `firebase/BLAZE_VERIFIED.md`:

```markdown
# Firebase Blaze plan verified

Verified on: <YYYY-MM-DD>
Verified by: <agent or Levin>
Project: relatably-prod
Method: <gcloud billing projects describe / firebase deploy --dry-run>

Cloud Functions deploys are now unblocked. See Task 10.
```

```bash
git add firebase/BLAZE_VERIFIED.md
git commit -m "ops: confirm Firebase Blaze plan active for relatably-prod"
```

---

## Task 2: `firebase/functions/src/lib/idempotency.ts` — `runOnce(key, fn)` helper

**Files:**
- Create: `firebase/functions/src/lib/idempotency.ts`
- Create: `firebase/functions/src/lib/idempotency.test.ts`

This is the shared helper that makes the three retry-vulnerable Cloud Functions safe under platform retries. It claims a `function_runs/{key}` doc atomically, runs the function, then stamps `completed_at`.

- [ ] **Step 1: Write failing tests**

```typescript
// firebase/functions/src/lib/idempotency.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runOnce } from "./idempotency";

const { fakeFirestore, fakeRef, txn, txnGet, txnSet, refUpdate } = vi.hoisted(() => {
  const txnGet = vi.fn();
  const txnSet = vi.fn();
  const refUpdate = vi.fn();
  const fakeRef = { update: refUpdate };
  const collectionDoc = vi.fn(() => fakeRef);
  const collection = vi.fn(() => ({ doc: collectionDoc }));
  const txn = vi.fn(async (cb: (t: { get: typeof txnGet; set: typeof txnSet }) => Promise<unknown>) => {
    return await cb({ get: txnGet, set: txnSet });
  });
  return {
    fakeFirestore: { collection, runTransaction: txn },
    fakeRef,
    txn,
    txnGet,
    txnSet,
    refUpdate,
  };
});

vi.mock("./admin", () => ({
  db: () => fakeFirestore,
}));

describe("runOnce", () => {
  beforeEach(() => {
    txnGet.mockReset();
    txnSet.mockReset();
    refUpdate.mockReset();
  });

  it("runs the inner fn when no guard doc exists yet", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const inner = vi.fn(async () => "ok");
    const result = await runOnce("test:abc", inner);
    expect(result).toBe("ok");
    expect(inner).toHaveBeenCalledTimes(1);
    expect(txnSet).toHaveBeenCalledTimes(1);
    expect(refUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips and returns null when guard doc already exists", async () => {
    txnGet.mockResolvedValue({ exists: true });
    const inner = vi.fn(async () => "should not run");
    const result = await runOnce("test:abc", inner);
    expect(result).toBeNull();
    expect(inner).not.toHaveBeenCalled();
    expect(txnSet).not.toHaveBeenCalled();
  });

  it("does NOT stamp completed_at if inner fn throws", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const inner = vi.fn(async () => { throw new Error("boom"); });
    await expect(runOnce("test:abc", inner)).rejects.toThrow("boom");
    expect(refUpdate).not.toHaveBeenCalled();
  });

  it("uses the key as the doc id under function_runs", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const collectionMock = (fakeFirestore.collection as ReturnType<typeof vi.fn>);
    await runOnce("scoreReveal:q123", async () => "v");
    expect(collectionMock).toHaveBeenCalledWith("function_runs");
  });

  it("returns the inner fn's value on success", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const result = await runOnce("k", async () => ({ count: 42 }));
    expect(result).toEqual({ count: 42 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd firebase/functions && pnpm vitest run src/lib/idempotency.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `idempotency.ts`**

```typescript
// firebase/functions/src/lib/idempotency.ts
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";

/**
 * Runs `fn` exactly once across Cloud Functions retries for a given key.
 *
 * The first invocation atomically claims a `function_runs/{key}` guard doc
 * inside a Firestore transaction, then runs `fn` outside the transaction
 * (Firestore txns can't span the long inner work). On success, stamps
 * `completed_at`. On failure, the guard doc remains with only `started_at`
 * — operators can clean up (or you can add a janitor — Phase 7).
 *
 * Returns the inner fn's value on a fresh run, or `null` if the key was
 * already claimed (i.e. this is a retry).
 */
export async function runOnce<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const ref = db().collection("function_runs").doc(key);
  const proceed = await db().runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (snap.exists) return false;
    txn.set(ref, { started_at: FieldValue.serverTimestamp() });
    return true;
  });
  if (!proceed) return null;
  const value = await fn();
  await ref.update({ completed_at: FieldValue.serverTimestamp() });
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd firebase/functions && pnpm vitest run src/lib/idempotency.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/lib/idempotency.ts firebase/functions/src/lib/idempotency.test.ts
git commit -m "feat(functions): add runOnce idempotency helper backed by function_runs guard doc"
```

---

## Task 3: Wrap `moderationReview` in `runOnce`

**Files:**
- Modify: `firebase/functions/src/moderationReview.ts`
- Modify: `firebase/functions/src/moderationReview.emulator.test.ts`

The function already has an inner `tier2_reviewed_at` guard, but Cloud Functions v2 retries can race that check. Wrap the whole `runModerationReview` body in `runOnce` keyed by `moderationReview:${submissionId}`.

- [ ] **Step 1: Read the existing file**

```bash
cat firebase/functions/src/moderationReview.ts
```

Identify the `export const moderationReview = onDocumentCreated(...)` wrapper and the exported `runModerationReview(firestore, submissionId)` worker.

- [ ] **Step 2: Update the wrapper to use `runOnce`**

In `firebase/functions/src/moderationReview.ts`, locate the trigger export at the bottom and replace its body:

```typescript
// at the top — add the import
import { runOnce } from "./lib/idempotency";

// at the bottom — replace existing trigger body
export const moderationReview = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    region: "us-central1",
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    await runOnce(`moderationReview:${submissionId}`, () =>
      runModerationReview(db(), submissionId),
    );
  },
);
```

(`runModerationReview` and `db` are already imported at the top of the file.)

- [ ] **Step 3: Add an emulator test that proves second invocation is a no-op**

Append to `firebase/functions/src/moderationReview.emulator.test.ts` a new test:

```typescript
import { describe, it, expect } from "vitest";
import { runOnce } from "./lib/idempotency";

// (append inside the existing describe block — use the same emulator setup the
// other tests in this file already perform.)

describe("idempotency wrap", () => {
  it("second invocation for same submission_id is a no-op", async () => {
    // Reuse the same `firestore` test helper the file already uses to seed
    // a submission. Then call runModerationReview twice via runOnce.
    const submissionId = "idem-test-1";
    // ... seed a submission doc with moderation_status=pending ...
    await runOnce(
      `moderationReview:${submissionId}`,
      () => runModerationReview(firestore, submissionId),
    );
    const inner = vi.fn(async () => {
      throw new Error("should not run twice");
    });
    const result = await runOnce(`moderationReview:${submissionId}`, inner);
    expect(result).toBeNull();
    expect(inner).not.toHaveBeenCalled();
  });
});
```

(If the existing test file structure already has emulator helper imports, reuse them — don't recreate. If not, follow the structure of the existing tests in the file: `beforeAll` to point Firestore at emulator, `beforeEach` to clear `function_runs` and `submissions` collections.)

- [ ] **Step 4: Run tests**

```bash
cd firebase/functions && pnpm vitest run src/moderationReview.emulator.test.ts
```

Expected: all green (existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/moderationReview.ts firebase/functions/src/moderationReview.emulator.test.ts
git commit -m "feat(functions): wrap moderationReview in runOnce for retry safety"
```

---

## Task 4: Wrap `fanoutPush` in `runOnce` + parallelize FCM batches with `pLimit(10)`

**Files:**
- Modify: `firebase/functions/src/fanoutPush.ts`
- Modify: `firebase/functions/src/fanoutPush.test.ts`
- Modify: `firebase/functions/package.json` (add `p-limit` dep)

Two improvements at once: idempotency on retries, AND replace the serial `for (const batch of batches) { await ... }` with parallel batches limited to 10 concurrent FCM calls.

- [ ] **Step 1: Add `p-limit` dep**

```bash
cd firebase/functions && pnpm add p-limit@^5
```

Expected: package.json gets `"p-limit": "^5.0.0"`; lockfile updated.

- [ ] **Step 2: Write/update failing tests**

Find the existing test that asserts FCM batch sends are awaited (probably called something like "sends all batches"). Add two new tests AND modify any existing test that expects serial calls.

```typescript
// firebase/functions/src/fanoutPush.test.ts
// (additions; preserve existing tests that aren't order-dependent)

import { runOnce } from "./lib/idempotency";

describe("idempotency wrap on event handler", () => {
  it("second invocation for same questionId is a no-op", async () => {
    // Reuse this file's existing fake firestore + fake messaging stubs.
    // The event handler is tested by calling the EXPORTED handler with the
    // same simulated event twice.
    const event = {
      params: { questionId: "q-idem" },
      data: {
        before: { data: () => ({ status: "scheduled", text: "x" }) },
        after: { data: () => ({ status: "live", text: "x" }) },
      },
    };
    // First call should fan out
    await fanoutPushHandler(event);
    fakeMessaging.sendEachForMulticast.mockClear();
    // Second call should NOT fan out
    await fanoutPushHandler(event);
    expect(fakeMessaging.sendEachForMulticast).not.toHaveBeenCalled();
  });
});

describe("parallel FCM fanout", () => {
  it("fires multiple batches concurrently (not serially)", async () => {
    // Seed 1500 device tokens → 3 batches of 500. Track call timing.
    // With pLimit(10), all 3 should be in-flight simultaneously.
    const tokens = Array.from({ length: 1500 }, (_, i) => `token-${i}`);
    // ... seed device_users docs with these tokens ...
    let inFlight = 0;
    let maxInFlight = 0;
    fakeMessaging.sendEachForMulticast.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { successCount: 500, failureCount: 0, responses: [] };
    });
    await runFanoutPush(fakeFirestore, fakeMessaging, {
      questionId: "q-parallel",
      before: { status: "scheduled", text: "x" },
      after: { status: "live", text: "x" },
    });
    expect(maxInFlight).toBeGreaterThan(1);
    expect(fakeMessaging.sendEachForMulticast).toHaveBeenCalledTimes(3);
  });
});
```

(If the file uses `vi.mock("./lib/admin", ...)` — preserve. The new test for the wrapper requires importing the actual exported `fanoutPush` const; rename the import locally as `fanoutPushHandler` for clarity.)

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd firebase/functions && pnpm vitest run src/fanoutPush.test.ts
```

Expected: 2 failures from the new tests. Existing tests should still pass.

- [ ] **Step 4: Update `fanoutPush.ts` — parallelize + wrap**

Modify the file. The full updated `runFanoutPush` and trigger export:

```typescript
// firebase/functions/src/fanoutPush.ts
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import pLimit from "p-limit";
import { db, messaging } from "./lib/admin";
import { batchTokens } from "./lib/batchTokens";
import { runOnce } from "./lib/idempotency";

interface QuestionDoc {
  status: string;
  text: string;
}

interface FanoutEvent {
  questionId?: string;
  before: QuestionDoc;
  after: QuestionDoc;
}

const FANOUT_CONCURRENCY = 10;

export async function runFanoutPush(
  firestore: Firestore,
  messagingClient: Messaging,
  event: FanoutEvent,
): Promise<void> {
  if (event.before.status === "live" || event.after.status !== "live") {
    return;
  }

  const snap = await firestore
    .collection("device_users")
    .where("fcm_token", "!=", null)
    .get();

  const tokens: string[] = snap.docs
    .map((d) => (d.data() as { fcm_token?: string | null }).fcm_token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  if (tokens.length === 0) {
    logger.info("fanoutPush: no devices to notify", { questionId: event.questionId });
    return;
  }

  const batches = batchTokens(tokens, 500);
  const limit = pLimit(FANOUT_CONCURRENCY);

  const results = await Promise.all(
    batches.map((batch) =>
      limit(() =>
        messagingClient.sendEachForMulticast({
          tokens: batch,
          notification: {
            title: "🚨 the world is voting NOW",
            body: event.after.text,
          },
          data: event.questionId ? { questionId: event.questionId } : {},
        }),
      ),
    ),
  );

  const success = results.reduce((acc, r) => acc + r.successCount, 0);
  const failure = results.reduce((acc, r) => acc + r.failureCount, 0);

  logger.info("fanoutPush: done", {
    questionId: event.questionId,
    batches: batches.length,
    success,
    failure,
  });
}

export const fanoutPush = onDocumentUpdated(
  { document: "questions/{questionId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data() as QuestionDoc | undefined;
    const after = event.data?.after.data() as QuestionDoc | undefined;
    if (!before || !after) return;
    const questionId = event.params.questionId;
    await runOnce(`fanoutPush:${questionId}`, () =>
      runFanoutPush(db(), messaging(), {
        questionId,
        before,
        after,
      }),
    );
  },
);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd firebase/functions && pnpm vitest run src/fanoutPush.test.ts
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add firebase/functions/src/fanoutPush.ts firebase/functions/src/fanoutPush.test.ts firebase/functions/package.json firebase/functions/pnpm-lock.yaml
git commit -m "feat(functions): wrap fanoutPush in runOnce + parallelize FCM batches with pLimit(10)"
```

---

## Task 5: Wrap `scoreReveal` in `runOnce`

**Files:**
- Modify: `firebase/functions/src/scoreReveal.ts`
- Modify: `firebase/functions/src/scoreReveal.test.ts` (or `.emulator.test.ts`)

`scoreReveal` is currently called from `triggerDrop.ts` directly (not its own trigger), but it still needs an idempotency guard because `triggerDrop` itself can be retried by the scheduler.

- [ ] **Step 1: Wrap the entry point**

In `firebase/functions/src/scoreReveal.ts`, locate the exported function `runScoreReveal(firestore, revealedQuestionId, ...)`. Add an idempotency wrapper. The cleanest spot is a new public function that wraps it:

```typescript
// at the top
import { runOnce } from "./lib/idempotency";

// add at the end of the file (after runScoreReveal):
export async function runScoreRevealOnce(
  firestore: Firestore,
  revealedQuestionId: string,
): Promise<void> {
  await runOnce(`scoreReveal:${revealedQuestionId}`, async () => {
    await runScoreReveal(firestore, revealedQuestionId);
  });
}
```

- [ ] **Step 2: Update `triggerDrop.ts` to call the wrapped version**

Find the `import { runScoreReveal } from "./scoreReveal";` line and change:

```typescript
import { runScoreRevealOnce } from "./scoreReveal";
```

Then find the call site (probably `await runScoreReveal(firestore, revealedQuestionId)` after the cluster ranking step) and change:

```typescript
await runScoreRevealOnce(firestore, revealedQuestionId);
```

- [ ] **Step 3: Add a test**

Append to `firebase/functions/src/scoreReveal.test.ts` (or `.emulator.test.ts` — pick whichever already runs against the emulator):

```typescript
describe("runScoreRevealOnce idempotency", () => {
  it("second invocation for same revealedQuestionId is a no-op", async () => {
    const qid = "score-idem-1";
    // Seed minimal state: a revealed question, one signed-in submission
    // so the first run actually creates a leaderboard_entry and bumps an aggregate.
    // (use the file's existing seeding helpers)
    await runScoreRevealOnce(firestore, qid);

    // Capture the leaderboard_entries count after first run
    const before = (await firestore
      .collection("leaderboard_entries")
      .where("question_id", "==", qid)
      .get()).size;

    // Second call should be a no-op
    await runScoreRevealOnce(firestore, qid);

    const after = (await firestore
      .collection("leaderboard_entries")
      .where("question_id", "==", qid)
      .get()).size;

    expect(after).toBe(before);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd firebase/functions && pnpm vitest run src/scoreReveal.test.ts
cd firebase/functions && pnpm vitest run src/triggerDrop.test.ts  # ensure refactor didn't break triggerDrop
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/scoreReveal.ts firebase/functions/src/triggerDrop.ts firebase/functions/src/scoreReveal.test.ts
git commit -m "feat(functions): wrap scoreReveal in runOnce; triggerDrop uses runScoreRevealOnce"
```

---

## Task 6: `firebase/functions/src/lib/remoteConfig.ts` — cached kill-switch reader

**Files:**
- Create: `firebase/functions/src/lib/remoteConfig.ts`
- Create: `firebase/functions/src/lib/remoteConfig.test.ts`

Server-side reader for Firebase Remote Config kill-switches. Caches the template for 5 minutes to avoid hammering the API on every function invocation.

- [ ] **Step 1: Write failing tests**

```typescript
// firebase/functions/src/lib/remoteConfig.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getKillSwitch, __resetRemoteConfigCacheForTest } from "./remoteConfig";

const { getTemplate } = vi.hoisted(() => ({ getTemplate: vi.fn() }));

vi.mock("firebase-admin/remote-config", () => ({
  getRemoteConfig: () => ({ getTemplate }),
}));

vi.mock("./admin", () => ({
  getAdminApp: () => ({}),
}));

describe("getKillSwitch", () => {
  beforeEach(() => {
    getTemplate.mockReset();
    __resetRemoteConfigCacheForTest();
  });

  it("returns the boolean default value when flag is unset", async () => {
    getTemplate.mockResolvedValue({
      parameters: {},
    });
    const v = await getKillSwitch("drop_enabled", true);
    expect(v).toBe(true);
  });

  it("returns the boolean override when set to false", async () => {
    getTemplate.mockResolvedValue({
      parameters: { drop_enabled: { defaultValue: { value: "false" } } },
    });
    const v = await getKillSwitch("drop_enabled", true);
    expect(v).toBe(false);
  });

  it("returns the int override when flag is a number string", async () => {
    getTemplate.mockResolvedValue({
      parameters: { submit_rate_limit_per_min: { defaultValue: { value: "3" } } },
    });
    const v = await getKillSwitch("submit_rate_limit_per_min", 10);
    expect(v).toBe(3);
  });

  it("falls back to default if Remote Config call throws", async () => {
    getTemplate.mockRejectedValue(new Error("network down"));
    const v = await getKillSwitch("drop_enabled", true);
    expect(v).toBe(true);
  });

  it("caches the template (second call within TTL does not re-fetch)", async () => {
    getTemplate.mockResolvedValue({ parameters: {} });
    await getKillSwitch("drop_enabled", true);
    await getKillSwitch("drop_enabled", true);
    expect(getTemplate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd firebase/functions && pnpm vitest run src/lib/remoteConfig.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `remoteConfig.ts`**

```typescript
// firebase/functions/src/lib/remoteConfig.ts
import { getRemoteConfig, type RemoteConfigTemplate } from "firebase-admin/remote-config";
import { logger } from "firebase-functions/v2";
import { getAdminApp } from "./admin";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  template: RemoteConfigTemplate;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

export function __resetRemoteConfigCacheForTest(): void {
  cache = null;
}

async function getTemplate(): Promise<RemoteConfigTemplate> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.template;
  }
  const template = await getRemoteConfig(getAdminApp()).getTemplate();
  cache = { template, fetchedAt: now };
  return template;
}

function readRaw(template: RemoteConfigTemplate, key: string): string | undefined {
  const param = template.parameters?.[key];
  if (!param) return undefined;
  const dv = param.defaultValue as { value?: string } | undefined;
  return dv?.value;
}

export async function getKillSwitch<T extends boolean | number>(
  key: string,
  fallback: T,
): Promise<T> {
  let template: RemoteConfigTemplate;
  try {
    template = await getTemplate();
  } catch (err) {
    logger.warn("remoteConfig.getKillSwitch: fetch failed; using fallback", {
      key,
      error: (err as Error).message,
    });
    return fallback;
  }
  const raw = readRaw(template, key);
  if (raw === undefined) return fallback;
  if (typeof fallback === "boolean") {
    return (raw === "true") as T;
  }
  // number
  const n = Number(raw);
  if (Number.isFinite(n)) return n as T;
  return fallback;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd firebase/functions && pnpm vitest run src/lib/remoteConfig.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add firebase/functions/src/lib/remoteConfig.ts firebase/functions/src/lib/remoteConfig.test.ts
git commit -m "feat(functions): add cached Firebase Remote Config kill-switch reader"
```

---

## Task 7: `triggerDrop` honors `drop_enabled` kill-switch

**Files:**
- Modify: `firebase/functions/src/triggerDrop.ts`
- Modify: `firebase/functions/src/triggerDrop.test.ts`

When `drop_enabled = false` in Firebase Remote Config, `triggerDrop` exits early without flipping any question state and without firing the FCM fanout.

- [ ] **Step 1: Write failing test**

Append to `firebase/functions/src/triggerDrop.test.ts`:

```typescript
import { getKillSwitch } from "./lib/remoteConfig";
vi.mock("./lib/remoteConfig", () => ({
  getKillSwitch: vi.fn(),
}));

describe("drop_enabled kill-switch", () => {
  it("exits early without touching firestore when drop_enabled is false", async () => {
    (getKillSwitch as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const fakeFirestore = {
      collection: vi.fn(() => {
        throw new Error("should not be called");
      }),
    };
    await runTriggerDrop(fakeFirestore as never, new Date());
    expect(fakeFirestore.collection).not.toHaveBeenCalled();
  });

  it("proceeds normally when drop_enabled is true", async () => {
    (getKillSwitch as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    // Use the existing test setup to seed a due question and assert it flips.
    // Reuse whatever helper the existing tests in this file already use.
  });
});
```

- [ ] **Step 2: Modify `triggerDrop.ts`**

At the top of the file:
```typescript
import { getKillSwitch } from "./lib/remoteConfig";
```

At the very top of `runTriggerDrop`:
```typescript
export async function runTriggerDrop(firestore: Firestore, now: Date): Promise<void> {
  const enabled = await getKillSwitch("drop_enabled", true);
  if (!enabled) {
    logger.warn("triggerDrop: skipped — drop_enabled kill-switch is OFF");
    return;
  }
  // ... existing body ...
```

- [ ] **Step 3: Run tests**

```bash
cd firebase/functions && pnpm vitest run src/triggerDrop.test.ts
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add firebase/functions/src/triggerDrop.ts firebase/functions/src/triggerDrop.test.ts
git commit -m "feat(functions): triggerDrop respects drop_enabled Remote Config kill-switch"
```

---

## Task 8: Sentry on Cloud Functions

**Files:**
- Create: `firebase/functions/src/lib/sentry.ts`
- Create: `firebase/functions/src/lib/sentry.test.ts`
- Modify: `firebase/functions/src/index.ts` (call init)
- Modify: `firebase/functions/src/moderationReview.ts`, `fanoutPush.ts`, `scoreReveal.ts`, `triggerDrop.ts`, `prepareNextDrop.ts` (capture inside catch)
- Modify: `firebase/functions/package.json`

> **Pre-requisite (Levin's manual step):** Sentry account exists (or create one at https://sentry.io). Create a new project named `relatably-functions` with platform "Node.js". Copy the DSN. Set it as a Cloud Functions secret with `firebase functions:secrets:set SENTRY_DSN_FUNCTIONS --project relatably-prod` and paste when prompted.

- [ ] **Step 1: Add Sentry SDK dep**

```bash
cd firebase/functions && pnpm add @sentry/google-cloud-serverless@^8
```

- [ ] **Step 2: Write failing test**

```typescript
// firebase/functions/src/lib/sentry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSentry, captureError } from "./sentry";

const { sentryInit, sentryCapture } = vi.hoisted(() => ({
  sentryInit: vi.fn(),
  sentryCapture: vi.fn(),
}));

vi.mock("@sentry/google-cloud-serverless", () => ({
  init: sentryInit,
  captureException: sentryCapture,
}));

describe("Sentry wrapper", () => {
  beforeEach(() => {
    sentryInit.mockReset();
    sentryCapture.mockReset();
    delete process.env.SENTRY_DSN_FUNCTIONS;
  });

  it("does NOT init when SENTRY_DSN_FUNCTIONS is unset", () => {
    initSentry();
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it("inits with DSN + environment when env is set", () => {
    process.env.SENTRY_DSN_FUNCTIONS = "https://abc@o0.ingest.sentry.io/1";
    process.env.SENTRY_ENVIRONMENT = "production";
    initSentry();
    expect(sentryInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://abc@o0.ingest.sentry.io/1",
      environment: "production",
    }));
  });

  it("captureError forwards to Sentry when initialized", () => {
    process.env.SENTRY_DSN_FUNCTIONS = "https://abc@o0.ingest.sentry.io/1";
    initSentry();
    const err = new Error("boom");
    captureError(err, { fn: "test" });
    expect(sentryCapture).toHaveBeenCalledWith(err, expect.objectContaining({
      tags: expect.objectContaining({ fn: "test" }),
    }));
  });

  it("captureError is a no-op when Sentry is not initialized", () => {
    captureError(new Error("x"));
    expect(sentryCapture).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd firebase/functions && pnpm vitest run src/lib/sentry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `sentry.ts`**

```typescript
// firebase/functions/src/lib/sentry.ts
import * as Sentry from "@sentry/google-cloud-serverless";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN_FUNCTIONS;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureError(err: unknown, tags?: Record<string, string>): void {
  if (!initialized) return;
  Sentry.captureException(err, { tags });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd firebase/functions && pnpm vitest run src/lib/sentry.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Wire `initSentry()` into `index.ts`**

Replace the contents of `firebase/functions/src/index.ts`:

```typescript
import { initSentry } from "./lib/sentry";

initSentry();

export { prepareNextDrop } from "./prepareNextDrop";
export { triggerDrop } from "./triggerDrop";
export { fanoutPush } from "./fanoutPush";
export { moderationReview } from "./moderationReview";
```

- [ ] **Step 7: Add `captureError` to each function's catch block**

For each of the 4 trigger exports (`prepareNextDrop`, `triggerDrop`, `fanoutPush`, `moderationReview`), wrap the entry-point body in try/catch + capture. (`scoreReveal` does NOT have its own trigger — it's invoked from `triggerDrop`, so its errors already propagate up to `triggerDrop`'s catch.) Example for `triggerDrop.ts` — find the existing `onSchedule` export and update:

Example for `triggerDrop.ts` — find the existing `onSchedule` export and update:

```typescript
import { captureError } from "./lib/sentry";

export const triggerDrop = onSchedule(
  { schedule: "* * * * *", region: "us-central1" },
  async () => {
    try {
      await runTriggerDrop(db(), new Date());
    } catch (err) {
      captureError(err, { fn: "triggerDrop" });
      throw err; // rethrow so Cloud Functions logs + retries
    }
  },
);
```

Repeat the same try/catch + captureError shape for each of the other 3 trigger exports (`prepareNextDrop`, `fanoutPush`, `moderationReview`). Use the unique `fn` tag for each.

- [ ] **Step 8: Run all functions tests**

```bash
cd firebase/functions && pnpm vitest run
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add firebase/functions/src/lib/sentry.ts firebase/functions/src/lib/sentry.test.ts firebase/functions/src/index.ts firebase/functions/src/triggerDrop.ts firebase/functions/src/prepareNextDrop.ts firebase/functions/src/fanoutPush.ts firebase/functions/src/moderationReview.ts firebase/functions/src/scoreReveal.ts firebase/functions/package.json firebase/functions/pnpm-lock.yaml
git commit -m "feat(functions): wire Sentry init + captureError on all 5 function entry points"
```

---

## Task 9: Sentry on api/ + Next.js 16 instrumentation hook

**Files:**
- Create: `api/instrumentation.ts`
- Create: `api/src/lib/sentry.ts`
- Create: `api/src/lib/sentry.test.ts`
- Modify: `api/package.json`
- Modify: `api/.env.example`

Next.js 16 supports an `instrumentation.ts` file at the project root that runs once on server start. Sentry's `@sentry/nextjs` package is the canonical wiring, but for a pure-API project we use the lighter `@sentry/node` directly.

- [ ] **Step 1: Add Sentry SDK dep**

```bash
cd api && pnpm add @sentry/node@^8
```

- [ ] **Step 2: Write failing test**

```typescript
// api/src/lib/sentry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSentry, captureError } from "./sentry";

const { sentryInit, sentryCapture } = vi.hoisted(() => ({
  sentryInit: vi.fn(),
  sentryCapture: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  init: sentryInit,
  captureException: sentryCapture,
}));

describe("api Sentry wrapper", () => {
  beforeEach(() => {
    sentryInit.mockReset();
    sentryCapture.mockReset();
    delete process.env.SENTRY_DSN;
  });

  it("does NOT init when SENTRY_DSN is unset", () => {
    initSentry();
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it("inits with DSN + environment", () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/2";
    process.env.SENTRY_ENVIRONMENT = "production";
    initSentry();
    expect(sentryInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://abc@o0.ingest.sentry.io/2",
      environment: "production",
    }));
  });

  it("captureError forwards when initialized", () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/2";
    initSentry();
    captureError(new Error("e"), { route: "/api/x" });
    expect(sentryCapture).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd api && pnpm vitest run src/lib/sentry.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement `sentry.ts`**

```typescript
// api/src/lib/sentry.ts
import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureError(err: unknown, tags?: Record<string, string>): void {
  if (!initialized) return;
  Sentry.captureException(err, { tags });
}
```

- [ ] **Step 5: Create the Next.js 16 instrumentation hook**

Create `api/instrumentation.ts` (at the project root, NOT under src/):

```typescript
// api/instrumentation.ts
// Next.js 16 calls register() once when the server boots (Node runtime only).
// Docs: node_modules/next/dist/docs/ → search "instrumentation".
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}
```

- [ ] **Step 6: Add env vars to `.env.example`**

Append to `api/.env.example`:
```
# Sentry
SENTRY_DSN=                                # from Sentry → Project Settings → Client Keys (DSN)
SENTRY_ENVIRONMENT=production              # production | preview | development
```

- [ ] **Step 7: Verify build still passes**

```bash
cd api && pnpm vitest run src/lib/sentry.test.ts && pnpm build
```

Expected: tests green, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add api/instrumentation.ts api/src/lib/sentry.ts api/src/lib/sentry.test.ts api/package.json api/pnpm-lock.yaml api/.env.example
git commit -m "feat(api): add Sentry init + Next.js 16 instrumentation hook"
```

---

## Task 10: Cloud Functions deploy + smoke test

**Files:** none (Levin-driven deploy + agent verification)

> **Pre-requisite:** Tasks 1–9 complete. Blaze plan active (Task 1).

- [ ] **Step 1: Set Sentry DSN as Cloud Functions secret**

Levin runs:
```bash
cd C:/Users/levin/relatably/firebase
firebase functions:secrets:set SENTRY_DSN_FUNCTIONS --project relatably-prod
# Pastes the DSN copied from Sentry when prompted.
firebase functions:secrets:set SENTRY_ENVIRONMENT --project relatably-prod
# Pastes "production" when prompted.
```

- [ ] **Step 2: Bind secrets in function configs**

For each function that uses Sentry, declare the secret. Edit each `onSchedule` / `onDocumentCreated` / `onDocumentUpdated` config block:

```typescript
// example: triggerDrop.ts
export const triggerDrop = onSchedule(
  {
    schedule: "* * * * *",
    region: "us-central1",
    secrets: ["SENTRY_DSN_FUNCTIONS", "SENTRY_ENVIRONMENT"],  // ← add this
  },
  // ...
);
```

Apply to: `prepareNextDrop` (schedule), `triggerDrop` (schedule), `fanoutPush` (Firestore trigger), `moderationReview` (Firestore trigger), `scoreReveal` (called from triggerDrop — already inherits secrets through it; but if scoreReveal had its own trigger, it would need them too).

- [ ] **Step 3: Build then deploy**

Levin runs:
```bash
cd C:/Users/levin/relatably/firebase/functions
pnpm build
cd ..
firebase deploy --only functions --project relatably-prod
```

Expected: 4 functions deploy successfully (`prepareNextDrop`, `triggerDrop`, `fanoutPush`, `moderationReview`). Watch for billing or quota errors.

- [ ] **Step 4: Smoke test — list deployed functions**

```bash
firebase functions:list --project relatably-prod
```

Expected: 4 functions listed with `ACTIVE` state and the correct schedules / triggers.

- [ ] **Step 5: Smoke test — minute cron is firing**

Wait 2 minutes, then check logs:

```bash
firebase functions:log --only triggerDrop --project relatably-prod | head -20
```

Expected: at least 2 invocations logged (one per minute).

- [ ] **Step 6: Smoke test — Sentry receives a test event**

Levin temporarily adds a `throw new Error("sentry-smoke-test")` at the very top of `triggerDrop` body, redeploys, waits 2 minutes, removes the throw, redeploys.

```bash
# Verify in Sentry UI: relatably-functions project → Issues → "sentry-smoke-test" issue exists
```

Then revert the temporary throw and redeploy clean. Commit nothing for this — it's a one-time validation.

- [ ] **Step 7: Mark deployed**

Create `firebase/CLOUD_DEPLOYED.md`:
```markdown
# Cloud Functions cloud-deployed

Deployed on: <YYYY-MM-DD>
Functions: prepareNextDrop, triggerDrop, fanoutPush, moderationReview
Sentry verified: yes (smoke event received)
```

```bash
git add firebase/functions/src/*.ts firebase/CLOUD_DEPLOYED.md
git commit -m "ops: deploy 4 Cloud Functions to relatably-prod with Sentry secrets bound"
```

---

## Task 11: AdMob account + EAS env wiring + verification

**Files:**
- Modify: `ios/.env.production` (create — see below)

> **Pre-requisite:** Levin needs an AdMob account (https://admob.google.com).

- [ ] **Step 1: Levin creates the AdMob app + 3 ad units**

In AdMob console:
1. Create app: name "Relatably", platform iOS, bundle `co.relatably.app`. Note the **App ID** (format `ca-app-pub-XXXX~YYYY`).
2. Create 3 ad units:
   - **Banner — Leaderboard** (size: anchored adaptive banner). Note ad unit ID.
   - **Banner — Archive** (size: anchored adaptive banner). Note ad unit ID.
   - **Interstitial — Post-reveal**. Note ad unit ID.

- [ ] **Step 2: Levin creates `ios/.env.production` with the real values**

```
EXPO_PUBLIC_API_URL=https://relatably.app
EXPO_PUBLIC_ADMOB_ENABLED=true
EXPO_PUBLIC_ADMOB_APP_ID_IOS=ca-app-pub-XXXX~YYYY
EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID=ca-app-pub-XXXX/AAAA
EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID=ca-app-pub-XXXX/BBBB
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXX/CCCC
```

(`.env.production` must be in `ios/.gitignore`; check it's already covered by `.env*` rule — it should be, but add `!.env.production.example` exception if you want to commit a template later.)

- [ ] **Step 3: Update `app.json` ios config**

In `ios/app.json`, the existing test app id `ca-app-pub-3940256099942544~1458002511` needs to be swappable. Use `process.env`:

Open `ios/app.json` and change the static `iosAppId` line from:
```json
"iosAppId": "ca-app-pub-3940256099942544~1458002511"
```
to read from env via the `app.config.js` pattern. Convert `app.json` → `app.config.ts`:

Create `ios/app.config.ts`:
```typescript
import type { ExpoConfig } from "expo/config";

const ADMOB_APP_ID =
  process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS ?? "ca-app-pub-3940256099942544~1458002511";

const config: ExpoConfig = {
  name: "Relatably",
  slug: "relatably",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "relatably",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "co.relatably.app",
    googleServicesFile: "./GoogleService-Info.plist",
    usesAppleSignIn: true,
    config: {
      googleMobileAdsAppId: ADMOB_APP_ID,
    },
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
      SKAdNetworkItems: [{ SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" }],
    },
  },
  plugins: [
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    "expo-apple-authentication",
    [
      "react-native-google-mobile-ads",
      { iosAppId: ADMOB_APP_ID },
    ],
    "react-native-branch",
    [
      "expo-build-properties",
      { ios: { useFrameworks: "static" } },
    ],
    "expo-secure-store",
  ],
};

export default config;
```

Delete `ios/app.json`:
```bash
rm ios/app.json
```

- [ ] **Step 4: Verify Expo still resolves the config**

```bash
cd ios && npx expo config --type public
```

Expected: prints the resolved config with `googleMobileAdsAppId` matching whichever env value is set.

- [ ] **Step 5: Run iOS tests + typecheck**

```bash
cd ios && npx tsc --noEmit && npx jest --runInBand
```

Expected: typecheck green, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add ios/app.config.ts
git rm ios/app.json
git commit -m "feat(ios): convert app.json to app.config.ts; AdMob app id is env-driven"
```

(`ios/.env.production` is git-ignored intentionally — only Levin's local copy + EAS secrets store the real values.)

---

## Task 12: Branch.io account + Vercel/EAS env + verification

**Files:** none (env wiring + verification)

- [ ] **Step 1: Levin creates Branch.io account + iOS app**

At https://dashboard.branch.io:
1. Create app "Relatably", platform iOS, bundle `co.relatably.app`.
2. Get the **Branch Key** (format `key_live_xxxxxxxxxx`).
3. In Branch dashboard → Configuration → upload `apple-app-site-association` settings (Branch handles this for you).

- [ ] **Step 2: Levin sets the env vars**

In Vercel project (`relatably-api` or whatever the slug is):
```
BRANCH_REFERRAL_SECRET=<random 32-byte hex>
```
(Generate via `openssl rand -hex 32`. This is the HMAC signing key for referral codes — set once and never rotate without invalidating outstanding codes.)

In EAS env (run from `ios/` directory):
```bash
cd ios && eas secret:create --scope project --name EXPO_PUBLIC_BRANCH_KEY --value "key_live_xxxxxxxxxx"
```

- [ ] **Step 3: Verify the api endpoint signs correctly**

After Vercel redeploys with the new env, hit the share-track endpoint:

```bash
curl -X POST https://relatably.app/api/share/track \
  -H "Content-Type: application/json" \
  -d '{"banner_type":"verdict","question_id":"smoke-test","share_target":"link"}'
```

Expected: 200 OK with `{ "referral_code": "<base64url>.<base64url>" }` (NOT the dev fallback `dev-referral.dev`).

- [ ] **Step 4: Mark verified**

```bash
echo "Verified $(date -u +%Y-%m-%dT%H:%M:%SZ): Branch.io referral signing live" >> ops/verifications.md
git add ops/verifications.md
git commit -m "ops: verify Branch.io referral signing live in production"
```

(Create `ops/verifications.md` if it doesn't exist with the line above.)

---

## Task 13: Perspective API key + Functions config + verification

**Files:** none

- [ ] **Step 1: Levin creates the Perspective API key**

At https://console.cloud.google.com → enable Perspective Comment Analyzer API → Credentials → Create API key. Note the key.

- [ ] **Step 2: Set the secret in both Vercel and Cloud Functions**

Vercel env: `PERSPECTIVE_API_KEY=<key>`.

Cloud Functions:
```bash
firebase functions:secrets:set PERSPECTIVE_API_KEY --project relatably-prod
# paste key when prompted
```

Bind the secret in `moderationReview.ts`:
```typescript
export const moderationReview = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    region: "us-central1",
    secrets: ["SENTRY_DSN_FUNCTIONS", "SENTRY_ENVIRONMENT", "PERSPECTIVE_API_KEY"],
  },
  // ...
);
```

Redeploy:
```bash
cd C:/Users/levin/relatably/firebase && firebase deploy --only functions:moderationReview --project relatably-prod
```

- [ ] **Step 3: Smoke test**

Submit a deliberately-toxic test answer via the existing `/api/submit` endpoint. Wait 30s. Check `submissions/{id}.moderation_status` flips to `blocked` (Perspective returned high TOXICITY).

- [ ] **Step 4: Mark verified**

```bash
echo "Verified $(date -u +%Y-%m-%dT%H:%M:%SZ): Perspective API live in moderationReview" >> ops/verifications.md
git add firebase/functions/src/moderationReview.ts ops/verifications.md
git commit -m "ops: bind Perspective API secret to moderationReview + verify live"
```

---

## Task 14: Firebase Auth Google sign-in for /admin + Vercel env

**Files:** none

- [ ] **Step 1: Levin enables Google sign-in provider**

Firebase Console → relatably-prod → Authentication → Sign-in method → Google → Enable. Set support email.

- [ ] **Step 2: Levin copies web SDK config**

Firebase Console → Project Settings → General → "Your apps" → Web app (create one if missing, name "relatably-web", uncheck Hosting). Copy the config snippet's `apiKey`, `authDomain`, `projectId`, `appId`.

- [ ] **Step 3: Levin sets Vercel env vars**

```
NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=relatably-prod
NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
```

- [ ] **Step 4: Levin signs in once + sets allowlist**

Visit https://relatably.app/admin. Click "Sign in with Google". The "Not authorized" page shows his uid. Copy that uid. Set:
```
ADMIN_UIDS=<uid>
NEXT_PUBLIC_ADMIN_UIDS=<uid>
```

In Vercel; trigger redeploy. Visit `/admin` again — now shows the landing page.

- [ ] **Step 5: Add prod + preview domains to Firebase Auth Authorized domains**

Firebase Console → Authentication → Settings → Authorized domains → Add: `relatably.app`, `*.vercel.app` (or the specific preview domain pattern).

- [ ] **Step 6: Mark verified**

```bash
echo "Verified $(date -u +%Y-%m-%dT%H:%M:%SZ): Admin console live at /admin (Google sign-in + uid allowlist)" >> ops/verifications.md
git add ops/verifications.md
git commit -m "ops: verify admin console live with Google sign-in"
```

---

## Task 15: Submit-rate-limit Remote Config override

**Files:**
- Create: `api/src/lib/remoteConfig.ts`
- Create: `api/src/lib/remoteConfig.test.ts`
- Modify: `api/src/lib/ratelimit.ts`
- Modify: `api/src/lib/ratelimit.test.ts`

The api/ side needs its own Remote Config reader (server-side, using firebase-admin already in api/). Sets `submit_rate_limit_per_min` to override the hardcoded 10/IP/min default.

- [ ] **Step 1: Write failing tests for `remoteConfig.ts`**

```typescript
// api/src/lib/remoteConfig.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getKillSwitch, __resetRemoteConfigCacheForTest } from "./remoteConfig";

const { getTemplate } = vi.hoisted(() => ({ getTemplate: vi.fn() }));

vi.mock("firebase-admin/remote-config", () => ({
  getRemoteConfig: () => ({ getTemplate }),
}));

vi.mock("./firebase", () => ({
  adminApp: {},
}));

describe("api getKillSwitch", () => {
  beforeEach(() => {
    getTemplate.mockReset();
    __resetRemoteConfigCacheForTest();
  });

  it("returns boolean override when set", async () => {
    getTemplate.mockResolvedValue({
      parameters: { leaderboard_endpoint_enabled: { defaultValue: { value: "false" } } },
    });
    expect(await getKillSwitch("leaderboard_endpoint_enabled", true)).toBe(false);
  });

  it("returns int override when set", async () => {
    getTemplate.mockResolvedValue({
      parameters: { submit_rate_limit_per_min: { defaultValue: { value: "3" } } },
    });
    expect(await getKillSwitch("submit_rate_limit_per_min", 10)).toBe(3);
  });

  it("falls back on fetch failure", async () => {
    getTemplate.mockRejectedValue(new Error("net"));
    expect(await getKillSwitch("drop_enabled", true)).toBe(true);
  });

  it("caches within TTL", async () => {
    getTemplate.mockResolvedValue({ parameters: {} });
    await getKillSwitch("a", true);
    await getKillSwitch("b", false);
    expect(getTemplate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd api && pnpm vitest run src/lib/remoteConfig.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `api/src/lib/remoteConfig.ts`**

(Identical structure to the functions/ version but uses api/'s `firebase` admin app handle. Check `api/src/lib/firebase.ts` for the existing export name — use whatever it's called there, likely `adminApp`.)

```typescript
// api/src/lib/remoteConfig.ts
import { getRemoteConfig, type RemoteConfigTemplate } from "firebase-admin/remote-config";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  template: RemoteConfigTemplate;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

export function __resetRemoteConfigCacheForTest(): void {
  cache = null;
}

async function getTemplate(): Promise<RemoteConfigTemplate> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.template;
  }
  // Lazy import to keep test mocks simple
  const { adminApp } = await import("./firebase");
  const template = await getRemoteConfig(adminApp).getTemplate();
  cache = { template, fetchedAt: now };
  return template;
}

function readRaw(template: RemoteConfigTemplate, key: string): string | undefined {
  const p = template.parameters?.[key];
  if (!p) return undefined;
  const dv = p.defaultValue as { value?: string } | undefined;
  return dv?.value;
}

export async function getKillSwitch<T extends boolean | number>(
  key: string,
  fallback: T,
): Promise<T> {
  let template: RemoteConfigTemplate;
  try {
    template = await getTemplate();
  } catch {
    return fallback;
  }
  const raw = readRaw(template, key);
  if (raw === undefined) return fallback;
  if (typeof fallback === "boolean") return (raw === "true") as T;
  const n = Number(raw);
  return (Number.isFinite(n) ? n : fallback) as T;
}
```

(Verify the `firebase` module export name matches. If api/ exports `getAdminApp()` or similar instead of `adminApp`, adjust accordingly.)

- [ ] **Step 4: Update `ratelimit.ts` to read the override**

In `api/src/lib/ratelimit.ts`, change `getRateLimiter()` to accept an optional limit override and `MemoryRateLimiter` / `UpstashRateLimiter` to be re-buildable. Cleanest path: add a new helper `getEffectiveRateLimit()`:

```typescript
// at the top of ratelimit.ts
import { getKillSwitch } from "./remoteConfig";

// add:
export async function getEffectiveRateLimit(): Promise<number> {
  return await getKillSwitch("submit_rate_limit_per_min", DEFAULT_LIMIT);
}
```

Then in the submit route handler (`api/src/app/api/submit/route.ts`), call `getEffectiveRateLimit()` and use it inline rather than the cached limiter when the override is in effect. Implementation note: the existing `MemoryRateLimiter` is initialized once with `DEFAULT_LIMIT`; rather than reinitializing, just compute `effectiveLimit = await getEffectiveRateLimit()` and short-circuit BEFORE calling `limiter.check()` if the user's IP has hit `effectiveLimit` in the last minute.

Cleaner alternative (recommended): make the rate limiter accept a per-call limit. Modify `RateLimiter.check`:

```typescript
export interface RateLimiter {
  check(key: string, limitOverride?: number): Promise<RateLimitResult>;
}

// MemoryRateLimiter.check:
async check(key: string, limitOverride?: number): Promise<RateLimitResult> {
  const effectiveLimit = limitOverride ?? this.cfg.limit;
  const now = Date.now();
  const cutoff = now - this.cfg.windowMs;
  const arr = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
  if (arr.length >= effectiveLimit) {
    const retryAfterMs = arr[0] + this.cfg.windowMs - now;
    this.hits.set(key, arr);
    return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }
  arr.push(now);
  this.hits.set(key, arr);
  return { ok: true, retryAfterMs: 0 };
}
```

(Apply the same `limitOverride` parameter to `UpstashRateLimiter.check`.)

In the submit route, call:
```typescript
import { getEffectiveRateLimit } from "@/lib/ratelimit";
// ...
const effectiveLimit = await getEffectiveRateLimit();
const result = await getRateLimiter().check(`submit:${ipHash}`, effectiveLimit);
```

- [ ] **Step 5: Add tests**

Append to `api/src/lib/ratelimit.test.ts`:

```typescript
describe("limitOverride", () => {
  it("respects per-call limitOverride below default", async () => {
    const limiter = new MemoryRateLimiter({ limit: 10, windowMs: 60_000 });
    // First 3 hits with override=3 should pass
    for (let i = 0; i < 3; i++) {
      const r = await limiter.check("k", 3);
      expect(r.ok).toBe(true);
    }
    // 4th should fail despite default of 10
    const r = await limiter.check("k", 3);
    expect(r.ok).toBe(false);
  });

  it("falls back to default limit when override omitted", async () => {
    const limiter = new MemoryRateLimiter({ limit: 5, windowMs: 60_000 });
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check("k2")).ok).toBe(true);
    }
    expect((await limiter.check("k2")).ok).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd api && pnpm vitest run src/lib/ratelimit.test.ts src/lib/remoteConfig.test.ts src/app/api/submit/route.test.ts
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add api/src/lib/remoteConfig.ts api/src/lib/remoteConfig.test.ts api/src/lib/ratelimit.ts api/src/lib/ratelimit.test.ts api/src/app/api/submit/route.ts
git commit -m "feat(api): submit rate limit honors submit_rate_limit_per_min Remote Config override"
```

---

## Task 16: Leaderboard endpoint kill-switch (503 short-circuit)

**Files:**
- Modify: `api/src/app/api/leaderboard/route.ts`
- Modify: `api/src/app/api/leaderboard/route.test.ts`

When `leaderboard_endpoint_enabled = false` in Remote Config, the endpoint returns `503 Service Unavailable` with `Retry-After: 60` header.

- [ ] **Step 1: Write failing test**

Append to `api/src/app/api/leaderboard/route.test.ts`:

```typescript
import { getKillSwitch } from "@/lib/remoteConfig";
vi.mock("@/lib/remoteConfig", () => ({
  getKillSwitch: vi.fn(),
}));

describe("leaderboard kill-switch", () => {
  it("returns 503 with Retry-After when leaderboard_endpoint_enabled is false", async () => {
    (getKillSwitch as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const req = new Request("http://localhost/api/leaderboard?period=daily&scope=global");
    const { GET } = await import("./route");
    const res = await GET(req);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("60");
  });

  it("proceeds normally when leaderboard_endpoint_enabled is true", async () => {
    (getKillSwitch as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    // Reuse the existing happy-path test setup.
  });
});
```

- [ ] **Step 2: Modify the GET handler**

At the top of `api/src/app/api/leaderboard/route.ts`:
```typescript
import { getKillSwitch } from "@/lib/remoteConfig";
```

At the very top of the GET handler:
```typescript
export async function GET(req: Request): Promise<NextResponse> {
  const enabled = await getKillSwitch("leaderboard_endpoint_enabled", true);
  if (!enabled) {
    return NextResponse.json(
      { error: "leaderboard temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }
  // ... existing body ...
}
```

- [ ] **Step 3: Run tests**

```bash
cd api && pnpm vitest run src/app/api/leaderboard/route.test.ts
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add api/src/app/api/leaderboard/route.ts api/src/app/api/leaderboard/route.test.ts
git commit -m "feat(api): leaderboard endpoint honors leaderboard_endpoint_enabled kill-switch"
```

---

## Task 17: k6 load test + synthetic-data bearer + cleanup script

**Files:**
- Create: `loadtest/k6-drop-burst.js`
- Create: `loadtest/README.md`
- Create: `api/src/lib/loadtest.ts`
- Create: `api/src/lib/loadtest.test.ts`
- Create: `firebase/scripts/cleanup-load-test-data.ts`
- Modify: `api/src/app/api/submit/route.ts` (accept synthetic flag when bearer matches)

The k6 script hits PROD with a bearer header that the api recognizes as load-test traffic. Synthetic submissions get `is_synthetic_load_test=true` in Firestore so they can be cleaned up + filtered out of leaderboard scoring.

- [ ] **Step 1: Add load-test bearer check**

Write `api/src/lib/loadtest.ts`:

```typescript
// api/src/lib/loadtest.ts
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Returns true iff the request carries a bearer that hashes to the
 * env-configured LOADTEST_TOKEN_HASH. Constant-time compare prevents
 * timing attacks. Returns false if either env var is missing.
 */
export function isLoadTestRequest(req: Request): boolean {
  const expectedHash = process.env.LOADTEST_TOKEN_HASH;
  if (!expectedHash) return false;
  const auth = req.headers.get("x-loadtest-bearer");
  if (!auth) return false;
  const provided = createHash("sha256").update(auth).digest("hex");
  if (provided.length !== expectedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// api/src/lib/loadtest.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { isLoadTestRequest } from "./loadtest";

const TOKEN = "loadtest-token-12345";
const HASH = createHash("sha256").update(TOKEN).digest("hex");

describe("isLoadTestRequest", () => {
  beforeEach(() => {
    process.env.LOADTEST_TOKEN_HASH = HASH;
  });
  afterEach(() => {
    delete process.env.LOADTEST_TOKEN_HASH;
  });

  it("returns true on matching bearer", () => {
    const req = new Request("http://x/", { headers: { "x-loadtest-bearer": TOKEN } });
    expect(isLoadTestRequest(req)).toBe(true);
  });

  it("returns false on non-matching bearer", () => {
    const req = new Request("http://x/", { headers: { "x-loadtest-bearer": "wrong" } });
    expect(isLoadTestRequest(req)).toBe(false);
  });

  it("returns false when no bearer header present", () => {
    const req = new Request("http://x/");
    expect(isLoadTestRequest(req)).toBe(false);
  });

  it("returns false when LOADTEST_TOKEN_HASH env is unset", () => {
    delete process.env.LOADTEST_TOKEN_HASH;
    const req = new Request("http://x/", { headers: { "x-loadtest-bearer": TOKEN } });
    expect(isLoadTestRequest(req)).toBe(false);
  });
});
```

Run:
```bash
cd api && pnpm vitest run src/lib/loadtest.test.ts
```

Expected: 4 passed.

- [ ] **Step 3: Wire the bearer into `/api/submit`**

In `api/src/app/api/submit/route.ts`, near the top of the handler:
```typescript
import { isLoadTestRequest } from "@/lib/loadtest";
// ...
const isSynthetic = isLoadTestRequest(req);
```

When writing the submission doc, include `is_synthetic_load_test: isSynthetic` (only when true — keep prod docs clean):
```typescript
await db.collection("submissions").add({
  // ... existing fields ...
  ...(isSynthetic && { is_synthetic_load_test: true }),
});
```

Also add a corresponding test in `submit/route.test.ts`:
```typescript
it("tags submission with is_synthetic_load_test when bearer matches", async () => {
  const TOKEN = "tok";
  const HASH = createHash("sha256").update(TOKEN).digest("hex");
  process.env.LOADTEST_TOKEN_HASH = HASH;
  // ... call POST /api/submit with x-loadtest-bearer: tok ...
  // Assert the captured submission doc has is_synthetic_load_test: true
});
```

- [ ] **Step 4: Filter synthetic submissions out of `scoreReveal`**

In `firebase/functions/src/scoreReveal.ts`, find the query that loads submissions for the revealed question (probably `where("question_id", "==", revealedQuestionId)`). Add a filter:
```typescript
.where("is_synthetic_load_test", "!=", true)
```

(Caveat: Firestore `!=` queries skip docs where the field is missing. That's the desired behavior — only docs explicitly tagged as synthetic get filtered.)

Add a test in `scoreReveal.test.ts`:
```typescript
it("excludes synthetic load-test submissions from leaderboard scoring", async () => {
  // Seed 1 real signed-in submission + 1 synthetic submission for the same question
  // Run runScoreRevealOnce
  // Assert exactly 1 leaderboard_entries doc was created
});
```

- [ ] **Step 5: Write the k6 script**

`loadtest/k6-drop-burst.js`:

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const submitTrend = new Trend("submit_latency_ms");
const yesterdayTrend = new Trend("yesterday_latency_ms");
const leaderboardTrend = new Trend("leaderboard_latency_ms");

const BASE = __ENV.BASE_URL || "https://relatably.app";
const BEARER = __ENV.LOADTEST_BEARER;
if (!BEARER) throw new Error("LOADTEST_BEARER env var required");

const ANSWERS = [
  "italy", "japan", "spain", "iceland", "thailand", "portugal", "greece",
  "norway", "vietnam", "mexico", "morocco", "turkey", "argentina", "indonesia",
];

export const options = {
  // 1k concurrent VUs, ramp up over 30s, hold for 60s, ramp down.
  // Each VU performs the full submit + reveal + leaderboard cycle once.
  stages: [
    { duration: "30s", target: 1000 },
    { duration: "60s", target: 1000 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    "submit_latency_ms": ["p(95)<1500", "p(99)<3000"],
    "yesterday_latency_ms": ["p(95)<800"],
    "leaderboard_latency_ms": ["p(95)<800"],
    "http_req_failed": ["rate<0.01"],
  },
};

function syntheticDeviceToken(vu) {
  return `loadtest-vu-${vu}-${__ITER}`;
}

export default function () {
  const headers = {
    "Content-Type": "application/json",
    "x-loadtest-bearer": BEARER,
  };
  const deviceToken = syntheticDeviceToken(__VU);

  // Step 1: register device
  http.post(`${BASE}/api/devices/register`, JSON.stringify({
    device_token: deviceToken,
    fcm_token: `fcm-${deviceToken}`,
  }), { headers });

  // Step 2: fetch today's question
  const todayRes = http.get(`${BASE}/api/questions/today`, { headers });
  check(todayRes, { "today: 200": (r) => r.status === 200 });
  const today = todayRes.json();
  if (!today || !today.id) return;

  // Step 3: submit answer (random offset to spread load)
  sleep(Math.random() * 60);
  const submitStart = Date.now();
  const submitRes = http.post(`${BASE}/api/submit`, JSON.stringify({
    device_token: deviceToken,
    question_id: today.id,
    answer_text: ANSWERS[Math.floor(Math.random() * ANSWERS.length)],
    dwell_ms: 4000 + Math.random() * 2000,
  }), { headers });
  submitTrend.add(Date.now() - submitStart);
  check(submitRes, { "submit: 200": (r) => r.status === 200 });

  // Step 4: fetch yesterday + leaderboard (parallel-ish)
  const yStart = Date.now();
  http.get(`${BASE}/api/yesterday?device_token=${deviceToken}`, { headers });
  yesterdayTrend.add(Date.now() - yStart);

  const lbStart = Date.now();
  http.get(`${BASE}/api/leaderboard?period=daily&scope=global`, { headers });
  leaderboardTrend.add(Date.now() - lbStart);
}
```

- [ ] **Step 6: Write the cleanup script**

`firebase/scripts/cleanup-load-test-data.ts`:

```typescript
/**
 * Deletes all Firestore docs tagged `is_synthetic_load_test=true`.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=relatably-prod \
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json \
 *   pnpm tsx firebase/scripts/cleanup-load-test-data.ts
 *
 * Cleans:
 *   - submissions where is_synthetic_load_test=true
 *   - device_users where device_token starts with "loadtest-vu-"
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID required");
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH required");

  const credentials = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"));
  initializeApp({ credential: cert(credentials), projectId });
  const db = getFirestore();

  // 1. Drop synthetic submissions
  let totalSubs = 0;
  while (true) {
    const snap = await db
      .collection("submissions")
      .where("is_synthetic_load_test", "==", true)
      .limit(500)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalSubs += snap.size;
    console.log(`deleted ${snap.size} synthetic submissions (running total: ${totalSubs})`);
  }

  // 2. Drop synthetic device_users (by device_token prefix)
  // Note: Firestore can't query by prefix; we list all and filter client-side.
  // For a load test of 1k VUs, this is ~1k docs — fine.
  let totalDevices = 0;
  const allDevices = await db.collection("device_users").get();
  const synthDocs = allDevices.docs.filter((d) =>
    (d.id ?? "").startsWith("loadtest-vu-") || (d.data() as { device_token?: string }).device_token?.startsWith("loadtest-vu-"),
  );
  for (let i = 0; i < synthDocs.length; i += 500) {
    const chunk = synthDocs.slice(i, i + 500);
    const batch = db.batch();
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalDevices += chunk.length;
  }
  console.log(`deleted ${totalDevices} synthetic device_users docs`);

  // 3. Drop function_runs guard docs created during load test
  // (these accumulate per drop event; harmless but tidy to clean)
  let totalRuns = 0;
  const runs = await db.collection("function_runs").get();
  const synthRuns = runs.docs.filter((d) => d.id.includes("loadtest"));
  for (let i = 0; i < synthRuns.length; i += 500) {
    const chunk = synthRuns.slice(i, i + 500);
    const batch = db.batch();
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalRuns += chunk.length;
  }
  console.log(`deleted ${totalRuns} synthetic function_runs docs`);

  console.log(`\nDONE. Removed: ${totalSubs} submissions, ${totalDevices} devices, ${totalRuns} runs.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 7: Write `loadtest/README.md`**

```markdown
# k6 load test — global drop burst

Simulates 1,000 concurrent users performing the full daily ritual cycle
(register-device → submit → fetch-yesterday → fetch-leaderboard) within a
60-second post-drop window.

## Prerequisites

1. k6 installed: `winget install k6` (Windows) or download from https://k6.io/.
2. `LOADTEST_TOKEN_HASH` env var set on Vercel (sha256 of the bearer below).
3. The bearer secret stored locally — DO NOT commit. Generate via:
   `openssl rand -hex 32`
   Paste the resulting hex as `LOADTEST_BEARER` below.
4. Cloud Functions deployed (so `triggerDrop` minute cron is firing in prod
   and there's a live question to submit against).

## Run

```bash
LOADTEST_BEARER="<the-bearer-secret>" \
BASE_URL="https://relatably.app" \
k6 run loadtest/k6-drop-burst.js
```

## Read results

Look for these lines at the end:

```
submit_latency_ms ........ p(95)= ___ms p(99)= ___ms   ✓ thresholds met
yesterday_latency_ms ..... p(95)= ___ms                 ✓ thresholds met
leaderboard_latency_ms ... p(95)= ___ms                 ✓ thresholds met
http_req_failed .......... rate=  ___%                  ✓ thresholds met
```

Pass criteria:
- submit p95 ≤ 1500ms
- submit p99 ≤ 3000ms
- yesterday + leaderboard p95 ≤ 800ms
- error rate < 1%

Save the full output to `loadtest/results-YYYY-MM-DD.md`.

## Cleanup after run

```bash
cd ..
FIREBASE_PROJECT_ID=relatably-prod \
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json \
pnpm tsx firebase/scripts/cleanup-load-test-data.ts
```

This drops all `submissions` with `is_synthetic_load_test=true`, all
`device_users` whose token starts with `loadtest-vu-`, and any
`function_runs` guard docs containing `loadtest`.
```

- [ ] **Step 8: Set the load-test secret on Vercel**

Levin generates a token + sets the env vars:
```bash
TOKEN=$(openssl rand -hex 32)
echo "$TOKEN" > .loadtest-bearer.local  # save locally; DO NOT COMMIT
HASH=$(echo -n "$TOKEN" | openssl dgst -sha256 -hex | awk '{print $2}')
# Set on Vercel: LOADTEST_TOKEN_HASH=<HASH>
```

Add `.loadtest-bearer.local` to `.gitignore` (root):
```
echo ".loadtest-bearer.local" >> .gitignore
```

- [ ] **Step 9: Run the load test + record results**

After Vercel redeploys with the env, Levin runs:
```bash
LOADTEST_BEARER=$(cat .loadtest-bearer.local) \
k6 run loadtest/k6-drop-burst.js > loadtest/results-$(date -u +%Y-%m-%d).md
```

Then runs the cleanup script.

- [ ] **Step 10: Run all api tests**

```bash
cd api && pnpm vitest run
```

Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add loadtest/ api/src/lib/loadtest.ts api/src/lib/loadtest.test.ts api/src/app/api/submit/route.ts api/src/app/api/submit/route.test.ts firebase/functions/src/scoreReveal.ts firebase/functions/src/scoreReveal.test.ts firebase/scripts/cleanup-load-test-data.ts .gitignore
git commit -m "feat(loadtest): k6 1k-VU drop-burst script + bearer-gated synthetic-data flag + cleanup"
```

(Add the results file in a separate commit AFTER Levin runs the test, so the plan execution and the data are clearly separated.)

---

## Task 18: 60 launch questions drafted + seed script + dry-run

**Files:**
- Create: `firebase/launch-questions.txt`
- Create: `firebase/scripts/seed-launch-questions.ts`

The 60 questions are Gen-Z, lighthearted, mildly controversial — same energy as `seed-questions.ts`'s placeholder examples. After Levin reviews/edits the file, the script bulk-creates them as approved candidates AND scheduled questions across the next 60 UTC days.

- [ ] **Step 1: Draft 60 questions**

Create `firebase/launch-questions.txt` (one question per line, blank lines + lines starting with `#` ignored):

```
# Relatably — 60 launch questions (v1.0 hand-curated)
# Style: Gen-Z, lighthearted, mildly controversial. Free-text answers.
# Drop order = file order. Edit freely; re-run seed script is idempotent.

what's the most overrated tourist trap?
what's the worst breakup line of all time?
what's a movie everyone loves that you hate?
what's the most useless app on your phone?
what food do people pretend to like?
what's the worst character in friends?
what's the most annoying tiktok trend right now?
which celebrity break-up actually broke your heart?
what's the worst thing about your zodiac sign?
what's a song you're embarrassed to love?
what's the most overrated sport?
what's the worst part of being an adult?
what's a hobby that's actually a personality trait?
which fast-food chain peaked years ago?
what's the most dishonest job?
which streaming service do you keep paying for but never use?
what's the worst flavor of ice cream?
what's a green flag people misread as a red flag?
what's the most embarrassing app you've used in public?
what's a popular show you couldn't get past episode 2?
what's the most overrated city to live in?
what's a word that immediately makes you cringe?
what's the worst gift you've ever received?
what's the most useless household appliance?
which fictional villain was actually right?
what's a popular opinion that's secretly wrong?
which fashion trend should never come back?
what's the worst thing to text a crush?
what's the dumbest thing you've cried about as an adult?
what's an unspoken rule of the gym?
what's a job that pays too little for what it requires?
what's a job that pays too much for what it requires?
which hollywood remake was unforgivable?
what's the most boring city in your country?
what's a school subject that should be optional?
what's the worst type of person to sit next to on a plane?
which app's notifications are pure noise?
what's the worst way to spend a saturday night?
which 2010s trend feels older than it should?
what's a small thing that makes someone instantly likable?
what's the most overrated holiday?
what's the worst thing about your hometown?
what's a sentence that ends a friendship?
which influencer is silently irrelevant?
what's a household chore you secretly enjoy?
what's the worst part about working from home?
what's the worst part about working in an office?
what's a food that tastes better than it looks?
what's the most overrated drink on a menu?
what's a confession that makes you a worse person, but funnier?
what's a small win that feels disproportionately good?
what's the most boring kind of party?
what's the worst type of compliment?
what's a hot take you'd say in a job interview?
what's the most useless airport amenity?
what's the worst type of group chat?
what's an app you opened today that you regret?
what's a dating-app red flag people ignore?
what's the worst place to make a phone call?
what's a secret nobody tells you about adulting?
```

(60 lines. Levin will revise. The script is forgiving — re-run is idempotent.)

- [ ] **Step 2: Write the seed script**

`firebase/scripts/seed-launch-questions.ts`:

```typescript
/**
 * Seeds the launch questions from firebase/launch-questions.txt.
 * For each question:
 *   - creates a question_candidates doc with deterministic id sha1(text)
 *     and status='approved'
 *   - creates a questions doc with status='scheduled' and
 *     scheduled_drop_at spread across the next N UTC days at 12:00 UTC
 *
 * Idempotent: deterministic IDs + merge:true mean re-runs are safe.
 *
 * Usage (dry run, prints what would be seeded):
 *   FIREBASE_PROJECT_ID=relatably-prod pnpm tsx firebase/scripts/seed-launch-questions.ts --dry-run
 *
 * Usage (real, against emulator):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod \
 *     pnpm tsx firebase/scripts/seed-launch-questions.ts
 *
 * Usage (real, against prod):
 *   FIREBASE_PROJECT_ID=relatably-prod \
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json \
 *     pnpm tsx firebase/scripts/seed-launch-questions.ts
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

interface SeedPlanItem {
  id: string;
  text: string;
  scheduledDropAt: Date;
}

const QUESTIONS_FILE = path.resolve(__dirname, "../launch-questions.txt");
const DROP_HOUR_UTC = 12;
const DROP_MINUTE_UTC = 0;

export function loadQuestions(): string[] {
  const raw = fs.readFileSync(QUESTIONS_FILE, "utf-8");
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("#"));
}

export function buildSeedPlan(questions: string[], startDate: Date): SeedPlanItem[] {
  return questions.map((text, i) => {
    const id = crypto.createHash("sha1").update(text).digest("hex").slice(0, 20);
    const drop = new Date(startDate.getTime());
    drop.setUTCDate(drop.getUTCDate() + i + 1); // tomorrow + i
    drop.setUTCHours(DROP_HOUR_UTC, DROP_MINUTE_UTC, 0, 0);
    return { id, text, scheduledDropAt: drop };
  });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const questions = loadQuestions();
  const plan = buildSeedPlan(questions, new Date());

  console.log(`Loaded ${questions.length} questions from ${QUESTIONS_FILE}`);
  console.log(`Plan: ${plan.length} candidate docs + ${plan.length} scheduled question docs`);
  console.log(`First drop:  ${plan[0].scheduledDropAt.toISOString()}`);
  console.log(`Last drop:   ${plan[plan.length - 1].scheduledDropAt.toISOString()}`);

  if (dryRun) {
    console.log("\n--dry-run, exiting before writing.");
    plan.slice(0, 5).forEach((p) => {
      console.log(`  ${p.id}  ${p.scheduledDropAt.toISOString()}  ${p.text}`);
    });
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID required");

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId });
  } else {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH required for prod");
    const credentials = JSON.parse(fs.readFileSync(path.resolve(sa), "utf-8"));
    initializeApp({ credential: cert(credentials), projectId });
  }

  const db = getFirestore();

  for (const item of plan) {
    const candidateRef = db.collection("question_candidates").doc(item.id);
    const questionRef = db.collection("questions").doc(item.id);

    await candidateRef.set({
      candidate_text: item.text,
      status: "approved",
      created_at: FieldValue.serverTimestamp(),
      source: "launch_seed",
    }, { merge: true });

    await questionRef.set({
      text: item.text,
      status: "scheduled",
      source: "launch_seed",
      scheduled_drop_at: Timestamp.fromDate(item.scheduledDropAt),
      created_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  ✓ ${item.id}  ${item.scheduledDropAt.toISOString()}  ${item.text.slice(0, 50)}`);
  }

  console.log(`\nDONE. ${plan.length} questions seeded.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Add a small unit test for the pure functions**

Create `firebase/scripts/seed-launch-questions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSeedPlan } from "./seed-launch-questions";

describe("buildSeedPlan", () => {
  const startDate = new Date("2026-05-09T08:30:00Z");

  it("produces one item per question", () => {
    const plan = buildSeedPlan(["a", "b", "c"], startDate);
    expect(plan).toHaveLength(3);
  });

  it("schedules first drop tomorrow at 12:00 UTC", () => {
    const plan = buildSeedPlan(["a"], startDate);
    expect(plan[0].scheduledDropAt.toISOString()).toBe("2026-05-10T12:00:00.000Z");
  });

  it("spreads drops one UTC day apart", () => {
    const plan = buildSeedPlan(["a", "b", "c"], startDate);
    expect(plan[0].scheduledDropAt.toISOString()).toBe("2026-05-10T12:00:00.000Z");
    expect(plan[1].scheduledDropAt.toISOString()).toBe("2026-05-11T12:00:00.000Z");
    expect(plan[2].scheduledDropAt.toISOString()).toBe("2026-05-12T12:00:00.000Z");
  });

  it("ids are deterministic for the same text", () => {
    const a = buildSeedPlan(["the same text"], startDate);
    const b = buildSeedPlan(["the same text"], new Date("2026-05-12T00:00:00Z"));
    expect(a[0].id).toBe(b[0].id);
  });

  it("ids differ across different texts", () => {
    const plan = buildSeedPlan(["a", "b"], startDate);
    expect(plan[0].id).not.toBe(plan[1].id);
  });
});
```

Run the test:
```bash
cd firebase/functions && pnpm vitest run ../scripts/seed-launch-questions.test.ts
```

(If the firebase/scripts vitest config doesn't pick up `../scripts/`, add `firebase/scripts/vitest.config.ts` matching `firebase/functions/vitest.config.ts`. Most likely simpler: copy the test next to the source under `firebase/scripts/` and run via `firebase/scripts/`'s own pnpm script. Add to `firebase/scripts/package.json`:

```json
"scripts": {
  "test": "vitest run --passWithNoTests"
}
```

Then run `cd firebase/scripts && pnpm test`.)

Expected: 5 passed.

- [ ] **Step 4: Dry run against emulator**

```bash
cd C:/Users/levin/relatably/firebase
# emulator must be running: firebase emulators:start --only firestore
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod \
  pnpm tsx scripts/seed-launch-questions.ts --dry-run
```

Expected: prints "Loaded 60 questions" + plan summary + first 5 items.

- [ ] **Step 5: Levin reviews `launch-questions.txt`**

Levin opens `firebase/launch-questions.txt` and edits any question he wants to rewrite. The script runs against the EDITED file — no re-execution of the draft step needed.

- [ ] **Step 6: Real run against PROD**

After Task 14 (admin console live) and Task 10 (Cloud Functions deployed), Levin runs:

```bash
cd C:/Users/levin/relatably/firebase
FIREBASE_PROJECT_ID=relatably-prod \
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json \
  pnpm tsx scripts/seed-launch-questions.ts
```

Expected: 60 candidates + 60 scheduled questions created. Re-running is idempotent.

- [ ] **Step 7: Verify in admin console**

Visit https://relatably.app/admin/candidates → should show 60 approved candidates.
Visit https://relatably.app/admin/schedule → should show 60 scheduled questions across the next 60 UTC days.

- [ ] **Step 8: Commit**

```bash
git add firebase/launch-questions.txt firebase/scripts/seed-launch-questions.ts firebase/scripts/seed-launch-questions.test.ts firebase/scripts/package.json
git commit -m "feat(seed): 60 launch questions + idempotent seed-launch-questions.ts script"
```

---

## Task 19: iOS Sentry SDK + init + Remote Config wrapper

**Files:**
- Create: `ios/src/lib/sentry.ts`
- Create: `ios/src/lib/sentry.test.ts`
- Create: `ios/src/lib/remoteConfig.ts`
- Create: `ios/src/lib/remoteConfig.test.ts`
- Modify: `ios/app/_layout.tsx` (call init at root)
- Modify: `ios/package.json`
- Modify: `ios/app.config.ts` (add Sentry Expo plugin)

- [ ] **Step 1: Add deps**

```bash
cd ios && pnpm add @sentry/react-native@^5 @react-native-firebase/remote-config@^20
```

(Match the major version of your existing `@react-native-firebase/*` packages — check `ios/package.json` and align.)

- [ ] **Step 2: Write Sentry wrapper test**

```typescript
// ios/src/lib/sentry.test.ts
import { initSentry, captureError } from "./sentry";

const mockInit = jest.fn();
const mockCapture = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCapture(...args),
}));

describe("ios Sentry wrapper", () => {
  beforeEach(() => {
    mockInit.mockReset();
    mockCapture.mockReset();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  it("does NOT init when DSN is unset", () => {
    initSentry();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("inits when DSN is set", () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://abc@o0.ingest.sentry.io/3";
    initSentry();
    expect(mockInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://abc@o0.ingest.sentry.io/3",
    }));
  });

  it("captureError no-ops when not initialized", () => {
    captureError(new Error("x"));
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Implement `sentry.ts`**

```typescript
// ios/src/lib/sentry.ts
import * as Sentry from "@sentry/react-native";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
  initialized = true;
}

export function captureError(err: unknown, tags?: Record<string, string>): void {
  if (!initialized) return;
  Sentry.captureException(err, { tags });
}
```

- [ ] **Step 4: Write Remote Config wrapper test**

```typescript
// ios/src/lib/remoteConfig.test.ts
import { isDropEnabled } from "./remoteConfig";

const mockFetch = jest.fn();
const mockGetValue = jest.fn();

jest.mock("@react-native-firebase/remote-config", () => () => ({
  setDefaults: jest.fn(),
  setConfigSettings: jest.fn(),
  fetchAndActivate: mockFetch,
  getValue: mockGetValue,
}));

describe("ios Remote Config", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockGetValue.mockReset();
  });

  it("returns true when drop_enabled is true", async () => {
    mockFetch.mockResolvedValue(true);
    mockGetValue.mockReturnValue({ asBoolean: () => true });
    expect(await isDropEnabled()).toBe(true);
  });

  it("returns false when drop_enabled is false", async () => {
    mockFetch.mockResolvedValue(true);
    mockGetValue.mockReturnValue({ asBoolean: () => false });
    expect(await isDropEnabled()).toBe(false);
  });

  it("returns true (default) on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("net"));
    expect(await isDropEnabled()).toBe(true);
  });
});
```

- [ ] **Step 5: Implement `remoteConfig.ts`**

```typescript
// ios/src/lib/remoteConfig.ts
import remoteConfig from "@react-native-firebase/remote-config";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  const rc = remoteConfig();
  await rc.setConfigSettings({ minimumFetchIntervalMillis: 5 * 60 * 1000 });
  await rc.setDefaults({ drop_enabled: true });
  initialized = true;
}

/**
 * Returns true if the daily drop UI should be enabled. Defaults true
 * on any error (fail-open — we never want to silently kill the daily
 * ritual on the client because Remote Config flaked).
 */
export async function isDropEnabled(): Promise<boolean> {
  try {
    await ensureInit();
    await remoteConfig().fetchAndActivate();
    return remoteConfig().getValue("drop_enabled").asBoolean();
  } catch {
    return true;
  }
}
```

- [ ] **Step 6: Wire `initSentry()` into the app root**

In `ios/app/_layout.tsx` (or whatever the root layout file is — check current contents first), add at the very top of the component body:

```typescript
import { useEffect } from "react";
import { initSentry } from "@/src/lib/sentry";

// inside the component body, before render:
useEffect(() => {
  initSentry();
}, []);
```

- [ ] **Step 7: Add Sentry Expo plugin to `app.config.ts`**

Add `@sentry/react-native/expo` to the plugins array in `ios/app.config.ts`:

```typescript
plugins: [
  // ... existing plugins ...
  [
    "@sentry/react-native/expo",
    {
      organization: process.env.SENTRY_ORG ?? "relatably",
      project: process.env.SENTRY_PROJECT ?? "relatably-ios",
      // url: "https://sentry.io/", // default
    },
  ],
],
```

This plugin handles automatic sourcemap upload during EAS build via the SENTRY_AUTH_TOKEN secret (set in Task 20).

- [ ] **Step 8: Run iOS tests + typecheck**

```bash
cd ios && npx tsc --noEmit && npx jest --runInBand
```

Expected: typecheck green, all tests pass (including new ones).

- [ ] **Step 9: Commit**

```bash
git add ios/src/lib/sentry.ts ios/src/lib/sentry.test.ts ios/src/lib/remoteConfig.ts ios/src/lib/remoteConfig.test.ts ios/app/_layout.tsx ios/app.config.ts ios/package.json ios/pnpm-lock.yaml
git commit -m "feat(ios): wire Sentry init at root + Firebase Remote Config drop_enabled wrapper"
```

---

## Task 20: iOS EAS production profile + env injection + sourcemap upload

**Files:**
- Create: `ios/eas.json`
- Modify: `ios/.gitignore` (ensure `.env.production` ignored)

EAS Build needs a production profile configured to inject env vars from EAS secrets and to upload sourcemaps to Sentry.

- [ ] **Step 1: Create `ios/eas.json`**

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_API_URL": "https://relatably.app",
        "EXPO_PUBLIC_ADMOB_ENABLED": "true",
        "EXPO_PUBLIC_BRANCH_KEY": "$EXPO_PUBLIC_BRANCH_KEY",
        "EXPO_PUBLIC_SENTRY_DSN": "$EXPO_PUBLIC_SENTRY_DSN",
        "EXPO_PUBLIC_SENTRY_ENVIRONMENT": "production",
        "EXPO_PUBLIC_ADMOB_APP_ID_IOS": "$EXPO_PUBLIC_ADMOB_APP_ID_IOS",
        "EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID": "$EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID",
        "EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID": "$EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID",
        "EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID": "$EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID",
        "SENTRY_AUTH_TOKEN": "$SENTRY_AUTH_TOKEN",
        "SENTRY_ORG": "relatably",
        "SENTRY_PROJECT": "relatably-ios"
      },
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "$APPLE_ID",
        "ascAppId": "$ASC_APP_ID",
        "appleTeamId": "R95M36AU2X"
      }
    }
  }
}
```

(`appleTeamId` from the Titi & Bina memory; same Apple Developer account.)

- [ ] **Step 2: Levin sets all required EAS secrets**

```bash
cd ios

# Sentry (from Sentry → Project Settings → Auth Tokens, scope: project:write)
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<sentry-auth-token>"
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "<sentry-dsn-for-relatably-ios-project>"

# AdMob — use values from Task 11
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_APP_ID_IOS --value "ca-app-pub-XXXX~YYYY"
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID --value "ca-app-pub-XXXX/AAAA"
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID --value "ca-app-pub-XXXX/BBBB"
eas secret:create --scope project --name EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID --value "ca-app-pub-XXXX/CCCC"

# Branch.io (from Task 12)
eas secret:create --scope project --name EXPO_PUBLIC_BRANCH_KEY --value "key_live_xxxxxxxxxx"

# Apple Submit credentials (used by `eas submit`)
eas secret:create --scope project --name APPLE_ID --value "<your-apple-id-email>"
eas secret:create --scope project --name ASC_APP_ID --value "<numeric-asc-app-id>"
```

(`ASC_APP_ID` is the App Store Connect numeric app ID — created in Task 21.)

- [ ] **Step 3: Verify the eas.json parses**

```bash
cd ios && npx eas build:configure --platform ios --non-interactive 2>&1 | head -10
```

Expected: no parse errors. (If it asks to auto-configure, say no — your eas.json is hand-crafted.)

- [ ] **Step 4: Verify the iOS test suite still passes**

```bash
cd ios && npx jest --runInBand
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add ios/eas.json
git commit -m "feat(ios): add EAS production build profile with env + Sentry sourcemap upload"
```

---

## Task 21: EAS prod build + TestFlight + dogfood + ASC submission

**Files:**
- Create: `ios/store-assets/dogfood-checklist.md`
- Create: `ios/store-assets/metadata.md` (paste-ready ASC metadata)

> **Pre-requisite:** Tasks 11–20 complete. Levin has icon, screenshots, copy, privacy URL, support URL ready (per spec section 6 file structure / brainstorm decision).

- [ ] **Step 1: Bump version**

In `ios/app.config.ts`, change `version: "0.1.0"` → `version: "1.0.0"`. (EAS `autoIncrement: true` handles the build number.)

- [ ] **Step 2: Levin creates the App Store Connect app record**

In ASC web UI (https://appstoreconnect.apple.com → My Apps → +):
- Name: `Relatably`
- Primary language: English (U.S.)
- Bundle ID: `co.relatably.app` (must match `app.config.ts`)
- SKU: `relatably-ios-001`
- Note the resulting numeric **App ID**.

Set the EAS secret:
```bash
cd ios && eas secret:create --scope project --name ASC_APP_ID --value "<numeric-id>"
```

- [ ] **Step 3: Levin runs EAS prod build**

```bash
cd C:/Users/levin/relatably/ios
eas build --platform ios --profile production
```

Wait ~20-40 minutes. EAS provisions credentials automatically the first time (will prompt for Apple Account login). Build artifact = `.ipa` in EAS dashboard.

Expected output: a build URL like `https://expo.dev/accounts/.../projects/relatably/builds/<uuid>`.

- [ ] **Step 4: Verify Sentry sourcemap was uploaded**

In Sentry → Settings → Source Maps, look for an entry with the EAS build version (e.g. `1.0.0+2`). Sourcemaps should be present for the iOS bundle.

- [ ] **Step 5: Submit to TestFlight**

```bash
cd ios && eas submit --platform ios --profile production --latest
```

This uploads the latest build to App Store Connect. ASC will email Levin when processing finishes (~10-30 min).

- [ ] **Step 6: Levin installs TestFlight build on physical iPhone**

In ASC → TestFlight → Internal Testing, add Levin's Apple ID to the testing group. He installs the TestFlight app on his iPhone, accepts the test invite, downloads the build.

- [ ] **Step 7: Create the dogfood checklist + walk through**

Create `ios/store-assets/dogfood-checklist.md`:

```markdown
# Relatably v1.0 — Pre-launch dogfood checklist

Performed by: Levin Schwab
Date: <YYYY-MM-DD>
Build: 1.0.0 (<build-number-from-eas>)
Device: <iPhone model + iOS version>

## Onboarding + Phase 1
- [ ] First-launch screen renders without crash
- [ ] Push permission prompt appears and accepts
- [ ] Sign in with Apple completes successfully
- [ ] Apple Sign-in returns to app, not stuck

## Daily ritual (Phase 2)
- [ ] Today's question screen loads (live question from prod Firestore)
- [ ] Submit an answer; live wordcloud updates with my submission

## Reveal (Phase 2/4)
- [ ] If a previous question is revealed, the reveal animation plays on next launch
- [ ] Verdict text appears at end of reveal
- [ ] "SHARE THE VERDICT" button works
- [ ] Share sheet opens with image attached
- [ ] Optional: post-reveal interstitial ad shows (once per day max)

## Friends + Leaderboard (Phase 3)
- [ ] Friends tab loads (empty state ok)
- [ ] Send friend request to a 2nd test account
- [ ] Accept friend request from 2nd test account
- [ ] Leaderboard tab loads — daily / weekly / alltime tabs work
- [ ] Banner ad shows at row 10 (only if leaderboard has ≥11 entries)

## Archive (Phase 5)
- [ ] Archive tab loads with paginated tiles
- [ ] Tap a tile → detail screen loads with clusters
- [ ] Long-press a tile → share verdict card

## Push delivery (Phase 2 / requires APNs cert)
- [ ] Trigger a test drop via /admin/trigger
- [ ] Push notification arrives on the iPhone within ~60 seconds
- [ ] Tapping the notification opens the app to today's question

## Crash + observability
- [ ] Force-crash the app from a debug menu (or wait for a real crash)
- [ ] Confirm the crash appears in Sentry → Issues within 5 minutes
- [ ] Source-mapped to readable line numbers (NOT minified)

## Notes / bugs found
<list any issues here, file as Phase 7 follow-ups>
```

Levin walks through the checklist, ticks every item, attaches screenshots if anything looks off.

- [ ] **Step 8: Create the ASC metadata reference**

`ios/store-assets/metadata.md`:

```markdown
# App Store Connect metadata — Relatably v1.0

Paste-ready reference for filling out App Store Connect.

## App Information
- **Name:** Relatably
- **Subtitle (30 chars):** the world votes once a day
- **Bundle ID:** co.relatably.app
- **SKU:** relatably-ios-001
- **Primary Category:** Social Networking
- **Secondary Category:** Entertainment

## Pricing & Availability
- **Price:** Free
- **Availability:** All countries (175 markets)

## App Privacy
- **Data collected:** anonymous device identifier, push token, IP address (hashed),
  app interaction events, optional Apple ID for leaderboard scoring.
- **Tracking:** No (no IDFA collected; AdMob non-personalized ads).

## Description
<paste the description copy here — 4000 char max>

## Keywords (100 chars)
viral,social,daily,wordcloud,vote,opinion,quiz,trending,community,share

## What's New (4000 chars)
v1.0 — first launch. One question, every day, at the same moment worldwide.

## Support URL
https://relatably.app/support

## Marketing URL
https://relatably.app

## Privacy Policy URL
https://relatably.app/privacy

## Age Rating
- Frequent/intense profanity or crude humor: Infrequent/Mild
- Age rating: 12+

## App Review Information
- **Sign-in required:** No (anonymous-by-default; Apple Sign-in optional)
- **Demo account:** N/A
- **Notes for reviewer:** Relatably is a daily one-question wordcloud app.
  Each user submits a free-text answer to today's question; answers are
  aggregated into a live wordcloud. Yesterday's "verdict" (top answer) is
  revealed only after today's question is answered. To test: open the app,
  answer today's question, then close + reopen to see the reveal animation
  for any previous day's verdict.

## Build
- 1.0.0 (auto-incremented build number from EAS)
```

- [ ] **Step 9: Levin fills ASC web UI from the metadata file**

Levin pastes the description, keywords, what's-new, URLs into the ASC web UI for v1.0. Uploads:
- App icon (1024×1024)
- 5 screenshots from `ios/store-assets/screenshots/01-05.png`

Selects the build (1.0.0+N) under "Build" section.

- [ ] **Step 10: Levin clicks "Submit for Review"**

In ASC sidebar → App Review → "Zur Prüfung übermitteln" / "Submit for Review". Status flips to `Warten auf Prüfung` / "Waiting for Review".

(Mirror of the Titi & Bina submission proof pattern — capture a screenshot at `ios/store-assets/SUBMITTED.png`.)

- [ ] **Step 11: Final commit**

```bash
git add ios/app.config.ts ios/store-assets/dogfood-checklist.md ios/store-assets/metadata.md ios/store-assets/SUBMITTED.png
git commit -m "ops: bump iOS to 1.0.0; submit Relatably to App Review"
```

- [ ] **Step 12: Tag + push the phase complete**

```bash
git tag phase-6-complete
git push https://lawoflarge:<TOKEN>@github.com/lawoflarge/relatably.git phase-6-launch-hardening --tags
```

(Use the GitHub PAT from `~/.claude/projects/C--Users-levin/memory/github_token.md`.)

- [ ] **Step 13: Update memory file**

In `~/.claude/projects/C--Users-levin/memory/project_relatably.md`, add a Phase 6 section mirroring the Phase 5 section style (commit chain, lanes, deviations, what's pending Apple review). Mark v1.0 as **submitted to App Review**.

---

## Phase 6 deviations + Phase 7 follow-ups (filled in at end of execution)

**Deviations / scope decisions actually made during execution:**
1. _(executor: fill in any deviations here, mirroring Phase 5's deviations section)_

**Phase 7 follow-ups newly identified by Phase 6:**
1. PostHog analytics (deferred deliberately at brainstorm).
2. Server-rendered archive thumbnails (Sharp/Skia Cloud Function).
3. Image-metadata referral embedding (PNG iTXt).
4. Branch deep-link first-open referral credit (Phase 4 only generates codes).
5. Upstash Redis leaderboard cache.
6. Friend leaderboard pagination >300.
7. App Attest / DeviceCheck.
8. Admin polish: bulk-create candidates from CSV, AI-assisted candidate generator, roles-table migration.
9. `function_runs` janitor (Phase 6 idempotency creates ~1 doc per function invocation per drop; cleanup script TBD).
10. App Review iteration (any rejections come back here).

---

## Self-Review Notes (for the planner / reviewer)

- **Spec coverage.** Spec § 2 "Definition of done" item 1 (App Review submission) → Task 21. Item 2 (Functions cloud-deployed) → Task 10. Item 3 (Sentry receiving events on all 3 runtimes) → Tasks 8 + 9 + 19 + 21 dogfood crash check. Item 4 (3 Remote Config kill-switches live + observed) → Tasks 6+7 (drop_enabled), 15 (submit_rate_limit), 16 (leaderboard_endpoint_enabled). Item 5 (3 functions idempotent) → Tasks 3, 4, 5. Item 6 (parallel FCM fanout) → Task 4. Item 7 (60 launch questions seeded) → Task 18. Item 8 (k6 load test report) → Task 17. Item 9 (env-flagged SDKs flipped on) → Tasks 11, 12, 13, 14. Item 10 (TestFlight dogfood checklist) → Task 21 step 7.
- **Type consistency.** `getKillSwitch(key, fallback)` is the same signature across `firebase/functions/src/lib/remoteConfig.ts` and `api/src/lib/remoteConfig.ts`. `runOnce(key, fn)` is one canonical signature. `captureError(err, tags)` is one canonical signature across all three Sentry wrappers (api, functions, ios) — same arg shape, even if underlying SDKs differ.
- **No placeholders.** Every step has the full code or the exact command. No TODOs except in the explicit "executor fills in" deviations section at the end.
- **DRY.** `getKillSwitch` lives separately in api/ and functions/ (different runtimes can't share a module). Idempotency helper is single-source-of-truth in functions/. Sentry wrappers are necessarily 3 separate files (3 SDKs) but share the same shape.
- **YAGNI.** No PostHog. No Upstash. No App Attest. No bulk admin tooling. No janitor for `function_runs`. No staging Firebase project. All explicitly Phase 7+.
- **TDD.** Backend code tasks (2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 19) are TDD (failing test → implement → green). iOS Sentry+RemoteConfig follow the same pattern. Manual ops tasks (1, 10, 11, 12, 13, 14, 18 step 6, 21) verify by external check.
- **Frequent commits.** 21 tasks, one commit per task (a few have commit-after-Levin-runs follow-ups but the code lands as one commit per task).
- **Exact paths.** Every file is named with absolute or repo-relative paths. iOS `app.config.ts` replaces `app.json` in Task 11 — explicit `git rm` step shows the cleanup.
- **Single Vercel project.** Admin UI under `app/admin/*` already shipped Phase 5 in the same `api/` Vercel deployment. Phase 6 doesn't create a 2nd project.
- **No deferred-secret leaks.** All secrets (Sentry DSN, AdMob, Branch, Perspective, Apple credentials, load-test bearer) live in EAS / Vercel / Firebase functions:secrets — never in source. `.env.production` is git-ignored. `.loadtest-bearer.local` is git-ignored.

---

## 2026-05-10 Architecture Pivot — Zero Running Cost

**Why:** Levin rejected any architecture that creates monthly running costs ("I do not want to have running costs for my app"). Firebase Blaze plan was the trigger. Constraint applies to the whole Phase 6 design.

**Constraint hierarchy:**
1. Zero recurring cost (hard).
2. Commercial-use OK (Relatably ships to App Store, Gewerbe-registered).
3. Ship to App Store soon (don't tank velocity).

### Eliminated options

| Option | Reason killed |
|---|---|
| Firebase Blaze (any usage) | Pay-as-you-go = "running cost" risk per Levin's constraint |
| Vercel Cron on Hobby | Once-per-day only; insufficient cadence |
| Vercel Hobby pure ToS-compliant path | Hobby ToS prohibits commercial use; mitigated below |
| Hostinger VPS | Levin doesn't own one (corrected 2026-05-10; see `~/.claude/.../infra_no_vps.md`) |

### New architecture

```
┌─────────────────────────────┐
│  iOS app (Expo)             │
│  - Auth via Firebase Auth   │
│  - Firestore client SDK     │
│  - FCM device token reg.    │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐    ┌────────────────────────────┐
│  Firebase Spark (free)      │    │  api/ on Vercel Hobby      │
│  - Auth                     │◄───┤  - /admin/* (admin UI)     │
│  - Firestore (no Functions) │    │  - /api/admin/* endpoints  │
│  - FCM (sent via Admin SDK) │    │  - /api/cron/* endpoints   │
│  - Remote Config            │    │  - Sentry (free tier)      │
└─────────────────────────────┘    └─────────┬──────────────────┘
                                             │ POST + bearer
                                             │
┌─────────────────────────────┐              │
│  GitHub Actions cron        ├──────────────┘
│  (private repo, 2000m free) │
│  - cron-trigger-drop.yml    │
│  - cron-score-reveal.yml    │
└─────────────────────────────┘
```

**Hosting decisions:**
- **Firebase Spark plan** — Auth, Firestore, FCM, Remote Config. No Cloud Functions. $0 forever.
- **Vercel Hobby** — `api/` (admin console + HTTP endpoints + cron-target endpoints). ToS gray area for commercial use; mitigation: low traffic at launch, monitor for Vercel emails, upgrade to Pro only if forced.
- **GitHub Actions cron** — drives schedule (2000 min/mo free for private repo, commercial OK, 5-min precision floor).
- **EAS Build** for iOS (already proven via Titi & Bina).

**Server logic relocation:**
- `triggerDrop` → `api/src/app/api/cron/trigger-drop/route.ts` (POST, bearer-auth, called by GH Actions cron)
- `scoreReveal` + FCM fanout → `api/src/app/api/cron/score-reveal/route.ts` (POST, bearer-auth, called by GH Actions cron; fanout uses `firebase-admin/messaging` directly with `pLimit(10)`)
- `moderationReview` → already inline in admin "approve" button (no cron needed; calls Firestore from `/api/admin/candidates/:id/approve`)

**Primitives port:**
- `firebase/functions/src/lib/idempotency.ts` (committed `2529d86`) → ported to `api/src/lib/idempotency.ts` — same code, `firebase-admin` works in both runtimes.
- `firebase/functions/src/lib/remoteConfig.ts` (committed `bac352c`) → ported to `api/src/lib/remoteConfig.ts` — same code.
- `firebase/functions/` directory stays in repo as Phase 5 archive but **is not deployed**.

### Task delta vs original Phase 6 plan

| Original | Status | Replacement |
|---|---|---|
| T1 Blaze upgrade | **DELETED** | Stay on Spark |
| T2 functions/lib/idempotency.ts | ✅ kept as primitive | Also ported in T-PORT-RUN |
| T3 wrap moderationReview in runOnce | **DELETED** | moderationReview is now inline in admin UI (one-shot click) — runOnce not needed |
| T4 fanout pLimit(10) in functions | **DELETED** | Replaced by T-API-CRON-REVEAL (same logic, in api/) |
| T5 wrap scoreReveal in runOnce | **DELETED** | Replaced by T-API-CRON-REVEAL (uses ported runOnce) |
| T6 functions/lib/remoteConfig.ts | ✅ kept as primitive | Also ported in T-PORT-RUN |
| T7 triggerDrop honors drop_enabled | **DELETED** | Replaced by T-API-CRON-DROP (same kill-switch logic, in api/) |
| T8 Sentry on Cloud Functions | **DELETED** | No Cloud Functions; Sentry only on api/ + iOS |
| T9 Sentry on api/ | ✅ shipped `c17ac36` | — |
| T10 Deploy Cloud Functions | **DELETED** | No Cloud Functions; Vercel deploy + GH Actions setup instead |
| T11–T14 (accounts, iOS env vars) | ✅ kept | unchanged |
| T15 api remoteConfig + ratelimit override | ✅ kept | now uses ported `api/src/lib/remoteConfig.ts` |
| T16 leaderboard 503 | ✅ kept | unchanged |
| T17 k6 load test | ✅ kept | target = Vercel deployment |
| T18 60 questions seed | ✅ kept | unchanged |
| T19 iOS Sentry + Remote Config | ✅ kept | unchanged |
| T20 eas.json | ✅ kept | unchanged |
| T21 EAS build + submit | ✅ kept | unchanged |

### New tasks added by pivot

| ID | Task | Owner |
|---|---|---|
| T-PORT-RUN | Port `runOnce` + `getKillSwitch` from firebase/functions to api/src/lib + tests | code |
| T-CRON-GH | Add `.github/workflows/cron-trigger-drop.yml` + `cron-score-reveal.yml` (calls Vercel endpoints with `secrets.CRON_SECRET`) | code + Levin sets repo secrets |
| T-API-CRON-DROP | Build `api/src/app/api/cron/trigger-drop/route.ts` (bearer auth, runOnce, drop_enabled gate) + tests | code |
| T-API-CRON-REVEAL | Build `api/src/app/api/cron/score-reveal/route.ts` (bearer auth, runOnce, fanout_enabled gate, parallel FCM via pLimit(10)) + tests | code |
| T-VERCEL-DEPLOY | First `vercel deploy --prod` of api/ (Levin runs); set Firebase service-account JSON + CRON_SECRET + Sentry DSN as Vercel env vars | Levin |

### Risks logged

- **Vercel Hobby ToS commercial-use clause** — accepted risk. Indie App Store apps routinely run on Hobby without enforcement. Mitigation: monitor Vercel emails, keep traffic <100K function invocations/month (free tier hard limit anyway), upgrade to Pro ($20/mo) only when forced.
- **GitHub Actions cron 5-min precision floor** — fine for daily-cadence drops (Relatably's product is 1 question/day).
- **No retry on GH Actions cron failure** — if a scheduled run fails (network, Vercel downtime), the next slot is missed. Mitigation: idempotent endpoints + manual `/api/admin/trigger` button for re-run (already exists from Phase 5 T17).
