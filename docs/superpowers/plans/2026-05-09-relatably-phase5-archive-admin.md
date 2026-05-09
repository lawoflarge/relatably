# Relatably v1.0 — Phase 5 Implementation Plan (Archive + Admin Tools)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two working subsystems on top of Phases 1–4: (a) a public **archive** of past revealed questions — paginated tile grid in iOS with a 3–5 cluster mini-thumbnail per tile, tap → full-cluster detail, long-press → share via the existing Phase 4 `ShareCardVerdict`; backed by `GET /api/archive` + `GET /api/archive/[id]`; and (b) a web-only **admin console** at `/admin` (path-gated under the existing `api/` Vercel project) that lets the admin curate `question_candidates`, schedule a question for a specific drop date, and manually trigger the next drop. Admin endpoints are gated to a hardcoded UID list from `ADMIN_UIDS` env via a new `requireAdmin` helper. Sign-in on the web console uses Firebase Auth + Google provider.

**Architecture:**

- **Backend (api/, Next.js 16)** gains: `lib/admin.ts` (`requireAdmin`), 2 public archive endpoints (`GET /api/archive` paginated, `GET /api/archive/[id]` detail), 5 admin endpoints (`GET /api/admin/candidates`, `POST /api/admin/candidates`, `PATCH /api/admin/candidates/[id]`, `GET /api/admin/questions`, `POST /api/admin/questions/[id]/schedule`, `POST /api/admin/trigger-drop`), and 4 `app/admin/*` UI pages that use the Firebase JS client SDK to sign in with Google and call those admin endpoints with the user's Firebase ID token as a Bearer header.
- **Manual drop trigger** is intentionally a **soft trigger**: the admin endpoint sets the chosen scheduled question's `scheduled_drop_at = Timestamp.now()`, then the existing `triggerDrop` minute cron picks it up within ≤60s. This avoids duplicating ~70 lines of `runTriggerDrop` + `runScoreReveal` orchestration into `api/` and keeps the trigger idempotent (the cron is the single source of truth).
- **Archive thumbnail** is the cheapest possible: server returns the top 3–5 cluster `canonical_text` strings per tile; iOS renders them as 3–5 mini bubbles (reusing `ClusterBubble` styling). NOT a server-rendered PNG. Zero added cost; works on day 1.
- **Archive pagination** uses cursor on `created_at desc` (deterministic under inserts; offset is broken when new revealed questions land mid-scroll).
- **iOS** gains: `screens/ArchiveDetailScreen.tsx`, `components/ArchiveTileThumbnail.tsx`, an Expo Router dynamic route at `app/(tabs)/archive/[id].tsx`, and a rewrite of the existing `screens/ArchiveScreen.tsx` (currently a Phase 4 ad-injection scaffold) to fetch + paginate real archive data and wire tap (→ detail) + long-press (→ share via existing `ShareCardVerdict`).
- **All admin write paths flow through the API layer** with Admin SDK; Firestore Security Rules stay deny-by-default. The web admin console only ever calls HTTP endpoints — it never writes Firestore directly via the client SDK.

**Tech Stack (additions in this phase):**

- `firebase` ^10 (NEW dep in `api/` — Firebase JS client SDK for the admin web console's Google sign-in).
- No new Cloud Functions deps. No new iOS deps.
- All other tech stack carries over from Phases 1–4: Next.js 16 (read `node_modules/next/dist/docs/` before touching routes; dynamic-route `params` is `Promise<{ id: string }>`), Vitest for backend tests, Jest + React Native Testing Library for iOS tests, Firebase Admin SDK for server-side Firestore writes.

**Phase 5 acceptance criteria:** A developer running `firebase emulators:start --only firestore,auth,functions` plus `pnpm dev` in `api/` should be able to:

1. `GET /api/archive` returns `{ tiles: [{ question_id, question_text, verdict_text, top_clusters: string[], created_at }], next_cursor: string | null }` paginated by `created_at desc` (default page size 20). `?cursor=<created_at_iso>` returns the next page.
2. `GET /api/archive/<id>` returns `{ id, text, created_at, top_clusters: [{ id, canonical_text, submission_count, final_rank, final_pct_of_total }] }` for a revealed question (default top 50). 404 if the question isn't revealed (or doesn't exist).
3. `POST /api/admin/candidates` with `{ candidate_text }` and admin Bearer token writes `question_candidates/{auto-id}` with `status='pending'`. Without a token → 401. With non-admin uid → 403.
4. `GET /api/admin/candidates` returns `{ candidates: [{ id, candidate_text, status, created_at }] }` ordered by `created_at desc`. Optional `?status=pending` filter.
5. `PATCH /api/admin/candidates/<id>` with `{ action: "approve" }` flips that candidate to `status='approved'` AND creates a sibling `questions/{auto-id}` doc with `status='scheduled'`, `source='ai_assisted'`, `text=<candidate_text>` — atomic via Firestore batch. `{ action: "reject" }` flips to `status='rejected'` only.
6. `GET /api/admin/questions` returns `{ questions: [{ id, text, status, scheduled_drop_at, created_at }] }` for `status in ['scheduled', 'live']` ordered by `created_at desc`.
7. `POST /api/admin/questions/<id>/schedule` with `{ scheduled_drop_at: <ISO 8601 string> }` sets that field on the doc. 400 if the question isn't `status='scheduled'`. Admin-only.
8. `POST /api/admin/trigger-drop` picks the oldest `status='scheduled'` question, sets its `scheduled_drop_at = Timestamp.now()`, and returns `{ question_id, will_fire_within_seconds: 60 }`. Admin-only.
9. iOS `ArchiveScreen` fetches the first page on mount, renders tiles with 3–5 mini bubbles each (via `ArchiveTileThumbnail`), loads more on `onEndReached`, navigates to `app/(tabs)/archive/[id].tsx` on tap, and shares via the existing `ShareCardVerdict` on long-press. The Phase 4 `BannerAdSlot slot="archive_banner"` injection between every 8 tiles is preserved.
10. Web admin console at `http://localhost:3000/admin` shows a Google Sign-In button. After sign-in, if `auth.currentUser.uid` ∈ `NEXT_PUBLIC_ADMIN_UIDS` (a public env so the web client can show/hide the gate; the actual server-side enforcement is via `ADMIN_UIDS` on each admin endpoint), shows links to `/admin/candidates`, `/admin/schedule`, `/admin/trigger`. Each page uses the user's Firebase ID token as the Bearer header.
11. All Cloud Functions tests still green (no new functions added). All backend endpoints have green Vitest tests. All new iOS lib + components + screens have green Jest tests. **Target: ≥280 tests across the 3 codebases at end of Phase 5** (Phase 4 ended at 239; Phase 5 adds ~40+ tests across the new endpoints, types, and iOS pieces; admin web pages are NOT unit-tested — see scope decision #6).
12. Branch `phase-5-archive-admin` is cut off `phase-4-share-monetization` AFTER this plan is committed + tagged `phase-5-plan-seed`. Each task lands as its own commit. Final commit gets tagged `phase-5-complete`. Pushed to `origin`.

**iOS-execution acceptance (deferred to Phase 6 / Mac):** Real iOS native build, real Firebase Auth + Google sign-in on web (works on dev workstation; Vercel prod just needs the OAuth client redirect URI added), real device validation of long-press share + archive scrolling. Same deferral pattern as Phases 1–4 iOS deferrals.

---

## Scope Decisions Made (To Surface At Planning Gate)

These five decisions are baked into the plan. Each is the recommended option from the user's planning-gate question list. If the user disagrees, the plan needs an edit before execution.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Admin auth model** | Hardcoded `ADMIN_UIDS` env list, server-side `requireAdmin` checks. Web gate also reads `NEXT_PUBLIC_ADMIN_UIDS` for UI affordance. | Cheapest possible. v1.0 has 1 admin (Levin). Roles table is v1.1+ when team grows. |
| 2 | **Archive thumbnail format** | Top 3–5 cluster `canonical_text` strings; iOS renders mini bubbles. | $0 cost, works immediately, reuses existing `ClusterBubble` style. Server-rendered PNG (Cloud Function + Sharp/Skia) is Phase 6 polish. |
| 3 | **Admin console hosting** | Path-gated `/admin` route under existing `api/` Vercel project. | Single Vercel project = single deploy + single env. Subdomain `admin.relatably.app` would mean a 2nd Vercel project + 2nd auth flow. |
| 4 | **Archive pagination** | Cursor on `created_at` desc (string ISO timestamp passed back as `next_cursor`). | Deterministic under inserts. Offset breaks when a new revealed question lands mid-scroll. |
| 5 | **User-submitted-questions deferral** | Phase 5 ONLY reads/curates the existing `question_candidates` collection (currently empty). No write path from end-users. Admin can manually create candidates via the console form. AI-generated candidate ingestion = future task, not Phase 5. | Spec § 8 puts user-submitted questions in v1.1 (~6 weeks post-launch). |

Two additional sub-decisions baked in (smaller scope; flagged here for transparency):

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 6 | **Admin web UI testing** | Backend admin endpoints are fully Vitest-covered. Admin web pages (`app/admin/*.tsx`) are NOT unit-tested. | Adding React Testing Library + Firebase JS SDK mocks to `api/` for 4 thin pages costs more than it returns. Manual smoke-test at `localhost:3000/admin` is the verification. Same precedent as Phase 4 iOS interstitial-gate integration test ("not worth the cost"). |
| 7 | **Admin sign-in provider** | Firebase Auth + Google provider on web. | One toggle in Firebase Console. No Resend/SMTP setup needed (vs email-link). No Apple Service ID setup needed (vs web Apple Sign-In). |
| 8 | **Manual drop trigger mechanism** | Admin endpoint sets `scheduled_drop_at = Timestamp.now()`; existing `triggerDrop` minute cron picks it up within ≤60s. | Avoids duplicating ~70 lines of `runTriggerDrop` + `runScoreReveal` into `api/`. Cron is the single source of truth. ≤60s wait is acceptable for soft-launch / debug usage. |

---

## File Structure

```
relatably/
├── api/
│   ├── package.json                                       (modify: add `firebase` ^10 dep for web sign-in)
│   ├── .env.example                                       (modify: document ADMIN_UIDS, NEXT_PUBLIC_ADMIN_UIDS, NEXT_PUBLIC_FIREBASE_* vars)
│   └── src/
│       ├── lib/
│       │   ├── admin.ts                                   (NEW: requireAdmin(req) — wraps requireAuth, checks uid in ADMIN_UIDS)
│       │   ├── admin.test.ts
│       │   └── firebaseClient.ts                          (NEW: Firebase JS client init for web admin pages)
│       └── app/
│           ├── api/
│           │   ├── archive/
│           │   │   ├── route.ts                           (NEW: GET paginated revealed questions)
│           │   │   ├── route.test.ts
│           │   │   └── [id]/
│           │   │       ├── route.ts                       (NEW: GET full archive detail)
│           │   │       └── route.test.ts
│           │   └── admin/
│           │       ├── candidates/
│           │       │   ├── route.ts                       (NEW: GET list + POST create)
│           │       │   ├── route.test.ts
│           │       │   └── [id]/
│           │       │       ├── route.ts                   (NEW: PATCH approve/reject)
│           │       │       └── route.test.ts
│           │       ├── questions/
│           │       │   ├── route.ts                       (NEW: GET list scheduled+live)
│           │       │   ├── route.test.ts
│           │       │   └── [id]/
│           │       │       └── schedule/
│           │       │           ├── route.ts               (NEW: POST set scheduled_drop_at)
│           │       │           └── route.test.ts
│           │       └── trigger-drop/
│           │           ├── route.ts                       (NEW: POST manual soft-trigger)
│           │           └── route.test.ts
│           └── admin/
│               ├── layout.tsx                             (NEW: Firebase Auth gate via Google sign-in)
│               ├── page.tsx                               (NEW: landing — links to candidates/schedule/trigger)
│               ├── candidates/
│               │   └── page.tsx                           (NEW: list + create form + approve/reject buttons)
│               ├── schedule/
│               │   └── page.tsx                           (NEW: list scheduled questions + set-drop-at form)
│               └── trigger/
│                   └── page.tsx                           (NEW: single button to soft-trigger next drop)
├── firebase/
│   ├── firestore.indexes.json                             (modify: add question_candidates.status + created_at index)
│   └── (no other firebase changes)
└── ios/
    ├── src/
    │   ├── lib/
    │   │   └── api.ts                                     (modify: add fetchArchive, fetchArchiveDetail clients)
    │   ├── components/
    │   │   ├── ArchiveTileThumbnail.tsx                   (NEW: renders 3–5 mini cluster bubbles)
    │   │   └── ArchiveTileThumbnail.test.tsx
    │   ├── screens/
    │   │   ├── ArchiveScreen.tsx                          (REWRITE: fetch real data, paginate, tap+long-press handlers)
    │   │   ├── ArchiveScreen.test.tsx                     (REWRITE: cover paginated fetch + tile rendering)
    │   │   ├── ArchiveDetailScreen.tsx                    (NEW: full-cluster view + share button)
    │   │   └── ArchiveDetailScreen.test.tsx
    │   └── types/
    │       └── api.ts                                     (modify: add ArchiveTile, ArchivePage, ArchiveDetail types)
    └── app/
        └── (tabs)/
            ├── archive.tsx                                (modify: fetch first page + pass tiles + handlers to ArchiveScreen)
            └── archive/
                └── [id].tsx                               (NEW: Expo Router dynamic route → ArchiveDetailScreen)
```

**Why this layout:**

- `lib/admin.ts` mirrors `lib/auth.ts` — one function, one responsibility, easy to test in isolation.
- Archive endpoints live under `app/api/archive/*` (parallel to `app/api/yesterday/route.ts`, which is the closest existing analog). Yesterday returns the most-recent revealed question + its top-10 clusters. Archive returns paginated revealed-question summaries, then a per-id detail. Same shape, different scope.
- Admin endpoints under `app/api/admin/*` are grouped by resource (`candidates`, `questions`, `trigger-drop`) — each route file is a single resource handler. This matches Phase 3's pattern (`app/api/friends/{request,accept,[id]}/route.ts`).
- Admin web pages live under `app/admin/*` (not `app/(admin)/`) so the URL is exactly `/admin/...`. The `layout.tsx` is the auth gate; child pages assume signed-in admin.
- iOS archive split: `ArchiveTileThumbnail.tsx` is a pure component (testable with snapshots / element counts). `ArchiveScreen.tsx` rewrite owns data fetching + pagination state. `ArchiveDetailScreen.tsx` is a separate screen, navigated to via Expo Router. Same pattern as Phase 3 split (`LeaderboardScreen` + `LeaderboardRow`).
- Two `perspective.ts` copies were Phase 4's deliberate duplication. **Phase 5 has no parallel duplication** — `runTriggerDrop` is NOT copied into `api/` (the soft-trigger design avoids it).

---

## Pre-flight: branch + tag plan

After this plan file is written + reviewed:

1. Commit the plan on the current branch `phase-4-share-monetization`:
   ```
   git add docs/superpowers/plans/2026-05-09-relatably-phase5-archive-admin.md
   git commit -m "docs: add Phase 5 archive + admin tools plan"
   ```
2. Tag the plan-seed commit:
   ```
   git tag phase-5-plan-seed
   ```
3. Cut the working branch:
   ```
   git checkout -b phase-5-archive-admin
   ```
4. Push the branch and the tag:
   ```
   git push https://lawoflarge:<token>@github.com/lawoflarge/relatably.git phase-5-archive-admin --tags
   ```
5. Each task below produces its own commit on `phase-5-archive-admin`. After Task 18, tag `phase-5-complete` and push.

---

## Task Map (Phase 5 = 18 tasks across ~2 weeks)

| Task | Subject | Depends on |
|---|---|---|
| 1 | Firestore index for `question_candidates` (status + created_at desc) | — |
| 2 | TDD `api/src/lib/admin.ts` — `requireAdmin(req)` | — |
| 3 | TDD `GET /api/archive` — paginated revealed questions | — |
| 4 | TDD `GET /api/archive/[id]` — full archive detail | — |
| 5 | TDD `GET /api/admin/candidates` + `POST /api/admin/candidates` | 1, 2 |
| 6 | TDD `PATCH /api/admin/candidates/[id]` (approve / reject + atomic question creation) | 2, 5 |
| 7 | TDD `GET /api/admin/questions` (list scheduled+live) | 2 |
| 8 | TDD `POST /api/admin/questions/[id]/schedule` | 2 |
| 9 | TDD `POST /api/admin/trigger-drop` (soft-trigger via timestamp bump) | 2 |
| 10 | iOS: `types/api.ts` archive types + `lib/api.ts` `fetchArchive` + `fetchArchiveDetail` clients | — |
| 11 | iOS: `components/ArchiveTileThumbnail.tsx` (3–5 mini bubbles) | 10 |
| 12 | iOS: REWRITE `screens/ArchiveScreen.tsx` (paginated fetch + tile + long-press share) | 10, 11 |
| 13 | iOS: `screens/ArchiveDetailScreen.tsx` + Expo Router dynamic route at `app/(tabs)/archive/[id].tsx` | 10 |
| 14 | iOS: wire `app/(tabs)/archive.tsx` to fetch + pass real tiles | 12 |
| 15 | api/: `lib/firebaseClient.ts` + `firebase` JS dep + `app/admin/layout.tsx` Google sign-in gate | — |
| 16 | api/: `app/admin/page.tsx` landing + `app/admin/candidates/page.tsx` console | 5, 6, 15 |
| 17 | api/: `app/admin/schedule/page.tsx` + `app/admin/trigger/page.tsx` | 7, 8, 9, 15 |
| 18 | Final: `.env.example` updates, README addendum, Phase 5 deviations doc, branch tag `phase-5-complete` | 1–17 |

**Estimated weeks:** 2 weeks (tracks Phases 3 + 4 cadence: 16/17 tasks → ~2 weeks under subagent-driven execution).

---

## Task 1: Firestore index for `question_candidates` (status + created_at desc)

**Files:**
- Modify: `firebase/firestore.indexes.json`

The admin `GET /api/admin/candidates?status=pending` query is `where("status", "==", X).orderBy("created_at", "desc")`, which Firestore requires a composite index for.

- [ ] **Step 1: Add the new index entry**

Append to the `indexes` array in `firebase/firestore.indexes.json` (keep existing entries; just add this one before the closing `]`):

```json
    {
      "collectionGroup": "question_candidates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
```

- [ ] **Step 2: Verify the file parses as valid JSON**

Run:
```
node -e "JSON.parse(require('fs').readFileSync('firebase/firestore.indexes.json'))"
```
Expected: silent (no output, no error).

- [ ] **Step 3: Deploy index to the local emulator (best-effort; emulator auto-creates indexes on demand but explicit deploy validates the JSON)**

If the emulator is running, indexes get auto-applied next time you `firebase deploy --only firestore:indexes` against the live project (Phase 6). Locally the emulator no-ops on indexes (it doesn't require them). Skip this step in dev; just note in the commit message that the index needs deploying when Phase 6 cuts the cloud release.

- [ ] **Step 4: Commit**

```bash
git add firebase/firestore.indexes.json
git commit -m "feat(firestore): add question_candidates status+created_at index for admin console"
```

---

## Task 2: TDD `api/src/lib/admin.ts` — `requireAdmin(req)`

**Files:**
- Create: `api/src/lib/admin.ts`
- Test: `api/src/lib/admin.test.ts`

This wraps `requireAuth` and checks the decoded uid against the `ADMIN_UIDS` env var (comma-separated). Returns the decoded token if admin, else `null`. The endpoints decide what to do with `null` (401 if no auth, 403 if auth but not admin).

- [ ] **Step 1: Write the failing tests**

Create `api/src/lib/admin.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
  adminFirestore: {},
}));

import { adminAuth } from "@/lib/firebase";
import { requireAdmin } from "./admin";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

describe("requireAdmin", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    delete process.env.ADMIN_UIDS;
  });

  afterEach(() => {
    delete process.env.ADMIN_UIDS;
  });

  it("returns null when no Authorization header", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    const req = new Request("http://localhost/x");
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "no_auth" });
  });

  it("returns null when token is invalid", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer bad-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "no_auth" });
  });

  it("returns 'not_admin' when uid not in ADMIN_UIDS", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    verifyIdToken.mockResolvedValue({ uid: "uid-3" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "not_admin", decoded: { uid: "uid-3" } });
  });

  it("returns 'ok' when uid in ADMIN_UIDS", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    verifyIdToken.mockResolvedValue({ uid: "uid-2" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "ok", decoded: { uid: "uid-2" } });
  });

  it("returns 'no_auth' when ADMIN_UIDS env is unset (defensive — prevents accidental open admin)", async () => {
    // ADMIN_UIDS deliberately not set
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "not_admin", decoded: { uid: "uid-1" } });
  });

  it("trims whitespace in ADMIN_UIDS list", async () => {
    process.env.ADMIN_UIDS = " uid-1 ,  uid-2 ";
    verifyIdToken.mockResolvedValue({ uid: "uid-2" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result.kind).toBe("ok");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run src/lib/admin.test.ts
```
Expected: FAIL — `Cannot find module './admin'`.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/lib/admin.ts`:

```typescript
import type { DecodedIdToken } from "firebase-admin/auth";
import { requireAuth } from "@/lib/auth";

export type RequireAdminResult =
  | { kind: "no_auth" }
  | { kind: "not_admin"; decoded: DecodedIdToken }
  | { kind: "ok"; decoded: DecodedIdToken };

function adminUids(): Set<string> {
  const raw = process.env.ADMIN_UIDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export async function requireAdmin(req: Request): Promise<RequireAdminResult> {
  const decoded = await requireAuth(req);
  if (!decoded) return { kind: "no_auth" };
  if (!adminUids().has(decoded.uid)) return { kind: "not_admin", decoded };
  return { kind: "ok", decoded };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run src/lib/admin.test.ts
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/lib/admin.ts api/src/lib/admin.test.ts
git commit -m "feat(api): add requireAdmin helper with ADMIN_UIDS env gate"
```

---

## Task 3: TDD `GET /api/archive` — paginated revealed questions

**Files:**
- Create: `api/src/app/api/archive/route.ts`
- Test: `api/src/app/api/archive/route.test.ts`

Returns `{ tiles, next_cursor }`. Each tile holds 3–5 cluster `canonical_text` strings for the iOS thumbnail. Pagination is cursor-based on `created_at` desc; `cursor` is the ISO timestamp of the last tile from the previous page; the next page returns rows where `created_at < cursor`.

**Defaults:** page size 20, thumbnail count 5 (top-5 clusters by `final_rank`).

This endpoint is **public** (no auth) — same as `/api/yesterday`.

> **Next.js 16 reminder:** Read `node_modules/next/dist/docs/` if anything about `Request`, `NextResponse`, or App Router routing seems unfamiliar. Phase 4 confirmed the route handler signature in Next 16 is plain `(req: Request) => Response | NextResponse | Promise<...>`.

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/archive/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const fakeFirestore = {
  collection: vi.fn(),
};

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
}));

import { GET } from "./route";

function makeQuestionDoc(id: string, text: string, createdAt: Date) {
  return {
    id,
    data: () => ({ text, created_at: Timestamp.fromDate(createdAt) }),
  };
}

function makeClusterDoc(id: string, canonical_text: string, final_rank: number) {
  return {
    id,
    data: () => ({ canonical_text, final_rank }),
  };
}

describe("GET /api/archive", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
  });

  it("returns tiles ordered by created_at desc with default page size 20", async () => {
    const q1 = makeQuestionDoc("q1", "first?", new Date("2026-05-09T00:00:00Z"));
    const q2 = makeQuestionDoc("q2", "second?", new Date("2026-05-08T00:00:00Z"));
    const c1 = [
      makeClusterDoc("c1a", "yes", 1),
      makeClusterDoc("c1b", "no", 2),
      makeClusterDoc("c1c", "maybe", 3),
    ];
    const c2 = [makeClusterDoc("c2a", "italy", 1)];

    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [q1, q2] }),
    };
    const clustersCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn()
        .mockResolvedValueOnce({ docs: c1 })
        .mockResolvedValueOnce({ docs: c2 }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return questionsCol;
      if (name === "answer_clusters") return clustersCol;
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiles).toHaveLength(2);
    expect(body.tiles[0]).toEqual({
      question_id: "q1",
      question_text: "first?",
      verdict_text: "yes",
      top_clusters: ["yes", "no", "maybe"],
      created_at: "2026-05-09T00:00:00.000Z",
    });
    expect(body.tiles[1]).toEqual({
      question_id: "q2",
      question_text: "second?",
      verdict_text: "italy",
      top_clusters: ["italy"],
      created_at: "2026-05-08T00:00:00.000Z",
    });
    expect(body.next_cursor).toBe("2026-05-08T00:00:00.000Z");

    expect(questionsCol.where).toHaveBeenCalledWith("status", "==", "revealed");
    expect(questionsCol.orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(questionsCol.limit).toHaveBeenCalledWith(20);
  });

  it("returns next_cursor=null when fewer tiles than page size returned", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return questionsCol;
      if (name === "answer_clusters") return { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ docs: [] }) };
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiles).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("applies cursor on subsequent page", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const cursor = "2026-05-08T00:00:00.000Z";
    const req = new Request(`http://localhost/api/archive?cursor=${encodeURIComponent(cursor)}`);
    await GET(req);

    expect(questionsCol.startAfter).toHaveBeenCalledTimes(1);
    const startAfterArg = questionsCol.startAfter.mock.calls[0][0];
    // expect a Firestore Timestamp constructed from the cursor
    expect(startAfterArg.toDate().toISOString()).toBe(cursor);
  });

  it("ignores invalid cursor string and returns first page", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const req = new Request("http://localhost/api/archive?cursor=not-a-date");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(questionsCol.startAfter).not.toHaveBeenCalled();
  });

  it("respects ?limit query param within bounds", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const req = new Request("http://localhost/api/archive?limit=5");
    await GET(req);

    expect(questionsCol.limit).toHaveBeenCalledWith(5);
  });

  it("clamps limit to MAX (50)", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const req = new Request("http://localhost/api/archive?limit=999");
    await GET(req);

    expect(questionsCol.limit).toHaveBeenCalledWith(50);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run src/app/api/archive/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/archive/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const THUMBNAIL_CLUSTERS = 5;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursorRaw = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");

  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  let query = adminFirestore
    .collection("questions")
    .where("status", "==", "revealed")
    .orderBy("created_at", "desc");

  if (cursorRaw) {
    const cursorDate = new Date(cursorRaw);
    if (!Number.isNaN(cursorDate.getTime())) {
      query = query.startAfter(Timestamp.fromDate(cursorDate));
    }
  }

  const qSnap = await query.limit(limit).get();

  const tiles = await Promise.all(
    qSnap.docs.map(async (doc) => {
      const data = doc.data() as { text: string; created_at: Timestamp };
      const clusterSnap = await adminFirestore
        .collection("answer_clusters")
        .where("question_id", "==", doc.id)
        .orderBy("final_rank", "asc")
        .limit(THUMBNAIL_CLUSTERS)
        .get();
      const top_clusters = clusterSnap.docs.map(
        (c) => (c.data() as { canonical_text: string }).canonical_text,
      );
      return {
        question_id: doc.id,
        question_text: data.text,
        verdict_text: top_clusters[0] ?? "",
        top_clusters,
        created_at: data.created_at.toDate().toISOString(),
      };
    }),
  );

  const next_cursor = tiles.length > 0 ? tiles[tiles.length - 1].created_at : null;
  return NextResponse.json({ tiles, next_cursor });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run src/app/api/archive/route.test.ts
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/app/api/archive/route.ts api/src/app/api/archive/route.test.ts
git commit -m "feat(api): add GET /api/archive paginated revealed-question tiles"
```

---

## Task 4: TDD `GET /api/archive/[id]` — full archive detail

**Files:**
- Create: `api/src/app/api/archive/[id]/route.ts`
- Test: `api/src/app/api/archive/[id]/route.test.ts`

Returns the full top-N (default 50) clusters for a single revealed question. 404 if the question isn't found, isn't revealed, or has no clusters. Public (no auth).

> **Next.js 16 reminder:** dynamic-route `params` is `Promise<{ id: string }>` — confirmed in `api/src/app/api/friends/[id]/route.ts`. Use `await ctx.params`.

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/archive/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const fakeFirestore = {
  collection: vi.fn(),
};

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
}));

import { GET } from "./route";

function questionRefMock(getResult: { exists: boolean; data?: () => unknown; id: string }) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
  };
}

describe("GET /api/archive/[id]", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
  });

  it("returns 200 with question + top clusters when revealed", async () => {
    const ref = questionRefMock({
      exists: true,
      id: "q1",
      data: () => ({
        text: "what's the most overrated tourist trap?",
        status: "revealed",
        created_at: Timestamp.fromDate(new Date("2026-05-09T00:00:00Z")),
      }),
    });
    const clustersCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "c1", data: () => ({ canonical_text: "Pisa Tower", submission_count: 412, final_rank: 1, final_pct_of_total: 0.31 }) },
          { id: "c2", data: () => ({ canonical_text: "Eiffel Tower", submission_count: 80, final_rank: 2, final_pct_of_total: 0.06 }) },
        ],
      }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      if (name === "answer_clusters") return clustersCol;
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/q1");
    const ctx = { params: Promise.resolve({ id: "q1" }) };
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: "q1",
      text: "what's the most overrated tourist trap?",
      created_at: "2026-05-09T00:00:00.000Z",
      top_clusters: [
        { id: "c1", canonical_text: "Pisa Tower", submission_count: 412, final_rank: 1, final_pct_of_total: 0.31 },
        { id: "c2", canonical_text: "Eiffel Tower", submission_count: 80, final_rank: 2, final_pct_of_total: 0.06 },
      ],
    });
    expect(clustersCol.limit).toHaveBeenCalledWith(50);
  });

  it("returns 404 when question doesn't exist", async () => {
    const ref = questionRefMock({ exists: false, id: "missing" });
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/missing");
    const ctx = { params: Promise.resolve({ id: "missing" }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
  });

  it("returns 404 when question exists but is not revealed", async () => {
    const ref = questionRefMock({
      exists: true,
      id: "q-live",
      data: () => ({ text: "live now", status: "live", created_at: Timestamp.now() }),
    });
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/q-live");
    const ctx = { params: Promise.resolve({ id: "q-live" }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
  });

  it("respects ?limit param within MAX (200)", async () => {
    const ref = questionRefMock({
      exists: true,
      id: "q1",
      data: () => ({
        text: "x",
        status: "revealed",
        created_at: Timestamp.now(),
      }),
    });
    const clustersCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      if (name === "answer_clusters") return clustersCol;
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/q1?limit=999");
    const ctx = { params: Promise.resolve({ id: "q1" }) };
    await GET(req, ctx);

    expect(clustersCol.limit).toHaveBeenCalledWith(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run src/app/api/archive/\[id\]/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/archive/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import type { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");

  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  const ref = adminFirestore.collection("questions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const qData = snap.data() as { text: string; status: string; created_at: Timestamp };
  if (qData.status !== "revealed") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const clusterSnap = await adminFirestore
    .collection("answer_clusters")
    .where("question_id", "==", id)
    .orderBy("final_rank", "asc")
    .limit(limit)
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

  return NextResponse.json({
    id,
    text: qData.text,
    created_at: qData.created_at.toDate().toISOString(),
    top_clusters,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run src/app/api/archive/\[id\]/route.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "api/src/app/api/archive/[id]/route.ts" "api/src/app/api/archive/[id]/route.test.ts"
git commit -m "feat(api): add GET /api/archive/[id] full revealed-question detail"
```

---

## Task 5: TDD `GET /api/admin/candidates` + `POST /api/admin/candidates`

**Files:**
- Create: `api/src/app/api/admin/candidates/route.ts`
- Test: `api/src/app/api/admin/candidates/route.test.ts`

`GET` lists candidates ordered by `created_at desc`, optional `?status=pending|approved|rejected` filter. Returns 401 if no auth, 403 if non-admin auth.

`POST` creates a new candidate from `{ candidate_text: string }`. Returns the new doc id. Status starts `'pending'`.

Schema (from spec § 6 — adapted for v1.0 admin-only writes; `user_id` and `votes_count` omitted because user submissions are v1.1):

```
/question_candidates/{candidateId}
    candidate_text: string
    status: 'pending' | 'approved' | 'rejected'
    created_at: Timestamp
```

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/admin/candidates/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const fakeFirestore = {
  collection: vi.fn(),
};

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { adminAuth } from "@/lib/firebase";
import { GET, POST } from "./route";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

function authedReq(uid: string, init?: RequestInit) {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request("http://localhost/api/admin/candidates", {
    ...init,
    headers: { Authorization: "Bearer t", ...(init?.headers ?? {}) },
  });
}

describe("GET /api/admin/candidates", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/candidates");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    const req = authedReq("not-admin");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns ordered candidates for admin", async () => {
    const candidatesCol = {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "c1", data: () => ({ candidate_text: "first?", status: "pending", created_at: Timestamp.fromDate(new Date("2026-05-09T00:00:00Z")) }) },
          { id: "c2", data: () => ({ candidate_text: "second?", status: "approved", created_at: Timestamp.fromDate(new Date("2026-05-08T00:00:00Z")) }) },
        ],
      }),
    };
    fakeFirestore.collection.mockReturnValue(candidatesCol);

    const req = authedReq("admin-1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      candidates: [
        { id: "c1", candidate_text: "first?", status: "pending", created_at: "2026-05-09T00:00:00.000Z" },
        { id: "c2", candidate_text: "second?", status: "approved", created_at: "2026-05-08T00:00:00.000Z" },
      ],
    });
    expect(candidatesCol.orderBy).toHaveBeenCalledWith("created_at", "desc");
  });

  it("applies ?status filter when present", async () => {
    const candidatesCol = {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockReturnValue(candidatesCol);

    const req = authedReq("admin-1", { method: "GET" });
    const url = new URL(req.url);
    url.searchParams.set("status", "pending");
    const filteredReq = new Request(url, req);
    await GET(filteredReq);

    expect(candidatesCol.where).toHaveBeenCalledWith("status", "==", "pending");
  });
});

describe("POST /api/admin/candidates", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/candidates", { method: "POST", body: JSON.stringify({ candidate_text: "x?" }) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    const req = authedReq("not-admin", { method: "POST", body: JSON.stringify({ candidate_text: "x?" }) });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    const req = authedReq("admin-1", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates candidate with status=pending", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const docMock = vi.fn().mockReturnValue({ id: "new-cid", set: setMock });
    fakeFirestore.collection.mockReturnValue({ doc: docMock });

    const req = authedReq("admin-1", { method: "POST", body: JSON.stringify({ candidate_text: "is pizza overrated?" }) });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: "new-cid", candidate_text: "is pizza overrated?", status: "pending" });
    expect(setMock).toHaveBeenCalledWith({
      candidate_text: "is pizza overrated?",
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run src/app/api/admin/candidates/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/admin/candidates/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

const CreateSchema = z.object({
  candidate_text: z.string().min(1).max(280),
});

const StatusSchema = z.enum(["pending", "approved", "rejected"]);

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  let query: FirebaseFirestore.Query = adminFirestore.collection("question_candidates");

  if (statusParam) {
    const parsedStatus = StatusSchema.safeParse(statusParam);
    if (parsedStatus.success) {
      query = query.where("status", "==", parsedStatus.data);
    }
  }
  query = query.orderBy("created_at", "desc").limit(200);

  const snap = await query.get();
  const candidates = snap.docs.map((d) => {
    const data = d.data() as { candidate_text: string; status: string; created_at: Timestamp };
    return {
      id: d.id,
      candidate_text: data.candidate_text,
      status: data.status,
      created_at: data.created_at.toDate().toISOString(),
    };
  });

  return NextResponse.json({ candidates });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body;
  try {
    body = CreateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ref = adminFirestore.collection("question_candidates").doc();
  await ref.set({
    candidate_text: body.candidate_text,
    status: "pending",
    created_at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { id: ref.id, candidate_text: body.candidate_text, status: "pending" },
    { status: 201 },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run src/app/api/admin/candidates/route.test.ts
```
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/app/api/admin/candidates/route.ts api/src/app/api/admin/candidates/route.test.ts
git commit -m "feat(api): add admin candidates list + create endpoint"
```

---

## Task 6: TDD `PATCH /api/admin/candidates/[id]` (approve / reject)

**Files:**
- Create: `api/src/app/api/admin/candidates/[id]/route.ts`
- Test: `api/src/app/api/admin/candidates/[id]/route.test.ts`

`PATCH` body: `{ action: "approve" | "reject" }`.

On `approve`: atomic Firestore batch — flip candidate `status='approved'` AND create a `questions/{auto-id}` doc with:
```
{
  text: <candidate.candidate_text>,
  status: 'scheduled',
  source: 'ai_assisted',
  created_at: serverTimestamp(),
}
```
(`scheduled_drop_at` deliberately omitted — `prepareNextDrop` cron picks it up; or the admin can manually schedule it via `/api/admin/questions/[id]/schedule`.)

On `reject`: just flip candidate `status='rejected'`.

Returns the updated candidate + the new question id (on approve only).

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/admin/candidates/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const fakeFirestore = {
  collection: vi.fn(),
  batch: vi.fn(),
};

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { adminAuth } from "@/lib/firebase";
import { PATCH } from "./route";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

function authedReq(uid: string, body: object, id = "cid") {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request(`http://localhost/api/admin/candidates/${id}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/candidates/[id]", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    fakeFirestore.batch.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/candidates/cid", {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    const req = authedReq("not-admin", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid action", async () => {
    const req = authedReq("admin-1", { action: "ignore" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when candidate doesn't exist", async () => {
    const candidateRef = {
      get: vi.fn().mockResolvedValue({ exists: false }),
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(candidateRef) });

    const req = authedReq("admin-1", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("on reject: flips status to rejected (no question created)", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const candidateRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "cid",
        data: () => ({ candidate_text: "x?", status: "pending", created_at: Timestamp.now() }),
      }),
      update: updateMock,
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(candidateRef) });

    const req = authedReq("admin-1", { action: "reject" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "cid", status: "rejected" });
    expect(updateMock).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("on approve: atomic batch flips status + creates scheduled question", async () => {
    const candidateRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "cid",
        data: () => ({ candidate_text: "is pizza overrated?", status: "pending", created_at: Timestamp.now() }),
      }),
    };
    const newQuestionRef = { id: "qid-new" };
    const collectionMock = vi.fn((name: string) => {
      if (name === "question_candidates") return { doc: vi.fn().mockReturnValue(candidateRef) };
      if (name === "questions") return { doc: vi.fn().mockReturnValue(newQuestionRef) };
      throw new Error("unexpected collection " + name);
    });
    fakeFirestore.collection.mockImplementation(collectionMock);

    const batchUpdate = vi.fn();
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    fakeFirestore.batch.mockReturnValue({ update: batchUpdate, set: batchSet, commit: batchCommit });

    const req = authedReq("admin-1", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "cid", status: "approved", question_id: "qid-new" });
    expect(batchUpdate).toHaveBeenCalledWith(candidateRef, { status: "approved" });
    expect(batchSet).toHaveBeenCalledWith(newQuestionRef, {
      text: "is pizza overrated?",
      status: "scheduled",
      source: "ai_assisted",
      created_at: FieldValue.serverTimestamp(),
    });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("rejects approving an already-approved candidate", async () => {
    const candidateRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "cid",
        data: () => ({ candidate_text: "x?", status: "approved", created_at: Timestamp.now() }),
      }),
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(candidateRef) });

    const req = authedReq("admin-1", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run "src/app/api/admin/candidates/[id]/route.test.ts"
```
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/admin/candidates/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

const PatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const candidateRef = adminFirestore.collection("question_candidates").doc(id);
  const snap = await candidateRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const candidate = snap.data() as { candidate_text: string; status: string };
  if (candidate.status !== "pending") {
    return NextResponse.json(
      { error: `candidate already ${candidate.status}` },
      { status: 409 },
    );
  }

  if (body.action === "reject") {
    await candidateRef.update({ status: "rejected" });
    return NextResponse.json({ id, status: "rejected" });
  }

  // approve: atomic batch — mark candidate approved + create scheduled question
  const newQuestionRef = adminFirestore.collection("questions").doc();
  const batch = adminFirestore.batch();
  batch.update(candidateRef, { status: "approved" });
  batch.set(newQuestionRef, {
    text: candidate.candidate_text,
    status: "scheduled",
    source: "ai_assisted",
    created_at: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ id, status: "approved", question_id: newQuestionRef.id });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run "src/app/api/admin/candidates/[id]/route.test.ts"
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add "api/src/app/api/admin/candidates/[id]/route.ts" "api/src/app/api/admin/candidates/[id]/route.test.ts"
git commit -m "feat(api): admin can approve/reject candidates; approve atomically schedules"
```

---

## Task 7: TDD `GET /api/admin/questions` (list scheduled+live)

**Files:**
- Create: `api/src/app/api/admin/questions/route.ts`
- Test: `api/src/app/api/admin/questions/route.test.ts`

Returns `{ questions: [{ id, text, status, scheduled_drop_at, created_at }] }` for `status in ['scheduled', 'live']`. `scheduled_drop_at` may be `null` if unset. Ordered by `created_at desc`. Limit 100. Admin-only.

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/admin/questions/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const fakeFirestore = {
  collection: vi.fn(),
};

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { adminAuth } from "@/lib/firebase";
import { GET } from "./route";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

function authedReq(uid: string) {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request("http://localhost/api/admin/questions", {
    headers: { Authorization: "Bearer t" },
  });
}

describe("GET /api/admin/questions", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/questions");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const req = authedReq("not-admin");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("lists scheduled + live questions", async () => {
    const drop = Timestamp.fromDate(new Date("2026-05-10T12:00:00Z"));
    const created = Timestamp.fromDate(new Date("2026-05-09T00:00:00Z"));
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "q1", data: () => ({ text: "a?", status: "scheduled", scheduled_drop_at: drop, created_at: created }) },
          { id: "q2", data: () => ({ text: "b?", status: "live", created_at: created }) },
        ],
      }),
    };
    fakeFirestore.collection.mockReturnValue(questionsCol);

    const req = authedReq("admin-1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      questions: [
        { id: "q1", text: "a?", status: "scheduled", scheduled_drop_at: "2026-05-10T12:00:00.000Z", created_at: "2026-05-09T00:00:00.000Z" },
        { id: "q2", text: "b?", status: "live", scheduled_drop_at: null, created_at: "2026-05-09T00:00:00.000Z" },
      ],
    });
    expect(questionsCol.where).toHaveBeenCalledWith("status", "in", ["scheduled", "live"]);
    expect(questionsCol.orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(questionsCol.limit).toHaveBeenCalledWith(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run src/app/api/admin/questions/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/admin/questions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import type { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  const snap = await adminFirestore
    .collection("questions")
    .where("status", "in", ["scheduled", "live"])
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  const questions = snap.docs.map((d) => {
    const data = d.data() as {
      text: string;
      status: "scheduled" | "live";
      scheduled_drop_at?: Timestamp;
      created_at: Timestamp;
    };
    return {
      id: d.id,
      text: data.text,
      status: data.status,
      scheduled_drop_at: data.scheduled_drop_at ? data.scheduled_drop_at.toDate().toISOString() : null,
      created_at: data.created_at.toDate().toISOString(),
    };
  });

  return NextResponse.json({ questions });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run src/app/api/admin/questions/route.test.ts
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/app/api/admin/questions/route.ts api/src/app/api/admin/questions/route.test.ts
git commit -m "feat(api): add GET /api/admin/questions for scheduling console"
```

---

## Task 8: TDD `POST /api/admin/questions/[id]/schedule`

**Files:**
- Create: `api/src/app/api/admin/questions/[id]/schedule/route.ts`
- Test: `api/src/app/api/admin/questions/[id]/schedule/route.test.ts`

Body: `{ scheduled_drop_at: <ISO 8601 string> }`. Updates the question's `scheduled_drop_at`. 400 if the timestamp is invalid or in the past. 400 if question status is not `'scheduled'` (can't reschedule a live or revealed question). 404 if not found. Admin-only.

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/admin/questions/[id]/schedule/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const fakeFirestore = { collection: vi.fn() };

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { adminAuth } from "@/lib/firebase";
import { POST } from "./route";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

function authedReq(uid: string, body: object, id = "qid") {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request(`http://localhost/api/admin/questions/${id}/schedule`, {
    method: "POST",
    headers: { Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/questions/[id]/schedule", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("401 without auth", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "{}" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(401);
  });

  it("403 for non-admin", async () => {
    const req = authedReq("not-admin", { scheduled_drop_at: "2030-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(403);
  });

  it("400 for invalid date", async () => {
    const req = authedReq("admin-1", { scheduled_drop_at: "not-a-date" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(400);
  });

  it("400 for past date", async () => {
    const req = authedReq("admin-1", { scheduled_drop_at: "2000-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(400);
  });

  it("404 when question doesn't exist", async () => {
    const ref = { get: vi.fn().mockResolvedValue({ exists: false }) };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(ref) });

    const req = authedReq("admin-1", { scheduled_drop_at: "2099-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("400 when question is not 'scheduled'", async () => {
    const ref = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid",
        data: () => ({ status: "live" }),
      }),
      update: vi.fn(),
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(ref) });

    const req = authedReq("admin-1", { scheduled_drop_at: "2099-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(400);
  });

  it("updates scheduled_drop_at when valid", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const ref = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid",
        data: () => ({ status: "scheduled" }),
      }),
      update: updateMock,
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(ref) });

    const req = authedReq("admin-1", { scheduled_drop_at: "2099-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "qid", scheduled_drop_at: "2099-01-01T00:00:00.000Z" });
    const arg = updateMock.mock.calls[0][0] as { scheduled_drop_at: Timestamp };
    expect(arg.scheduled_drop_at.toDate().toISOString()).toBe("2099-01-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run "src/app/api/admin/questions/[id]/schedule/route.test.ts"
```
Expected: FAIL.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/admin/questions/[id]/schedule/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

const Schema = z.object({
  scheduled_drop_at: z.string(),
});

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const date = new Date(body.scheduled_drop_at);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (date.getTime() <= Date.now()) {
    return NextResponse.json({ error: "scheduled_drop_at must be in the future" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const ref = adminFirestore.collection("questions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const data = snap.data() as { status: string };
  if (data.status !== "scheduled") {
    return NextResponse.json(
      { error: `question is ${data.status}, only 'scheduled' can be re-scheduled` },
      { status: 400 },
    );
  }

  await ref.update({ scheduled_drop_at: Timestamp.fromDate(date) });

  return NextResponse.json({ id, scheduled_drop_at: date.toISOString() });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run "src/app/api/admin/questions/[id]/schedule/route.test.ts"
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add "api/src/app/api/admin/questions/[id]/schedule/route.ts" "api/src/app/api/admin/questions/[id]/schedule/route.test.ts"
git commit -m "feat(api): admin can set scheduled_drop_at for a question"
```

---

## Task 9: TDD `POST /api/admin/trigger-drop`

**Files:**
- Create: `api/src/app/api/admin/trigger-drop/route.ts`
- Test: `api/src/app/api/admin/trigger-drop/route.test.ts`

Picks the oldest `status='scheduled'` question (ordered by `created_at asc`) and sets its `scheduled_drop_at = Timestamp.now()`. The existing `triggerDrop` minute cron will pick it up within ≤60s. Admin-only.

If no scheduled question exists, returns 404 with a clear error.

Optional body `{ question_id: string }` to target a specific question (otherwise oldest).

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/admin/trigger-drop/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const fakeFirestore = { collection: vi.fn() };

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { adminAuth } from "@/lib/firebase";
import { POST } from "./route";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

function authedReq(uid: string, body: object = {}) {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request("http://localhost/api/admin/trigger-drop", {
    method: "POST",
    headers: { Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/trigger-drop", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("401 without auth", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "{}" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("403 for non-admin", async () => {
    const req = authedReq("not-admin");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("404 when no scheduled question exists", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    };
    fakeFirestore.collection.mockReturnValue(questionsCol);

    const req = authedReq("admin-1");
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("flips oldest scheduled drop_at to now", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const docRef = {
      id: "qid-old",
      update: updateMock,
    };
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: "qid-old", ref: docRef, data: () => ({ status: "scheduled" }) }],
      }),
    };
    fakeFirestore.collection.mockReturnValue(questionsCol);

    const req = authedReq("admin-1");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.question_id).toBe("qid-old");
    expect(body.will_fire_within_seconds).toBe(60);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const arg = updateMock.mock.calls[0][0] as { scheduled_drop_at: Timestamp };
    // Timestamp should be ~now
    const diff = Math.abs(arg.scheduled_drop_at.toDate().getTime() - Date.now());
    expect(diff).toBeLessThan(2000);
  });

  it("targets specific question_id when provided", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const docRef = { id: "qid-target", update: updateMock };
    const docMock = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid-target",
        ref: docRef,
        data: () => ({ status: "scheduled" }),
      }),
      update: updateMock,
    });
    fakeFirestore.collection.mockReturnValue({ doc: docMock });

    const req = authedReq("admin-1", { question_id: "qid-target" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.question_id).toBe("qid-target");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("400 when targeted question is not 'scheduled'", async () => {
    const docMock = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid-live",
        data: () => ({ status: "live" }),
      }),
    });
    fakeFirestore.collection.mockReturnValue({ doc: docMock });

    const req = authedReq("admin-1", { question_id: "qid-live" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd api && pnpm vitest run src/app/api/admin/trigger-drop/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Write the minimal implementation**

Create `api/src/app/api/admin/trigger-drop/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

const BodySchema = z.object({
  question_id: z.string().min(1).optional(),
});

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body: { question_id?: string } = {};
  try {
    const text = await req.text();
    if (text) body = BodySchema.parse(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const now = Timestamp.now();

  if (body.question_id) {
    const ref = adminFirestore.collection("questions").doc(body.question_id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const data = snap.data() as { status: string };
    if (data.status !== "scheduled") {
      return NextResponse.json({ error: `question is ${data.status}` }, { status: 400 });
    }
    await ref.update({ scheduled_drop_at: now });
    return NextResponse.json({ question_id: body.question_id, will_fire_within_seconds: 60 });
  }

  // no question_id: pick oldest scheduled
  const snap = await adminFirestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .orderBy("created_at", "asc")
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "no scheduled question to trigger" }, { status: 404 });
  }

  const doc = snap.docs[0];
  await doc.ref.update({ scheduled_drop_at: now });

  return NextResponse.json({ question_id: doc.id, will_fire_within_seconds: 60 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd api && pnpm vitest run src/app/api/admin/trigger-drop/route.test.ts
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add api/src/app/api/admin/trigger-drop/route.ts api/src/app/api/admin/trigger-drop/route.test.ts
git commit -m "feat(api): admin can soft-trigger next drop via timestamp bump"
```

---

## Task 10: iOS — `types/api.ts` + `lib/api.ts` archive clients

**Files:**
- Modify: `ios/src/types/api.ts`
- Modify: `ios/src/lib/api.ts`
- Modify: `ios/src/lib/api.test.ts`

Add types: `ArchiveTile`, `ArchivePage`, `ArchiveDetailCluster`, `ArchiveDetail`. Add clients: `fetchArchive(cursor?: string)` and `fetchArchiveDetail(questionId: string)`.

- [ ] **Step 1: Add types to `ios/src/types/api.ts`**

Append at the end of `ios/src/types/api.ts` (preserve everything above):

```typescript
export interface ArchiveTile {
  question_id: string;
  question_text: string;
  verdict_text: string;
  top_clusters: string[];
  created_at: string;
}

export interface ArchivePage {
  tiles: ArchiveTile[];
  next_cursor: string | null;
}

export interface ArchiveDetailCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;
}

export interface ArchiveDetail {
  id: string;
  text: string;
  created_at: string;
  top_clusters: ArchiveDetailCluster[];
}
```

(`ArchiveTile` already exists as an inline interface in `ArchiveScreen.tsx` from Phase 4 — Task 12 below replaces the screen wholesale and removes that local definition; Task 12 also imports from this central types module.)

- [ ] **Step 2: Write failing tests for the new clients**

Append to `ios/src/lib/api.test.ts` (preserve existing tests above):

```typescript
import { fetchArchive, fetchArchiveDetail } from "./api";

describe("fetchArchive", () => {
  beforeEach(() => {
    (globalThis.fetch as unknown) = jest.fn();
  });

  it("calls /api/archive without cursor by default", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tiles: [], next_cursor: null }),
    });
    const result = await fetchArchive();
    expect(result).toEqual({ tiles: [], next_cursor: null });
    const call = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(call).toMatch(/\/api\/archive$/);
  });

  it("includes cursor query when provided", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tiles: [], next_cursor: null }),
    });
    await fetchArchive("2026-05-08T00:00:00.000Z");
    const call = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(call).toContain("cursor=2026-05-08T00%3A00%3A00.000Z");
  });

  it("throws on non-ok response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchArchive()).rejects.toThrow();
  });
});

describe("fetchArchiveDetail", () => {
  beforeEach(() => {
    (globalThis.fetch as unknown) = jest.fn();
  });

  it("calls /api/archive/<id>", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "q1", text: "?", created_at: "x", top_clusters: [] }),
    });
    const result = await fetchArchiveDetail("q1");
    expect(result.id).toBe("q1");
    const call = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(call).toMatch(/\/api\/archive\/q1$/);
  });

  it("throws on 404", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchArchiveDetail("missing")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```
cd ios && npx jest src/lib/api.test.ts
```
Expected: FAIL — `fetchArchive` and `fetchArchiveDetail` are not exported yet.

- [ ] **Step 4: Add the clients to `ios/src/lib/api.ts`**

Append to the existing `ios/src/lib/api.ts` (preserve the existing functions like `fetchToday`, `submitAnswer`, `trackShare`, etc.):

```typescript
import type { ArchivePage, ArchiveDetail } from "@/src/types/api";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export async function fetchArchive(cursor?: string): Promise<ArchivePage> {
  const url = cursor
    ? `${BASE_URL}/api/archive?cursor=${encodeURIComponent(cursor)}`
    : `${BASE_URL}/api/archive`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchArchive failed: ${res.status}`);
  return (await res.json()) as ArchivePage;
}

export async function fetchArchiveDetail(questionId: string): Promise<ArchiveDetail> {
  const res = await fetch(`${BASE_URL}/api/archive/${encodeURIComponent(questionId)}`);
  if (!res.ok) throw new Error(`fetchArchiveDetail failed: ${res.status}`);
  return (await res.json()) as ArchiveDetail;
}
```

> **Note:** If `BASE_URL` is already declared elsewhere in the file, reuse it. The same applies for the import path — if Phase 4 already imports `@/src/types/api`, just merge into the existing import line.

- [ ] **Step 5: Run tests to verify they pass**

Run:
```
cd ios && npx jest src/lib/api.test.ts
```
Expected: PASS — all `api.test.ts` tests including the new 5.

- [ ] **Step 6: Commit**

```bash
git add ios/src/types/api.ts ios/src/lib/api.ts ios/src/lib/api.test.ts
git commit -m "feat(ios): add archive types + fetchArchive + fetchArchiveDetail clients"
```

---

## Task 11: iOS — `components/ArchiveTileThumbnail.tsx`

**Files:**
- Create: `ios/src/components/ArchiveTileThumbnail.tsx`
- Test: `ios/src/components/ArchiveTileThumbnail.test.tsx`

Pure component that renders 3–5 mini bubbles given an array of canonical_text strings. The biggest bubble (index 0 = top cluster) is large; subsequent bubbles shrink. Reuses the visual style from `ClusterBubble.tsx` but in a constrained 80pt row layout. Used inside `ArchiveScreen` tiles.

- [ ] **Step 1: Write the failing tests**

Create `ios/src/components/ArchiveTileThumbnail.test.tsx`:

```typescript
import { render } from "@testing-library/react-native";
import { ArchiveTileThumbnail } from "./ArchiveTileThumbnail";

describe("ArchiveTileThumbnail", () => {
  it("renders nothing when texts is empty", () => {
    const { queryAllByTestId } = render(<ArchiveTileThumbnail texts={[]} />);
    expect(queryAllByTestId("archive-thumb-bubble")).toHaveLength(0);
  });

  it("renders one bubble per text up to 5 max", () => {
    const { getAllByTestId } = render(
      <ArchiveTileThumbnail texts={["a", "b", "c", "d", "e", "f", "g"]} />,
    );
    expect(getAllByTestId("archive-thumb-bubble")).toHaveLength(5);
  });

  it("renders all texts when count <= 5", () => {
    const { getAllByText } = render(
      <ArchiveTileThumbnail texts={["yes", "no", "maybe"]} />,
    );
    expect(getAllByText("yes")).toHaveLength(1);
    expect(getAllByText("no")).toHaveLength(1);
    expect(getAllByText("maybe")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd ios && npx jest src/components/ArchiveTileThumbnail.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `ios/src/components/ArchiveTileThumbnail.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Props {
  texts: string[];
}

const MAX_BUBBLES = 5;

export function ArchiveTileThumbnail({ texts }: Props) {
  const visible = texts.slice(0, MAX_BUBBLES);
  if (visible.length === 0) return null;
  return (
    <View style={styles.row}>
      {visible.map((t, i) => {
        const sizeScale = 1 - i * 0.15; // 1.0, 0.85, 0.70, 0.55, 0.40
        const fontSize = Math.max(10, Math.round(16 * sizeScale));
        return (
          <View key={`${i}-${t}`} testID="archive-thumb-bubble" style={[styles.bubble, { paddingHorizontal: 8 + i }]}>
            <Text style={[styles.text, { fontSize }]} numberOfLines={1}>
              {t}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  bubble: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 4,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd ios && npx jest src/components/ArchiveTileThumbnail.test.tsx
```
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add ios/src/components/ArchiveTileThumbnail.tsx ios/src/components/ArchiveTileThumbnail.test.tsx
git commit -m "feat(ios): add ArchiveTileThumbnail (3–5 mini bubble preview)"
```

---

## Task 12: iOS — REWRITE `screens/ArchiveScreen.tsx`

**Files:**
- Modify: `ios/src/screens/ArchiveScreen.tsx`
- Modify: `ios/src/screens/ArchiveScreen.test.tsx`

Rewrites the Phase 4 placeholder (which only had ad-injection scaffolding) to:
1. Accept `tiles` + `nextCursor` + `onLoadMore` + `onTilePress` + `onTileLongPress` props (parent owns data fetching — pure, easy to test).
2. Render each tile with `ArchiveTileThumbnail` (top 5 cluster strings) + verdict text.
3. Preserve Phase 4's `BannerAdSlot slot="archive_banner"` injection every 8 tiles.
4. Hook up `onEndReached` to call `onLoadMore` once per page.
5. Empty state preserved.

Wiring to fetch real data + navigate happens in Task 14 (the route file `app/(tabs)/archive.tsx`).

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `ios/src/screens/ArchiveScreen.test.tsx`:

```tsx
import { fireEvent, render } from "@testing-library/react-native";
import { ArchiveScreen } from "./ArchiveScreen";
import type { ArchiveTile } from "@/src/types/api";

function tile(i: number, top = ["a", "b", "c"]): ArchiveTile {
  return {
    question_id: `q-${i}`,
    question_text: `question ${i}?`,
    verdict_text: top[0] ?? "",
    top_clusters: top,
    created_at: new Date(2026, 4, 9 - i).toISOString(),
  };
}

describe("ArchiveScreen", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
  });

  it("shows empty-state copy when no tiles", () => {
    const { getByText } = render(
      <ArchiveScreen tiles={[]} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={() => {}} />,
    );
    expect(getByText(/coming soon/i)).toBeTruthy();
  });

  it("renders one tile per archive entry", () => {
    const tiles = [tile(0), tile(1), tile(2)];
    const { getByText } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={() => {}} />,
    );
    expect(getByText("question 0?")).toBeTruthy();
    expect(getByText("question 1?")).toBeTruthy();
    expect(getByText("question 2?")).toBeTruthy();
  });

  it("injects an ad slot after every 8 tiles", () => {
    const tiles = Array.from({ length: 17 }, (_, i) => tile(i));
    const { queryAllByTestId } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={() => {}} />,
    );
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(2);
  });

  it("calls onTilePress with question_id when a tile is tapped", () => {
    const onTilePress = jest.fn();
    const tiles = [tile(0), tile(1)];
    const { getByText } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={onTilePress} onTileLongPress={() => {}} />,
    );
    fireEvent.press(getByText("question 1?"));
    expect(onTilePress).toHaveBeenCalledWith("q-1");
  });

  it("calls onTileLongPress with the tile when long-pressed", () => {
    const onTileLongPress = jest.fn();
    const tiles = [tile(0)];
    const { getByText } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={onTileLongPress} />,
    );
    fireEvent(getByText("question 0?"), "longPress");
    expect(onTileLongPress).toHaveBeenCalledWith(tiles[0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd ios && npx jest src/screens/ArchiveScreen.test.tsx
```
Expected: FAIL — props mismatch / new behavior not implemented.

- [ ] **Step 3: Rewrite the screen**

Replace the entire contents of `ios/src/screens/ArchiveScreen.tsx`:

```tsx
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
import { ArchiveTileThumbnail } from "@/src/components/ArchiveTileThumbnail";
import type { ArchiveTile } from "@/src/types/api";

interface Props {
  tiles: ArchiveTile[];
  nextCursor: string | null;
  onLoadMore: () => void;
  onTilePress: (questionId: string) => void;
  onTileLongPress: (tile: ArchiveTile) => void;
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

export function ArchiveScreen({ tiles, nextCursor, onLoadMore, onTilePress, onTileLongPress }: Props) {
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
        const t = item.tile;
        return (
          <Pressable
            onPress={() => onTilePress(t.question_id)}
            onLongPress={() => onTileLongPress(t)}
            style={styles.tile}
          >
            <Text style={styles.tileQuestion} numberOfLines={2}>
              {t.question_text}
            </Text>
            <Text style={styles.tileVerdict} numberOfLines={1}>
              👑 {t.verdict_text}
            </Text>
            <View style={styles.tileThumbWrap}>
              <ArchiveTileThumbnail texts={t.top_clusters} />
            </View>
          </Pressable>
        );
      }}
      onEndReached={() => {
        if (nextCursor) onLoadMore();
      }}
      onEndReachedThreshold={0.5}
      initialNumToRender={30}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 32 },
  muted: { color: "#888", fontSize: 14, textAlign: "center" },
  tile: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
    gap: 8,
  },
  tileQuestion: { color: "#fff", fontSize: 16, fontWeight: "700" },
  tileVerdict: { color: "#facc15", fontSize: 14, fontWeight: "600" },
  tileThumbWrap: { marginTop: 4 },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd ios && npx jest src/screens/ArchiveScreen.test.tsx
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add ios/src/screens/ArchiveScreen.tsx ios/src/screens/ArchiveScreen.test.tsx
git commit -m "feat(ios): rewrite ArchiveScreen with paginated tile + tap + long-press handlers"
```

---

## Task 13: iOS — `screens/ArchiveDetailScreen.tsx` + Expo Router dynamic route

**Files:**
- Create: `ios/src/screens/ArchiveDetailScreen.tsx`
- Create: `ios/src/screens/ArchiveDetailScreen.test.tsx`
- Create: `ios/app/(tabs)/archive/[id].tsx`

Detail view shows the full top-N (default 50) cluster list for one revealed question. Renders a heading (question text + date), a list of clusters with rank + canonical_text + percentage. Includes the `ShareButton` from Phase 4 (delegating to `ShareCardVerdict`).

- [ ] **Step 1: Write the failing tests**

Create `ios/src/screens/ArchiveDetailScreen.test.tsx`:

```tsx
import { render, waitFor } from "@testing-library/react-native";
import { ArchiveDetailScreen } from "./ArchiveDetailScreen";

jest.mock("@/src/lib/api", () => ({
  fetchArchiveDetail: jest.fn(),
}));

const { fetchArchiveDetail } = require("@/src/lib/api");

describe("ArchiveDetailScreen", () => {
  beforeEach(() => {
    fetchArchiveDetail.mockReset();
  });

  it("renders loading state initially", () => {
    fetchArchiveDetail.mockReturnValue(new Promise(() => {}));
    const { getByText } = render(<ArchiveDetailScreen questionId="q1" />);
    expect(getByText(/loading/i)).toBeTruthy();
  });

  it("renders question text + clusters after fetch", async () => {
    fetchArchiveDetail.mockResolvedValueOnce({
      id: "q1",
      text: "what's the most overrated tourist trap?",
      created_at: "2026-05-09T00:00:00.000Z",
      top_clusters: [
        { id: "c1", canonical_text: "Pisa Tower", submission_count: 412, final_rank: 1, final_pct_of_total: 0.31 },
        { id: "c2", canonical_text: "Eiffel Tower", submission_count: 80, final_rank: 2, final_pct_of_total: 0.06 },
      ],
    });

    const { getByText } = render(<ArchiveDetailScreen questionId="q1" />);
    await waitFor(() => {
      expect(getByText(/most overrated tourist trap/)).toBeTruthy();
      expect(getByText("Pisa Tower")).toBeTruthy();
      expect(getByText("Eiffel Tower")).toBeTruthy();
    });
  });

  it("renders error state on fetch failure", async () => {
    fetchArchiveDetail.mockRejectedValueOnce(new Error("boom"));
    const { getByText } = render(<ArchiveDetailScreen questionId="q1" />);
    await waitFor(() => {
      expect(getByText(/couldn't load/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
cd ios && npx jest src/screens/ArchiveDetailScreen.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `ios/src/screens/ArchiveDetailScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { fetchArchiveDetail } from "@/src/lib/api";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardVerdict } from "@/src/components/ShareCardVerdict";
import type { ArchiveDetail } from "@/src/types/api";

interface Props {
  questionId: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; detail: ArchiveDetail }
  | { kind: "error" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function ArchiveDetailScreen({ questionId }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchArchiveDetail(questionId)
      .then((detail) => {
        if (!cancelled) setState({ kind: "ready", detail });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  if (state.kind === "loading") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>loading…</Text>
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>couldn't load this archive entry.</Text>
      </View>
    );
  }

  const { detail } = state;
  const verdict = detail.top_clusters[0]?.canonical_text ?? "";
  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>{formatDate(detail.created_at)}</Text>
          <Text style={styles.questionText}>{detail.text}</Text>
          <Text style={styles.verdictText}>👑 {verdict}</Text>
        </View>
        <ShareButton
          viewRef={shareCardRef}
          banner_type="verdict"
          question_id={detail.id}
          share_target="system"
          label="SHARE"
        />
      </View>
      <FlatList
        data={detail.top_clusters}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>#{item.final_rank}</Text>
            <Text style={styles.canonical} numberOfLines={2}>{item.canonical_text}</Text>
            <Text style={styles.pct}>{(item.final_pct_of_total * 100).toFixed(1)}%</Text>
          </View>
        )}
      />
      <View ref={shareCardRef} collapsable={false} style={styles.shareCardOffscreen} pointerEvents="none">
        <ShareCardVerdict
          verdictText={verdict}
          topClusters={detail.top_clusters.map((c) => ({ canonical_text: c.canonical_text, final_rank: c.final_rank }))}
          userRank={null}
          percentile={null}
          date={formatDate(detail.created_at)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  muted: { color: "#888", fontSize: 14 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
  dateLabel: { color: "#888", fontSize: 12 },
  questionText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 4 },
  verdictText: { color: "#facc15", fontSize: 16, fontWeight: "600", marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
    gap: 12,
  },
  rank: { color: "#facc15", fontSize: 14, fontWeight: "700", width: 40 },
  canonical: { color: "#fff", fontSize: 14, flex: 1 },
  pct: { color: "#888", fontSize: 12 },
  shareCardOffscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
```

> **Note:** `ShareCardVerdict` (from Phase 4) takes `{ verdictText, topClusters, userRank, percentile, date }` and is NOT a forwardRef component, so the ref must go on a wrapping `<View>`. `ShareButton` (from Phase 4) takes `{ viewRef, banner_type, question_id, share_target, label }`. Both confirmed against the live source — these names match the Phase 4 implementation exactly.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
cd ios && npx jest src/screens/ArchiveDetailScreen.test.tsx
```
Expected: PASS, 3 tests.

If `ShareCardVerdict`'s ref forwarding or prop names don't match exactly, the test will tell you what's missing — fix the screen call site to match Phase 4's existing component (do NOT change `ShareCardVerdict` itself).

- [ ] **Step 5: Create the Expo Router dynamic route**

Create `ios/app/(tabs)/archive/[id].tsx`:

```tsx
import { useLocalSearchParams } from "expo-router";
import { ArchiveDetailScreen } from "@/src/screens/ArchiveDetailScreen";

export default function ArchiveDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArchiveDetailScreen questionId={id ?? ""} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add ios/src/screens/ArchiveDetailScreen.tsx ios/src/screens/ArchiveDetailScreen.test.tsx "ios/app/(tabs)/archive/[id].tsx"
git commit -m "feat(ios): add ArchiveDetailScreen + dynamic route at archive/[id]"
```

---

## Task 14: iOS — wire `app/(tabs)/archive.tsx` to fetch real data

**Files:**
- Modify: `ios/app/(tabs)/archive.tsx`

The route owns data fetching state (initial page on mount, append on `onLoadMore`, navigate on tap, share on long-press). Stays small — all rendering lives in `ArchiveScreen`.

- [ ] **Step 1: Replace `ios/app/(tabs)/archive.tsx`**

Overwrite with:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { ArchiveScreen } from "@/src/screens/ArchiveScreen";
import { ShareCardVerdict } from "@/src/components/ShareCardVerdict";
import { fetchArchive } from "@/src/lib/api";
import { shareCardImage } from "@/src/lib/shareCard";
import type { ArchiveTile } from "@/src/types/api";

export default function ArchiveTab() {
  const [tiles, setTiles] = useState<ArchiveTile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [longPressedTile, setLongPressedTile] = useState<ArchiveTile | null>(null);
  const shareRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchive()
      .then((page) => {
        if (cancelled) return;
        setTiles(page.tiles);
        setNextCursor(page.next_cursor);
      })
      .catch(() => {
        if (!cancelled) Alert.alert("couldn't load archive");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const page = await fetchArchive(nextCursor);
      setTiles((prev) => [...prev, ...page.tiles]);
      setNextCursor(page.next_cursor);
    } catch {
      // best-effort; user can scroll back up and try again
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading]);

  const onTilePress = useCallback((id: string) => {
    router.push(`/(tabs)/archive/${id}`);
  }, []);

  const onTileLongPress = useCallback(async (tile: ArchiveTile) => {
    setLongPressedTile(tile);
    // Defer one tick so React renders the offscreen ShareCardVerdict before captureRef.
    setTimeout(() => {
      if (!shareRef.current) return;
      shareCardImage({
        viewRef: shareRef,
        banner_type: "verdict",
        question_id: tile.question_id,
        share_target: "system",
      }).catch(() => {
        // best-effort; user can try again
      });
    }, 50);
  }, []);

  return (
    <>
      <ArchiveScreen
        tiles={tiles}
        nextCursor={nextCursor}
        onLoadMore={onLoadMore}
        onTilePress={onTilePress}
        onTileLongPress={onTileLongPress}
      />
      {longPressedTile && (
        <View
          ref={shareRef}
          collapsable={false}
          pointerEvents="none"
          style={{ position: "absolute", left: -10000, top: -10000, opacity: 0 }}
        >
          <ShareCardVerdict
            verdictText={longPressedTile.verdict_text}
            topClusters={longPressedTile.top_clusters.map((text, i) => ({ canonical_text: text, final_rank: i + 1 }))}
            userRank={null}
            percentile={null}
            date={new Date(longPressedTile.created_at).toLocaleDateString()}
          />
        </View>
      )}
    </>
  );
}
```

> **Note on `shareCardImage`:** This is the Phase 4 helper at `ios/src/lib/shareCard.ts`. Confirm its signature matches the call site. If Phase 4 named it differently or the props differ, adjust the call. Don't modify `shareCard.ts` itself unless the existing tests are broken — they shouldn't be.

> **No new tests for this route file** — same precedent as Phase 4's `app/(tabs)/index.tsx` interstitial wiring (Phase 4 deviation #10): integration test would require RN screen-tree mocking that's not worth the cost. The unit-test coverage on `ArchiveScreen`, `fetchArchive`, and `ShareCardVerdict` is sufficient.

- [ ] **Step 2: Run the existing iOS test suite to confirm nothing broke**

Run:
```
cd ios && npx jest --runInBand
```
Expected: PASS — all existing 75+ tests + the new 3 (Task 13) + 5 (Task 12) + 5 (Task 10) + 3 (Task 11) = ~91+ tests, all green.

(`npx jest --runInBand` rather than `pnpm test --runInBand` per the Phase 4 lesson — pnpm rejects the flag.)

- [ ] **Step 3: Commit**

```bash
git add "ios/app/(tabs)/archive.tsx"
git commit -m "feat(ios): wire archive tab to fetchArchive + navigation + long-press share"
```

---

## Task 15: api/ — `firebase` JS dep + `lib/firebaseClient.ts` + `app/admin/layout.tsx` Google sign-in gate

**Files:**
- Modify: `api/package.json` (add `firebase` ^10 dep)
- Create: `api/src/lib/firebaseClient.ts`
- Create: `api/src/app/admin/layout.tsx`

This adds Firebase JS client SDK (separate from `firebase-admin` Admin SDK already in the project) and a layout that shows a Google Sign-In button when not authenticated, and gates child pages on the signed-in uid being in `NEXT_PUBLIC_ADMIN_UIDS`.

> **Pre-requisite for the engineer to verify locally:** Levin needs to (a) enable Google sign-in provider in Firebase Console for project `relatably-prod`, and (b) add his Google-account uid to both `NEXT_PUBLIC_ADMIN_UIDS` (web client gate) and `ADMIN_UIDS` (server-side enforcement) in `api/.env.local`. The Firebase web config (`apiKey`, `authDomain`, `projectId`, `appId`) goes into `NEXT_PUBLIC_FIREBASE_*` env vars — the values come from `firebase apps:sdkconfig WEB --project relatably-prod`.

- [ ] **Step 1: Add the `firebase` dep**

Run:
```
cd api && pnpm add firebase@^10
```
Expected: package added; lockfile updated.

- [ ] **Step 2: Create `api/src/lib/firebaseClient.ts`**

```typescript
"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

function getConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

let app: FirebaseApp | null = null;

function getClientApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(getConfig());
  return app;
}

export function getClientAuth() {
  return getAuth(getClientApp());
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(getClientAuth(), provider);
  return result.user;
}

export function signOutAdmin(): Promise<void> {
  return signOut(getClientAuth());
}

export function watchAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(getClientAuth(), callback);
}

export function isAdminUid(uid: string): boolean {
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "";
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return set.has(uid);
}

export async function getAdminBearerToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return await user.getIdToken();
}
```

- [ ] **Step 3: Create `api/src/app/admin/layout.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutAdmin, watchAuthState, isAdminUid } from "@/lib/firebaseClient";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = watchAuthState((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) {
    return <main style={shellStyle}><p>loading…</p></main>;
  }

  if (!user) {
    return (
      <main style={shellStyle}>
        <h1>Relatably Admin</h1>
        <p>Sign in with your admin Google account.</p>
        <button
          type="button"
          onClick={() => {
            signInWithGoogle().catch((err) => alert("sign-in failed: " + (err?.message ?? "unknown")));
          }}
          style={btnStyle}
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  if (!isAdminUid(user.uid)) {
    return (
      <main style={shellStyle}>
        <h1>Not authorized</h1>
        <p>
          Signed in as <strong>{user.email}</strong> (uid <code>{user.uid}</code>) but this account is not in the admin
          allowlist. Add this uid to <code>NEXT_PUBLIC_ADMIN_UIDS</code> + <code>ADMIN_UIDS</code> and re-deploy.
        </p>
        <button type="button" onClick={() => signOutAdmin()} style={btnStyle}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0 }}>Relatably Admin</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 12 }}>{user.email}</span>
          <button type="button" onClick={() => signOutAdmin()} style={btnStyle}>Sign out</button>
        </div>
      </header>
      {children}
    </main>
  );
}

const shellStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 960,
  margin: "0 auto",
  padding: 24,
  color: "#fff",
  backgroundColor: "#000",
  minHeight: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #222",
  paddingBottom: 12,
  marginBottom: 24,
};

const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "8px 14px",
  cursor: "pointer",
};
```

- [ ] **Step 4: Verify the api/ project still builds**

Run:
```
cd api && pnpm build
```
Expected: build succeeds. (If `pnpm build` is wired to a different command in `package.json`, run whatever the existing build command is.)

- [ ] **Step 5: Commit**

```bash
git add api/package.json api/pnpm-lock.yaml api/src/lib/firebaseClient.ts api/src/app/admin/layout.tsx
git commit -m "feat(admin): add Firebase JS client + Google sign-in gate at /admin"
```

---

## Task 16: api/ — `app/admin/page.tsx` landing + `app/admin/candidates/page.tsx` console

**Files:**
- Create: `api/src/app/admin/page.tsx`
- Create: `api/src/app/admin/candidates/page.tsx`

Landing page = links to `/admin/candidates`, `/admin/schedule`, `/admin/trigger`. Candidates page = list + create form + approve/reject buttons.

- [ ] **Step 1: Create `api/src/app/admin/page.tsx`**

```tsx
import Link from "next/link";

export default function AdminLanding() {
  return (
    <section>
      <p>Pick a console:</p>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
        <li><Link href="/admin/candidates" style={linkStyle}>Question candidates → curate / approve / reject</Link></li>
        <li><Link href="/admin/schedule" style={linkStyle}>Scheduled questions → set drop times</Link></li>
        <li><Link href="/admin/trigger" style={linkStyle}>Manually trigger next drop (test / soft-launch)</Link></li>
      </ul>
    </section>
  );
}

const linkStyle: React.CSSProperties = {
  color: "#facc15",
  fontSize: 16,
  textDecoration: "none",
  display: "block",
  padding: "12px 16px",
  border: "1px solid #333",
  borderRadius: 6,
};
```

- [ ] **Step 2: Create `api/src/app/admin/candidates/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAdminBearerToken } from "@/lib/firebaseClient";

interface Candidate {
  id: string;
  candidate_text: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAdminBearerToken();
  if (!token) throw new Error("not signed in");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch<{ candidates: Candidate[] }>("/api/admin/candidates");
      setCandidates(body.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function create() {
    if (!text.trim()) return;
    try {
      await adminFetch("/api/admin/candidates", {
        method: "POST",
        body: JSON.stringify({ candidate_text: text.trim() }),
      });
      setText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function act(id: string, action: "approve" | "reject") {
    try {
      await adminFetch(`/api/admin/candidates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2>Question candidates</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="new candidate question text…"
          style={inputStyle}
        />
        <button type="button" onClick={create} style={btnStyle}>Create</button>
      </div>
      {loading ? <p>loading…</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thStyle}>text</th>
            <th style={thStyle}>status</th>
            <th style={thStyle}>created</th>
            <th style={thStyle}>actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={tdStyle}>{c.candidate_text}</td>
              <td style={tdStyle}>{c.status}</td>
              <td style={tdStyle}>{new Date(c.created_at).toLocaleString()}</td>
              <td style={tdStyle}>
                {c.status === "pending" ? (
                  <>
                    <button type="button" onClick={() => act(c.id, "approve")} style={btnStyle}>Approve</button>{" "}
                    <button type="button" onClick={() => act(c.id, "reject")} style={btnStyle}>Reject</button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {candidates.length === 0 && !loading ? (
            <tr><td colSpan={4} style={{ padding: 16, color: "#888" }}>no candidates yet — create one above.</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "#0a0a0a",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "8px 12px",
};
const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "8px 14px",
  cursor: "pointer",
};
const thStyle: React.CSSProperties = { textAlign: "left", padding: 8, color: "#888", fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: 8, fontSize: 14, verticalAlign: "top" };
```

- [ ] **Step 3: Verify the build still passes**

Run:
```
cd api && pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add api/src/app/admin/page.tsx api/src/app/admin/candidates/page.tsx
git commit -m "feat(admin): add landing + candidates console (list/create/approve/reject)"
```

---

## Task 17: api/ — `app/admin/schedule/page.tsx` + `app/admin/trigger/page.tsx`

**Files:**
- Create: `api/src/app/admin/schedule/page.tsx`
- Create: `api/src/app/admin/trigger/page.tsx`

Schedule page lists scheduled+live questions and lets the admin set `scheduled_drop_at` for any `status='scheduled'` question via a datetime input. Trigger page is a single button that POSTs to `/api/admin/trigger-drop`.

- [ ] **Step 1: Create `api/src/app/admin/schedule/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { getAdminBearerToken } from "@/lib/firebaseClient";

interface Question {
  id: string;
  text: string;
  status: "scheduled" | "live";
  scheduled_drop_at: string | null;
  created_at: string;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAdminBearerToken();
  if (!token) throw new Error("not signed in");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

function defaultDropTime(): string {
  // tomorrow at 12:00 UTC, formatted for <input type="datetime-local">
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function SchedulePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch<{ questions: Question[] }>("/api/admin/questions");
      setQuestions(body.questions);
      const init: Record<string, string> = {};
      for (const q of body.questions) {
        init[q.id] = q.scheduled_drop_at ? q.scheduled_drop_at.slice(0, 16) : defaultDropTime();
      }
      setEditing(init);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function save(id: string) {
    const localValue = editing[id];
    if (!localValue) return;
    try {
      const iso = new Date(localValue).toISOString();
      await adminFetch(`/api/admin/questions/${id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduled_drop_at: iso }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2>Scheduled + live questions</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {loading ? <p>loading…</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thStyle}>text</th>
            <th style={thStyle}>status</th>
            <th style={thStyle}>current drop_at</th>
            <th style={thStyle}>set new drop_at</th>
            <th style={thStyle}>action</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={tdStyle}>{q.text}</td>
              <td style={tdStyle}>{q.status}</td>
              <td style={tdStyle}>{q.scheduled_drop_at ? new Date(q.scheduled_drop_at).toLocaleString() : "—"}</td>
              <td style={tdStyle}>
                <input
                  type="datetime-local"
                  value={editing[q.id] ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, [q.id]: e.target.value }))}
                  disabled={q.status !== "scheduled"}
                  style={inputStyle}
                />
              </td>
              <td style={tdStyle}>
                <button type="button" onClick={() => save(q.id)} disabled={q.status !== "scheduled"} style={btnStyle}>
                  Save
                </button>
              </td>
            </tr>
          ))}
          {questions.length === 0 && !loading ? (
            <tr><td colSpan={5} style={{ padding: 16, color: "#888" }}>no scheduled or live questions.</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "6px 8px",
};
const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "6px 12px",
  cursor: "pointer",
};
const thStyle: React.CSSProperties = { textAlign: "left", padding: 8, color: "#888", fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: 8, fontSize: 14, verticalAlign: "top" };
```

- [ ] **Step 2: Create `api/src/app/admin/trigger/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { getAdminBearerToken } from "@/lib/firebaseClient";

export default function TriggerPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await getAdminBearerToken();
      if (!token) throw new Error("not signed in");
      const res = await fetch("/api/admin/trigger-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setResult(`triggered question ${body.question_id} — minute cron picks it up within ≤${body.will_fire_within_seconds}s`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Manually trigger next drop</h2>
      <p style={{ color: "#888", maxWidth: 560 }}>
        Sets the oldest scheduled question's <code>scheduled_drop_at</code> to now.
        The existing minute cron picks it up within ≤60 seconds.
        Use only for soft-launch / debugging — production drops fire on the natural random schedule.
      </p>
      <button type="button" onClick={trigger} disabled={busy} style={btnStyle}>
        {busy ? "triggering…" : "Trigger next drop now"}
      </button>
      {result && <p style={{ color: "#86efac", marginTop: 12 }}>{result}</p>}
      {error && <p style={{ color: "#f87171", marginTop: 12 }}>{error}</p>}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 14,
};
```

- [ ] **Step 3: Verify the build still passes**

Run:
```
cd api && pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add api/src/app/admin/schedule/page.tsx api/src/app/admin/trigger/page.tsx
git commit -m "feat(admin): add schedule + trigger consoles"
```

---

## Task 18: Final integration — `.env.example` + README addendum + Phase 5 deviations doc + branch tag

**Files:**
- Modify: `api/.env.example` (or create if missing)
- Modify: `api/README.md` (or `relatably/README.md` if api lacks one)
- Modify: `docs/superpowers/plans/2026-05-09-relatably-phase5-archive-admin.md` (add deviations section in-place at the bottom)
- Modify: `~/.claude/projects/C--Users-levin/memory/project_relatably.md` (add Phase 5 entry — done outside the repo, not in this commit)

- [ ] **Step 1: Update `api/.env.example`**

If the file exists, append; if not, create. Add (preserve existing entries):

```
# Phase 5 — admin console
ADMIN_UIDS=                                # comma-separated Firebase Auth uids allowed to call /api/admin/*
NEXT_PUBLIC_ADMIN_UIDS=                    # same list, exposed to web client to gate /admin UI
NEXT_PUBLIC_FIREBASE_API_KEY=              # from `firebase apps:sdkconfig WEB --project relatably-prod`
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 2: README addendum**

Append to `api/README.md` (or root README if none):

```markdown
## Admin console (Phase 5)

The admin console lives at `/admin` and is gated by Firebase Auth + Google sign-in.

### Local setup

1. In Firebase Console for `relatably-prod`, enable the Google sign-in provider under Authentication → Sign-in method.
2. Copy your web SDK config (Firebase Console → Project Settings → SDK setup → Web) into `api/.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
3. Sign into the running app at `http://localhost:3000/admin` once with Google. Note the uid printed by the gate when you're "Not authorized".
4. Add that uid to BOTH `ADMIN_UIDS` (server-side enforcement) and `NEXT_PUBLIC_ADMIN_UIDS` (web UI gate) in `.env.local`.
5. Restart `pnpm dev`. You're now an admin.

### Production (Vercel)

Set the same five env vars in the Vercel project (`relatably-api` or whatever the slug is). Add `localhost`, the preview-deploy domain, and the production domain to the Firebase Auth → Settings → Authorized domains list.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/archive`                                  | Public — paginated revealed-question tiles |
| GET    | `/api/archive/[id]`                             | Public — full archive detail (top-N clusters) |
| GET    | `/api/admin/candidates`                         | Admin — list question candidates |
| POST   | `/api/admin/candidates`                         | Admin — create candidate (status=pending) |
| PATCH  | `/api/admin/candidates/[id]`                    | Admin — approve (atomically schedules question) or reject |
| GET    | `/api/admin/questions`                          | Admin — list scheduled + live questions |
| POST   | `/api/admin/questions/[id]/schedule`            | Admin — set scheduled_drop_at |
| POST   | `/api/admin/trigger-drop`                       | Admin — soft-trigger next drop (≤60s) |
```

- [ ] **Step 3: Document Phase 5 spec deviations + Phase 6 follow-ups in this plan**

Append to `docs/superpowers/plans/2026-05-09-relatably-phase5-archive-admin.md`:

```markdown

---

## Phase 5 deviations + Phase 6 follow-ups (filled in at end of execution)

**Deviations / scope decisions actually made during execution:**
1. _(executor: fill in any deviations here, mirroring Phase 4's "Documented Phase 4 spec deviations" section in the project memory)_

**Phase 6 follow-ups newly identified by Phase 5:**
1. Real Firebase Auth + Google sign-in validation on the deployed Vercel preview (works in dev; prod just needs Google OAuth client redirect URI added).
2. Server-rendered archive thumbnails (Cloud Function + Sharp/Skia generates a static PNG per revealed question, stored in Cloud Storage; iOS just renders the URL). Phase 5 ships text-string thumbnails — visually meh but $0.
3. Image metadata (PNG iTXt) referral embedding — still deferred from Phase 4 polish.
4. Admin console: bulk-create candidates from a CSV/Markdown paste. Phase 5 has one-at-a-time only.
5. Admin console: question-candidate AI-assisted generator (Cloud Function generates ~20 candidate questions per week from prompt templates → admin approves/rejects). v1.0 admin types each one manually.
6. Admin auth: roles-table Firestore migration when a 2nd admin joins (current ADMIN_UIDS env list is fine for v1.0 with 1 admin).
7. Long-press share on archive tile uses a 50ms `setTimeout` to let React render the offscreen `ShareCardVerdict` before `captureRef` fires. Replace with a proper `requestAnimationFrame` + ref-mounted callback when refining.
```

- [ ] **Step 4: Run all test suites one more time**

Run in parallel from 3 shells (or sequentially):

```
cd api && pnpm vitest run
cd firebase/functions && pnpm vitest run
cd ios && npx jest --runInBand
```

Expected: all green. Total ≥280 tests across the 3 codebases (Phase 4 ended at 239; this phase adds at least 40+ — the GET archive 6 + GET archive[id] 4 + admin candidates 8 + PATCH candidates 7 + GET admin questions 3 + POST schedule 7 + POST trigger 6 + admin requireAdmin 6 + iOS api archive 5 + iOS thumbnail 3 + iOS ArchiveScreen rewrite 5 + iOS ArchiveDetailScreen 3 = 63 new tests).

- [ ] **Step 5: Commit + tag + push**

```bash
git add api/.env.example api/README.md docs/superpowers/plans/2026-05-09-relatably-phase5-archive-admin.md
git commit -m "docs: Phase 5 .env.example, README, and deviations addendum"
git tag phase-5-complete
git push https://lawoflarge:<token>@github.com/lawoflarge/relatably.git phase-5-archive-admin --tags
```

(Replace `<token>` with the PAT from `~/.claude/projects/C--Users-levin/memory/github_token.md`.)

- [ ] **Step 6: Update memory file (outside the repo)**

Add a Phase 5 section to `~/.claude/projects/C--Users-levin/memory/project_relatably.md` mirroring the Phase 4 section style: branch + tag, what shipped, deviations, Phase 6 follow-ups.

---

## Self-Review Notes (for the planner / reviewer)

- **Spec coverage.** Spec § 4 "Archive tab" → Tasks 3, 4, 10, 11, 12, 13, 14. Spec § 8 "Phase 5: Archive + admin tools" → all of Phase 5. Spec § 6 `/question_candidates` schema → Task 5 (intentionally omits `user_id`/`votes_count` since user-submission is v1.1).
- **Type consistency.** `ArchiveTile`, `ArchivePage`, `ArchiveDetail`, `ArchiveDetailCluster` named consistently across `types/api.ts`, `lib/api.ts`, `screens/ArchiveScreen.tsx`, `screens/ArchiveDetailScreen.tsx`, and `app/(tabs)/archive.tsx`. `RequireAdminResult` consistently a discriminated union of `no_auth` / `not_admin` / `ok` across all admin endpoints.
- **No placeholders.** Every step has the full code or the exact command. No TODOs, no "implement later", no "similar to Task N".
- **DRY.** `gateResponse(kind)` repeats across admin endpoints (~5 lines each, 5 endpoints) — kept inline rather than extracted because the alternative (an exported helper from `lib/admin.ts`) couples HTTP-layer return types to the auth helper, which is a bigger smell than the duplication. Same precedent as Phase 3's `friendshipId` helper, which is also inline.
- **YAGNI.** No CLI fallback, no roles table, no bulk-import, no AI-assisted candidate generator, no server-rendered PNG thumbnails, no admin web UI unit tests. All those are explicitly Phase 6 / v1.1.
- **TDD.** All endpoints + all iOS lib + components are TDD (write failing test → implement → green). Admin web pages are NOT TDD'd — see scope decision #6.
- **Frequent commits.** 18 commits, one per task.
- **Exact paths.** Every file is named with absolute or repo-relative paths. Dynamic routes use the `[id]` literal which Next.js requires.
- **Next.js 16 contract.** Dynamic route handlers use `ctx: { params: Promise<{ id: string }> }` per Phase 3+4 confirmation; `await ctx.params` is the access pattern.
- **Single Vercel project.** Admin UI under `app/admin/*` ships in the same `api/` Vercel deployment. No 2nd project needed.
