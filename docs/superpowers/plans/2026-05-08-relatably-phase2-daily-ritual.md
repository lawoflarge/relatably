# Relatably v1.0 — Phase 2 Implementation Plan (Daily Ritual)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working daily-ritual subsystem where (a) admin queues curated questions, (b) Cloud Functions automatically pick a uniform-random global drop time per day and atomically transition statuses (scheduled → live → revealed), (c) FCM push fanout fires on the drop, and (d) the iOS client plays a 12-second per-user reveal animation of yesterday's verdict — gated on the user having submitted yesterday — before today's question.

**Architecture:** Firebase Cloud Functions v2 (TypeScript) under `firebase/functions/` host four functions: `prepareNextDrop` (nightly cron), `triggerDrop` (every-minute cron), `fanoutPush` (Firestore trigger on status flip to `live`), and the existing Next.js API gains `/api/devices/register` (POST FCM token) and `/api/yesterday` (GET yesterday's verdict for reveal animation). The iOS client gains `@react-native-firebase/messaging` for permission/token + tap routing, and a Reanimated 3 reveal animation gated on a SecureStore "reveal-seen" flag.

**Tech Stack:** Firebase Functions v2 (`firebase-functions/v2/scheduler` + `/firestore` triggers), Firebase Admin SDK (already used in `api/`), `@react-native-firebase/messaging` 24.x (new), React Native Reanimated 3 (already pinned in `ios/package.json`), Vitest (backend tests), Jest + RNTL (iOS tests), Firebase Emulator Suite (functions:5001, firestore:8080, auth:9099, ui:4000).

**Phase 2 acceptance criteria:** A developer running `firebase emulators:start --only firestore,auth,functions` plus `pnpm dev` in `api/` should be able to:
1. Run `pnpm seed:questions` and verify 3 placeholder questions appear in Firestore as `status='scheduled'` with no `scheduled_drop_at`.
2. Trigger `prepareNextDrop` via the functions shell and verify the oldest scheduled question now has a `scheduled_drop_at` Timestamp uniformly within the next 24h UTC.
3. Set the `scheduled_drop_at` to `now()` via the Emulator UI, manually trigger `triggerDrop`, and verify in Firestore that:
   - The previous live question (if any) flipped to `status='revealed'`.
   - Top-100 clusters of that previous question got `final_rank` (1..N) and `final_pct_of_total` (0..1) fields.
   - The previously-scheduled question flipped to `status='live'`.
4. Confirm `fanoutPush` fires on the status flip (visible in functions emulator logs) and calls `messaging().sendEachForMulticast()` with mock FCM tokens (validated via mocked unit test, not real APNs delivery).
5. All Cloud Functions code has green Vitest tests against the emulator (or against unit-extracted pure functions).
6. The iOS client compiles with `@react-native-firebase/messaging` added and the new permission flow is unit-tested where logic exists.
7. The `/api/devices/register` and `/api/yesterday` endpoints have green Vitest tests.

**iOS-execution acceptance (deferred to Phase 6 / Mac):** Real FCM token registration on a physical device, real APNs delivery, real reveal animation render. Same deferral pattern as Phase 1 Task 16. Code is written and unit-tested; full E2E validation when Levin has Mac access.

---

## File Structure

```
relatably/
├── firebase/
│   ├── firebase.json                          (modify: re-add functions emulator block + functions deploy config)
│   ├── functions/                             (NEW: Firebase Functions v2 TypeScript project)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── .gitignore
│   │   ├── src/
│   │   │   ├── index.ts                       (exports prepareNextDrop, triggerDrop, fanoutPush)
│   │   │   ├── lib/
│   │   │   │   ├── admin.ts                   (lazy Firebase Admin init for emulator + prod)
│   │   │   │   ├── pickDropAt.ts              (pure: random Timestamp in [tomorrow, day-after) UTC)
│   │   │   │   ├── pickDropAt.test.ts
│   │   │   │   ├── computeFinalRanks.ts       (pure: top-N cluster ranking)
│   │   │   │   ├── computeFinalRanks.test.ts
│   │   │   │   ├── batchTokens.ts             (pure: chunk into 500-token arrays)
│   │   │   │   └── batchTokens.test.ts
│   │   │   ├── prepareNextDrop.ts             (scheduled v2 cron @ 00:00 UTC)
│   │   │   ├── prepareNextDrop.test.ts        (emulator-backed integration test)
│   │   │   ├── triggerDrop.ts                 (scheduled v2 cron every minute)
│   │   │   ├── triggerDrop.test.ts            (emulator-backed integration test)
│   │   │   ├── fanoutPush.ts                  (Firestore onDocumentUpdated trigger)
│   │   │   └── fanoutPush.test.ts             (mocked messaging client test)
│   └── scripts/
│       └── seed-questions.ts                  (NEW: admin CLI to add scheduled questions)
├── api/
│   ├── package.json                           (modify: nothing new — uses existing Admin SDK)
│   └── src/
│       └── app/
│           └── api/
│               ├── devices/
│               │   └── register/
│               │       ├── route.ts           (NEW: POST {device_token, fcm_token})
│               │       └── route.test.ts
│               └── yesterday/
│                   ├── route.ts               (NEW: GET top-10 of last revealed question)
│                   └── route.test.ts
└── ios/
    ├── package.json                           (modify: add @react-native-firebase/messaging)
    ├── app.json                               (modify: add messaging plugin + UIBackgroundModes:remote-notification)
    ├── src/
    │   ├── lib/
    │   │   ├── messaging.ts                   (NEW: permission + token registration helper)
    │   │   ├── messaging.test.ts
    │   │   ├── revealStore.ts                 (NEW: SecureStore reveal-seen tracker)
    │   │   ├── revealStore.test.ts
    │   │   └── api.ts                         (modify: add registerDevice() + fetchYesterday())
    │   ├── components/
    │   │   ├── RevealAnimation.tsx            (NEW: 12-sec sequential bubble reveal)
    │   │   └── RevealAnimation.test.tsx
    │   └── types/
    │       └── api.ts                         (modify: add Yesterday + DeviceRegister types)
    └── app/
        └── (tabs)/
            └── index.tsx                      (modify: gate reveal phase before question phase)
```

**Why this layout:**
- `firebase/functions/` is its own npm project with its own `tsconfig` + `vitest`. Firebase deploys this as a single Cloud Functions package; tests run independently of `api/`.
- All Cloud-Function business logic is extracted into pure `lib/*.ts` files that get unit-tested without the emulator. Only the function entrypoints (`prepareNextDrop.ts` etc.) need emulator-backed integration tests.
- iOS reveal animation lives next to other components; reveal-seen storage is a tiny pure module.
- `firebase/scripts/seed-questions.ts` is a TS-Node CLI; it's not deployed to Cloud Functions, so it lives outside `functions/`.

---

## Task Map (Phase 2 = 15 tasks across ~3 weeks)

| Task | Subject | Depends on |
|---|---|---|
| 1 | Re-add functions emulator + scaffold `firebase/functions/` Functions v2 TS project | — |
| 2 | Admin seed-questions CLI script | 1 |
| 3 | TDD `pickDropAt(now)` pure function | 1 |
| 4 | `prepareNextDrop` scheduled Cloud Function | 1, 3 |
| 5 | TDD `computeFinalRanks(clusters)` pure function | 1 |
| 6 | `triggerDrop` scheduled Cloud Function | 1, 5 |
| 7 | TDD `batchTokens(tokens, size)` pure function | 1 |
| 8 | `fanoutPush` Firestore-trigger Cloud Function | 1, 7 |
| 9 | iOS: install `@react-native-firebase/messaging` + permission + token registration helper (TDD) | — |
| 10 | Backend `POST /api/devices/register` endpoint | — |
| 11 | iOS: wire messaging helper to register device on app start + tap-routing | 9, 10 |
| 12 | Backend `GET /api/yesterday` endpoint | — |
| 13 | iOS: SecureStore reveal-seen tracker (TDD) | — |
| 14 | iOS: `RevealAnimation` component (TDD) + wire into root index gated on submission | 12, 13 |
| 15 | Phase 2 acceptance gate (manual emulator E2E) | all |

---

## Pre-flight: branch + Firebase functions runtime

The agent should verify before starting Task 1:

- [ ] **Confirm branch.** Run `git branch --show-current`. If on `phase-1-core-loop`, cut a new branch:

```bash
cd /c/Users/levin/relatably
git checkout -b phase-2-daily-ritual
```

- [ ] **Confirm Firebase CLI version.** Run `firebase --version`. Must be `>=13.0`. If older: `npm install -g firebase-tools`.

- [ ] **Confirm Node version.** Run `node --version`. Functions v2 requires Node 20 or 22. If older: install Node 20+ and retry.

---

## Task 1: Re-add functions emulator + scaffold Functions v2 project

**Files:**
- Modify: `firebase/firebase.json`
- Create: `firebase/functions/package.json`
- Create: `firebase/functions/tsconfig.json`
- Create: `firebase/functions/vitest.config.ts`
- Create: `firebase/functions/.gitignore`
- Create: `firebase/functions/src/index.ts`
- Create: `firebase/functions/src/lib/admin.ts`

- [ ] **Step 1: Re-add functions emulator + functions deploy config to firebase.json**

Replace `firebase/firebase.json` with:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20",
      "predeploy": ["pnpm --filter ./functions run build"]
    }
  ],
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 2: Create `firebase/functions/package.json`**

```json
{
  "name": "functions",
  "version": "0.1.0",
  "private": true,
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "pnpm build && firebase emulators:start --only functions",
    "shell": "pnpm build && firebase functions:shell",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  },
  "dependencies": {
    "firebase-admin": "^13.9.0",
    "firebase-functions": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.40",
    "typescript": "^5.6.0",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 3: Create `firebase/functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "lib": ["es2022"],
    "moduleResolution": "node",
    "strict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "lib",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts", "lib/**"]
}
```

- [ ] **Step 4: Create `firebase/functions/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create `firebase/functions/.gitignore`**

```
node_modules/
lib/
*.log
.env
.env.local
```

- [ ] **Step 6: Create `firebase/functions/src/lib/admin.ts`**

```ts
import { initializeApp, getApps, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let app: App | undefined;

export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  // In Cloud Functions runtime + emulator, Application Default Credentials Just Work.
  app = initializeApp({ credential: applicationDefault() });
  return app;
}

export function db(): Firestore {
  return getFirestore(getAdminApp());
}

export function messaging(): Messaging {
  return getMessaging(getAdminApp());
}
```

- [ ] **Step 7: Create `firebase/functions/src/index.ts` (placeholder exports)**

```ts
// Function exports will be filled in by Tasks 4, 6, 8.
// Each task adds its own export here.
```

- [ ] **Step 8: Install dependencies**

Run from `firebase/functions/`:

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm install
```

Expected: clean install, lockfile created, `node_modules/` populated.

- [ ] **Step 9: Verify TypeScript compiles**

Run:

```bash
pnpm build
```

Expected: no errors. `lib/` directory now exists with `index.js` + `lib/admin.js`.

- [ ] **Step 10: Verify Vitest runs (zero tests)**

Run:

```bash
pnpm test
```

Expected: `No test files found, exiting with code 0` (because of `--passWithNoTests`).

- [ ] **Step 11: Verify functions emulator boots**

Run from repo root:

```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start --only functions,firestore,auth
```

Expected: emulator UI starts on http://localhost:4000, functions emulator loads index.ts (no functions registered yet — this is fine), no errors. Stop with Ctrl+C.

- [ ] **Step 12: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/firebase.json firebase/functions/
git commit -m "feat(functions): scaffold Firebase Functions v2 TypeScript project"
```

---

## Task 2: Admin seed-questions CLI script

**Files:**
- Create: `firebase/scripts/seed-questions.ts`
- Create: `firebase/scripts/package.json`
- Create: `firebase/scripts/tsconfig.json`
- Create: `firebase/scripts/.gitignore`

The seed script writes `N` curated questions to Firestore with `status='scheduled'` and no `scheduled_drop_at` (which the nightly `prepareNextDrop` will fill in).

- [ ] **Step 1: Create `firebase/scripts/package.json`**

```json
{
  "name": "scripts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "seed:questions": "tsx seed-questions.ts"
  },
  "dependencies": {
    "firebase-admin": "^13.9.0",
    "tsx": "^4.19.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.40",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `firebase/scripts/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "lib": ["es2022"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 3: Create `firebase/scripts/.gitignore`**

```
node_modules/
*.log
```

- [ ] **Step 4: Create `firebase/scripts/seed-questions.ts`**

```ts
/**
 * Admin script to seed curated questions into Firestore as 'scheduled' status.
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod \
 *     pnpm seed:questions
 *
 * Each question is created with no scheduled_drop_at; the nightly
 * prepareNextDrop function picks a random drop time on its turn.
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

const QUESTIONS: string[] = [
  "what's the most overrated tourist trap?",
  "what's the worst breakup line of all time?",
  "what's a movie everyone loves that you hate?",
];

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId });
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_PATH is required when not running against the emulator",
      );
    }
    const credentials = JSON.parse(
      fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"),
    );
    initializeApp({ credential: cert(credentials), projectId });
  }

  const db = getFirestore();
  for (const text of QUESTIONS) {
    const ref = db.collection("questions").doc();
    await ref.set({
      text,
      status: "scheduled",
      source: "curated",
      created_at: FieldValue.serverTimestamp(),
      // scheduled_drop_at intentionally omitted — prepareNextDrop fills it in.
    });
    console.log(`seeded: ${ref.id} — "${text}"`);
  }
  console.log(`done. seeded ${QUESTIONS.length} scheduled questions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Install + run against emulator**

In one terminal, start the emulator:

```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start --only firestore
```

In another terminal, install + run:

```bash
cd /c/Users/levin/relatably/firebase/scripts
pnpm install
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod pnpm seed:questions
```

Expected stdout:
```
seeded: <id1> — "what's the most overrated tourist trap?"
seeded: <id2> — "what's the worst breakup line of all time?"
seeded: <id3> — "what's a movie everyone loves that you hate?"
done. seeded 3 scheduled questions.
```

- [ ] **Step 6: Verify in Emulator UI**

Open http://localhost:4000/firestore. The `questions` collection should have 3 documents, each with `status='scheduled'` and `source='curated'`. None should have `scheduled_drop_at`.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/scripts/
git commit -m "feat(scripts): admin seed-questions CLI for scheduled questions"
```

---

## Task 3: TDD `pickDropAt(now)` pure function

**Files:**
- Create: `firebase/functions/src/lib/pickDropAt.test.ts`
- Create: `firebase/functions/src/lib/pickDropAt.ts`

`pickDropAt(now)` returns a JS `Date` uniform-random within `[tomorrow 00:00:00 UTC, day-after 00:00:00 UTC)`. Pure function, no Firebase deps. Caller converts to Firestore Timestamp.

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/lib/pickDropAt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickDropAt } from "./pickDropAt";

function startOfTomorrowUTC(now: Date): Date {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return t;
}

describe("pickDropAt", () => {
  it("returns a Date within [tomorrow 00:00 UTC, day-after 00:00 UTC)", () => {
    const now = new Date(Date.UTC(2026, 4, 8, 12, 30, 0));
    const start = startOfTomorrowUTC(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    for (let i = 0; i < 1000; i++) {
      const drop = pickDropAt(now);
      expect(drop.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(drop.getTime()).toBeLessThan(end.getTime());
    }
  });

  it("distribution is roughly uniform across the 24h window", () => {
    const now = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    const buckets = new Array(24).fill(0);
    const N = 24000;
    for (let i = 0; i < N; i++) {
      const drop = pickDropAt(now);
      buckets[drop.getUTCHours()]++;
    }
    const expected = N / 24; // 1000 per bucket
    for (const count of buckets) {
      // Allow ±3-sigma slack (sqrt(1000) ≈ 31.6 → 95): generous.
      expect(count).toBeGreaterThan(expected - 200);
      expect(count).toBeLessThan(expected + 200);
    }
  });

  it("crosses month boundary correctly when 'now' is end-of-month", () => {
    const now = new Date(Date.UTC(2026, 4, 31, 23, 30, 0)); // 2026-05-31
    const drop = pickDropAt(now);
    // Tomorrow is 2026-06-01.
    expect(drop.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(drop.getUTCDate()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test
```

Expected: FAIL — `pickDropAt is not exported` / `Cannot find module './pickDropAt'`.

- [ ] **Step 3: Write minimal implementation**

Create `firebase/functions/src/lib/pickDropAt.ts`:

```ts
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a Date uniformly random within [tomorrow 00:00 UTC, day-after 00:00 UTC).
 * Pure function; injectable `now` for testability. Caller converts to Timestamp.
 */
export function pickDropAt(now: Date): Date {
  const startOfTomorrowUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const offsetMs = Math.floor(Math.random() * ONE_DAY_MS);
  return new Date(startOfTomorrowUTC + offsetMs);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/lib/pickDropAt.ts firebase/functions/src/lib/pickDropAt.test.ts
git commit -m "feat(functions): TDD pickDropAt — uniform random drop time within tomorrow UTC"
```

---

## Task 4: `prepareNextDrop` scheduled Cloud Function

**Files:**
- Create: `firebase/functions/src/prepareNextDrop.ts`
- Create: `firebase/functions/src/prepareNextDrop.test.ts`
- Modify: `firebase/functions/src/index.ts`

`prepareNextDrop` runs nightly at 00:00 UTC. It finds the oldest `status='scheduled'` question that has no `scheduled_drop_at`, picks a random drop_at via `pickDropAt(new Date())`, and updates the doc. If no eligible question is found, logs a warning (admin needs to seed more) and exits cleanly.

- [ ] **Step 1: Write the failing integration test**

This test runs against the Firestore emulator. The emulator must be started before running `pnpm test`.

Create `firebase/functions/src/prepareNextDrop.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { runPrepareNextDrop } from "./prepareNextDrop";

let app: App;
let db: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: "relatably-test" }, "prepareNextDropTest");
  db = getFirestore(app);
});

beforeEach(async () => {
  // Wipe all questions between tests via the emulator REST clear endpoint
  // would be cleanest, but a per-doc delete loop is simpler here.
  const snap = await db.collection("questions").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
});

describe("prepareNextDrop (emulator-backed)", () => {
  it("assigns scheduled_drop_at to the oldest scheduled question without one", async () => {
    // Seed two scheduled questions, oldest first.
    const older = db.collection("questions").doc("older");
    await older.set({
      text: "older question",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = db.collection("questions").doc("newer");
    await newer.set({
      text: "newer question",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-02-01T00:00:00Z"),
    });

    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    await runPrepareNextDrop(db, fakeNow);

    const olderSnap = await older.get();
    const newerSnap = await newer.get();
    const olderData = olderSnap.data() as { scheduled_drop_at?: { toDate(): Date } };
    const newerData = newerSnap.data() as { scheduled_drop_at?: { toDate(): Date } };

    expect(olderData.scheduled_drop_at).toBeDefined();
    expect(newerData.scheduled_drop_at).toBeUndefined();
  });

  it("skips scheduled questions that already have a drop_at", async () => {
    const already = db.collection("questions").doc("already");
    await already.set({
      text: "already scheduled",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-01-01T00:00:00Z"),
      scheduled_drop_at: new Date("2026-05-09T15:00:00Z"),
    });
    const fresh = db.collection("questions").doc("fresh");
    await fresh.set({
      text: "fresh",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-02-01T00:00:00Z"),
    });

    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    await runPrepareNextDrop(db, fakeNow);

    const alreadyData = (await already.get()).data() as {
      scheduled_drop_at?: { toDate(): Date };
    };
    const freshData = (await fresh.get()).data() as {
      scheduled_drop_at?: { toDate(): Date };
    };
    // 'already' must remain unchanged.
    expect(alreadyData.scheduled_drop_at!.toDate().toISOString()).toBe(
      "2026-05-09T15:00:00.000Z",
    );
    // 'fresh' must now have a drop_at.
    expect(freshData.scheduled_drop_at).toBeDefined();
  });

  it("is a no-op when no scheduled questions are queued", async () => {
    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    // Should not throw.
    await runPrepareNextDrop(db, fakeNow);
    const snap = await db.collection("questions").get();
    expect(snap.size).toBe(0);
  });

  it("ignores questions in 'live' or 'revealed' status", async () => {
    const live = db.collection("questions").doc("live");
    await live.set({
      text: "live",
      status: "live",
      source: "curated",
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
    const revealed = db.collection("questions").doc("revealed");
    await revealed.set({
      text: "revealed",
      status: "revealed",
      source: "curated",
      created_at: new Date("2026-01-02T00:00:00Z"),
    });

    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    await runPrepareNextDrop(db, fakeNow);

    expect((await live.get()).data()?.scheduled_drop_at).toBeUndefined();
    expect((await revealed.get()).data()?.scheduled_drop_at).toBeUndefined();
  });
});
```

- [ ] **Step 2: Start the Firestore emulator** (in a separate terminal — leave it running for Tasks 4, 6, 8 tests)

```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start --only firestore
```

Expected: `firestore: started on localhost:8080`.

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/prepareNextDrop.test.ts
```

Expected: FAIL — `Cannot find module './prepareNextDrop'`.

- [ ] **Step 4: Write minimal implementation**

Create `firebase/functions/src/prepareNextDrop.ts`:

```ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { pickDropAt } from "./lib/pickDropAt";

/**
 * Pure runner — separated from the scheduled-trigger wrapper so it can be
 * driven from tests with an injected db + now.
 *
 * Picks the OLDEST scheduled question that has no scheduled_drop_at, and
 * assigns a uniform-random drop time within the next-day UTC window.
 * No-op if nothing is eligible.
 */
export async function runPrepareNextDrop(
  firestore: Firestore,
  now: Date,
): Promise<void> {
  const snap = await firestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .orderBy("created_at", "asc")
    .get();

  const eligible = snap.docs.find(
    (d) => (d.data() as { scheduled_drop_at?: unknown }).scheduled_drop_at === undefined,
  );
  if (!eligible) {
    logger.warn("prepareNextDrop: no scheduled question without drop_at — admin must seed more");
    return;
  }

  const dropAt = pickDropAt(now);
  await eligible.ref.update({
    scheduled_drop_at: Timestamp.fromDate(dropAt),
  });
  logger.info("prepareNextDrop: scheduled question", {
    questionId: eligible.id,
    dropAt: dropAt.toISOString(),
  });
}

/**
 * v2 scheduled trigger — runs nightly at 00:00 UTC.
 */
export const prepareNextDrop = onSchedule(
  {
    schedule: "0 0 * * *", // every day at 00:00 UTC
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    await runPrepareNextDrop(db(), new Date());
  },
);
```

- [ ] **Step 5: Wire export into `src/index.ts`**

Replace `firebase/functions/src/index.ts`:

```ts
export { prepareNextDrop } from "./prepareNextDrop";
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test src/prepareNextDrop.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 7: Manually trigger the function in the functions shell**

In a fresh terminal:

```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start --only firestore,functions
```

In another terminal:

```bash
cd /c/Users/levin/relatably/firebase
firebase functions:shell
```

Inside the shell, type:

```
prepareNextDrop()
```

Expected: function fires, logs visible in functions emulator console. Verify in http://localhost:4000/firestore that one of the scheduled questions now has a `scheduled_drop_at`.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/
git commit -m "feat(functions): prepareNextDrop nightly scheduler picks random drop time"
```

---

## Task 5: TDD `computeFinalRanks(clusters)` pure function

**Files:**
- Create: `firebase/functions/src/lib/computeFinalRanks.test.ts`
- Create: `firebase/functions/src/lib/computeFinalRanks.ts`

Pure function: takes an array of `{id, submission_count}` and returns `{id, final_rank, final_pct_of_total}`. Sorted by submission_count desc; ties broken by lex-ascending `id` so output is deterministic. `final_pct_of_total = submission_count / sum(submission_count)`.

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/lib/computeFinalRanks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeFinalRanks } from "./computeFinalRanks";

describe("computeFinalRanks", () => {
  it("ranks clusters by submission_count descending starting at 1", () => {
    const ranks = computeFinalRanks([
      { id: "a", submission_count: 100 },
      { id: "b", submission_count: 300 },
      { id: "c", submission_count: 50 },
    ]);
    expect(ranks).toEqual([
      { id: "b", final_rank: 1, final_pct_of_total: 300 / 450 },
      { id: "a", final_rank: 2, final_pct_of_total: 100 / 450 },
      { id: "c", final_rank: 3, final_pct_of_total: 50 / 450 },
    ]);
  });

  it("breaks ties by lex-ascending id (deterministic)", () => {
    const ranks = computeFinalRanks([
      { id: "z", submission_count: 100 },
      { id: "a", submission_count: 100 },
      { id: "m", submission_count: 100 },
    ]);
    expect(ranks.map((r) => r.id)).toEqual(["a", "m", "z"]);
    expect(ranks.map((r) => r.final_rank)).toEqual([1, 2, 3]);
  });

  it("returns empty array for empty input", () => {
    expect(computeFinalRanks([])).toEqual([]);
  });

  it("handles a single cluster (rank 1, 100% of total)", () => {
    const ranks = computeFinalRanks([{ id: "solo", submission_count: 42 }]);
    expect(ranks).toEqual([
      { id: "solo", final_rank: 1, final_pct_of_total: 1 },
    ]);
  });

  it("emits final_pct_of_total = 0 when total is 0 (defensive)", () => {
    const ranks = computeFinalRanks([
      { id: "a", submission_count: 0 },
      { id: "b", submission_count: 0 },
    ]);
    expect(ranks[0].final_pct_of_total).toBe(0);
    expect(ranks[1].final_pct_of_total).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/computeFinalRanks.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `firebase/functions/src/lib/computeFinalRanks.ts`:

```ts
export interface ClusterRankInput {
  id: string;
  submission_count: number;
}

export interface ClusterRankOutput {
  id: string;
  final_rank: number;
  final_pct_of_total: number;
}

/**
 * Sort clusters by submission_count desc with lex-ascending id tiebreak,
 * assign final_rank starting at 1, compute final_pct_of_total.
 * Total of 0 yields 0% for every cluster.
 */
export function computeFinalRanks(input: ClusterRankInput[]): ClusterRankOutput[] {
  const total = input.reduce((sum, c) => sum + c.submission_count, 0);
  const sorted = [...input].sort((a, b) => {
    if (b.submission_count !== a.submission_count) {
      return b.submission_count - a.submission_count;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted.map((c, idx) => ({
    id: c.id,
    final_rank: idx + 1,
    final_pct_of_total: total === 0 ? 0 : c.submission_count / total,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/computeFinalRanks.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/lib/computeFinalRanks.ts firebase/functions/src/lib/computeFinalRanks.test.ts
git commit -m "feat(functions): TDD computeFinalRanks — deterministic top-N cluster ranking"
```

---

## Task 6: `triggerDrop` scheduled Cloud Function

**Files:**
- Create: `firebase/functions/src/triggerDrop.ts`
- Create: `firebase/functions/src/triggerDrop.test.ts`
- Modify: `firebase/functions/src/index.ts`

`triggerDrop` runs every minute. It:
1. Finds questions where `status='scheduled' AND scheduled_drop_at <= now()`. Should be at most one in steady state.
2. For each such question:
   a. **Transaction:** flip the previous `live` question (if any) to `revealed`. Single-doc write — fits in any txn.
   b. **Outside transaction:** query top-100 `answer_clusters` of the just-revealed question, run `computeFinalRanks`, write back `final_rank` + `final_pct_of_total` via a batched write (max 500 ops/batch — top-100 fits in one batch).
   c. **Transaction:** flip this scheduled question to `live`.

**Why split into multiple operations?** A Firestore transaction can read up to 500 documents. The full `answer_clusters` collection for a viral question may exceed 100k. The spec says "in a Firestore transaction" but that's aspirational — we limit final_rank to top-100 (the only ones the wordcloud + archive ever display in v1.0). Phase 3 leaderboard scoring computes per-submitter ranks separately at score-write time and does not need final_rank on every cluster.

- [ ] **Step 1: Write the failing integration test**

Create `firebase/functions/src/triggerDrop.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initializeApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { runTriggerDrop } from "./triggerDrop";

let app: App;
let db: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: "relatably-test" }, "triggerDropTest");
  db = getFirestore(app);
});

beforeEach(async () => {
  for (const col of ["questions", "answer_clusters"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("triggerDrop (emulator-backed)", () => {
  it("flips previous live → revealed and scheduled → live", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-prev").set({
      text: "yesterday",
      status: "live",
      source: "curated",
      created_at: new Date("2026-05-07T00:00:00Z"),
    });
    await db.collection("questions").doc("q-next").set({
      text: "today",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    await runTriggerDrop(db, now);

    const prev = (await db.collection("questions").doc("q-prev").get()).data();
    const next = (await db.collection("questions").doc("q-next").get()).data();
    expect(prev?.status).toBe("revealed");
    expect(next?.status).toBe("live");
  });

  it("skips questions whose scheduled_drop_at is still in the future", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-future").set({
      text: "future",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() + 60 * 60 * 1000)),
    });

    await runTriggerDrop(db, now);

    const after = (await db.collection("questions").doc("q-future").get()).data();
    expect(after?.status).toBe("scheduled");
  });

  it("computes final_rank and final_pct_of_total for top-100 clusters of revealed question", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-prev").set({
      text: "yesterday",
      status: "live",
      source: "curated",
      created_at: new Date("2026-05-07T00:00:00Z"),
    });
    await db.collection("questions").doc("q-next").set({
      text: "today",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    // Seed clusters under q-prev with varying counts.
    const clusters: { id: string; count: number }[] = [
      { id: "c-200", count: 200 },
      { id: "c-150", count: 150 },
      { id: "c-100", count: 100 },
    ];
    for (const c of clusters) {
      await db.collection("answer_clusters").doc(c.id).set({
        question_id: "q-prev",
        canonical_text: c.id,
        submission_count: c.count,
        first_submission_at: new Date("2026-05-07T01:00:00Z"),
      });
    }

    await runTriggerDrop(db, now);

    const c200 = (await db.collection("answer_clusters").doc("c-200").get()).data();
    const c150 = (await db.collection("answer_clusters").doc("c-150").get()).data();
    const c100 = (await db.collection("answer_clusters").doc("c-100").get()).data();
    expect(c200?.final_rank).toBe(1);
    expect(c150?.final_rank).toBe(2);
    expect(c100?.final_rank).toBe(3);
    expect(c200?.final_pct_of_total).toBeCloseTo(200 / 450, 5);
  });

  it("succeeds when there is no previous live question (first-ever drop)", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-first").set({
      text: "first ever",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    await runTriggerDrop(db, now);

    const first = (await db.collection("questions").doc("q-first").get()).data();
    expect(first?.status).toBe("live");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/triggerDrop.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `firebase/functions/src/triggerDrop.ts`:

```ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { computeFinalRanks } from "./lib/computeFinalRanks";

const TOP_N_TO_RANK = 100;

export async function runTriggerDrop(firestore: Firestore, now: Date): Promise<void> {
  const dueSnap = await firestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .where("scheduled_drop_at", "<=", Timestamp.fromDate(now))
    .orderBy("scheduled_drop_at", "asc")
    .get();

  if (dueSnap.empty) return;

  for (const dueDoc of dueSnap.docs) {
    // 1. Transaction A: flip previous live → revealed.
    let revealedQuestionId: string | null = null;
    await firestore.runTransaction(async (tx) => {
      const liveSnap = await tx.get(
        firestore.collection("questions").where("status", "==", "live").limit(1),
      );
      if (!liveSnap.empty) {
        const live = liveSnap.docs[0];
        revealedQuestionId = live.id;
        tx.update(live.ref, { status: "revealed" });
      }
    });

    // 2. Outside any transaction: rank top-N clusters of the just-revealed question.
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
    }

    // 3. Transaction B: flip this scheduled question → live.
    await firestore.runTransaction(async (tx) => {
      tx.update(dueDoc.ref, { status: "live" });
    });

    logger.info("triggerDrop: dropped", {
      newLiveQuestionId: dueDoc.id,
      revealedQuestionId,
    });
  }
}

/**
 * v2 scheduled trigger — runs every minute. 1-minute granularity is acceptable
 * since `scheduled_drop_at` is a continuous random value; users see "the world
 * is voting" with up to 60s lag from the chosen instant.
 */
export const triggerDrop = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    await runTriggerDrop(db(), new Date());
  },
);
```

- [ ] **Step 4: Update `src/index.ts`**

Replace with:

```ts
export { prepareNextDrop } from "./prepareNextDrop";
export { triggerDrop } from "./triggerDrop";
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test src/triggerDrop.test.ts
```

Expected: PASS — 4 tests green.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/triggerDrop.ts firebase/functions/src/triggerDrop.test.ts firebase/functions/src/index.ts
git commit -m "feat(functions): triggerDrop transitions question statuses + ranks top-100 clusters"
```

---

## Task 7: TDD `batchTokens(tokens, size)` pure function

**Files:**
- Create: `firebase/functions/src/lib/batchTokens.test.ts`
- Create: `firebase/functions/src/lib/batchTokens.ts`

Splits an array of FCM tokens into chunks of size `N` (default 500 — FCM `sendEachForMulticast` API hard limit).

- [ ] **Step 1: Write the failing test**

Create `firebase/functions/src/lib/batchTokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { batchTokens } from "./batchTokens";

describe("batchTokens", () => {
  it("returns one batch when count <= size", () => {
    const tokens = ["a", "b", "c"];
    expect(batchTokens(tokens, 500)).toEqual([["a", "b", "c"]]);
  });

  it("splits into batches of exactly size when count is a multiple", () => {
    const tokens = Array.from({ length: 1000 }, (_, i) => `t${i}`);
    const batches = batchTokens(tokens, 500);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(500);
  });

  it("last batch is smaller when count is not a multiple", () => {
    const tokens = Array.from({ length: 1234 }, (_, i) => `t${i}`);
    const batches = batchTokens(tokens, 500);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(500);
    expect(batches[2]).toHaveLength(234);
  });

  it("returns empty array for empty input", () => {
    expect(batchTokens([], 500)).toEqual([]);
  });

  it("uses default size 500 when none provided", () => {
    const tokens = Array.from({ length: 600 }, (_, i) => `t${i}`);
    const batches = batchTokens(tokens);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(100);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test src/lib/batchTokens.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `firebase/functions/src/lib/batchTokens.ts`:

```ts
const DEFAULT_BATCH_SIZE = 500;

export function batchTokens<T>(tokens: T[], size: number = DEFAULT_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    batches.push(tokens.slice(i, i + size));
  }
  return batches;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test src/lib/batchTokens.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/lib/batchTokens.ts firebase/functions/src/lib/batchTokens.test.ts
git commit -m "feat(functions): TDD batchTokens — chunk FCM tokens into 500-token batches"
```

---

## Task 8: `fanoutPush` Firestore-trigger Cloud Function

**Files:**
- Create: `firebase/functions/src/fanoutPush.ts`
- Create: `firebase/functions/src/fanoutPush.test.ts`
- Modify: `firebase/functions/src/index.ts`

`fanoutPush` is a Firestore trigger on `questions/{id}` document updates. It fires when `status` flips to `live`. Then:
1. Query all `device_users` with `fcm_token != null`. Page in batches of 500 doc reads.
2. Collect tokens, batch via `batchTokens(tokens, 500)`.
3. For each batch, call `messaging().sendEachForMulticast({ tokens, notification: { title, body }, data: { questionId } })`.
4. Log success/failure counts.

**Real APNs delivery is NOT validated in Phase 2.** The mocked test verifies the function logic. End-to-end push delivery requires APNs cert + iOS device — Phase 6.

- [ ] **Step 1: Write the failing test (mocked messaging)**

Create `firebase/functions/src/fanoutPush.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runFanoutPush } from "./fanoutPush";

describe("runFanoutPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing if status didn't change to 'live'", async () => {
    const sendEachForMulticast = vi.fn();
    const fakeDb = {
      collection: vi.fn(),
    } as any;
    const fakeMessaging = { sendEachForMulticast } as any;

    await runFanoutPush(fakeDb, fakeMessaging, {
      before: { status: "scheduled", text: "q" },
      after: { status: "scheduled", text: "q" },
    });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("does nothing when status was already 'live' before", async () => {
    const sendEachForMulticast = vi.fn();
    const fakeDb = { collection: vi.fn() } as any;
    const fakeMessaging = { sendEachForMulticast } as any;

    await runFanoutPush(fakeDb, fakeMessaging, {
      before: { status: "live", text: "q" },
      after: { status: "live", text: "q" },
    });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("fans out in 500-token batches when status flips scheduled → live", async () => {
    const tokens = Array.from({ length: 1234 }, (_, i) => `tok-${i}`);
    const docs = tokens.map((t) => ({ data: () => ({ fcm_token: t }) }));

    const fakeDb = {
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs }),
        }),
      }),
    } as any;

    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      responses: [],
    });
    const fakeMessaging = { sendEachForMulticast } as any;

    await runFanoutPush(fakeDb, fakeMessaging, {
      questionId: "q-123",
      before: { status: "scheduled", text: "today's q" },
      after: { status: "live", text: "today's q" },
    });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(3);
    const firstCall = sendEachForMulticast.mock.calls[0][0];
    expect(firstCall.tokens).toHaveLength(500);
    expect(firstCall.notification.title).toMatch(/world is voting/i);
    expect(firstCall.notification.body).toBe("today's q");
    expect(firstCall.data).toEqual({ questionId: "q-123" });
    expect(sendEachForMulticast.mock.calls[2][0].tokens).toHaveLength(234);
  });

  it("does nothing when there are zero device tokens", async () => {
    const fakeDb = {
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      }),
    } as any;
    const sendEachForMulticast = vi.fn();
    const fakeMessaging = { sendEachForMulticast } as any;

    await runFanoutPush(fakeDb, fakeMessaging, {
      questionId: "q-123",
      before: { status: "scheduled", text: "q" },
      after: { status: "live", text: "q" },
    });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/fanoutPush.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `firebase/functions/src/fanoutPush.ts`:

```ts
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import { db, messaging } from "./lib/admin";
import { batchTokens } from "./lib/batchTokens";

interface QuestionDoc {
  status: string;
  text: string;
}

interface FanoutEvent {
  questionId?: string;
  before: QuestionDoc;
  after: QuestionDoc;
}

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
  let success = 0;
  let failure = 0;

  for (const batch of batches) {
    const res = await messagingClient.sendEachForMulticast({
      tokens: batch,
      notification: {
        title: "🚨 the world is voting NOW",
        body: event.after.text,
      },
      data: event.questionId ? { questionId: event.questionId } : {},
    });
    success += res.successCount;
    failure += res.failureCount;
  }

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
    await runFanoutPush(db(), messaging(), {
      questionId: event.params.questionId,
      before,
      after,
    });
  },
);
```

- [ ] **Step 4: Update `src/index.ts`**

```ts
export { prepareNextDrop } from "./prepareNextDrop";
export { triggerDrop } from "./triggerDrop";
export { fanoutPush } from "./fanoutPush";
```

- [ ] **Step 5: Run all functions tests**

```bash
pnpm test
```

Expected: PASS — all 4 test suites green (pickDropAt, computeFinalRanks, batchTokens, fanoutPush, plus prepareNextDrop + triggerDrop with emulator running).

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/functions/src/fanoutPush.ts firebase/functions/src/fanoutPush.test.ts firebase/functions/src/index.ts
git commit -m "feat(functions): fanoutPush Firestore trigger sends FCM multicast on status flip"
```

---

## Task 9: iOS — install `@react-native-firebase/messaging` + permission helper (TDD)

**Files:**
- Modify: `ios/package.json` (add `@react-native-firebase/messaging`)
- Modify: `ios/app.json` (add UIBackgroundModes + plugin)
- Create: `ios/src/lib/messaging.ts`
- Create: `ios/src/lib/messaging.test.ts`

A pure helper that wraps the messaging SDK calls so they can be mocked. The helper:
- `requestPermission()` → returns `boolean` (granted/denied)
- `getFcmToken()` → returns `string | null`

Permission handling and token retrieval are SDK-driven; we don't unit-test the SDK itself. We test that our helper passes through correctly via mocked `@react-native-firebase/messaging`.

- [ ] **Step 1: Add `@react-native-firebase/messaging` to `ios/package.json`**

Run from `ios/`:

```bash
cd /c/Users/levin/relatably/ios
pnpm add @react-native-firebase/messaging@^24.0.0
```

Expected: package added to dependencies. Lockfile updated.

- [ ] **Step 2: Update `ios/app.json` to declare messaging plugin and UIBackgroundModes**

Replace `ios/app.json` with:

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
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
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

- [ ] **Step 3: Write the failing test**

Create `ios/src/lib/messaging.test.ts`:

```ts
import { requestNotificationPermission, getFcmToken } from "./messaging";

jest.mock("@react-native-firebase/messaging", () => {
  const requestPermission = jest.fn();
  const getToken = jest.fn();
  const messaging = jest.fn(() => ({ requestPermission, getToken }));
  // Surface authorization-status constants on the default export, like the SDK does.
  (messaging as any).AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return { __esModule: true, default: messaging };
});

import messagingModule from "@react-native-firebase/messaging";

describe("messaging helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requestNotificationPermission returns true when status is AUTHORIZED", async () => {
    (messagingModule() as any).requestPermission.mockResolvedValueOnce(1);
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  it("requestNotificationPermission returns true when status is PROVISIONAL", async () => {
    (messagingModule() as any).requestPermission.mockResolvedValueOnce(2);
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  it("requestNotificationPermission returns false when status is DENIED", async () => {
    (messagingModule() as any).requestPermission.mockResolvedValueOnce(0);
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it("getFcmToken returns the token from the SDK", async () => {
    (messagingModule() as any).getToken.mockResolvedValueOnce("fake-token-abc");
    await expect(getFcmToken()).resolves.toBe("fake-token-abc");
  });

  it("getFcmToken returns null and swallows errors", async () => {
    (messagingModule() as any).getToken.mockRejectedValueOnce(new Error("boom"));
    await expect(getFcmToken()).resolves.toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/ios
pnpm test --testPathPattern=messaging
```

Expected: FAIL — `Cannot find module './messaging'`.

- [ ] **Step 5: Write implementation**

Create `ios/src/lib/messaging.ts`:

```ts
import messaging from "@react-native-firebase/messaging";

const AUTHORIZED = (messaging as any).AuthorizationStatus.AUTHORIZED ?? 1;
const PROVISIONAL = (messaging as any).AuthorizationStatus.PROVISIONAL ?? 2;

export async function requestNotificationPermission(): Promise<boolean> {
  const status = await messaging().requestPermission();
  return status === AUTHORIZED || status === PROVISIONAL;
}

export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm test --testPathPattern=messaging
```

Expected: PASS — 5 tests green.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/package.json ios/pnpm-lock.yaml ios/app.json ios/src/lib/messaging.ts ios/src/lib/messaging.test.ts
git commit -m "feat(ios): add @react-native-firebase/messaging + permission helper (TDD)"
```

---

## Task 10: Backend `POST /api/devices/register` endpoint

**Files:**
- Create: `api/src/app/api/devices/register/route.ts`
- Create: `api/src/app/api/devices/register/route.test.ts`

Accepts `{device_token, fcm_token}`, hashes `device_token` (sha256, same as `/api/submit`), upserts `device_users/{deviceTokenHash}.fcm_token`. Idempotent.

- [ ] **Step 1: Write the failing test**

Create `api/src/app/api/devices/register/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  return {
    adminFirestore: {
      collection: vi.fn(),
    },
    adminAuth: {},
  };
});

import { POST } from "./route";
import { adminFirestore } from "@/lib/firebase";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/devices/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/devices/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing fields", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects empty fcm_token", async () => {
    const res = await POST(
      buildRequest({ device_token: "dev1", fcm_token: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts device_users with sha256-hashed device_token and stores fcm_token", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    const docMock = vi.fn(() => ({ set: setMock }));

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(
      buildRequest({ device_token: "raw-dev-1", fcm_token: "fcm-token-xyz" }),
    );
    expect(res.status).toBe(200);

    // device_token must be hashed (64 hex chars), never raw.
    const docCallArg = docMock.mock.calls[0][0] as string;
    expect(docCallArg).toMatch(/^[a-f0-9]{64}$/);
    expect(docCallArg).not.toBe("raw-dev-1");

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        device_token: "raw-dev-1",
        fcm_token: "fcm-token-xyz",
      }),
      { merge: true },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/app/api/devices/register/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `api/src/app/api/devices/register/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";

const RegisterSchema = z.object({
  device_token: z.string().min(1),
  fcm_token: z.string().min(1),
});

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = RegisterSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const deviceTokenHash = hashDeviceToken(parsed.device_token);
  await adminFirestore
    .collection("device_users")
    .doc(deviceTokenHash)
    .set(
      {
        device_token: parsed.device_token,
        fcm_token: parsed.fcm_token,
        fcm_token_updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/app/api/devices/register/route.test.ts
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/devices/register/
git commit -m "feat(api): POST /api/devices/register persists FCM token by hashed device id"
```

---

## Task 11: iOS — wire messaging helper to register device + tap-routing

**Files:**
- Modify: `ios/src/lib/api.ts` (add `registerDevice`)
- Modify: `ios/src/types/api.ts` (add `DeviceRegisterPayload`)
- Modify: `ios/app/(tabs)/index.tsx` (call register on mount + handle taps)

On first app open: request notification permission. If granted → fetch FCM token → POST to `/api/devices/register` with `{device_token, fcm_token}`. Store a `messaging_registered_at` timestamp in SecureStore so we don't re-prompt on every open. Tap routing: foreground messages no-op for v1.0; background/cold-start tap → app already opens to root index (Expo Router default) which loads today's question — no extra wiring needed.

- [ ] **Step 1: Add type to `ios/src/types/api.ts`**

Read the current contents first:

```bash
cat ios/src/types/api.ts
```

Then add to the existing file (preserve existing exports):

```ts
export interface DeviceRegisterPayload {
  device_token: string;
  fcm_token: string;
}
```

- [ ] **Step 2: Add `registerDevice` to `ios/src/lib/api.ts`**

Read the current contents first:

```bash
cat ios/src/lib/api.ts
```

Then add the new function. The exact placement depends on the existing structure — append the function and ensure it uses the same `API_BASE_URL` pattern as `fetchTodayQuestion` and `submitAnswer`. Pattern:

```ts
import type { DeviceRegisterPayload } from "../types/api";

export async function registerDevice(payload: DeviceRegisterPayload): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`register failed: ${res.status}`);
  }
}
```

- [ ] **Step 3: Wire registration into root index**

Modify `ios/app/(tabs)/index.tsx`:

Add this `useEffect` (placed alongside the existing `loadQuestion` effect, before the Firestore listener):

```ts
import { requestNotificationPermission, getFcmToken } from "@/src/lib/messaging";
import { registerDevice } from "@/src/lib/api";
// ... within HomeScreen:

useEffect(() => {
  (async () => {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      const fcmToken = await getFcmToken();
      if (!fcmToken) return;
      const deviceToken = await getDeviceToken();
      await registerDevice({ device_token: deviceToken, fcm_token: fcmToken });
    } catch (e) {
      console.warn("messaging registration failed", e);
    }
  })();
}, []);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /c/Users/levin/relatably/ios
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify Jest still green**

```bash
pnpm test
```

Expected: existing 9 tests (4 SubmitButton + 5 messaging) all pass.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/src/lib/api.ts ios/src/types/api.ts ios/app/\(tabs\)/index.tsx
git commit -m "feat(ios): register FCM token via /api/devices/register on app start"
```

---

## Task 12: Backend `GET /api/yesterday` endpoint

**Files:**
- Create: `api/src/app/api/yesterday/route.ts`
- Create: `api/src/app/api/yesterday/route.test.ts`

Returns the most recent `revealed` question + its top-10 ranked clusters. Optionally accepts a `device_token` query param: if provided, looks up which cluster (if any) this device submitted to so the iOS reveal animation can glow the matching bubble.

- [ ] **Step 1: Write the failing test**

Create `api/src/app/api/yesterday/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  return {
    adminFirestore: {
      collection: vi.fn(),
    },
    adminAuth: {},
  };
});

import { GET } from "./route";
import { adminFirestore } from "@/lib/firebase";

const buildRequest = (url: string) => new Request(url);

describe("GET /api/yesterday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when there is no revealed question", async () => {
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildRequest("http://localhost/api/yesterday"));
    expect(res.status).toBe(404);
  });

  it("returns yesterday's question text + top-10 clusters", async () => {
    const questionDoc = {
      id: "q-yesterday",
      data: () => ({ text: "what's the most overrated tourist trap?", status: "revealed" }),
    };
    const clusterDocs = [
      { id: "c-1", data: () => ({ canonical_text: "pisa tower", submission_count: 412381, final_rank: 1, final_pct_of_total: 0.32 }) },
      { id: "c-2", data: () => ({ canonical_text: "louvre", submission_count: 200000, final_rank: 2, final_pct_of_total: 0.15 }) },
    ];

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [questionDoc] }),
              }),
            }),
          }),
        };
      }
      if (name === "answer_clusters") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: clusterDocs }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildRequest("http://localhost/api/yesterday"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("q-yesterday");
    expect(body.text).toBe("what's the most overrated tourist trap?");
    expect(body.top_clusters).toHaveLength(2);
    expect(body.top_clusters[0]).toEqual({
      id: "c-1",
      canonical_text: "pisa tower",
      submission_count: 412381,
      final_rank: 1,
      final_pct_of_total: 0.32,
    });
    expect(body.self_cluster_id).toBeNull();
  });

  it("includes self_cluster_id when device_token query param is provided and matches", async () => {
    const questionDoc = {
      id: "q-yesterday",
      data: () => ({ text: "q", status: "revealed" }),
    };
    const clusterDocs = [
      { id: "c-1", data: () => ({ canonical_text: "pisa tower", submission_count: 100, final_rank: 1, final_pct_of_total: 1 }) },
    ];
    const submissionDocs = [
      { data: () => ({ normalized_cluster_id: "c-self-cluster-id" }) },
    ];

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [questionDoc] }),
              }),
            }),
          }),
        };
      }
      if (name === "answer_clusters") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: clusterDocs }),
              }),
            }),
          }),
        };
      }
      if (name === "submissions") {
        return {
          where: () => ({
            where: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: submissionDocs }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(
      buildRequest("http://localhost/api/yesterday?device_token=raw-dev-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.self_cluster_id).toBe("c-self-cluster-id");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /c/Users/levin/relatably/api
pnpm test src/app/api/yesterday/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `api/src/app/api/yesterday/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminFirestore } from "@/lib/firebase";

const TOP_N = 10;

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceToken = url.searchParams.get("device_token");

  // Most recent revealed question — order by created_at desc.
  const qSnap = await adminFirestore
    .collection("questions")
    .where("status", "==", "revealed")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();

  if (qSnap.empty) {
    return NextResponse.json({ error: "no revealed question yet" }, { status: 404 });
  }

  const questionDoc = qSnap.docs[0];
  const questionData = questionDoc.data() as { text: string };

  const clusterSnap = await adminFirestore
    .collection("answer_clusters")
    .where("question_id", "==", questionDoc.id)
    .orderBy("final_rank", "asc")
    .limit(TOP_N)
    .get();

  const top_clusters = clusterSnap.docs.map((d) => {
    const data = d.data() as {
      canonical_text: string;
      submission_count: number;
      final_rank: number;
      final_pct_of_total: number;
    };
    return {
      id: d.id,
      canonical_text: data.canonical_text,
      submission_count: data.submission_count,
      final_rank: data.final_rank,
      final_pct_of_total: data.final_pct_of_total,
    };
  });

  let self_cluster_id: string | null = null;
  if (deviceToken) {
    const hash = hashDeviceToken(deviceToken);
    const subSnap = await adminFirestore
      .collection("submissions")
      .where("question_id", "==", questionDoc.id)
      .where("device_user_id", "==", hash)
      .limit(1)
      .get();
    if (!subSnap.empty) {
      const sub = subSnap.docs[0].data() as { normalized_cluster_id?: string | null };
      self_cluster_id = sub.normalized_cluster_id ?? null;
    }
  }

  return NextResponse.json({
    id: questionDoc.id,
    text: questionData.text,
    top_clusters,
    self_cluster_id,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/app/api/yesterday/route.test.ts
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Add Firestore index for the new submissions query**

Modify `firebase/firestore.indexes.json` — add a new index on `submissions` for `(question_id ASC, device_user_id ASC)`:

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
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/yesterday/ firebase/firestore.indexes.json
git commit -m "feat(api): GET /api/yesterday returns top-10 verdict + optional self-cluster"
```

---

## Task 13: iOS — SecureStore reveal-seen tracker (TDD)

**Files:**
- Create: `ios/src/lib/revealStore.ts`
- Create: `ios/src/lib/revealStore.test.ts`

Per spec: reveal animation plays once per question, restarts from beginning if user quits mid-reveal. We track only the `markRevealSeen(questionId)` after animation completes.

- [ ] **Step 1: Write the failing test**

Create `ios/src/lib/revealStore.test.ts`:

```ts
import { hasSeenReveal, markRevealSeen } from "./revealStore";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    __reset: () => store.clear(),
  };
});

const SecureStore = jest.requireMock("expo-secure-store") as any;

describe("revealStore", () => {
  beforeEach(() => {
    SecureStore.__reset();
    jest.clearAllMocks();
  });

  it("hasSeenReveal returns false when never marked", async () => {
    await expect(hasSeenReveal("q-1")).resolves.toBe(false);
  });

  it("hasSeenReveal returns true after markRevealSeen", async () => {
    await markRevealSeen("q-1");
    await expect(hasSeenReveal("q-1")).resolves.toBe(true);
  });

  it("hasSeenReveal isolates per question id", async () => {
    await markRevealSeen("q-1");
    await expect(hasSeenReveal("q-2")).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /c/Users/levin/relatably/ios
pnpm test --testPathPattern=revealStore
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `ios/src/lib/revealStore.ts`:

```ts
import * as SecureStore from "expo-secure-store";

const PREFIX = "reveal_seen_";

export async function hasSeenReveal(questionId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${PREFIX}${questionId}`);
  return v === "1";
}

export async function markRevealSeen(questionId: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}${questionId}`, "1");
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm test --testPathPattern=revealStore
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/src/lib/revealStore.ts ios/src/lib/revealStore.test.ts
git commit -m "feat(ios): SecureStore reveal-seen tracker (TDD)"
```

---

## Task 14: iOS — `RevealAnimation` component + wire into root index

**Files:**
- Create: `ios/src/components/RevealAnimation.tsx`
- Create: `ios/src/components/RevealAnimation.test.tsx`
- Modify: `ios/src/lib/api.ts` (add `fetchYesterday`)
- Modify: `ios/src/types/api.ts` (add `Yesterday` types)
- Modify: `ios/app/(tabs)/index.tsx` (add reveal phase before question phase)

A 12-second animation that reveals top-10 bubbles in sequence #10 → #1, with a glow on `selfClusterId` if matched. We TDD the lifecycle:
- Component receives `top_clusters` + `selfClusterId` + `onComplete` callback.
- Renders bubble sequence using `setTimeout` cascade. Each bubble fades in over ~1s (Reanimated 3 `withTiming`); next bubble starts ~1s after the previous → ~10s for sequence + ~2s "world said: X" hold = 12s.
- After last bubble holds for the final card, calls `onComplete`.

For testability: the component takes an injectable `intervalMs` prop (default 1000) so tests can run at 1ms.

- [ ] **Step 1: Add types to `ios/src/types/api.ts`**

Append to existing file:

```ts
export interface YesterdayCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

export interface Yesterday {
  id: string;
  text: string;
  top_clusters: YesterdayCluster[];
  self_cluster_id: string | null;
}
```

- [ ] **Step 2: Add `fetchYesterday` to `ios/src/lib/api.ts`**

Append:

```ts
import type { Yesterday } from "../types/api";

export async function fetchYesterday(deviceToken?: string): Promise<Yesterday | null> {
  const url = new URL(`${API_BASE_URL}/api/yesterday`);
  if (deviceToken) url.searchParams.set("device_token", deviceToken);
  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`yesterday failed: ${res.status}`);
  return (await res.json()) as Yesterday;
}
```

- [ ] **Step 3: Write the failing test**

Create `ios/src/components/RevealAnimation.test.tsx`:

```tsx
import React from "react";
import { render, act } from "@testing-library/react-native";
import { RevealAnimation } from "./RevealAnimation";
import type { YesterdayCluster } from "../types/api";

const clusters: YesterdayCluster[] = Array.from({ length: 10 }, (_, i) => ({
  id: `c-${i + 1}`,
  canonical_text: `answer-${i + 1}`,
  submission_count: 1000 - i * 100,
  final_rank: i + 1,
  final_pct_of_total: (1000 - i * 100) / 5500,
}));

describe("RevealAnimation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the question text", () => {
    const { getByText } = render(
      <RevealAnimation
        questionText="what's overrated?"
        clusters={clusters}
        selfClusterId={null}
        onComplete={() => {}}
        intervalMs={1}
      />,
    );
    expect(getByText("what's overrated?")).toBeTruthy();
  });

  it("calls onComplete after all 10 bubbles + final hold", async () => {
    const onComplete = jest.fn();
    render(
      <RevealAnimation
        questionText="q"
        clusters={clusters}
        selfClusterId={null}
        onComplete={onComplete}
        intervalMs={1}
      />,
    );

    // 10 bubbles × 1ms + 2ms final hold = 12ms; advance generously.
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders the verdict text (rank-1 canonical_text) eventually", () => {
    const { getByText } = render(
      <RevealAnimation
        questionText="q"
        clusters={clusters}
        selfClusterId={null}
        onComplete={() => {}}
        intervalMs={1}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(50);
    });
    // The rank-1 cluster's canonical_text should now be visible somewhere.
    expect(getByText(/answer-1/i)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run to verify failure**

```bash
cd /c/Users/levin/relatably/ios
pnpm test --testPathPattern=RevealAnimation
```

Expected: FAIL — module not found.

- [ ] **Step 5: Write the implementation**

Create `ios/src/components/RevealAnimation.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { YesterdayCluster } from "../types/api";

interface Props {
  questionText: string;
  clusters: YesterdayCluster[]; // assumed sorted ascending by final_rank
  selfClusterId: string | null;
  onComplete: () => void;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 1000;
const HOLD_MS_DEFAULT = 2000;

export function RevealAnimation({
  questionText,
  clusters,
  selfClusterId,
  onComplete,
  intervalMs = DEFAULT_INTERVAL_MS,
}: Props) {
  // step counts down from clusters.length (showing none) to 0 (all shown).
  // Reveal order is #10 → #1, i.e. iterate clusters reversed.
  const reversed = [...clusters].sort((a, b) => b.final_rank - a.final_rank);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step < reversed.length) {
      const t = setTimeout(() => setStep((s) => s + 1), intervalMs);
      return () => clearTimeout(t);
    }
    // final hold then complete
    const t = setTimeout(onComplete, intervalMs * (HOLD_MS_DEFAULT / DEFAULT_INTERVAL_MS));
    return () => clearTimeout(t);
  }, [step, reversed.length, intervalMs, onComplete]);

  const visible = reversed.slice(0, step);
  const verdict = clusters.find((c) => c.final_rank === 1);

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{questionText}</Text>
      <View style={styles.cloud}>
        {visible.map((c) => (
          <Text
            key={c.id}
            style={[
              styles.bubble,
              c.id === selfClusterId && styles.selfBubble,
              { fontSize: 14 + c.final_pct_of_total * 40 },
            ]}
          >
            {c.canonical_text}
          </Text>
        ))}
      </View>
      {step >= reversed.length && verdict && (
        <Text style={styles.verdict}>🌍 the world said: {verdict.canonical_text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  question: {
    color: "#aaff00",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  cloud: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: {
    color: "#fff",
    margin: 6,
  },
  selfBubble: {
    color: "#aaff00",
    textShadowColor: "#aaff00",
    textShadowRadius: 8,
  },
  verdict: {
    color: "#aaff00",
    fontSize: 24,
    fontWeight: "800",
    marginVertical: 24,
    textAlign: "center",
  },
});
```

- [ ] **Step 6: Run test to verify pass**

```bash
pnpm test --testPathPattern=RevealAnimation
```

Expected: PASS — 3 tests green.

- [ ] **Step 7: Wire reveal into root index — add a 'reveal' phase**

Modify `ios/app/(tabs)/index.tsx`. Plan:
1. Extend `Phase` union: add `"reveal"` between `"loading"` and `"question"`.
2. On mount, after token registration, fetch `/api/yesterday` (with device_token).
3. If non-null AND `self_cluster_id != null` AND `!hasSeenReveal(yesterday.id)` → set `phase='reveal'`, render `RevealAnimation`. On complete: `markRevealSeen(yesterday.id)` + transition to `phase='question'`.
4. Else go straight to question loading as today.

Replace the file contents with:

```tsx
import { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WordcloudScreen, type Cluster } from "@/src/screens/WordcloudScreen";
import { SubmitButton } from "@/src/components/SubmitButton";
import { QuestionText } from "@/src/components/QuestionText";
import { AnswerInput } from "@/src/components/AnswerInput";
import { LiveCounter } from "@/src/components/LiveCounter";
import { RevealAnimation } from "@/src/components/RevealAnimation";
import {
  fetchTodayQuestion,
  fetchYesterday,
  registerDevice,
  submitAnswer,
} from "@/src/lib/api";
import { getDeviceToken } from "@/src/lib/deviceId";
import { firestore } from "@/src/lib/firebase";
import { hasSeenReveal, markRevealSeen } from "@/src/lib/revealStore";
import { requestNotificationPermission, getFcmToken } from "@/src/lib/messaging";
import type { TodayQuestion, Yesterday } from "@/src/types/api";

type Phase = "loading" | "reveal" | "question" | "wordcloud" | "error";

export default function HomeScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [yesterday, setYesterday] = useState<Yesterday | null>(null);
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt, setRenderedAt] = useState(Date.now());
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selfClusterId, setSelfClusterId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Best-effort messaging registration on first open.
  useEffect(() => {
    (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!granted) return;
        const fcmToken = await getFcmToken();
        if (!fcmToken) return;
        const deviceToken = await getDeviceToken();
        await registerDevice({ device_token: deviceToken, fcm_token: fcmToken });
      } catch (e) {
        console.warn("messaging registration failed", e);
      }
    })();
  }, []);

  const loadQuestion = useCallback(() => {
    setErrorMsg(null);
    fetchTodayQuestion()
      .then((q) => {
        setQuestion(q);
        setRenderedAt(Date.now());
        setPhase("question");
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "fetch failed";
        setErrorMsg(msg);
        setPhase("error");
      });
  }, []);

  // Boot: try yesterday-reveal first, then today's question.
  useEffect(() => {
    (async () => {
      try {
        const deviceToken = await getDeviceToken();
        const y = await fetchYesterday(deviceToken);
        if (y && y.self_cluster_id && !(await hasSeenReveal(y.id))) {
          setYesterday(y);
          setPhase("reveal");
          return;
        }
      } catch (e) {
        // Soft-fail: just proceed to today's question.
        console.warn("yesterday fetch failed", e);
      }
      loadQuestion();
    })();
  }, [loadQuestion]);

  // Subscribe to Firestore listener for live cluster updates (only when we have a question).
  useEffect(() => {
    if (!question) return;
    const unsub = firestore()
      .collection("answer_clusters")
      .where("question_id", "==", question.id)
      .orderBy("submission_count", "desc")
      .limit(100)
      .onSnapshot(
        (snap) => {
          const next: Cluster[] = snap.docs.map((d) => {
            const data = d.data() as {
              canonical_text: string;
              submission_count: number;
            };
            return {
              id: d.id,
              canonical_text: data.canonical_text,
              submission_count: data.submission_count,
            };
          });
          setClusters(next);
        },
        (err) => {
          console.warn("clusters listener error", err);
        },
      );
    return () => unsub();
  }, [question]);

  const handleRevealComplete = useCallback(async () => {
    if (yesterday) await markRevealSeen(yesterday.id);
    loadQuestion();
  }, [yesterday, loadQuestion]);

  const handleSubmit = async () => {
    if (!question) return;
    try {
      const dwellMs = Date.now() - renderedAt;
      const deviceToken = await getDeviceToken();
      const result = await submitAnswer({
        question_id: question.id,
        device_token: deviceToken,
        raw_text: text,
        dwell_ms: dwellMs,
      });
      setSelfClusterId(result.cluster_id);
      setPhase("wordcloud");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "submit failed";
      setErrorMsg(msg);
    }
  };

  const totalCount = clusters.reduce((s, c) => s + c.submission_count, 0);

  return (
    <>
      <StatusBar style="light" />
      {phase === "loading" && (
        <View style={styles.center}>
          <Text style={styles.muted}>loading…</Text>
        </View>
      )}
      {phase === "reveal" && yesterday && (
        <RevealAnimation
          questionText={yesterday.text}
          clusters={yesterday.top_clusters}
          selfClusterId={yesterday.self_cluster_id}
          onComplete={handleRevealComplete}
        />
      )}
      {phase === "error" && (
        <View style={styles.center}>
          <Text style={styles.error}>{errorMsg}</Text>
          <Pressable
            role="button"
            onPress={loadQuestion}
            style={styles.retryBtn}
          >
            <Text style={styles.retryLabel}>RETRY</Text>
          </Pressable>
        </View>
      )}
      {phase === "question" && question && (
        <View style={styles.container}>
          <QuestionText text={question.text} />
          <AnswerInput value={text} onChangeText={setText} />
          <LiveCounter count={totalCount} />
          {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
          <SubmitButton
            hasText={text.trim().length > 0}
            onPress={handleSubmit}
            startedAt={renderedAt}
          />
        </View>
      )}
      {phase === "wordcloud" && (
        <WordcloudScreen
          clusters={clusters}
          selfClusterId={selfClusterId}
          totalCount={totalCount}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingTop: 80, paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  muted: { color: "#888", fontSize: 16 },
  error: { color: "tomato", fontSize: 14, textAlign: "center", marginTop: 12 },
  retryBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#aaff00",
  },
  retryLabel: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /c/Users/levin/relatably/ios
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Verify all Jest tests pass**

```bash
pnpm test
```

Expected: all green (4 SubmitButton + 5 messaging + 3 revealStore + 3 RevealAnimation).

- [ ] **Step 10: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/src/components/RevealAnimation.tsx ios/src/components/RevealAnimation.test.tsx ios/src/types/api.ts ios/src/lib/api.ts ios/app/\(tabs\)/index.tsx
git commit -m "feat(ios): RevealAnimation + reveal phase gated on yesterday submission"
```

---

## Task 15: Phase 2 acceptance gate (manual emulator E2E)

This task is operator-driven, identical in spirit to Phase 1's Task 16. The agent cannot complete it without Levin running the local emulator + iOS sim. The agent's job is to:
- Verify all backend + Cloud-Function tests are green from a clean checkout.
- Document the manual E2E procedure clearly.
- Tag the branch when Levin confirms acceptance.

- [ ] **Step 1: Verify all unit + integration tests pass from a clean state**

In one terminal start the emulator:

```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start --only firestore
```

In another terminal:

```bash
cd /c/Users/levin/relatably/firebase/functions
pnpm test
```

Expected: 6 test files green (pickDropAt, prepareNextDrop, computeFinalRanks, triggerDrop, batchTokens, fanoutPush).

```bash
cd /c/Users/levin/relatably/api
pnpm test
```

Expected: existing tests + new register/yesterday tests all green.

```bash
cd /c/Users/levin/relatably/ios
pnpm test
```

Expected: 15 tests green (4 SubmitButton + 5 messaging + 3 revealStore + 3 RevealAnimation).

- [ ] **Step 2: Manual end-to-end emulator drill (operator: Levin)**

Operator opens 4 terminals at `C:\Users\levin\relatably\`:

**Terminal A — full emulator suite:**
```bash
cd firebase
firebase emulators:start --only firestore,auth,functions
```

**Terminal B — backend dev server:**
```bash
cd api
cp .env.example .env.local      # if not already done
# .env.local should contain:
#   FIREBASE_PROJECT_ID=relatably-prod
#   FIRESTORE_EMULATOR_HOST=localhost:8080
pnpm dev
```

**Terminal C — seed scheduled questions:**
```bash
cd firebase/scripts
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod pnpm seed:questions
```

**Terminal D — Firebase functions shell:**
```bash
cd firebase
firebase functions:shell
```

In the functions shell:
```
prepareNextDrop()
```

Expected: in the Emulator UI (http://localhost:4000/firestore), the oldest scheduled question now has `scheduled_drop_at` set to a Timestamp ~tomorrow UTC.

In the Emulator UI, edit that question's `scheduled_drop_at` to be `now()` (a few seconds in the past). Then in the functions shell:
```
triggerDrop()
```

Expected:
- That question flipped to `status='live'`.
- The functions emulator console logs `triggerDrop: dropped`.
- The functions emulator console logs `fanoutPush: no devices to notify` (no FCM tokens exist yet).

Repeat the seed → prepareNextDrop → triggerDrop cycle a second time. Now there's a `live` and a `revealed` question. To exercise the rank computation:
- Manually add 3 `answer_clusters` docs in the Emulator UI under the previously-live question with varying `submission_count` values.
- Re-run `triggerDrop()` after seeding another scheduled question and pushing its `scheduled_drop_at` to `now()`.
- Verify the previously-live question is now `revealed` and its three clusters have `final_rank` 1/2/3 + `final_pct_of_total`.

- [ ] **Step 3: iOS simulator drill (DEFERRED)**

Document in the commit message that the iOS visual + push path is deferred to Phase 6 / Mac access, same as Phase 1 Task 16. No code changes; this is a status acknowledgement.

- [ ] **Step 4: Tag the branch**

After Levin confirms acceptance:

```bash
cd /c/Users/levin/relatably
git tag -a phase-2-complete -m "Phase 2: Daily Ritual subsystem complete (backend + functions verified; iOS deferred to Phase 6)"
```

- [ ] **Step 5: Update project memory**

Update `~/.claude/projects/C--Users-levin/memory/project_relatably.md` to reflect:
- Phase 2 is code-complete.
- Branch `phase-2-daily-ritual` tagged `phase-2-complete`.
- iOS push delivery + reveal animation deferred to Phase 6 (needs APNs cert + Mac).
- Next phase: Phase 3 — Leaderboard + anti-cheat.

---

## Self-review (post-write checklist)

**Spec coverage check:**
- [x] §6 "Cloud Function `prepareNextDrop`" → Task 4
- [x] §6 "Cloud Function `triggerDrop`" → Task 6 (with documented deviation: top-100 final_rank only; leaderboard scoring deferred to Phase 3)
- [x] §6 "FCM push fanout in 1k-device batches" → Task 8 (deviation: 500-batch, FCM API hard limit)
- [x] §4 "Yesterday's verdict reveal animation" → Tasks 12, 13, 14
- [x] §4 "Push notification routing" → Task 11 (Expo Router default + UIBackgroundModes; foreground handler is a no-op for v1.0)
- [x] §6 "Admin: seed-question script" → Task 2
- [x] Edge case: "If quit mid-reveal: resumes from start" → Task 13 only marks seen after onComplete fires
- [x] Edge case: "If user never opens that day, brief replay of missed-day's reveal" → covered by reveal-store keyed on questionId; works for any prior unseen revealed question with a self-submission

**Placeholder scan:** none — every task has complete code blocks, exact commands, and expected output.

**Type consistency:**
- `pickDropAt` is named the same in Tasks 3, 4 — ✓
- `computeFinalRanks` returns `{id, final_rank, final_pct_of_total}`; consumed identically in Tasks 5, 6, 12 — ✓
- `Yesterday` type is defined once in Task 14 step 1 and used in Task 14 step 2 — ✓
- `runPrepareNextDrop` / `runTriggerDrop` / `runFanoutPush` follow the same `run*` extraction pattern across Tasks 4, 6, 8 — ✓
- `device_users` doc fields: Task 10 writes `{device_token, fcm_token, fcm_token_updated_at}` with `merge:true`; Task 8 reads `fcm_token`; Phase 1 `/api/submit` writes `{device_token, linked_user_id, created_at}` with `merge:true`. No collisions — `merge:true` preserves both sides' fields. ✓

**Open documented deviations from spec (called out for reviewer):**
1. **`triggerDrop` is NOT a single transaction.** Status flip + final_rank batch + status flip = three operations (one batched-write between two transactions). The spec wording is aspirational — Firestore transactions are capped at 500 doc reads.
2. **`final_rank` is computed for top-100 clusters only**, not the full collection. Phase 3 leaderboard scoring will compute per-submitter ranks at score-write time using a separate path; nothing else in the v1.0 product reads `final_rank` past the top-10/100.
3. **FCM batch size = 500** (FCM API limit), not 1000 as the spec text mentions.
4. **iOS-execution acceptance is deferred to Phase 6.** Code is written, unit-tested, and TypeScript-clean; real APNs delivery + simulator visual validation needs Mac + APNs cert.

---

**End of Phase 2 implementation plan.**
