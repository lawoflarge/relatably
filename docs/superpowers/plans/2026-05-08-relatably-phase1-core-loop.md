# Relatably v1.0 — Phase 1 Implementation Plan (Core Loop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working iOS app where any user can open the app, see today's question, type and submit a free-text answer, and watch their answer appear in a live-updating Mentimeter-style wordcloud alongside everyone else's submissions.

**Architecture:** Expo (React Native) iOS client → Next.js 16 serverless API on Vercel → Supabase Postgres + Realtime. Deterministic answer normalization on submit. Anonymous-by-default; Sign in with Apple is wired but not required. No leaderboard, no friend graph, no share banner, no ads, no scheduler in this phase — those land in Phases 2–4.

**Tech Stack:** Expo SDK 51+, React Native, TypeScript 5+, Next.js 16 App Router, Supabase (Postgres 15 + Realtime + Auth), Vitest (backend tests), React Native Testing Library + Jest (iOS tests), pnpm.

**Phase 1 acceptance criteria:** A developer running `pnpm dev` in `api/` and `pnpm ios` in `ios/` against a Supabase Cloud project should be able to:
1. Manually seed a `live` question via SQL
2. Open the iOS app in simulator
3. Type a free-text answer and submit
4. See their answer appear as a bubble in the wordcloud
5. Open a second simulator, submit a different answer
6. Watch both bubbles update in real time on both devices
7. All backend endpoints have green Vitest tests
8. The deterministic `normalize()` function has 100% line coverage in unit tests

---

## File Structure

```
relatably/
├── README.md                            (already exists)
├── .gitignore                           (already exists)
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-05-08-relatably-design.md   (already exists)
│       └── plans/
│           └── 2026-05-08-relatably-phase1-core-loop.md  (this file)
├── api/                                 (Next.js 16 backend, deploys to Vercel)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── src/
│   │   ├── app/
│   │   │   └── api/
│   │   │       ├── questions/
│   │   │       │   └── today/
│   │   │       │       └── route.ts        (GET today's live question)
│   │   │       └── submit/
│   │   │           └── route.ts            (POST submission)
│   │   └── lib/
│   │       ├── normalize.ts                (deterministic normalization)
│   │       ├── normalize.test.ts
│   │       ├── profanity.ts                (regex-based blocklist)
│   │       ├── profanity.test.ts
│   │       └── supabase.ts                 (server-side Supabase client)
│   └── .gitignore (delegated to root)
├── ios/                                 (Expo app)
│   ├── package.json
│   ├── tsconfig.json
│   ├── app.json
│   ├── babel.config.js
│   ├── App.tsx
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts                      (typed fetch wrappers for backend)
│   │   │   ├── supabase.ts                 (Realtime client)
│   │   │   └── deviceId.ts                 (anonymous device tracking)
│   │   ├── screens/
│   │   │   ├── QuestionScreen.tsx          (today's Q + text input + submit)
│   │   │   └── WordcloudScreen.tsx         (live cluster bubbles)
│   │   ├── components/
│   │   │   ├── QuestionText.tsx
│   │   │   ├── AnswerInput.tsx
│   │   │   ├── SubmitButton.tsx            (with 3-sec dwell guard)
│   │   │   ├── ClusterBubble.tsx
│   │   │   └── LiveCounter.tsx
│   │   └── types/
│   │       └── api.ts                      (shared response types)
│   └── __tests__/
│       └── components/
│           └── SubmitButton.test.tsx
└── supabase/
    └── migrations/
        ├── 20260508_001_init_schema.sql
        ├── 20260508_002_rls_policies.sql
        └── 20260508_003_realtime_publication.sql
```

**Why this layout:**
- `api/` and `ios/` are independent npm projects (no monorepo workspace tooling) — solo-founder simple, less to debug.
- Shared types are duplicated by design — there are only ~3 of them and each side is small.
- All SQL lives under `supabase/migrations/` and runs via `supabase db push`.
- Plans/specs live under `docs/superpowers/` per the brainstorming workflow.

---

## Task Map (Phase 1 = 18 tasks across ~4 weeks)

| Task | Subject | Depends on |
|---|---|---|
| 1 | Provision Supabase project + local CLI | — |
| 2 | Initialize `api/` Next.js project | 1 |
| 3 | Initialize `ios/` Expo project | 1 |
| 4 | Write schema migration `001_init_schema.sql` | 1 |
| 5 | Write RLS policies migration `002_rls_policies.sql` | 4 |
| 6 | Enable Realtime publication migration `003_realtime_publication.sql` | 4 |
| 7 | TDD: `normalize()` function | 2 |
| 8 | TDD: profanity filter | 2 |
| 9 | TDD: `/api/questions/today` endpoint | 2, 4, 7 |
| 10 | TDD: `/api/submit` endpoint | 2, 4, 7, 8 |
| 11 | Anonymous device tracking (`deviceId.ts`) | 3 |
| 12 | iOS API client (`api.ts`) | 3, 9, 10 |
| 13 | iOS Supabase Realtime client | 3, 6 |
| 14 | iOS `QuestionScreen` (UI only) | 3 |
| 15 | iOS `SubmitButton` with 3-sec dwell (TDD) | 3 |
| 16 | iOS `WordcloudScreen` static rendering | 3 |
| 17 | iOS Realtime subscription wires bubbles to live updates | 13, 16 |
| 18 | End-to-end smoke test + Phase 1 acceptance gate | all |

---

## Task 1: Provision Supabase project + local CLI

**Files:**
- Create: `supabase/config.toml`
- Create: `api/.env.example`
- Modify: `README.md` (add setup section)

- [ ] **Step 1: Install Supabase CLI**

Run:
```bash
# Windows (PowerShell)
scoop install supabase
# Or, via npm
npm i -g supabase
```

- [ ] **Step 2: Log in to Supabase CLI**

Run:
```bash
supabase login
```

Expected: opens browser to authorize. After authorizing, CLI prints `You are now logged in.`

- [ ] **Step 3: Create a new Supabase project via CLI**

Run:
```bash
cd /c/Users/levin/relatably
supabase projects create relatably-prod --org-id <your-org-id> --plan free --region eu-central-1
```

Expected: prints new project ref, e.g., `abcdefghijklmnopqrst`. Save this for env vars.

(Alternative: create via supabase.com dashboard if CLI region defaults bite you. Note the project ref + URL + anon key + service-role key.)

- [ ] **Step 4: Initialize Supabase locally in repo**

Run:
```bash
supabase init
```

Expected: creates `supabase/` directory with `config.toml`, `seed.sql`, etc. (We already have `supabase/migrations/` from this plan; init won't overwrite it.)

- [ ] **Step 5: Link the local project to the remote**

Run:
```bash
supabase link --project-ref <project-ref-from-step-3>
```

Expected: `Finished supabase link.`

- [ ] **Step 6: Create `api/.env.example`**

Write the file `api/.env.example` with this exact content:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Server settings
NODE_ENV=development
```

- [ ] **Step 7: Update README setup section**

Modify `README.md` — append a new section before the "Owner" section:

```markdown
## Local development setup

1. Install Supabase CLI: `npm i -g supabase`
2. Log in: `supabase login`
3. Link local repo to your project: `supabase link --project-ref <your-ref>`
4. Copy `api/.env.example` to `api/.env.local` and fill in values
5. Run migrations: `supabase db push`
6. Start API: `cd api && pnpm dev`
7. Start iOS app: `cd ios && pnpm ios`
```

- [ ] **Step 8: Commit**

```bash
cd /c/Users/levin/relatably
git add supabase/config.toml api/.env.example README.md
git commit -m "chore: scaffold supabase + env example"
```

---

## Task 2: Initialize `api/` Next.js project

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/next.config.ts`
- Create: `api/vitest.config.ts`
- Create: `api/src/lib/supabase.ts`

- [ ] **Step 1: Scaffold Next.js with TypeScript and pnpm**

Run:
```bash
cd /c/Users/levin/relatably
pnpm create next-app@latest api --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --turbopack
```

When prompted: skip Tailwind. Confirm App Router.

Expected: `api/` populated. App Router under `api/src/app/`.

- [ ] **Step 2: Install Supabase + Vitest deps**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm add @supabase/supabase-js zod
pnpm add -D vitest @vitest/coverage-v8 @types/node
```

- [ ] **Step 3: Replace `vitest.config.ts`**

Create `api/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 4: Add scripts to `api/package.json`**

Modify `api/package.json` — under `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Create `src/lib/supabase.ts`**

Create `api/src/lib/supabase.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm install
pnpm build
```

Expected: `✓ Compiled successfully`. Build may warn about no pages — that's fine.

- [ ] **Step 7: Verify Vitest runs (no tests yet)**

Run:
```bash
pnpm test
```

Expected: `No test files found, exiting with code 0` or similar — the runner exits cleanly.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/levin/relatably
git add api/
git commit -m "feat(api): scaffold Next.js 16 + Vitest + Supabase admin client"
```

---

## Task 3: Initialize `ios/` Expo project

**Files:**
- Create: `ios/package.json`
- Create: `ios/app.json`
- Create: `ios/App.tsx`
- Create: `ios/tsconfig.json`
- Create: `ios/.env.example`

- [ ] **Step 1: Scaffold Expo TypeScript template**

Run:
```bash
cd /c/Users/levin/relatably
pnpm create expo-app ios --template default
```

Choose the default TypeScript template. Expected: `ios/` populated.

- [ ] **Step 2: Move out the example route file**

The Expo default ships an example tab navigation. Replace `ios/app/index.tsx` and any other `app/` files with a minimal `App.tsx` entry. First, install the additional deps we'll need:

Run:
```bash
cd /c/Users/levin/relatably/ios
pnpm add @supabase/supabase-js react-native-reanimated react-native-gesture-handler expo-secure-store expo-application
pnpm add -D @testing-library/react-native @testing-library/jest-native jest jest-expo @types/jest
```

- [ ] **Step 3: Configure Reanimated babel plugin**

Modify `ios/babel.config.js` — replace contents with:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-reanimated/plugin"],
  };
};
```

- [ ] **Step 4: Add jest config**

Modify `ios/package.json` — add at top level:

```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/.*))"
  ]
},
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

(Merge with whatever `scripts` block was created — keep `start`, `ios`, `android`, `web`.)

- [ ] **Step 5: Create `ios/.env.example`**

Create `ios/.env.example`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

- [ ] **Step 6: Verify Expo runs**

Run:
```bash
cd /c/Users/levin/relatably/ios
cp .env.example .env.local
# Fill in values manually
pnpm start
```

Press `i` to launch iOS simulator. Expected: default Expo app loads with a "Welcome" screen.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/
git commit -m "feat(ios): scaffold Expo + Supabase client + Jest"
```

---

## Task 4: Schema migration `001_init_schema.sql`

**Files:**
- Create: `supabase/migrations/20260508_001_init_schema.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260508_001_init_schema.sql`:

```sql
-- Relatably v1.0 — Phase 1 schema
-- Tables: users, device_users, questions, submissions, answer_clusters

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Users (Supabase auth users gain a row here when they opt-in to public)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  is_public boolean not null default false,
  locale text,
  shadowbanned boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_users_handle on public.users(handle) where handle is not null;

-- Anonymous device tracking (pre-signup answerers)
create table public.device_users (
  id uuid primary key default uuid_generate_v4(),
  device_token text unique not null,
  linked_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_device_users_device_token on public.device_users(device_token);

-- Questions
create type question_status as enum ('scheduled', 'live', 'revealed');
create type question_source as enum ('curated', 'ai_assisted', 'user_submitted');

create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  status question_status not null default 'scheduled',
  source question_source not null default 'curated',
  scheduled_drop_at timestamptz,
  author_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_questions_status on public.questions(status);
create unique index uniq_questions_one_live on public.questions(status) where status = 'live';

-- Submissions (partitioned by month from day 1)
create table public.submissions (
  id uuid not null default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  device_user_id uuid references public.device_users(id) on delete set null,
  raw_text text not null,
  normalized_cluster_id uuid,
  submitted_at timestamptz not null default now(),
  ip_hash text not null,
  dwell_ms integer not null,
  moderation_status text not null default 'passed' check (moderation_status in ('passed', 'blocked')),
  primary key (id, submitted_at)
) partition by range (submitted_at);

-- May 2026 partition (manual; v1.1 will add a cron to auto-create future partitions)
create table public.submissions_2026_05 partition of public.submissions
  for values from ('2026-05-01') to ('2026-06-01');
create table public.submissions_2026_06 partition of public.submissions
  for values from ('2026-06-01') to ('2026-07-01');

create index idx_submissions_question_id on public.submissions(question_id);
create index idx_submissions_user_id on public.submissions(user_id) where user_id is not null;
create index idx_submissions_submitted_at on public.submissions(submitted_at);

-- Answer clusters (the wordcloud bubbles)
create table public.answer_clusters (
  id text primary key,                              -- = sha256(question_id || normalized_text)
  question_id uuid not null references public.questions(id) on delete cascade,
  canonical_text text not null,
  submission_count integer not null default 0,
  first_submission_at timestamptz,
  final_rank integer,
  final_pct_of_total real
);

create index idx_answer_clusters_question_id on public.answer_clusters(question_id);
create index idx_answer_clusters_count on public.answer_clusters(question_id, submission_count desc);
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
cd /c/Users/levin/relatably
supabase db push
```

Expected: `Applying migration 20260508_001_init_schema.sql... Finished.`

- [ ] **Step 3: Verify in Supabase Studio**

Open the Supabase dashboard → Table Editor. Expected: see `users`, `device_users`, `questions`, `submissions` (with two partitions visible), `answer_clusters`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260508_001_init_schema.sql
git commit -m "feat(db): initial schema for users, questions, submissions, clusters"
```

---

## Task 5: RLS policies migration `002_rls_policies.sql`

**Files:**
- Create: `supabase/migrations/20260508_002_rls_policies.sql`

- [ ] **Step 1: Write the policies**

Create `supabase/migrations/20260508_002_rls_policies.sql`:

```sql
-- Deny-by-default RLS on all public tables.
-- All write paths go through service-role-keyed API routes.
-- Read paths for clients: only answer_clusters (post-submit) and live question text.

alter table public.users enable row level security;
alter table public.device_users enable row level security;
alter table public.questions enable row level security;
alter table public.submissions enable row level security;
alter table public.answer_clusters enable row level security;

-- USERS: a user may read+update their own row
create policy users_self_select on public.users
  for select using (auth.uid() = id);
create policy users_self_update on public.users
  for update using (auth.uid() = id);

-- QUESTIONS: anyone (anon + authed) may read live + revealed questions
create policy questions_public_read on public.questions
  for select using (status in ('live', 'revealed'));

-- ANSWER_CLUSTERS: anyone may read clusters for live or revealed questions
create policy answer_clusters_public_read on public.answer_clusters
  for select using (
    exists (
      select 1 from public.questions q
      where q.id = answer_clusters.question_id
        and q.status in ('live', 'revealed')
    )
  );

-- SUBMISSIONS: clients may NOT read submissions directly. Service role only.
-- (No policy added → deny-by-default applies for anon/authed.)

-- DEVICE_USERS: clients may NOT read directly. Service role only.
-- (No policy added.)
```

- [ ] **Step 2: Apply migration**

Run:
```bash
supabase db push
```

Expected: `Applying migration 20260508_002_rls_policies.sql... Finished.`

- [ ] **Step 3: Verify policies in Studio**

Supabase dashboard → Authentication → Policies. Expected: see 4 policies listed.

- [ ] **Step 4: Smoke-test deny-by-default with anon key**

Run:
```bash
curl -sS "https://<project-ref>.supabase.co/rest/v1/submissions" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

Expected: empty array `[]` (RLS hides everything from anon). NOT a list of submissions.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260508_002_rls_policies.sql
git commit -m "feat(db): RLS deny-by-default + public-read for live questions/clusters"
```

---

## Task 6: Realtime publication migration `003_realtime_publication.sql`

**Files:**
- Create: `supabase/migrations/20260508_003_realtime_publication.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260508_003_realtime_publication.sql`:

```sql
-- Add answer_clusters to the supabase_realtime publication so clients
-- can subscribe to live cluster updates via WebSocket.

alter publication supabase_realtime add table public.answer_clusters;
```

- [ ] **Step 2: Apply**

Run: `supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508_003_realtime_publication.sql
git commit -m "feat(db): publish answer_clusters to supabase_realtime"
```

---

## Task 7: TDD `normalize()` function

**Files:**
- Create: `api/src/lib/normalize.ts`
- Create: `api/src/lib/normalize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/src/lib/normalize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalize, clusterId } from "./normalize";

describe("normalize", () => {
  it("trims whitespace", () => {
    expect(normalize("  italy  ")).toBe("italy");
  });

  it("lowercases", () => {
    expect(normalize("ITALY")).toBe("italy");
    expect(normalize("Italy")).toBe("italy");
  });

  it("strips leading articles", () => {
    expect(normalize("the italy")).toBe("italy");
    expect(normalize("a pizza")).toBe("pizza");
    expect(normalize("an eiffel tower")).toBe("eiffel tower");
  });

  it("strips trailing punctuation", () => {
    expect(normalize("italy.")).toBe("italy");
    expect(normalize("italy!")).toBe("italy");
    expect(normalize("italy?")).toBe("italy");
    expect(normalize("italy...")).toBe("italy");
  });

  it("collapses multiple spaces", () => {
    expect(normalize("pisa  tower")).toBe("pisa tower");
    expect(normalize("pisa   tower")).toBe("pisa tower");
  });

  it("combines all rules together", () => {
    expect(normalize("  The Italy.  ")).toBe("italy");
    expect(normalize("  THE  Pisa   Tower !!! ")).toBe("pisa tower");
  });

  it("does NOT collapse semantically different text", () => {
    expect(normalize("italy")).not.toBe(normalize("italian"));
    expect(normalize("pisa tower")).not.toBe(normalize("leaning tower of pisa"));
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles emoji-only text", () => {
    expect(normalize("🇮🇹")).toBe("🇮🇹");
  });

  it("preserves emoji within words", () => {
    expect(normalize("italy 🇮🇹")).toBe("italy 🇮🇹");
  });
});

describe("clusterId", () => {
  it("returns deterministic sha256 for question_id + normalized text", () => {
    const id1 = clusterId("q1", "italy");
    const id2 = clusterId("q1", "italy");
    expect(id1).toBe(id2);
  });

  it("differs across questions", () => {
    expect(clusterId("q1", "italy")).not.toBe(clusterId("q2", "italy"));
  });

  it("differs across normalized texts", () => {
    expect(clusterId("q1", "italy")).not.toBe(clusterId("q1", "italian"));
  });

  it("returns a 64-char hex string", () => {
    expect(clusterId("q1", "italy")).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm test
```

Expected: FAIL — `Cannot find module './normalize'`.

- [ ] **Step 3: Write minimal implementation**

Create `api/src/lib/normalize.ts`:

```typescript
import { createHash } from "node:crypto";

const LEADING_ARTICLES = ["the ", "a ", "an "];
const TRAILING_PUNCT = /[.!?,…]+$/;
const MULTIPLE_SPACES = /\s+/g;

export function normalize(input: string): string {
  let s = input.trim().toLowerCase();
  for (const article of LEADING_ARTICLES) {
    if (s.startsWith(article)) {
      s = s.slice(article.length);
      break;
    }
  }
  s = s.replace(TRAILING_PUNCT, "");
  s = s.replace(MULTIPLE_SPACES, " ");
  return s.trim();
}

export function clusterId(questionId: string, normalizedText: string): string {
  return createHash("sha256")
    .update(`${questionId}|${normalizedText}`)
    .digest("hex");
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test`

Expected: all 14 tests PASS.

- [ ] **Step 5: Verify 100% coverage**

Run: `pnpm test:coverage`

Expected: `normalize.ts` shows 100% line coverage.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/lib/normalize.ts api/src/lib/normalize.test.ts
git commit -m "feat(api): deterministic normalize() + clusterId() with full TDD coverage"
```

---

## Task 8: TDD profanity filter

**Files:**
- Create: `api/src/lib/profanity.ts`
- Create: `api/src/lib/profanity.test.ts`

This is a deliberately small, regex-based filter — first line of defense only. Perspective API integration lands in Phase 5 hardening.

- [ ] **Step 1: Write the failing tests**

Create `api/src/lib/profanity.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { containsProfanity } from "./profanity";

describe("containsProfanity", () => {
  it("blocks the n-word and variants", () => {
    expect(containsProfanity("nigger")).toBe(true);
    expect(containsProfanity("n1gger")).toBe(true);
    expect(containsProfanity("NIGGER")).toBe(true);
  });

  it("blocks slurs we don't want in a wordcloud", () => {
    expect(containsProfanity("faggot")).toBe(true);
    expect(containsProfanity("retard")).toBe(true);
  });

  it("blocks blatant violent content", () => {
    expect(containsProfanity("kill yourself")).toBe(true);
    expect(containsProfanity("kys")).toBe(true);
  });

  it("does NOT block normal text containing substrings", () => {
    expect(containsProfanity("classics")).toBe(false);   // contains "ass"
    expect(containsProfanity("scunthorpe")).toBe(false); // famous false-positive case
    expect(containsProfanity("pisa tower")).toBe(false);
  });

  it("does NOT block mild language we consider acceptable Gen Z register", () => {
    expect(containsProfanity("damn")).toBe(false);
    expect(containsProfanity("hell")).toBe(false);
    expect(containsProfanity("crap")).toBe(false);
  });

  it("handles empty + whitespace", () => {
    expect(containsProfanity("")).toBe(false);
    expect(containsProfanity("   ")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests, verify fail**

Run: `pnpm test`

Expected: FAIL — `Cannot find module './profanity'`.

- [ ] **Step 3: Write minimal implementation**

Create `api/src/lib/profanity.ts`:

```typescript
// First-line regex profanity/violence filter.
// Deliberately conservative for v1 — focuses on universally hateful slurs
// and explicit self-harm / violence prompts. Perspective API in Phase 5 catches
// the long tail.
//
// Patterns use word boundaries to avoid the Scunthorpe problem.

const HATE_SLUR_PATTERNS: RegExp[] = [
  /\bn[i1]gg[ae]r\b/i,
  /\bf[a4]gg[o0]t\b/i,
  /\bret[a4]rd\b/i,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  /\bkys\b/i,
  /\bkill\s+yourself\b/i,
  /\bkill\s+myself\b/i,
];

const ALL_PATTERNS: RegExp[] = [...HATE_SLUR_PATTERNS, ...VIOLENCE_PATTERNS];

export function containsProfanity(text: string): boolean {
  if (!text || !text.trim()) return false;
  return ALL_PATTERNS.some((p) => p.test(text));
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test`

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/lib/profanity.ts api/src/lib/profanity.test.ts
git commit -m "feat(api): regex profanity filter (slurs + self-harm)"
```

---

## Task 9: TDD `/api/questions/today` endpoint

**Files:**
- Create: `api/src/app/api/questions/today/route.ts`
- Create: `api/src/app/api/questions/today/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/questions/today/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin BEFORE importing route
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { GET } from "./route";
import { supabaseAdmin } from "@/lib/supabase";

describe("GET /api/questions/today", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the live question with id + text", async () => {
    const mockQuestion = {
      id: "q-uuid-1",
      text: "what's the most overrated tourist trap?",
      status: "live",
    };
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockQuestion, error: null }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: "q-uuid-1",
      text: "what's the most overrated tourist trap?",
    });
  });

  it("returns 404 when no live question exists", async () => {
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm test`

Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write minimal route handler**

Create `api/src/app/api/questions/today/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("id, text, status")
    .eq("status", "live")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "no live question" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, text: data.text });
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test`

Expected: both tests PASS.

- [ ] **Step 5: Manual smoke test against real Supabase**

Seed a live question via SQL:
```sql
insert into public.questions (text, status) values
  ('what is the most overrated tourist trap?', 'live');
```

Run dev server:
```bash
cd /c/Users/levin/relatably/api
pnpm dev
```

Curl the endpoint:
```bash
curl -sS http://localhost:3000/api/questions/today
```

Expected: `{"id":"<uuid>","text":"what is the most overrated tourist trap?"}`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/questions/today/
git commit -m "feat(api): GET /api/questions/today returns live question"
```

---

## Task 10: TDD `/api/submit` endpoint

**Files:**
- Create: `api/src/app/api/submit/route.ts`
- Create: `api/src/app/api/submit/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/submit/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { POST } from "./route";
import { supabaseAdmin } from "@/lib/supabase";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing fields", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects dwell_ms < 3000", async () => {
    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 100,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/dwell/i);
  });

  it("rejects profane text", async () => {
    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "kys",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/that won't fly/i);
  });

  it("upserts cluster and inserts submission for valid input", async () => {
    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { cluster_id: "cluster-abc", submission_count: 138 },
        error: null,
      });
    (supabaseAdmin.rpc as any) = mockRpc;

    const res = await POST(
      buildRequest({
        question_id: "q-uuid-1",
        device_token: "dev1",
        raw_text: "  Italy  ",
        dwell_ms: 5000,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      cluster_id: "cluster-abc",
      submission_count: 138,
      normalized_text: "italy",
    });

    // Should have called RPC with normalized text
    expect(mockRpc).toHaveBeenCalledWith(
      "submit_answer",
      expect.objectContaining({
        p_question_id: "q-uuid-1",
        p_normalized_text: "italy",
        p_raw_text: "  Italy  ",
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm test`

Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write a Postgres function for the atomic upsert**

The submission API does: upsert cluster + insert submission + return new count. To keep it atomic, push it to Postgres as an `RPC`. Add a new migration.

Create `supabase/migrations/20260508_004_submit_rpc.sql`:

```sql
-- Atomic submit_answer RPC.
-- Upserts the cluster, inserts the submission row, returns updated cluster count.

create or replace function public.submit_answer(
  p_question_id uuid,
  p_user_id uuid,
  p_device_user_id uuid,
  p_raw_text text,
  p_normalized_text text,
  p_cluster_id text,
  p_ip_hash text,
  p_dwell_ms integer
)
returns table(cluster_id text, submission_count integer)
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
begin
  -- Ensure the question exists and is live.
  perform 1 from public.questions
    where id = p_question_id and status = 'live';
  if not found then
    raise exception 'question_not_live';
  end if;

  -- Upsert cluster atomically.
  insert into public.answer_clusters (id, question_id, canonical_text, submission_count, first_submission_at)
    values (p_cluster_id, p_question_id, p_normalized_text, 1, v_now)
    on conflict (id) do update
      set submission_count = public.answer_clusters.submission_count + 1
    returning public.answer_clusters.id, public.answer_clusters.submission_count
    into cluster_id, submission_count;

  -- Insert submission row.
  insert into public.submissions (
    question_id, user_id, device_user_id,
    raw_text, normalized_cluster_id, submitted_at, ip_hash, dwell_ms, moderation_status
  ) values (
    p_question_id, p_user_id, p_device_user_id,
    p_raw_text, p_cluster_id, v_now, p_ip_hash, p_dwell_ms, 'passed'
  );

  return next;
end;
$$;

revoke all on function public.submit_answer from public, anon, authenticated;
grant execute on function public.submit_answer to service_role;
```

Apply: `supabase db push`

- [ ] **Step 4: Write minimal route handler**

Create `api/src/app/api/submit/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { normalize, clusterId } from "@/lib/normalize";
import { containsProfanity } from "@/lib/profanity";

const SubmitSchema = z.object({
  question_id: z.string().uuid().or(z.string().min(1)),
  device_token: z.string().min(1),
  raw_text: z.string().min(1).max(280),
  dwell_ms: z.number().int().nonnegative(),
});

const MIN_DWELL_MS = 3000;

function hashIp(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = SubmitSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (parsed.dwell_ms < MIN_DWELL_MS) {
    return NextResponse.json(
      { error: "dwell too short" },
      { status: 400 },
    );
  }

  if (containsProfanity(parsed.raw_text)) {
    return NextResponse.json(
      { error: "that won't fly. try again." },
      { status: 400 },
    );
  }

  const normalizedText = normalize(parsed.raw_text);
  if (!normalizedText) {
    return NextResponse.json({ error: "empty after normalization" }, { status: 400 });
  }

  const cId = clusterId(parsed.question_id, normalizedText);
  const ipHash = hashIp(req);

  // Resolve device_user_id (upsert if needed)
  const { data: deviceRow, error: deviceErr } = await supabaseAdmin
    .from("device_users")
    .upsert(
      { device_token: parsed.device_token },
      { onConflict: "device_token", ignoreDuplicates: false },
    )
    .select("id, linked_user_id")
    .single();

  if (deviceErr || !deviceRow) {
    return NextResponse.json({ error: "device registration failed" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.rpc("submit_answer", {
    p_question_id: parsed.question_id,
    p_user_id: deviceRow.linked_user_id,
    p_device_user_id: deviceRow.id,
    p_raw_text: parsed.raw_text,
    p_normalized_text: normalizedText,
    p_cluster_id: cId,
    p_ip_hash: ipHash,
    p_dwell_ms: parsed.dwell_ms,
  });

  if (error || !data) {
    return NextResponse.json({ error: "submit failed" }, { status: 500 });
  }

  // RPC returns array-of-rows; take first
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    cluster_id: row.cluster_id,
    submission_count: row.submission_count,
    normalized_text: normalizedText,
  });
}
```

- [ ] **Step 5: Update test to align with implementation**

The implementation also calls `supabaseAdmin.from("device_users").upsert(...)`. Update the test mock setup. Modify `api/src/app/api/submit/route.test.ts` — replace the "upserts cluster..." test with this version that mocks both calls:

```typescript
  it("upserts cluster and inserts submission for valid input", async () => {
    const mockUpsertResult = {
      data: { id: "device-uuid-1", linked_user_id: null },
      error: null,
    };
    (supabaseAdmin.from as any).mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockUpsertResult),
        }),
      }),
    });

    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ cluster_id: "cluster-abc", submission_count: 138 }],
      error: null,
    });
    (supabaseAdmin.rpc as any) = mockRpc;

    const res = await POST(
      buildRequest({
        question_id: "q-uuid-1",
        device_token: "dev1",
        raw_text: "  Italy  ",
        dwell_ms: 5000,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      cluster_id: "cluster-abc",
      submission_count: 138,
      normalized_text: "italy",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "submit_answer",
      expect.objectContaining({
        p_question_id: "q-uuid-1",
        p_normalized_text: "italy",
        p_raw_text: "  Italy  ",
      }),
    );
  });
```

- [ ] **Step 6: Run tests, verify pass**

Run: `pnpm test`

Expected: all 4 tests PASS.

- [ ] **Step 7: Manual smoke against real Supabase**

Run dev: `pnpm dev`

```bash
curl -sS -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<live-question-uuid>","device_token":"smoke-1","raw_text":"Italy","dwell_ms":5000}'
```

Expected: `{"cluster_id":"<sha>","submission_count":1,"normalized_text":"italy"}`

Submit again same text:
```bash
curl -sS -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<live-question-uuid>","device_token":"smoke-2","raw_text":"italy.","dwell_ms":5000}'
```

Expected: `{"cluster_id":"<same-sha>","submission_count":2,"normalized_text":"italy"}`

- [ ] **Step 8: Commit**

```bash
git add api/src/app/api/submit/ supabase/migrations/20260508_004_submit_rpc.sql
git commit -m "feat(api): POST /api/submit with RPC upsert + dwell + profanity guards"
```

---

## Task 11: Anonymous device tracking

**Files:**
- Create: `ios/src/lib/deviceId.ts`

- [ ] **Step 1: Write the implementation**

Create `ios/src/lib/deviceId.ts`:

```typescript
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";

const KEY = "relatably.device_token";

export async function getDeviceToken(): Promise<string> {
  let token = await SecureStore.getItemAsync(KEY);
  if (token) return token;

  // Use Apple's iOS-stable identifierForVendor as the seed; if unavailable
  // (sim sometimes returns null), fall back to a random UUID.
  const ifv = await Application.getIosIdForVendorAsync().catch(() => null);
  token = ifv ?? `anon-${cryptoRandom()}`;
  await SecureStore.setItemAsync(KEY, token);
  return token;
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

- [ ] **Step 2: Sanity test on simulator**

Add a temporary log in `App.tsx`:

```typescript
import { getDeviceToken } from "./src/lib/deviceId";
useEffect(() => {
  getDeviceToken().then((t) => console.log("device token:", t));
}, []);
```

Run: `pnpm ios` — expected: console logs a token; restarting the app shows the same token.

Remove the log before committing.

- [ ] **Step 3: Commit**

```bash
git add ios/src/lib/deviceId.ts
git commit -m "feat(ios): persistent anonymous device token via SecureStore"
```

---

## Task 12: iOS API client

**Files:**
- Create: `ios/src/types/api.ts`
- Create: `ios/src/lib/api.ts`

- [ ] **Step 1: Write shared types**

Create `ios/src/types/api.ts`:

```typescript
export interface TodayQuestion {
  id: string;
  text: string;
}

export interface SubmitRequest {
  question_id: string;
  device_token: string;
  raw_text: string;
  dwell_ms: number;
}

export interface SubmitResponse {
  cluster_id: string;
  submission_count: number;
  normalized_text: string;
}
```

- [ ] **Step 2: Write API client**

Create `ios/src/lib/api.ts`:

```typescript
import type { TodayQuestion, SubmitRequest, SubmitResponse } from "../types/api";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchTodayQuestion(): Promise<TodayQuestion> {
  const res = await fetch(`${BASE}/api/questions/today`);
  if (!res.ok) throw new Error(`fetchTodayQuestion: ${res.status}`);
  return res.json();
}

export async function submitAnswer(req: SubmitRequest): Promise<SubmitResponse> {
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `submit: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add ios/src/types/api.ts ios/src/lib/api.ts
git commit -m "feat(ios): typed API client for /questions/today and /submit"
```

---

## Task 13: iOS Supabase Realtime client

**Files:**
- Create: `ios/src/lib/supabase.ts`

- [ ] **Step 1: Write the client**

Create `ios/src/lib/supabase.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase: SupabaseClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
```

- [ ] **Step 2: Commit**

```bash
git add ios/src/lib/supabase.ts
git commit -m "feat(ios): Supabase Realtime client (anon key)"
```

---

## Task 14: iOS QuestionScreen UI

**Files:**
- Create: `ios/src/screens/QuestionScreen.tsx`
- Create: `ios/src/components/QuestionText.tsx`
- Create: `ios/src/components/AnswerInput.tsx`
- Create: `ios/src/components/LiveCounter.tsx`

- [ ] **Step 1: Write QuestionText component**

Create `ios/src/components/QuestionText.tsx`:

```tsx
import { Text, StyleSheet } from "react-native";

export function QuestionText({ text }: { text: string }) {
  return <Text style={styles.text}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
```

- [ ] **Step 2: Write AnswerInput component**

Create `ios/src/components/AnswerInput.tsx`:

```tsx
import { TextInput, StyleSheet } from "react-native";

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  editable?: boolean;
}

export function AnswerInput({ value, onChangeText, editable = true }: Props) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder="type your take…"
      placeholderTextColor="#666"
      editable={editable}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={280}
      multiline={false}
      returnKeyType="send"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "500",
    borderBottomColor: "#aaff00",
    borderBottomWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 32,
  },
});
```

- [ ] **Step 3: Write LiveCounter component**

Create `ios/src/components/LiveCounter.tsx`:

```tsx
import { Text, StyleSheet } from "react-native";

export function LiveCounter({ count }: { count: number }) {
  return (
    <Text style={styles.text}>{count.toLocaleString()} answers so far</Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "#888",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 12,
  },
});
```

- [ ] **Step 4: Compose QuestionScreen**

Create `ios/src/screens/QuestionScreen.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { QuestionText } from "../components/QuestionText";
import { AnswerInput } from "../components/AnswerInput";
import { LiveCounter } from "../components/LiveCounter";
import { fetchTodayQuestion } from "../lib/api";
import type { TodayQuestion } from "../types/api";

export function QuestionScreen({
  onSubmit,
}: {
  onSubmit: (question: TodayQuestion, text: string, dwellMs: number) => void;
}) {
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayQuestion()
      .then(setQuestion)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!question) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#aaff00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <QuestionText text={question.text} />
      <AnswerInput value={text} onChangeText={setText} />
      <LiveCounter count={0 /* wired up in Task 17 */} />
      {/* SubmitButton wired in Task 15 + 17 */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  error: { color: "tomato", fontSize: 16, textAlign: "center" },
});
```

- [ ] **Step 5: Wire QuestionScreen into App.tsx (placeholder)**

Modify `ios/App.tsx` — replace contents:

```tsx
import { StatusBar } from "expo-status-bar";
import { QuestionScreen } from "./src/screens/QuestionScreen";

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <QuestionScreen onSubmit={() => {}} />
    </>
  );
}
```

- [ ] **Step 6: Smoke test on simulator**

Run: `pnpm ios`

Expected: black screen, big white question text (the live question seeded earlier), accent-color underline input, "0 answers so far" counter.

- [ ] **Step 7: Commit**

```bash
git add ios/src/components/QuestionText.tsx ios/src/components/AnswerInput.tsx ios/src/components/LiveCounter.tsx ios/src/screens/QuestionScreen.tsx ios/App.tsx
git commit -m "feat(ios): QuestionScreen UI (no submit logic yet)"
```

---

## Task 15: TDD SubmitButton with 3-second dwell guard

**Files:**
- Create: `ios/src/components/SubmitButton.tsx`
- Create: `ios/__tests__/components/SubmitButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `ios/__tests__/components/SubmitButton.test.tsx`:

```tsx
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { SubmitButton } from "../../src/components/SubmitButton";

describe("SubmitButton", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("is disabled before 3 seconds elapse", () => {
    const { getByRole } = render(
      <SubmitButton hasText={true} onPress={() => {}} startedAt={Date.now()} />,
    );
    const btn = getByRole("button");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("is disabled when text is empty even after 3 seconds", () => {
    const startedAt = Date.now();
    const { getByRole } = render(
      <SubmitButton hasText={false} onPress={() => {}} startedAt={startedAt} />,
    );

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    const btn = getByRole("button");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("becomes enabled after 3 seconds AND text is non-empty", async () => {
    const startedAt = Date.now();
    const { getByRole } = render(
      <SubmitButton hasText={true} onPress={() => {}} startedAt={startedAt} />,
    );

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    await waitFor(() => {
      const btn = getByRole("button");
      expect(btn.props.accessibilityState?.disabled).toBe(false);
    });
  });

  it("calls onPress when tapped while enabled", async () => {
    const onPress = jest.fn();
    const startedAt = Date.now();
    const { getByRole } = render(
      <SubmitButton hasText={true} onPress={onPress} startedAt={startedAt} />,
    );

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `cd ios && pnpm test`

Expected: FAIL — `Cannot find module '../../src/components/SubmitButton'`.

- [ ] **Step 3: Write minimal implementation**

Create `ios/src/components/SubmitButton.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";

interface Props {
  hasText: boolean;
  onPress: () => void;
  startedAt: number;
}

const MIN_DWELL_MS = 3000;

export function SubmitButton({ hasText, onPress, startedAt }: Props) {
  const [dwellMet, setDwellMet] = useState(false);

  useEffect(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_DWELL_MS) {
      setDwellMet(true);
      return;
    }
    const t = setTimeout(() => setDwellMet(true), MIN_DWELL_MS - elapsed);
    return () => clearTimeout(t);
  }, [startedAt]);

  const enabled = dwellMet && hasText;

  return (
    <Pressable
      role="button"
      accessibilityState={{ disabled: !enabled }}
      onPress={enabled ? onPress : undefined}
      style={[styles.btn, enabled ? styles.btnOn : styles.btnOff]}
    >
      <Text style={styles.label}>SUBMIT</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 32,
    marginHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOn: { backgroundColor: "#aaff00" },
  btnOff: { backgroundColor: "#222" },
  label: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test`

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/src/components/SubmitButton.tsx ios/__tests__/components/SubmitButton.test.tsx
git commit -m "feat(ios): SubmitButton with 3-sec dwell guard (TDD)"
```

---

## Task 16: iOS WordcloudScreen static rendering

**Files:**
- Create: `ios/src/screens/WordcloudScreen.tsx`
- Create: `ios/src/components/ClusterBubble.tsx`

This implementation is a "naive flow layout" — bubbles ranked by submission_count, sized proportionally, laid out left-to-right with row wrap. No physics simulation. Good enough for v1 and animated upgrades land in Phase 2 hardening.

- [ ] **Step 1: Write ClusterBubble component**

Create `ios/src/components/ClusterBubble.tsx`:

```tsx
import { Text, StyleSheet, View } from "react-native";

interface Props {
  text: string;
  count: number;
  maxCount: number;
  isSelf: boolean;
}

const MIN_FONT = 14;
const MAX_FONT = 56;

export function ClusterBubble({ text, count, maxCount, isSelf }: Props) {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const fontSize = MIN_FONT + ratio * (MAX_FONT - MIN_FONT);
  return (
    <View style={[styles.bubble, isSelf && styles.self]}>
      <Text style={[styles.text, { fontSize }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  self: {
    backgroundColor: "#aaff00",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
  },
});
```

- [ ] **Step 2: Write WordcloudScreen**

Create `ios/src/screens/WordcloudScreen.tsx`:

```tsx
import { View, StyleSheet, ScrollView, Text } from "react-native";
import { ClusterBubble } from "../components/ClusterBubble";

export interface Cluster {
  id: string;
  canonical_text: string;
  submission_count: number;
}

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
}

export function WordcloudScreen({ clusters, selfClusterId, totalCount }: Props) {
  const sorted = [...clusters].sort(
    (a, b) => b.submission_count - a.submission_count,
  );
  const max = sorted[0]?.submission_count ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>
        {totalCount.toLocaleString()} answers • the world is voting
      </Text>
      <ScrollView contentContainerStyle={styles.cloud}>
        {sorted.map((c) => (
          <ClusterBubble
            key={c.id}
            text={c.canonical_text}
            count={c.submission_count}
            maxCount={max}
            isSelf={c.id === selfClusterId}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 12,
  },
  counter: {
    color: "#888",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  cloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
});
```

- [ ] **Step 3: Smoke render with seeded fake data**

Temporarily modify `App.tsx` to render WordcloudScreen with mock data:

```tsx
import { WordcloudScreen } from "./src/screens/WordcloudScreen";

const MOCK = [
  { id: "a", canonical_text: "pisa tower", submission_count: 412 },
  { id: "b", canonical_text: "louvre", submission_count: 138 },
  { id: "c", canonical_text: "times square", submission_count: 89 },
  { id: "d", canonical_text: "eiffel tower", submission_count: 47 },
  { id: "e", canonical_text: "colosseum", submission_count: 18 },
];

export default function App() {
  return <WordcloudScreen clusters={MOCK} selfClusterId="b" totalCount={704} />;
}
```

Run: `pnpm ios`

Expected: see the bubbles laid out by size, with "louvre" highlighted as self.

Revert `App.tsx` back to the QuestionScreen variant before commit.

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/ClusterBubble.tsx ios/src/screens/WordcloudScreen.tsx
git commit -m "feat(ios): WordcloudScreen + ClusterBubble static layout"
```

---

## Task 17: Wire submit flow + Realtime updates end-to-end

**Files:**
- Modify: `ios/App.tsx`

This is the integration task — connects QuestionScreen → submit → WordcloudScreen → live Supabase updates.

- [ ] **Step 1: Replace App.tsx with the integrated flow**

Replace `ios/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QuestionScreen } from "./src/screens/QuestionScreen";
import { WordcloudScreen, type Cluster } from "./src/screens/WordcloudScreen";
import { SubmitButton } from "./src/components/SubmitButton";
import { QuestionText } from "./src/components/QuestionText";
import { AnswerInput } from "./src/components/AnswerInput";
import { LiveCounter } from "./src/components/LiveCounter";
import { fetchTodayQuestion, submitAnswer } from "./src/lib/api";
import { getDeviceToken } from "./src/lib/deviceId";
import { supabase } from "./src/lib/supabase";
import type { TodayQuestion } from "./src/types/api";

type Phase = "loading" | "question" | "wordcloud" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt, setRenderedAt] = useState(Date.now());
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selfClusterId, setSelfClusterId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load today's question
  useEffect(() => {
    fetchTodayQuestion()
      .then((q) => {
        setQuestion(q);
        setRenderedAt(Date.now());
        setPhase("question");
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setPhase("error");
      });
  }, []);

  // Subscribe to Realtime cluster updates once we know the question
  useEffect(() => {
    if (!question) return;
    const channel = supabase
      .channel(`clusters:${question.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "answer_clusters",
          filter: `question_id=eq.${question.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Cluster;
          if (!row) return;
          setClusters((prev) => {
            const idx = prev.findIndex((c) => c.id === row.id);
            if (idx === -1) return [...prev, row];
            const copy = [...prev];
            copy[idx] = row;
            return copy;
          });
        },
      )
      .subscribe();

    // Initial snapshot
    supabase
      .from("answer_clusters")
      .select("id, canonical_text, submission_count")
      .eq("question_id", question.id)
      .then(({ data }) => {
        if (data) setClusters(data as Cluster[]);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [question]);

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
      {phase === "error" && (
        <View style={styles.center}>
          <Text style={styles.error}>{errorMsg}</Text>
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
});
```

- [ ] **Step 2: Smoke test single device**

Run dev server: `cd api && pnpm dev`
Run iOS sim: `cd ios && pnpm ios`

Expected:
1. Question loads.
2. Type "italy", wait 3+ sec, tap SUBMIT.
3. Transitions to wordcloud screen with "italy" as the only (highlighted) bubble.

- [ ] **Step 3: Smoke test two devices**

Open a second iOS simulator (or physical device on same network):
```bash
cd ios && pnpm ios -- --device "iPhone 15 Pro Max"
```

Submit a different answer. Expected: both simulators see both bubbles updating in real-time.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/App.tsx
git commit -m "feat(ios): integrate question→submit→wordcloud with live Realtime updates"
```

---

## Task 18: Phase 1 acceptance gate

This is a gate, not new code. It validates the entire phase against the acceptance criteria.

- [ ] **Step 1: Run all backend tests**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm test:coverage
```

Expected:
- All Vitest tests PASS
- `normalize.ts` shows 100% line coverage
- `profanity.ts` shows ≥ 95% coverage
- Route tests pass

- [ ] **Step 2: Run all iOS tests**

Run:
```bash
cd /c/Users/levin/relatably/ios
pnpm test
```

Expected: all Jest tests PASS.

- [ ] **Step 3: Manual end-to-end smoke**

Run both servers, open two iOS simulators, submit answers from each, verify:

- ✅ Question loads
- ✅ Submit button stays disabled for first 3 seconds
- ✅ Submit button stays disabled while text is empty
- ✅ After submit, wordcloud screen shows
- ✅ Self bubble is highlighted in accent color
- ✅ Live counter updates as second device submits
- ✅ Bubble sizes update as cluster counts grow
- ✅ "italy", "Italy", "  italy.  " all collapse into one cluster
- ✅ "italy" and "italian" stay as separate clusters
- ✅ Profanity submit returns inline error, not crash
- ✅ Empty text never enables submit
- ✅ Sub-3-second submit is rejected by backend (would only happen via direct curl since UI blocks)

- [ ] **Step 4: Manual `curl` regression checks**

Hit edge cases against the live API:

```bash
# Empty body
curl -i -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" -d '{}'
# Expected: HTTP 400

# Profanity
curl -i -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<id>","device_token":"t","raw_text":"kys","dwell_ms":5000}'
# Expected: HTTP 400 with "that won't fly"

# Sub-3s dwell
curl -i -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<id>","device_token":"t","raw_text":"italy","dwell_ms":100}'
# Expected: HTTP 400 with "dwell too short"
```

- [ ] **Step 5: Tag the milestone**

Run:
```bash
cd /c/Users/levin/relatably
git tag -a phase-1-complete -m "Phase 1 (core loop) complete"
git push origin main --tags
```

- [ ] **Step 6: Phase 1 retrospective**

Write a brief retro at `docs/superpowers/specs/2026-05-08-relatably-design.md` — append a new section near the end:

```markdown
## Implementation log

### Phase 1 — Core loop (completed YYYY-MM-DD)

**What worked:**
- [fill in]

**What surprised us:**
- [fill in]

**Carryover to Phase 2:**
- [fill in]
```

This becomes input for the Phase 2 plan.

---

## Phase 1 self-review

**Spec coverage check (against Section 4 + 6 of design spec):**

| Spec requirement | Task |
|---|---|
| Anonymous answering | Tasks 11, 17 |
| Free-text submission | Tasks 14, 17 |
| Deterministic normalization | Task 7 |
| Profanity filter | Task 8 |
| Live wordcloud via Supabase Realtime | Tasks 13, 16, 17 |
| Submit dwell ≥ 3 seconds | Tasks 10, 15 |
| Sign in with Apple | **NOT in Phase 1** — moved to Phase 3 (where leaderboard requires it) |
| Random drop scheduler | **NOT in Phase 1** — Phase 2 |
| Push notifications | **NOT in Phase 1** — Phase 2 |
| Reveal animation | **NOT in Phase 1** — Phase 2 |
| Leaderboard | **NOT in Phase 1** — Phase 3 |
| Anti-cheat (Apple sign-in, IP throttle, DeviceCheck, behavioral) | **NOT in Phase 1** — Phase 3 (the `dwell ≥ 3s` defense IS in Phase 1) |
| Friend graph | **NOT in Phase 1** — Phase 3 |
| Share banners | **NOT in Phase 1** — Phase 4 |
| AdMob ads | **NOT in Phase 1** — Phase 4 |
| Past archive | **NOT in Phase 1** — Phase 5 |
| User-submitted questions | **NOT in v1.0 at all** — deferred to v1.1 |

Coverage of Phase 1 scope: complete. ✅

**Placeholder scan:** no "TBD", "TODO", or hand-wavy steps. Every code block is the actual code. ✅

**Type consistency:** `clusterId()` signature consistent across `normalize.ts` and `route.ts`. `Cluster` type consistent across `WordcloudScreen.tsx` and `App.tsx`. `SubmitRequest` / `SubmitResponse` consistent across `api.ts` (ios) and `route.ts` (api). ✅

---

## Out of scope (Phase 1)

These features are **explicitly NOT** built in Phase 1 — separate plans cover them:

- **Phase 2:** random global drop scheduler, Vercel Cron, Expo Push fanout, push-to-app deep linking, per-user reveal animation, atomic question status transition
- **Phase 3:** Sign in with Apple wiring, leaderboard scoring formula, three boards, friend graph, group leaderboards, six-layer anti-cheat (App Attest, IP throttle, behavioral classifier, soft shadowban)
- **Phase 4:** three banner types, share triggers, AdMob (3 placements), Branch.io install attribution
- **Phase 5:** archive tab, admin curation console, scheduled question pipeline, Perspective API integration
- **Phase 6:** Sentry, PostHog, load testing, App Store submission

Each will get its own bite-sized plan written when its phase is about to begin — so the plan reflects current state of the code rather than 12-week-stale assumptions.

---

**End of Phase 1 plan.**

**Total tasks:** 18
**Estimated calendar time:** 4 weeks at solo-founder pace (working evenings + weekends)
**Working software at completion:** A standalone iOS app where any user can answer one manually-seeded question and watch a live wordcloud grow. Nothing else.
