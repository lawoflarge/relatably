# Relatably v1.0 — Phase 1 Implementation Plan (Core Loop, Firebase)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working iOS app where any user can open the app, see today's question, type and submit a free-text answer, and watch their answer appear in a live-updating Mentimeter-style wordcloud alongside everyone else's submissions.

**Architecture:** Expo (React Native) iOS client → Next.js 16 serverless API on Vercel → Firestore (Firebase) + Firebase Auth + Firestore listeners. Deterministic answer normalization on submit. Anonymous-by-default; Sign in with Apple is wired but not required. No leaderboard, no friend graph, no share banner, no ads, no scheduler in this phase — those land in Phases 2–4.

**Tech Stack:** Expo SDK 51+, React Native, TypeScript 5+, Next.js 16 App Router, **Firebase (Firestore + Auth)**, Firebase Admin SDK (server), `@react-native-firebase/*` packages (client), Vitest (backend tests), React Native Testing Library + Jest (iOS tests), pnpm.

**Phase 1 acceptance criteria:** A developer running `pnpm dev` in `api/` and `pnpm ios` in `ios/` against a Firebase project (or local Emulator Suite) should be able to:
1. Manually seed a `live` question via the Firebase console or a setup script
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
├── README.md                            (already exists, updated for Firebase)
├── .gitignore                           (already exists)
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-05-08-relatably-design.md   (already exists, updated for Firebase)
│       └── plans/
│           └── 2026-05-08-relatably-phase1-core-loop.md  (this file)
├── firebase/                            (Firebase project config + rules + indexes)
│   ├── firebase.json
│   ├── .firebaserc
│   ├── firestore.rules
│   └── firestore.indexes.json
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
│   │       ├── firebase.ts                 (Firebase Admin SDK init)
│   │       ├── normalize.ts                (deterministic normalization)
│   │       ├── normalize.test.ts
│   │       ├── profanity.ts                (regex-based blocklist)
│   │       └── profanity.test.ts
└── ios/                                 (Expo app)
    ├── package.json
    ├── tsconfig.json
    ├── app.json
    ├── babel.config.js
    ├── App.tsx
    ├── src/
    │   ├── lib/
    │   │   ├── api.ts                      (typed fetch wrappers for backend)
    │   │   ├── firebase.ts                 (Firebase RN client init)
    │   │   └── deviceId.ts                 (anonymous device tracking)
    │   ├── screens/
    │   │   ├── QuestionScreen.tsx          (today's Q + text input + submit)
    │   │   └── WordcloudScreen.tsx         (live cluster bubbles)
    │   ├── components/
    │   │   ├── QuestionText.tsx
    │   │   ├── AnswerInput.tsx
    │   │   ├── SubmitButton.tsx            (with 3-sec dwell guard)
    │   │   ├── ClusterBubble.tsx
    │   │   └── LiveCounter.tsx
    │   └── types/
    │       └── api.ts                      (shared response types)
    └── __tests__/
        └── components/
            └── SubmitButton.test.tsx
```

**Why this layout:**
- `firebase/` holds Firebase project config (rules, indexes, .firebaserc) — ready to `firebase deploy` when needed
- `api/` and `ios/` are independent npm projects (no monorepo workspace tooling)
- Shared types are duplicated — only ~3 of them and each side is small
- All Firestore Security Rules live under `firebase/firestore.rules` and deploy via `firebase deploy --only firestore:rules`

---

## Task Map (Phase 1 = 16 tasks across ~4 weeks)

| Task | Subject | Depends on |
|---|---|---|
| 1 | Provision Firebase project + Emulator Suite + service-account key | — |
| 2 | Initialize `api/` Next.js project + Firebase Admin SDK | 1 |
| 3 | Initialize `ios/` Expo project + `@react-native-firebase/*` | 1 |
| 4 | Firestore Security Rules + indexes (deny-by-default) | 1 |
| 5 | TDD: `normalize()` function | 2 |
| 6 | TDD: profanity filter | 2 |
| 7 | TDD: `/api/questions/today` endpoint | 2, 4, 5 |
| 8 | TDD: `/api/submit` endpoint with Firestore transaction | 2, 4, 5, 6 |
| 9 | Anonymous device tracking (`deviceId.ts`) | 3 |
| 10 | iOS API client (`api.ts`) | 3, 7, 8 |
| 11 | iOS Firebase RN client init | 3 |
| 12 | iOS `QuestionScreen` (UI only) | 3 |
| 13 | iOS `SubmitButton` with 3-sec dwell (TDD) | 3 |
| 14 | iOS `WordcloudScreen` static rendering | 3 |
| 15 | iOS Firestore listener wires bubbles to live updates | 11, 14 |
| 16 | End-to-end smoke test + Phase 1 acceptance gate | all |

---

## Task 1: Provision Firebase project + Emulator Suite + service-account key

**Files:**
- Create: `firebase/.firebaserc`
- Create: `firebase/firebase.json`
- Create: `api/.env.example`
- Modify: `README.md` (add setup section)

This task has TWO halves: a manual half that the human partner must do (Firebase console UI for project creation and service-account export), and a scriptable half (CLI install, emulator config, env files). The agent should ask the human partner to complete the manual half before proceeding.

- [ ] **Step 1: Install Firebase CLI**

Run:
```bash
npm install -g firebase-tools
firebase --version
```

Expected: prints version (v13+).

- [ ] **Step 2: Log in to Firebase**

Run:
```bash
firebase login
```

Expected: opens browser to authorize Google account. After auth: `Success! Logged in as <email>`.

- [ ] **Step 3 (HUMAN PARTNER): Create the Firebase project in the console**

Open https://console.firebase.google.com → **Add project** → name `relatably-prod` → disable Google Analytics for v1 (skips the GA setup; can enable later) → Create.

Once provisioned:
1. **Build → Firestore Database → Create database** → start in **production mode** (we manage Security Rules ourselves) → location `eur3 (europe-west)` (closest match to project's launch market).
2. **Build → Authentication → Get started** → enable **Apple** provider (configure later in Phase 3 — for now just enable the toggle, leave Service ID blank).
3. **Project Settings (gear icon) → Service Accounts → Generate new private key** → download JSON. Save it to your password manager AND put a copy at `api/firebase-service-account.json` (this file is gitignored — DO NOT COMMIT).

Capture from **Project Settings → General**:
- `Project ID` (e.g., `relatably-prod-abc12`)
- For the iOS app — register an iOS app: bundle id `co.relatably.app` (placeholder, can change later) → download `GoogleService-Info.plist` → save to `ios/GoogleService-Info.plist` (also gitignored).

Confirm to the controller when this human-only step is done.

- [ ] **Step 4: Initialize Firebase locally in the repo**

Run:
```bash
cd /c/Users/levin/relatably
mkdir -p firebase
cd firebase
firebase use --add
```

Pick the `relatably-prod` project and assign alias `default`.

Expected: creates `firebase/.firebaserc`.

- [ ] **Step 5: Configure `firebase.json` for emulators + Firestore**

Create `firebase/firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 6: Create `api/.env.example`**

Create `api/.env.example`:

```bash
# Firebase
FIREBASE_PROJECT_ID=relatably-prod-abc12
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# When running against the emulator suite (local dev), set:
# FIRESTORE_EMULATOR_HOST=localhost:8080
# FIREBASE_AUTH_EMULATOR_HOST=localhost:9099

# Server settings
NODE_ENV=development
```

- [ ] **Step 7: Update `.gitignore` for Firebase secrets**

Modify `.gitignore` — append:

```
# Firebase secrets (never commit)
firebase-service-account.json
api/firebase-service-account.json
ios/GoogleService-Info.plist
ios/google-services.json
.firebase/
```

- [ ] **Step 8: Update README setup section**

Modify `README.md` — append a new section before the "Owner" section:

```markdown
## Local development setup

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. Initialize: `cd firebase && firebase use --add` (pick relatably-prod, alias `default`)
4. Place service-account JSON at `api/firebase-service-account.json` (gitignored)
5. Place `GoogleService-Info.plist` at `ios/GoogleService-Info.plist` (gitignored)
6. Copy `api/.env.example` to `api/.env.local` and fill in values
7. Start local emulators (in `firebase/`): `firebase emulators:start`
8. Start API: `cd api && pnpm dev`
9. Start iOS app: `cd ios && pnpm ios`
```

- [ ] **Step 9: Commit (no secrets!)**

```bash
cd /c/Users/levin/relatably
git add firebase/.firebaserc firebase/firebase.json api/.env.example .gitignore README.md
# Verify nothing secret is staged:
git status
git diff --cached  # eyeball it
git commit -m "chore(firebase): scaffold project config + emulator suite + env example"
```

---

## Task 2: Initialize `api/` Next.js project + Firebase Admin SDK

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/next.config.ts`
- Create: `api/vitest.config.ts`
- Create: `api/src/lib/firebase.ts`

- [ ] **Step 1: Scaffold Next.js with TypeScript and pnpm**

Run:
```bash
cd /c/Users/levin/relatably
pnpm create next-app@latest api --typescript --eslint --app --src-dir --import-alias "@/*" --no-tailwind --turbopack
```

Expected: `api/` populated. App Router under `api/src/app/`.

- [ ] **Step 2: Install Firebase + Vitest deps**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm add firebase-admin zod
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

- [ ] **Step 5: Create `src/lib/firebase.ts`**

Create `api/src/lib/firebase.ts`:

```typescript
import {
  initializeApp,
  getApps,
  cert,
  type App,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import * as path from "node:path";
import * as fs from "node:fs";

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID env var is required");
  }

  // When the FIRESTORE_EMULATOR_HOST env var is set the Admin SDK auto-routes
  // to the emulator and does not need real credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    app = initializeApp({ projectId });
    return app;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH must be set when not running against the emulator",
    );
  }

  const absolute = path.resolve(serviceAccountPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`service-account JSON not found at ${absolute}`);
  }
  const credentials = JSON.parse(fs.readFileSync(absolute, "utf-8"));
  app = initializeApp({ credential: cert(credentials), projectId });
  return app;
}

export const adminFirestore: Firestore = getFirestore(getApp());
export const adminAuth: Auth = getAuth(getApp());
```

- [ ] **Step 6: Verify build**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm install
pnpm build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Verify Vitest runs (no tests yet)**

Run:
```bash
pnpm test
```

Expected: exits cleanly with no test files.

- [ ] **Step 8: Commit**

```bash
cd /c/Users/levin/relatably
git add api/
git commit -m "feat(api): scaffold Next.js 16 + Vitest + Firebase Admin SDK"
```

---

## Task 3: Initialize `ios/` Expo project + Firebase RN

**Files:**
- Create: `ios/package.json` (and surrounding scaffold)
- Modify: `ios/babel.config.js`
- Create: `ios/.env.example`

- [ ] **Step 1: Scaffold Expo TypeScript template**

Run:
```bash
cd /c/Users/levin/relatably
pnpm create expo-app ios --template default
```

Choose default TypeScript template.

- [ ] **Step 2: Install Firebase RN + auxiliary deps**

`@react-native-firebase` requires native modules. For Expo we use the `@react-native-firebase/*` packages (which work with Expo dev builds) plus the Expo config plugins.

Run:
```bash
cd /c/Users/levin/relatably/ios
pnpm add @react-native-firebase/app @react-native-firebase/firestore @react-native-firebase/auth
pnpm add expo-build-properties expo-secure-store expo-application
pnpm add react-native-reanimated react-native-gesture-handler
pnpm add -D @testing-library/react-native @testing-library/jest-native jest jest-expo @types/jest
```

- [ ] **Step 3: Update `app.json` with Firebase config plugin**

Modify `ios/app.json` — replace the `expo` block with:

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
      "googleServicesFile": "./GoogleService-Info.plist"
    },
    "plugins": [
      "@react-native-firebase/app",
      ["expo-build-properties", { "ios": { "useFrameworks": "static" } }]
    ]
  }
}
```

- [ ] **Step 4: Configure Reanimated babel plugin**

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

- [ ] **Step 5: Add jest config**

Modify `ios/package.json` — add at top level:

```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@react-native-firebase/.*))"
  ]
},
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
}
```

(Merge with whatever `scripts` block was created — keep `start`, `ios`, `android`, `web`.)

- [ ] **Step 6: Create `ios/.env.example`**

Create `ios/.env.example`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
# Firebase config is loaded from GoogleService-Info.plist (placed at ios/ root, gitignored)
```

- [ ] **Step 7: Build a development client**

Because `@react-native-firebase/*` requires native modules, the Expo Go app can't host this app. We need an Expo development build. Run:

```bash
cd /c/Users/levin/relatably/ios
pnpm add -D expo-dev-client
npx expo prebuild --platform ios
npx expo run:ios
```

Expected: Xcode builds the app and opens it in the simulator. Default Expo welcome screen loads.

(If `expo run:ios` errors with CocoaPods issues, run `cd ios && pod install` then retry.)

- [ ] **Step 8: Commit**

```bash
cd /c/Users/levin/relatably
git add ios/
git commit -m "feat(ios): scaffold Expo + @react-native-firebase + Jest"
```

---

## Task 4: Firestore Security Rules + indexes

**Files:**
- Create: `firebase/firestore.rules`
- Create: `firebase/firestore.indexes.json`

- [ ] **Step 1: Write Security Rules**

Create `firebase/firestore.rules`:

```
rules_version = '2';

// Deny-by-default: every read/write must match a rule below or it's blocked.
// All write paths go through the Next.js API using Firebase Admin SDK,
// which bypasses Security Rules with full credentials. So clients only need
// READ rules — they cannot write anything directly.

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

    // USERS: a user may read+update their own user doc.
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if false;        // server-only via Admin SDK
      allow update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['handle', 'is_public', 'locale']);
      allow delete: if false;
    }

    // SUBMISSIONS, DEVICE_USERS, FRIENDSHIPS, LEADERBOARD_ENTRIES,
    // USER_AGGREGATES, QUESTION_CANDIDATES: server-only.
    match /submissions/{id}              { allow read, write: if false; }
    match /device_users/{id}             { allow read, write: if false; }
    match /friendships/{id}              { allow read, write: if false; }
    match /leaderboard_entries/{id}      { allow read, write: if false; }
    match /user_aggregates/{id}          { allow read, write: if false; }
    match /question_candidates/{id}      { allow read, write: if false; }
  }
}
```

- [ ] **Step 2: Write composite indexes**

Create `firebase/firestore.indexes.json`:

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
      "collectionGroup": "questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduled_drop_at", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Deploy rules + indexes**

Run:
```bash
cd /c/Users/levin/relatably/firebase
firebase deploy --only firestore:rules,firestore:indexes
```

Expected: `✔ Deploy complete!` Rules show up in Firebase console under Firestore → Rules.

(If working entirely in the emulator: skip deploy, the rules apply locally on `firebase emulators:start`.)

- [ ] **Step 4: Smoke-test deny-by-default with the client SDK**

Open Firestore in the Firebase console (or emulator UI on http://localhost:4000) → Try to read `/submissions` from the "Rules Playground" simulating an unauthenticated client. Expected: **denied**.

Try to read `/questions` where `status = 'live'`. Expected: **allowed**.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add firebase/firestore.rules firebase/firestore.indexes.json
git commit -m "feat(firebase): Firestore Security Rules deny-by-default + cluster + question indexes"
```

---

## Task 5: TDD `normalize()` function

**Files:**
- Create: `api/src/lib/normalize.ts`
- Create: `api/src/lib/normalize.test.ts`

(This task is identical to the Supabase version — pure TypeScript, no DB touch.)

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
    expect(clusterId("q1", "italy")).toBe(clusterId("q1", "italy"));
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

- [ ] **Step 2: Run the tests, verify fail**

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

- [ ] **Step 4: Run tests, verify pass + 100% coverage**

Run: `pnpm test:coverage`

Expected: 14 tests PASS; `normalize.ts` 100% line coverage.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/lib/normalize.ts api/src/lib/normalize.test.ts
git commit -m "feat(api): deterministic normalize() + clusterId() with full TDD coverage"
```

---

## Task 6: TDD profanity filter

**Files:**
- Create: `api/src/lib/profanity.ts`
- Create: `api/src/lib/profanity.test.ts`

(Identical to original — pure TS, DB-agnostic.)

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
    expect(containsProfanity("classics")).toBe(false);
    expect(containsProfanity("scunthorpe")).toBe(false);
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

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm test` — expect FAIL on missing module.

- [ ] **Step 3: Write minimal implementation**

Create `api/src/lib/profanity.ts`:

```typescript
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

Run: `pnpm test` — expect 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/lib/profanity.ts api/src/lib/profanity.test.ts
git commit -m "feat(api): regex profanity filter (slurs + self-harm)"
```

---

## Task 7: TDD `/api/questions/today` endpoint

**Files:**
- Create: `api/src/app/api/questions/today/route.ts`
- Create: `api/src/app/api/questions/today/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/questions/today/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
  },
  adminAuth: {},
}));

import { GET } from "./route";
import { adminFirestore } from "@/lib/firebase";

describe("GET /api/questions/today", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the live question with id + text", async () => {
    const mockDoc = {
      id: "q-uuid-1",
      data: () => ({ text: "what's the most overrated tourist trap?", status: "live" }),
    };
    (adminFirestore.collection as any).mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: false, docs: [mockDoc] }),
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
    (adminFirestore.collection as any).mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm test` — expect FAIL.

- [ ] **Step 3: Write the route handler**

Create `api/src/app/api/questions/today/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";

export async function GET() {
  const snap = await adminFirestore
    .collection("questions")
    .where("status", "==", "live")
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "no live question" }, { status: 404 });
  }

  const doc = snap.docs[0];
  const data = doc.data() as { text: string };
  return NextResponse.json({ id: doc.id, text: data.text });
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test` — expect 2 tests PASS.

- [ ] **Step 5: Manual smoke test against Firebase emulator**

Start the emulator:
```bash
cd /c/Users/levin/relatably/firebase
firebase emulators:start
```

In a second terminal, seed a live question via a one-shot script. Create `api/scripts/seed-question.ts`:

```typescript
import { adminFirestore } from "../src/lib/firebase";

(async () => {
  await adminFirestore.collection("questions").add({
    text: "what is the most overrated tourist trap?",
    status: "live",
    source: "curated",
    created_at: new Date(),
  });
  console.log("seeded");
  process.exit(0);
})();
```

Run with emulator env:
```bash
cd /c/Users/levin/relatably/api
FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx scripts/seed-question.ts
```

Then run the API dev server pointing at the emulator:
```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm dev
```

Curl:
```bash
curl -sS http://localhost:3000/api/questions/today
```

Expected: `{"id":"<id>","text":"what is the most overrated tourist trap?"}`

- [ ] **Step 6: Commit**

```bash
cd /c/Users/levin/relatably
git add api/src/app/api/questions/today/ api/scripts/seed-question.ts
git commit -m "feat(api): GET /api/questions/today using Firestore Admin SDK"
```

---

## Task 8: TDD `/api/submit` endpoint with Firestore transaction

**Files:**
- Create: `api/src/app/api/submit/route.ts`
- Create: `api/src/app/api/submit/route.test.ts`

The atomic upsert pattern: a Firestore transaction reads the cluster doc; if it exists, increments `submission_count`; if not, creates it with `submission_count = 1` and `first_submission_at = now`. Then writes the submission doc.

- [ ] **Step 1: Write the failing tests**

Create `api/src/app/api/submit/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    adminAuth: {},
  };
});

import { POST } from "./route";
import { adminFirestore } from "@/lib/firebase";

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

  it("creates a new cluster on first submission", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };
    const mockDeviceRef = { id: "dev-1" };

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
      if (name === "submissions") {
        return { doc: vi.fn(() => mockSubmissionRef) };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);

    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

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
    expect(body.normalized_text).toBe("italy");
    expect(body.submission_count).toBe(1);

    expect(tx.set).toHaveBeenCalledWith(
      mockClusterRef,
      expect.objectContaining({
        canonical_text: "italy",
        submission_count: 1,
        question_id: "q-uuid-1",
      }),
    );
  });

  it("increments existing cluster on repeat submission", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ linked_user_id: null }) }),
            set: vi.fn().mockResolvedValue({}),
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
    tx.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ submission_count: 137 }),
    });

    const res = await POST(
      buildRequest({
        question_id: "q-uuid-1",
        device_token: "dev2",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submission_count).toBe(138);

    expect(tx.update).toHaveBeenCalledWith(
      mockClusterRef,
      expect.objectContaining({ submission_count: expect.anything() }),
    );
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

Run: `pnpm test` — expect FAIL on missing route module.

- [ ] **Step 3: Write the route handler**

Create `api/src/app/api/submit/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { normalize, clusterId } from "@/lib/normalize";
import { containsProfanity } from "@/lib/profanity";

const SubmitSchema = z.object({
  question_id: z.string().min(1),
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

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

  const cId = clusterId(parsed.question_id, normalizedText);
  const ipHash = hashIp(req);
  const deviceTokenHash = hashDeviceToken(parsed.device_token);

  // Upsert the device_user record (outside the transaction — it's idempotent and
  // not on the critical write path of cluster atomicity).
  const deviceRef = adminFirestore
    .collection("device_users")
    .doc(deviceTokenHash);
  const deviceSnap = await deviceRef.get();
  let linkedUserId: string | null = null;
  if (!deviceSnap.exists) {
    await deviceRef.set({
      device_token: parsed.device_token,
      linked_user_id: null,
      created_at: FieldValue.serverTimestamp(),
    });
  } else {
    linkedUserId = (deviceSnap.data() as any)?.linked_user_id ?? null;
  }

  const clusterRef = adminFirestore.doc(`answer_clusters/${cId}`);
  const submissionRef = adminFirestore.collection("submissions").doc();

  let newCount = 1;
  await adminFirestore.runTransaction(async (tx) => {
    const clusterSnap = await tx.get(clusterRef);
    const now = FieldValue.serverTimestamp();

    if (!clusterSnap.exists) {
      tx.set(clusterRef, {
        question_id: parsed.question_id,
        canonical_text: normalizedText,
        submission_count: 1,
        first_submission_at: now,
      });
      newCount = 1;
    } else {
      const prevCount = (clusterSnap.data() as any)?.submission_count ?? 0;
      newCount = prevCount + 1;
      tx.update(clusterRef, {
        submission_count: FieldValue.increment(1),
      });
    }

    tx.set(submissionRef, {
      question_id: parsed.question_id,
      user_id: null,
      device_user_id: deviceTokenHash,
      raw_text: parsed.raw_text,
      normalized_cluster_id: cId,
      submitted_at: now,
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

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test` — expect 5 tests PASS.

- [ ] **Step 5: Manual smoke test against Firebase emulator**

With emulator running and seed-question script having seeded a live question:

```bash
# First submit
curl -sS -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<live-question-id>","device_token":"smoke-1","raw_text":"Italy","dwell_ms":5000}'
```

Expected: `{"cluster_id":"<sha>","submission_count":1,"normalized_text":"italy"}`

```bash
# Second submit, same answer, different device
curl -sS -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<live-question-id>","device_token":"smoke-2","raw_text":"italy.","dwell_ms":5000}'
```

Expected: `{"cluster_id":"<same-sha>","submission_count":2,"normalized_text":"italy"}`

In emulator UI (http://localhost:4000) → Firestore → `/answer_clusters` → see the cluster doc with `submission_count: 2`.

- [ ] **Step 6: Commit**

```bash
git add api/src/app/api/submit/
git commit -m "feat(api): POST /api/submit with Firestore transaction + dwell + profanity guards"
```

---

## Task 9: Anonymous device tracking (iOS)

**Files:**
- Create: `ios/src/lib/deviceId.ts`

(Identical to original — Firebase-agnostic.)

- [ ] **Step 1: Write the implementation**

Create `ios/src/lib/deviceId.ts`:

```typescript
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";

const KEY = "relatably.device_token";

export async function getDeviceToken(): Promise<string> {
  let token = await SecureStore.getItemAsync(KEY);
  if (token) return token;

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

Run on dev client. Expected: token logs once, persists across restarts.

Remove the temporary log before commit.

- [ ] **Step 3: Commit**

```bash
git add ios/src/lib/deviceId.ts
git commit -m "feat(ios): persistent anonymous device token via SecureStore"
```

---

## Task 10: iOS API client

**Files:**
- Create: `ios/src/types/api.ts`
- Create: `ios/src/lib/api.ts`

(Identical to original — calls `/api/*` endpoints, DB-agnostic.)

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

## Task 11: iOS Firebase RN client init

**Files:**
- Create: `ios/src/lib/firebase.ts`

- [ ] **Step 1: Write the client init**

Create `ios/src/lib/firebase.ts`:

```typescript
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

// In dev with the Firebase Emulator Suite, point the client at the local emulators.
// EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 should be set in .env.local during dev.
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
  // Default emulator host on simulator: 'localhost' for iOS sim works because
  // sim shares the host network. For physical devices on LAN, replace with the
  // dev machine's LAN IP (e.g. '192.168.1.42').
  firestore().useEmulator("localhost", 8080);
  auth().useEmulator("http://localhost:9099");
}

export { firestore, auth };
```

- [ ] **Step 2: Smoke test**

Add a temporary log in `App.tsx`:

```typescript
import { firestore } from "./src/lib/firebase";
useEffect(() => {
  firestore()
    .collection("questions")
    .where("status", "==", "live")
    .limit(1)
    .get()
    .then((snap) => console.log("questions snap:", snap.size));
}, []);
```

Run on dev client with emulator running. Expected: console logs `questions snap: 1` (from seeded question).

Remove the temporary log before commit.

- [ ] **Step 3: Commit**

```bash
git add ios/src/lib/firebase.ts
git commit -m "feat(ios): @react-native-firebase client init + emulator support"
```

---

## Task 12: iOS QuestionScreen UI

**Files:**
- Create: `ios/src/screens/QuestionScreen.tsx`
- Create: `ios/src/components/QuestionText.tsx`
- Create: `ios/src/components/AnswerInput.tsx`
- Create: `ios/src/components/LiveCounter.tsx`

(Identical to the Supabase plan — pure UI, DB-agnostic. SubmitButton wired in Task 13, Realtime in Task 15.)

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
      <LiveCounter count={0 /* wired up in Task 15 */} />
      {/* SubmitButton wired in Task 13 + 15 */}
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

Modify `ios/App.tsx`:

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

- [ ] **Step 6: Smoke test on dev client**

Run with emulator + API + dev client. Expected: black screen, white question text from seeded question, accent input underline, "0 answers so far".

- [ ] **Step 7: Commit**

```bash
git add ios/src/components/QuestionText.tsx ios/src/components/AnswerInput.tsx ios/src/components/LiveCounter.tsx ios/src/screens/QuestionScreen.tsx ios/App.tsx
git commit -m "feat(ios): QuestionScreen UI (no submit logic yet)"
```

---

## Task 13: TDD SubmitButton with 3-second dwell guard

**Files:**
- Create: `ios/src/components/SubmitButton.tsx`
- Create: `ios/__tests__/components/SubmitButton.test.tsx`

(Identical to the Supabase plan — pure component logic, DB-agnostic.)

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

Run: `cd ios && pnpm test` — expect FAIL on missing module.

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

Run: `pnpm test` — expect 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/src/components/SubmitButton.tsx ios/__tests__/components/SubmitButton.test.tsx
git commit -m "feat(ios): SubmitButton with 3-sec dwell guard (TDD)"
```

---

## Task 14: iOS WordcloudScreen static rendering

**Files:**
- Create: `ios/src/screens/WordcloudScreen.tsx`
- Create: `ios/src/components/ClusterBubble.tsx`

(Identical to the Supabase plan — pure UI, DB-agnostic.)

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

- [ ] **Step 3: Smoke render with mock data**

Temporarily set `App.tsx` to render WordcloudScreen with the mock array used in the original plan. Verify visually. Revert before commit.

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/ClusterBubble.tsx ios/src/screens/WordcloudScreen.tsx
git commit -m "feat(ios): WordcloudScreen + ClusterBubble static layout"
```

---

## Task 15: Wire submit + Firestore listener live updates

**Files:**
- Modify: `ios/App.tsx`

This is the integration task — connects QuestionScreen → submit (via `/api/submit`) → WordcloudScreen → live Firestore listener.

- [ ] **Step 1: Replace App.tsx with integrated flow**

Replace `ios/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WordcloudScreen, type Cluster } from "./src/screens/WordcloudScreen";
import { SubmitButton } from "./src/components/SubmitButton";
import { QuestionText } from "./src/components/QuestionText";
import { AnswerInput } from "./src/components/AnswerInput";
import { LiveCounter } from "./src/components/LiveCounter";
import { fetchTodayQuestion, submitAnswer } from "./src/lib/api";
import { getDeviceToken } from "./src/lib/deviceId";
import { firestore } from "./src/lib/firebase";
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

  // Subscribe to Firestore listener for live cluster updates
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
            const data = d.data() as any;
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

Start emulator + API (with `FIRESTORE_EMULATOR_HOST=localhost:8080`) + dev client (with `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1`). Expected: question loads → type "italy" → wait 3+ sec → SUBMIT → wordcloud screen shows "italy" highlighted.

- [ ] **Step 3: Smoke test two devices**

Open a second simulator. Submit a different answer. Expected: both simulators' wordclouds show both bubbles, updating in real-time.

- [ ] **Step 4: Commit**

```bash
git add ios/App.tsx
git commit -m "feat(ios): integrate question→submit→wordcloud with live Firestore listener"
```

---

## Task 16: Phase 1 acceptance gate

This is a gate, not new code. Validates the entire phase against acceptance criteria.

- [ ] **Step 1: Run all backend tests**

Run:
```bash
cd /c/Users/levin/relatably/api
pnpm test:coverage
```

Expected:
- All Vitest tests PASS (≥21 total: 14 normalize + 6 profanity + 2 today + 5 submit)
- `normalize.ts` 100% coverage
- `profanity.ts` ≥ 95% coverage

- [ ] **Step 2: Run all iOS tests**

Run:
```bash
cd /c/Users/levin/relatably/ios
pnpm test
```

Expected: 4 SubmitButton tests PASS.

- [ ] **Step 3: Manual end-to-end smoke**

With emulator + API + 2 simulators running, verify:

- ✅ Question loads
- ✅ Submit button stays disabled for first 3 seconds
- ✅ Submit button stays disabled while text is empty
- ✅ After submit, wordcloud screen shows
- ✅ Self bubble highlighted in accent color
- ✅ Live counter updates as second device submits
- ✅ Bubble sizes update as cluster counts grow
- ✅ "italy", "Italy", "  italy.  " collapse into one cluster
- ✅ "italy" and "italian" stay separate
- ✅ Profanity submit returns inline error, app doesn't crash
- ✅ Empty text never enables submit
- ✅ Sub-3-sec submit rejected by backend (only reachable via direct curl)

- [ ] **Step 4: Manual `curl` regression checks**

```bash
# Empty body
curl -i -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" -d '{}'
# Expected: 400

# Profanity
curl -i -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<id>","device_token":"t","raw_text":"kys","dwell_ms":5000}'
# Expected: 400 with "that won't fly"

# Sub-3s dwell
curl -i -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"question_id":"<id>","device_token":"t","raw_text":"italy","dwell_ms":100}'
# Expected: 400 with "dwell too short"
```

- [ ] **Step 5: Tag the milestone**

```bash
cd /c/Users/levin/relatably
git tag -a phase-1-complete -m "Phase 1 (core loop, Firebase) complete"
# Push branch + tag (token URL one-shot)
git push origin phase-1-core-loop --tags
```

- [ ] **Step 6: Phase 1 retrospective**

Append to `docs/superpowers/specs/2026-05-08-relatably-design.md`:

```markdown
## Implementation log

### Phase 1 — Core loop (Firebase, completed YYYY-MM-DD)

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

**Spec coverage check (against Sections 4 + 6 of design spec):**

| Spec requirement | Task |
|---|---|
| Anonymous answering | Tasks 9, 15 |
| Free-text submission | Tasks 12, 15 |
| Deterministic normalization | Task 5 |
| Profanity filter | Task 6 |
| Live wordcloud via Firestore listener | Tasks 11, 14, 15 |
| Submit dwell ≥ 3 seconds | Tasks 8, 13 |
| Sign in with Apple | **NOT in Phase 1** — Phase 3 |
| Random drop scheduler | **NOT in Phase 1** — Phase 2 |
| Push notifications | **NOT in Phase 1** — Phase 2 |
| Reveal animation | **NOT in Phase 1** — Phase 2 |
| Leaderboard | **NOT in Phase 1** — Phase 3 |
| Anti-cheat (Sign in with Apple, IP throttle, App Attest, behavioral) | **NOT in Phase 1** — Phase 3 (the `dwell ≥ 3s` defense IS in Phase 1) |
| Friend graph | **NOT in Phase 1** — Phase 3 |
| Share banners | **NOT in Phase 1** — Phase 4 |
| AdMob ads | **NOT in Phase 1** — Phase 4 |
| Past archive | **NOT in Phase 1** — Phase 5 |
| User-submitted questions | **NOT in v1.0 at all** — deferred to v1.1 |

Coverage of Phase 1 scope: complete. ✅

**Placeholder scan:** no "TBD", "TODO", or hand-wavy steps. Every code block is the actual code. ✅

**Type consistency:** `clusterId()` signature consistent. `Cluster` type consistent across screens and App.tsx. `SubmitRequest`/`SubmitResponse` consistent across iOS api.ts and Next.js route.ts. ✅

---

## Out of scope (Phase 1)

These features are **explicitly NOT** built in Phase 1 — separate plans cover them:

- **Phase 2:** random global drop scheduler (Cloud Functions scheduled trigger), FCM push fanout, push deep linking, per-user reveal animation, atomic question status transition
- **Phase 3:** Sign in with Apple via Firebase Auth, leaderboard scoring formula, three boards, friend graph, group leaderboards, six-layer anti-cheat (App Attest, IP throttle, behavioral classifier, soft shadowban)
- **Phase 4:** three banner types, share triggers, AdMob (3 placements), Branch.io install attribution
- **Phase 5:** archive tab, admin curation console, scheduled question pipeline, Perspective API integration
- **Phase 6:** Sentry, PostHog, load testing, App Store submission

Each phase will get its own bite-sized plan written when its phase begins.

---

**End of Phase 1 plan (Firebase edition).**

**Total tasks:** 16 (down from 18 in the Supabase version — collapsed 3 migration tasks into 1 Security Rules + Indexes task, removed Realtime publication migration since Firestore listeners are auto-enabled)
**Estimated calendar time:** 4 weeks at solo-founder pace
**Working software at completion:** Standalone iOS app where any user can answer one manually-seeded question and watch a live wordcloud grow.
