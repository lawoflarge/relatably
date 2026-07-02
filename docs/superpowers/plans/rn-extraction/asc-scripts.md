# Relatably — ASC (App Store Connect) automation scripts, full extraction

Root: `/Users/levinschwab/Data/Claude/relatably`
Scope: everything under `scripts/asc-*.{mjs,js}` relevant to metadata fill, build attach, screenshot upload, review submission/cancellation, plus the Codemagic build/upload pipeline (`codemagic.yaml`). These are Node CLI tools, not app UI — "user-facing strings" here are (a) the App Store metadata text they write to Apple (verbatim below, this IS the store-facing copy) and (b) console output where load-bearing.

---

## 0. Shared foundation (identical across nearly all scripts)

### 0.1 Auth constants (hardcoded, no env vars needed for local scripts)

| Constant | Value | Notes |
|---|---|---|
| `KEY_PATH` | `<repo>/.secrets/AuthKey_8XWLD2B2RQ.p8` | resolved via `path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8")` |
| `KEY_ID` | `8XWLD2B2RQ` | ASC API key id |
| `ISSUER_ID` (aka `ISSUER`) | `538cb0d4-b8c6-4bc7-8b59-75da5d2b9411` | team issuer |
| `APP_ID` | `6768082631` | Relatably ASC app id (Apple ID) |
| API base | `https://api.appstoreconnect.apple.com` | |
| JWT `aud` | `appstoreconnect-v1` | |
| JWT expiry | `now + 60*15` = **900 s (15 min)** in all scripts except `asc-setup.js` which uses `now + 20*60` = **1200 s (20 min)** | |

Only `asc-setup.js` reads env overrides: `ASC_KEY_PATH` (default `.secrets/AuthKey_8XWLD2B2RQ.p8` — relative, so run from repo root), `ASC_KEY_ID`, `ASC_ISSUER_ID`.
Only `asc-revoke-distribution-certs-ci.mjs` is env-driven (CI): `APP_STORE_CONNECT_PRIVATE_KEY` (raw .p8 contents), `APP_STORE_CONNECT_KEY_IDENTIFIER` (or legacy `APP_STORE_CONNECT_KEY_ID`), `APP_STORE_CONNECT_ISSUER_ID` — provided by the Codemagic `relatably-asc` integration.

### 0.2 JWT signing algorithm (verbatim, the modern .mjs form)

```js
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function makeToken() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 15, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const sig = crypto.sign("SHA256", Buffer.from(signingInput), { key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(sig)}`;
}
```

Key detail: `dsaEncoding: "ieee-p1363"` produces the raw r||s signature Apple requires (no manual DER conversion needed). The Swift equivalent: sign ES256 with P-256, raw 64-byte signature.

`asc-setup.js` (the oldest script, CommonJS) does the same thing manually: signs with `crypto.createSign("SHA256")` (DER output) then converts DER→JOSE with a hand-rolled parser:

```js
// ECDSA outputs DER; Apple expects raw r||s (64 bytes for P-256). Convert.
function derToJose(der) {
  // DER: SEQUENCE [INTEGER r, INTEGER s]
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("bad der seq");
  let len = der[i++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let j = 0; j < n; j++) len = (len << 8) | der[i++];
  }
  function readInt() {
    if (der[i++] !== 0x02) throw new Error("bad der int");
    let l = der[i++];
    if (l & 0x80) {
      const n = l & 0x7f;
      l = 0;
      for (let j = 0; j < n; j++) l = (l << 8) | der[i++];
    }
    let val = der.slice(i, i + l);
    i += l;
    // strip leading zero or pad
    while (val.length > 32) val = val.slice(1);
    if (val.length < 32) {
      val = Buffer.concat([Buffer.alloc(32 - val.length), val]);
    }
    return val;
  }
  const r = readInt();
  const s = readInt();
  return Buffer.concat([r, s]);
}
```

### 0.3 Shared fetch wrapper (verbatim pattern)

```js
async function api(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  return { status: r.status, ok: r.ok, body: j };
}
```

Token is minted **once per process** at module load (except `asc-wait-and-submit.mjs`, which mints a fresh token per API call — relevant because it polls up to 150 s).

### 0.4 Hardcoded resource IDs seen across scripts (historical, submission-specific)

| ID | Meaning | Where |
|---|---|---|
| `6768082631` | Relatably app | all |
| `e613956d-da8b-4fc3-8b01-c5a69ed84f15` | v1.0 appStoreVersion | asc-cancel-old-submission, asc-wait-and-submit, asc-rejection-notes |
| `c94cb368-f96f-43bd-8d45-9f1567085e00` | old rejected reviewSubmission (`OLD`) | asc-cancel-old-submission |
| `245a9f1f-e626-4232-9908-81e290f7afa4` | later rejected reviewSubmission (`OLD_SUB` / `SUBMISSION_ID`) | asc-wait-and-submit, asc-rejection-notes |
| `4679c135-9e81-49cf-8d67-01320dc67988` | replacement draft reviewSubmission (`NEW_SUB`) | asc-wait-and-submit |
| `71cb1b69-1d4e-4504-9ddb-2b5bd571c7c2` | a build id | asc-rejection-notes |
| `6a18304d-4068-43f9-854a-2e851a245297` | a build id | asc-tf-state |
| `1e278ce3-3f30-4c37-a175-c9aba7adf1a7` | "Founders" internal TestFlight betaGroup | asc-check-founders |
| `co.relatably.app` | bundle id | asc-setup.js, codemagic.yaml |
| `relatably-v1` | ASC SKU | asc-setup.js |

---

## 1. `scripts/asc-fill-metadata.mjs` — metadata fill + build attach

**Invocation:** `node scripts/asc-fill-metadata.mjs` (no flags, no env vars; idempotent, safe to re-run).

### 1.1 Flow / endpoints in order

0. Resolve editable resources. `EDITABLE_STATES = new Set(["PREPARE_FOR_SUBMISSION","REJECTED","METADATA_REJECTED","DEVELOPER_REJECTED"])`.
   - `GET /v1/apps/6768082631/appInfos` → find first appInfo whose `attributes.appStoreState` OR `attributes.state` is in `EDITABLE_STATES`. Throws `"No editable appInfo found."` otherwise.
   - `GET /v1/apps/6768082631/appStoreVersions?limit=10` → find version with `versionString === "1.0"` AND state in `EDITABLE_STATES`. Throws `"No editable v1.0 appStoreVersion found."`
   - `GET /v1/appInfos/{infoId}/appInfoLocalizations` → find `locale === "en-US"`. Throws `"No en-US appInfoLocalization."`
   - `GET /v1/appStoreVersions/{versionId}/appStoreVersionLocalizations` → find `locale === "en-US"`. Throws `"No en-US appStoreVersionLocalization."`
1. `PATCH /v1/appInfoLocalizations/{id}` — attributes `{ subtitle, privacyPolicyUrl }`.
2. `PATCH /v1/appInfos/{id}` — relationships `{ primaryCategory: {type:"appCategories", id:"SOCIAL_NETWORKING"}, secondaryCategory: {type:"appCategories", id:"ENTERTAINMENT"} }`. (Category ids ARE the enum strings.)
3. `PATCH /v1/appStoreVersionLocalizations/{id}` — attributes `{ description, keywords, marketingUrl, supportUrl, promotionalText }`.
4. Separate `PATCH /v1/appStoreVersionLocalizations/{id}` with only `{ whatsNew }` — isolated so a STATE_ERROR doesn't kill the run. On failure logs: `[SKIP {status}] whatsNew not editable for first release v1.0 — Apple uses description instead` (Apple disables What's New for a first release).
5. `PATCH /v1/appStoreVersions/{id}` — attributes `{ copyright: "© 2026 Levin Schwab", usesIdfa: false }`.
6. Review detail (create-or-update):
   - `GET /v1/appStoreVersions/{id}/appStoreReviewDetail`; if `body.data.id` exists → `PATCH /v1/appStoreReviewDetails/{detailId}`, else `POST /v1/appStoreReviewDetails` with relationship `appStoreVersion`. Attributes in both cases: `contactFirstName, contactLastName, contactPhone, contactEmail, notes`.
7. **Build attach:** `GET /v1/builds?filter[app]=6768082631&limit=10&sort=-uploadedDate` → first build with `processingState === "VALID"` → `PATCH /v1/appStoreVersions/{versionId}/relationships/build` with body `{ data: { type: "builds", id: buildId } }`. If none VALID: logs `No VALID builds found — skipping build attachment.`
8. Age rating: `PATCH /v1/ageRatingDeclarations/{appInfoId}` — **the declaration's ID equals the appInfo's ID** (Apple moved the declaration off appStoreVersion onto appInfo). Full attribute payload verbatim:

```js
attributes: {
  violenceCartoonOrFantasy: "NONE",
  violenceRealistic: "NONE",
  violenceRealisticProlongedGraphicOrSadistic: "NONE",
  profanityOrCrudeHumor: "FREQUENT_OR_INTENSE",
  sexualContentOrNudity: "NONE",
  sexualContentGraphicAndNudity: "NONE",
  horrorOrFearThemes: "NONE",
  matureOrSuggestiveThemes: "FREQUENT_OR_INTENSE",
  medicalOrTreatmentInformation: "NONE",
  alcoholTobaccoOrDrugUseOrReferences: "NONE",
  gamblingSimulated: "NONE",
  contests: "NONE",
  gunsOrOtherWeapons: "NONE",
  healthOrWellnessTopics: false,
  advertising: false,
  gambling: false,
  unrestrictedWebAccess: false,
  lootBox: false,
  messagingAndChat: false,
  userGeneratedContent: true,
  parentalControls: false,
  kidsAgeBand: null,
  ageAssurance: false,
  ageRatingOverrideV2: "EIGHTEEN_PLUS",
}
```

Age-rating edge cases documented in source comments:
- Apple errors with `STATE_ERROR.AGE_RATING_OVERRIDE_V1_AND_V2_NOT_ALLOWED` when the legacy `ageRatingOverride` appears in the same body as `ageRatingOverrideV2` — **even when set to "NONE"**. So only V2 is sent; the legacy field keeps its current value.
- `ageRatingOverrideV2` enum: `NONE / NINE_PLUS / THIRTEEN_PLUS / SIXTEEN_PLUS / EIGHTEEN_PLUS / UNRATED`. Legacy `ageRatingOverride` enum: `NONE / NINE_PLUS / THIRTEEN_PLUS / SIXTEEN_PLUS / SEVENTEEN_PLUS / UNRATED`. These were confirmed "by probing /v1/ageRatingDeclarations/{id} with an invalid value: Apple returns the allowed enum in ENTITY_ERROR.ATTRIBUTE.TYPE".
- The 18+ override was added because Apple rejected v1.0 (build 28, sub 4679c135) under Guideline 1.2 with "Age rating must reflect 18+".

Last console line: `Done. Re-run scripts/asc-diag.mjs to verify written state.`

### 1.2 The `META` object — ALL store-facing strings VERBATIM

```
subtitle:            "One question. One global drop."
privacyPolicyUrl:    "https://relatably.vercel.app/privacy"
primaryCategory:     "SOCIAL_NETWORKING"
secondaryCategory:   "ENTERTAINMENT"
marketingUrl:        "https://relatably.vercel.app"
supportUrl:          "https://relatably.vercel.app/support"
copyright:           "© 2026 Levin Schwab"
reviewContactFirstName: "Levin"
reviewContactLastName:  "Schwab"
reviewContactPhone:  "+49 157 379 65607"
reviewContactEmail:  "levin.schwab@gmx.de"
```

`promotionalText`:
```
One question, dropped at the same random moment for everyone on Earth. Type your answer. See the world's. Daily.
```

`keywords` (93 chars / 100 limit; source comment: removed "bereal" because Guideline 2.3.7 forbids unauthorized third-party app references in metadata, replaced with "discussion"):
```
daily,question,wordcloud,social,opinion,poll,trivia,discussion,survey,gen z,relatable,friends
```

`description` (full, verbatim):
```
One question. One global drop. Once a day.

Relatably picks one question and asks the entire world at the same random moment. You have one shot to type your answer in plain text. Then watch every other answer on Earth cluster into a live wordcloud — the world's collective opinion, in real time.

To see yesterday's verdict, you have to answer today. No streaks to grind. No XP. No infinite scroll. Just a single daily ritual that takes thirty seconds.

How it works:
• Once per day, at a synchronized random moment in UTC, every Relatably user gets the same question
• You type your honest free-text answer. No multiple choice.
• Answers cluster into a Mentimeter-style live wordcloud
• Tomorrow you'll see who guessed the eventual #1 answer first — they win the title "most relatable on Earth"
• That's it. Come back tomorrow.

Sign in with Apple to:
• Compete on the global daily, weekly, and all-time leaderboards
• Friend other users (no DMs, no comments — just a leaderboard you both see)
• Earn the "called it" badge when you submit the eventual #1 answer first

Or stay anonymous and just play the daily ritual.

Why we built it:
Most social apps want you to scroll forever. Relatably wants thirty seconds of your day. One question. One answer. Real people, no algorithm.

Privacy:
We collect the bare minimum — an anonymous device ID, your free-text answer, and a hashed IP for rate-limiting. No location, no contacts, no third-party analytics on the iOS client. Full policy at relatably.vercel.app/privacy.

Free to play. No subscription. No paywall.
```

`whatsNew` (verbatim; usually skipped for v1.0 first release):
```
Welcome to Relatably 🌍

The first daily one-question social ritual. We start small with sixty hand-picked questions; user-submitted questions land in v1.1.

Free, no subscription. Sign in with Apple to compete on the leaderboard, or play anonymously.
```

### 1.3 `reviewNotes` — the CURRENT review-notes text, VERBATIM (this is the contract the SwiftUI port MUST honor 1:1; every claim here must be true of the rebuilt app)

```
Relatably is an anonymous daily-question app with user-generated free-text answers. Every Guideline 1.2 safeguard is a visible, one-tap control, and this build GUARANTEES there is always populated content to act on — a brand-new install immediately shows a full wordcloud of other answers and a full Board of users — so a reviewer can exercise every control in under a minute with NO sign-in and NO waiting.

HOW TO TEST (about 60 seconds, fully anonymous, no account)
1. Launch. A full-screen Terms gate appears on first launch. It states our ZERO-TOLERANCE policy for objectionable content and abusive users and requires you to confirm you are 18 or older. Tap "I AGREE".
2. On the Today tab, type any answer and tap DROP IT. You immediately see a live wordcloud with many other answers.
3. REPORT / HIDE / BLOCK another user's content: tap any answer bubble that is not your own (on-screen hint: "Tap any answer ... to hide it, report it, or block whoever wrote it"). The sheet offers "Hide this answer", "Report this answer" (files a report to our 24-hour queue and removes it from your feed immediately), and "Block this contributor" (hides them and their answers). The identical control is on every past wordcloud under the Archive tab via a visible "..." button on each row.
4. POST and DELETE your own content: your submitted answer is tagged "YOU" and has a visible "DELETE MY ANSWER" button that removes it from the feed instantly.
5. BLOCK a user from the Board: open the Board tab. It always lists ranked users. Each row has a visible "..." button -> "Block this user" (the row disappears and their content is hidden) or "Report this user".
6. CONTACT and manage: the ME tab (gear icon, far right of the tab bar) has a visible "Contact support" email, a "Report inappropriate content" button, Terms of Service, Privacy Policy, and sections to review and undo your hidden answers and blocked users.

WHY THERE IS ALWAYS CONTENT TO MODERATE
Answers are anonymous and aggregated into a wordcloud. To make sure the moderation controls always have something to act on (even on a fresh install or a brand-new daily drop), this build shows clearly non-objectionable demo answers and demo Board users. Prior 1.2 feedback was caused by the feed/Board being empty at review time even though the controls existed; that can no longer happen.

ADDITIONAL SAFEGUARDS
- Age rating is 18+, and the first-launch Terms gate requires an 18+ confirmation.
- Two-tier filtering on every submission: an immediate slur/violence block, plus a Google Perspective toxicity check that removes toxic answers server-side.
- We act on every report within 24 hours by removing the content and ejecting repeat offenders, as stated in the Terms.
- There is NO chat, NO direct messages, and NO 1:1 messaging of any kind — only anonymous aggregated answers.
- Sign in with Apple is optional (only for the leaderboard); account deletion is in the ME tab.

CONTACT
Levin Schwab, levin.schwab@gmx.de, +49 157 379 65607
Terms: https://relatably.vercel.app/tos
Privacy: https://relatably.vercel.app/privacy
Support: https://relatably.vercel.app/support
```

**UI features the review notes promise (checklist for the SwiftUI port):** first-launch full-screen Terms gate with 18+ confirmation and "I AGREE" button; Today tab with free-text input + "DROP IT" button; instantly-populated wordcloud (demo answers on fresh install); tap-any-foreign-bubble sheet with exactly "Hide this answer" / "Report this answer" / "Block this contributor"; on-screen hint "Tap any answer ... to hide it, report it, or block whoever wrote it"; own answer tagged "YOU" with "DELETE MY ANSWER" button; Archive tab with "..." button per row offering identical sheet; Board tab always populated (demo users) with "..." per row → "Block this user" / "Report this user"; ME tab (gear icon, far right) with "Contact support", "Report inappropriate content", ToS, Privacy Policy, undo-lists for hidden answers and blocked users, and account deletion.

### 1.4 What this script deliberately does NOT touch (from header comment)
- Pricing & Availability (→ `asc-finalize-submission.mjs` / web UI)
- App Privacy questionnaire (web-only)
- Content Rights toggle (handled in finalize script, despite comment saying web-only)
- Screenshots (→ `asc-upload-screenshots.mjs`)
- Build attachment "auto once #21 lands" (stale comment — attach IS in this script now, step 7)

---

## 2. `scripts/asc-submit-for-review.mjs` — submit v1.0 for review

**Invocation:** `node scripts/asc-submit-for-review.mjs` or `node scripts/asc-submit-for-review.mjs --dry-run` (flag: `process.argv.includes("--dry-run")`).

### Flow / endpoints

0. `GET /v1/apps/6768082631/appStoreVersions?limit=10` → require version with `versionString === "1.0"` && `appStoreState === "PREPARE_FOR_SUBMISSION"` (NOTE: stricter than fill-metadata — only this one state). Exit 1 with `No editable v1.0 appStoreVersion. State may have already changed.` if not found.
1. Find-or-create draft submission: `GET /v1/reviewSubmissions?filter[app]=6768082631&filter[platform]=IOS&limit=20`. **Draft-detection gate (verbatim):**

```js
const draft = existing.body.data?.find((rs) => {
  const s = rs.attributes?.state;
  const submitted = rs.attributes?.submittedDate;
  if (submitted) return false; // already committed
  return s === "READY_FOR_REVIEW" || s === "DRAFT" || s === "READY_FOR_SUBMISSION";
});
```

Key insight from comments: *"a submission with state='READY_FOR_REVIEW' and submittedDate=null is actually a DRAFT awaiting items + final submit. We can/should reuse it. Once submittedDate is non-null OR state is IN_REVIEW/COMPLETED/etc, treat as committed and don't reuse."*

If no draft: `POST /v1/reviewSubmissions` body `{ data: { type:"reviewSubmissions", attributes:{ platform:"IOS" }, relationships:{ app:{ data:{ type:"apps", id:APP_ID } } } } }`. Exit 1 on failure.

2. Attach version item (idempotent): `GET /v1/reviewSubmissions/{id}/items?limit=10`; skip if any item's `relationships.appStoreVersion.data.id === version.id`; else `POST /v1/reviewSubmissionItems` body `{ data: { type:"reviewSubmissionItems", relationships:{ reviewSubmission:{data:{type:"reviewSubmissions",id}}, appStoreVersion:{data:{type:"appStoreVersions",id}} } } }`. Exit 1 on failure.

3. Final submit: `PATCH /v1/reviewSubmissions/{id}` body `{ data: { type:"reviewSubmissions", id, attributes:{ submitted: true } } }`. (Comment: PATCH with `submitted:true` is the current documented form; an actions endpoint is the older alternative.) On failure: **exit code 2** and prints:

```
=== SUBMIT FAILED {status} ===
Most common causes:
  - App Privacy questionnaire not filled (web-UI only)
  - Build still processing in Apple's pipeline (rare)
  - Export Compliance not answered
```

On success prints `✓ SUBMITTED FOR REVIEW`, the new state, and `https://appstoreconnect.apple.com/apps/6768082631/distribution/ios/version/inflight`. Comment: "Apple Review typically takes 24–48h."

Dry-run behavior: stops after step 1 if it would need to create a submission (`(dry-run) Stopping here — no submission ID to operate on.`); otherwise prints what each POST/PATCH would do and returns before step 3.

Exit codes: 1 = no version / create-submission failed / add-item failed; 2 = final submit failed; 1 via catch on fatal.

---

## 3. `scripts/asc-cancel-old-submission.mjs` — cancel a rejected submission (one-off)

**Invocation:** `node scripts/asc-cancel-old-submission.mjs`. Hardcoded target `OLD = "c94cb368-f96f-43bd-8d45-9f1567085e00"`.

Fires three probing calls sequentially, printing `{method} {path} -> {status}` + first 1200 chars of each response (comment: "ASC undocumented but the modern API typically uses /actions/cancel or a PATCH with cancelled=true"):

1. `POST /v1/reviewSubmissions/{OLD}/actions/cancel` body `{ data: { type: "reviewSubmissions", id: OLD } }`
2. `PATCH /v1/reviewSubmissions/{OLD}` body `{ data: { type: "reviewSubmissions", id: OLD, attributes: { canceled: true } } }`
3. `GET /v1/appStoreVersions/e613956d-da8b-4fc3-8b01-c5a69ed84f15/relationships/appStoreVersionSubmission` (legacy singular relationship)

No success/failure gating — purely exploratory output. (In the sibling script asc-wait-and-submit the observed post-cancel state is `CANCELING`, implying one of these routes worked; the canonical modern cancel is the PATCH `canceled: true` form.)

---

## 4. `scripts/asc-wait-and-submit.mjs` — poll cancel, then re-submit

**Invocation:** `node scripts/asc-wait-and-submit.mjs`. Hardcoded: `OLD_SUB = 245a9f1f-e626-4232-9908-81e290f7afa4`, `NEW_SUB = 4679c135-9e81-49cf-8d67-01320dc67988`, `VERSION_ID = e613956d-da8b-4fc3-8b01-c5a69ed84f15`.

Unique detail: **mints a fresh JWT per API call** (`makeToken()` inside `api()`) since polling can outlive a token.

1. Poll `GET /v1/reviewSubmissions/{OLD_SUB}` until `state !== "CANCELING"`: max **30 iterations**, **5000 ms** sleep between → **150 s** budget. If still CANCELING: `Old submission still CANCELING after 150s. Aborting.` exit 1.
2. `POST /v1/reviewSubmissionItems` attaching VERSION_ID to NEW_SUB (same shape as §2 step 2). On failure (e.g. 409 lock elsewhere) exit **2**.
3. `PATCH /v1/reviewSubmissions/{NEW_SUB}` `{ attributes: { submitted: true } }`. On failure exit **3**.
Success output includes `Apple SLA 24-48h. Decision email -> levin.schwab@gmx.de`.

---

## 5. `scripts/asc-finalize-submission.mjs` — content rights + pricing + verification checklist

**Invocation:** `node scripts/asc-finalize-submission.mjs` or `--dry-run`. Idempotent. Deliberately does NOT submit for review ("that's the deliberate gate requiring Levin's explicit visual confirmation that build 26 works"). App Privacy is delegated to a separate `asc-fill-app-privacy.mjs` (referenced in the header but **does not exist in scripts/** — never written or deleted; privacy was done in the web UI).

### [1] Content Rights
- `GET /v1/apps/{APP_ID}` → read `attributes.contentRightsDeclaration`; if already `DOES_NOT_USE_THIRD_PARTY_CONTENT`, skip.
- Else `PATCH /v1/apps/{APP_ID}` `{ data: { type:"apps", id, attributes:{ contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT" } } }`.

### [2] Pricing (Free, all territories) — the tricky one
- Existing check: `GET /v1/apps/{APP_ID}/relationships/priceSchedule` → if schedule exists, `GET /v2/appPriceSchedules/{schedId}?include=manualPrices,baseTerritory`; if it has ≥1 included `appPrices`, done.
- Find Free price point: `GET /v1/apps/{APP_ID}/appPricePoints?filter[territory]=USA&limit=200` — **the app-scoped relationship endpoint; the top-level `/v1/appPricePoints` 404s**. Free = first point where `customerPrice` is `"0" | "0.0" | "0.00"` or `Number(c) === 0`.
- Create schedule — note the **temp-id `"${price1}"` literal string** cross-referencing `included` (JSON:API client-generated id pattern), verbatim:

```js
const res = await api("POST", "/v1/appPriceSchedules", {
  data: {
    type: "appPriceSchedules",
    relationships: {
      app: { data: { type: "apps", id: APP_ID } },
      baseTerritory: { data: { type: "territories", id: "USA" } },
      manualPrices: {
        data: [{ type: "appPrices", id: "${price1}" }],
      },
    },
  },
  included: [
    {
      type: "appPrices",
      id: "${price1}",
      attributes: { startDate: null },
      relationships: {
        appPricePoint: { data: { type: "appPricePoints", id: freePoint.id } },
      },
    },
  ],
});
```

### [3] Verify (read-only checklist, ✓/✗ per line)
- v1.0 in PREPARE_FOR_SUBMISSION; `GET .../relationships/build` → build attached? then `GET /v1/builds/{id}` for its version number.
- `contentRightsDeclaration === "DOES_NOT_USE_THIRD_PARTY_CONTENT"`.
- priceSchedule relationship present.
- Screenshot sets: `GET /v1/appStoreVersions/{id}/appStoreVersionLocalizations` → en-US → `GET /v1/appStoreVersionLocalizations/{locId}/appScreenshotSets?limit=50` (pass if ≥1 set), then per set `GET /v1/appScreenshotSets/{id}/appScreenshots?limit=20` printed as `- {screenshotDisplayType}: {n} shots`.
- appInfo (PREPARE_FOR_SUBMISSION or first) → `GET /v1/ageRatingDeclarations/{appInfoId}` present.

Final line: `Next: review state in ASC web UI; if everything looks good, submit via scripts/asc-submit-for-review.mjs.`

---

## 6. `scripts/asc-upload-screenshots.mjs` — screenshot upload

**Invocation:** `node scripts/asc-upload-screenshots.mjs`. Idempotent: skips a display-type set that already has ≥ FILES.length (4) screenshots.

### Inputs (exact paths & required dimensions)

`SHOTS_DIR = <repo>/ios/assets/screenshots`

| displayType | dir | expected W×H | device class |
|---|---|---|---|
| `APP_IPHONE_67` | `6.9/` | **1290×2796** | 6.9" (15/16 Pro Max) — uploaded under 67 because "Apple's ASC API enum has not added APP_IPHONE_69 yet" |
| `APP_IPHONE_65` | `6.5/` | **1242×2688** | 6.5" |

`FILES = ["01-question.png", "02-wordcloud.png", "03-leaderboard.png", "04-archive.png"]` (order = store display order).

PNG dimension check (verbatim — reads IHDR directly):
```js
function pngDims(filePath) {
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
```
Mismatch throws before anything is reserved: `` `${disp.dir}/${f} is ${dims.w}x${dims.h}; Apple expects ${disp.expectedW}x${disp.expectedH} for ${disp.displayType}` ``.

### Apple's 4-step upload protocol (as implemented)

1. Ensure set: `GET /v1/appStoreVersionLocalizations/{verLocId}/appScreenshotSets?limit=50`, match `attributes.screenshotDisplayType`; else `POST /v1/appScreenshotSets` `{ attributes:{ screenshotDisplayType }, relationships:{ appStoreVersionLocalization } }`.
2. Reserve: `POST /v1/appScreenshots` `{ attributes:{ fileSize, fileName }, relationships:{ appScreenshotSet } }` → response contains `attributes.uploadOperations[]`.
3. For each operation: raw `fetch(operation.url, { method: operation.method, headers: fromArray(operation.requestHeaders), body: fileBuffer.subarray(operation.offset, operation.offset + operation.length) })` — S3-style chunked PUT. Non-OK → throw `PUT chunk failed {status}`.
4. Commit: `PATCH /v1/appScreenshots/{id}` `{ attributes: { uploaded: true, sourceFileChecksum: md5hex(fileBuffer) } }` (MD5 of the whole file, hex).

Version/localization resolution identical to §1 step 0 but only `PREPARE_FOR_SUBMISSION` accepted. Final line: `Done. Verify in ASC web UI → My Apps → Relatably → 1.0 Prepare for Submission → screenshots.`

---

## 7. `scripts/asc-list-builds.mjs` — build/upload verification (read-only)

**Invocation:** `node scripts/asc-list-builds.mjs`. Purpose per header: "verifying that a Codemagic upload actually landed."

- `GET /v1/builds?filter[app]=6768082631&sort=-uploadedDate&limit=10&include=preReleaseVersion,buildBetaDetail`
- Prints per build: `build={a.version}  v={preReleaseVersion?.attributes?.version || "?"}  state={processingState}  uploaded={uploadedDate}  beta={externalBuildState||"—"}/{internalBuildState||"—"}` (buildBetaDetail resolved from `included` by relationship id).
- Non-200 → print error, exit 1.

---

## 8. `scripts/asc-setup.js` — one-shot app record creation (CommonJS)

**Invocation:** `node scripts/asc-setup.js` **from repo root** (KEY_PATH default is relative `.secrets/AuthKey_8XWLD2B2RQ.p8`). Env overrides: `ASC_KEY_PATH`, `ASC_KEY_ID`, `ASC_ISSUER_ID`.

Constants: `BUNDLE_ID="co.relatably.app"`, `APP_NAME="Relatably"`, `APP_SKU="relatably-v1"`, `PRIMARY_LOCALE="en-US"`.

Steps (each `[n/6]`-logged):
1. Sign JWT (20-min expiry, manual DER→JOSE, see §0.2).
2. Auth check `GET /v1/apps?limit=1` — exit 1 on failure.
3. `GET /v1/bundleIds?filter[identifier]=co.relatably.app&limit=200`; if missing `POST /v1/bundleIds` `{ attributes:{ identifier, name:"Relatably", platform:"IOS" } }`.
4. `POST /v1/bundleIdCapabilities` `{ attributes:{ capabilityType:"APPLE_ID_AUTH" }, relationships:{ bundleId } }` (Sign in with Apple). Treated as OK if status 409 or response matches `/already|exist|conflict/i`; other failures are WARN-and-continue.
5. `GET /v1/apps?filter[bundleId]=...`; if missing `POST /v1/apps` `{ attributes:{ bundleId, name:"Relatably", primaryLocale:"en-US", sku:"relatably-v1" }, relationships:{ bundleId } }`.
6. **Persistence:** writes `.secrets/asc-app-id.txt` with exactly:
```
ASC_APP_ID={app.id}
BUNDLE_RECORD_ID={bundle.id}
BUNDLE_ID=co.relatably.app
```

(Note: POST /v1/apps is not officially documented by Apple; the memory-note skill "asc-app-create-ui" exists because app creation usually needs the web UI — but this script attempts it via API.)

---

## 9. `scripts/asc-tf-setup.mjs` — TestFlight internal group + tester

**Invocation:** `node scripts/asc-tf-setup.mjs`. Idempotent.

Constants: `TESTER_EMAIL="levin.schwab@gmx.de"`, `TESTER_FIRST="Levin"`, `TESTER_LAST="Schwab"`, `GROUP_NAME="Founders"`.

1. `GET /v1/apps/{APP_ID}/betaGroups` → find by name; else `POST /v1/betaGroups` `{ attributes:{ name:"Founders", isInternalGroup:true, hasAccessToAllBuilds:true }, relationships:{ app } }`. Key: **internal groups with `hasAccessToAllBuilds:true` automatically receive every uploaded build — no manual attach needed.**
2. `GET /v1/betaTesters?filter[email]=...&include=betaGroups` → else `POST /v1/betaTesters` `{ attributes:{ firstName, lastName, email }, relationships:{ betaGroups:{ data:[group] } } }`. If tester exists but not in group: `POST /v1/betaGroups/{groupId}/relationships/betaTesters` `{ data:[{type:"betaTesters", id}] }`.
3. Re-invite: `POST /v1/betaTesterInvitations` `{ relationships:{ app, betaTester } }`.

---

## 10. `scripts/asc-revoke-distribution-certs-ci.mjs` — CI cert-cap workaround

**Invocation (from codemagic.yaml):** `node scripts/asc-revoke-distribution-certs-ci.mjs`
**Required env (from Codemagic `relatably-asc` integration):** `APP_STORE_CONNECT_PRIVATE_KEY` (raw .p8 with BEGIN/END), `APP_STORE_CONNECT_KEY_IDENTIFIER` (fallback: `APP_STORE_CONNECT_KEY_ID`), `APP_STORE_CONNECT_ISSUER_ID`. Missing any → error message + exit 1.

**Why it exists:** Codemagic destroys its keychain each build → private key for the existing IOS_DISTRIBUTION cert is lost → next `fetch-signing-files --create` hits Apple's 2-active-cert cap: `POST /v1/certificates returned 409: "You already have a current Distribution certificate or a pending certificate request."` Revoking all distribution certs pre-build makes builds idempotent. Safe: revocation does not affect installed TestFlight/App Store binaries.

**PEM normalization (verbatim — 3 observed Codemagic serializations of the same secret):**
```js
function normalizePem(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  // (b) literal \n -> real newline
  if (s.includes("\\n")) s = s.replace(/\\n/g, "\n");
  // (c) no BEGIN marker -> wrap as PKCS#8 PEM
  if (!s.includes("BEGIN")) {
    const b64 = s.replace(/\s+/g, "");
    s = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
  }
  return s;
}
```
Case (a) full PEM with real newlines works as-is; (b)/(c) cause `ERR_OSSL_UNSUPPORTED`. Also prints a redaction-safe diagnostic: `PEM length={n}  first={30 chars}…  last=…{30 chars}` with newlines shown as `\n`.

Flow: `GET /v1/certificates?limit=200` → filter `certificateType === "IOS_DISTRIBUTION" || "DISTRIBUTION"` → `DELETE /v1/certificates/{id}` each (OK = `r.ok || status 204`). **Soft-fail policy:** revoke errors do NOT exit non-zero, and the top-level `.catch` deliberately does NOT `process.exit(1)` — the build must proceed to the signing step ("if 0 stale certs exist, signing succeeds anyway"). Contrast: only the initial `GET /v1/certificates` listing failure exits 1.

A local twin `scripts/asc-revoke-distribution-certs.mjs` exists (reads `.secrets` key instead of env).

---

## 11. `codemagic.yaml` — the build+upload pipeline (context for build numbers on ASC)

Workflow `ios-production` ("iOS Production -> TestFlight"), `instance_type: mac_mini_m2`, `max_build_duration: 60` (minutes), integration `app_store_connect: relatably-asc`, triggers on push to `main`.

Env vars: `XCODE_WORKSPACE="Relatably.xcworkspace"`, `XCODE_SCHEME="Relatably"`, `BUNDLE_ID="co.relatably.app"`, `APP_STORE_APPLE_ID=6768082631`, `EXPO_PUBLIC_API_URL="https://relatably.vercel.app"`, `EXPO_PUBLIC_ADMOB_ENABLED="false"`, node `20.18.0`, xcode `latest`.
**Trap documented in-file:** these EXPO_PUBLIC_* vars mirror `ios/eas.json → build.production.env`; Codemagic doesn't read eas.json, and without them `ios/src/lib/api.ts` falls back to `http://localhost:3000` → "Network request failed" on device (build 25 shipped broken this way). For the SwiftUI port: **the production API base URL is `https://relatably.vercel.app`** and it must be compiled in, not defaulted to localhost.

Steps: pnpm install (pinned `pnpm@10.11.0`, `--frozen-lockfile --network-concurrency=8 --fetch-retries=3 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000`, corepack disabled) → `npx expo prebuild --platform ios --clean --no-install` → `pod install` → `node scripts/asc-revoke-distribution-certs-ci.mjs` → signing (`keychain initialize`; `openssl genrsa -out /tmp/codemagic-signing/cert_key.pem 2048`; `app-store-connect fetch-signing-files "$BUNDLE_ID" --platform IOS --type IOS_APP_STORE --certificate-key @file:/tmp/codemagic-signing/cert_key.pem --create` — the `@file:` prefix is mandatory; `keychain add-certificates`; `xcode-project use-profiles`) → build-number bump → `xcode-project build-ipa --workspace "$XCODE_WORKSPACE" --scheme "$XCODE_SCHEME" --config Release`.

**Build-number algorithm (must be preserved so CFBundleVersion keeps monotonically increasing past the RN builds):**
```sh
LATEST_BUILD_NUMBER=$(app-store-connect get-latest-build-number "$APP_STORE_APPLE_ID" 2>/dev/null || echo 0)
if [ "$LATEST_BUILD_NUMBER" -lt 23 ]; then
  LATEST_BUILD_NUMBER=23
fi
NEXT_BUILD_NUMBER=$((LATEST_BUILD_NUMBER + 1))
agvtool new-version -all "$NEXT_BUILD_NUMBER"
```
Uses `get-latest-build-number` (highest CFBundleVersion across **both** TestFlight AND App Store) — an earlier version used `get-latest-app-store-build-number`, which ignores TestFlight and produced collisions with TF build 23. Floor of 23 is belt-and-suspenders. Latest known builds from memory context: up to build 34 in review.

Publishing: `app_store_connect: { auth: integration, submit_to_testflight: true, beta_groups: [Founders] }`.

---

## 12. Read-only diagnostic scripts (endpoint catalog)

All `node scripts/<name>.mjs`, no args, no env.

- **`asc-diag.mjs`** — full state dump: `GET /v1/apps/{id}`, `/appInfos`, `/appStoreVersions?limit=10`, `/v1/builds?filter[app]&limit=10&sort=-uploadedDate`, `/v1/preReleaseVersions?filter[app]&limit=10`, `/v1/apps/{id}/appPriceSchedule`, **`/v2/appAvailabilities/{APP_ID}`** (v2 availability keyed by app id), per-version `/ageRatingDeclaration` + `/appStoreVersionLocalizations`, per-appInfo `/appInfoLocalizations` + `?include=primaryCategory,secondaryCategory`, `/v1/buildBetaDetails?filter[build.app]={id}&limit=5`. String attrs are truncated at 200 chars in output.
- **`asc-tf-state.mjs`** — per-build TF state for hardcoded `BUILD_ID 6a18304d-…`: `/v1/builds/{id}/buildBetaDetail`, `/betaAppReviewSubmission`, `/betaBuildLocalizations`, `/appEncryptionDeclaration`; app-level `/betaAppReviewDetail`, `/betaAppLocalizations`, `/betaGroups`, `/betaLicenseAgreement`; `/v1/betaTesters?limit=20`.
- **`asc-check-founders.mjs`** — group `1e278ce3-3f30-4c37-a175-c9aba7adf1a7`: `/v1/betaGroups/{gid}`, `/v1/betaGroups/{gid}/builds?sort=-uploadedDate&limit=10`, `/v1/builds?filter[app]&filter[version]=24&include=buildBetaDetail,betaGroups`, `/v1/builds/{bid}/buildBetaDetail`.
- **`asc-rejection-notes.mjs`** — Resolution-Center probing for `VERSION_ID e613956d…`, `BUILD_ID 71cb1b69…`, `SUBMISSION_ID 245a9f1f…`: `/v1/appStoreVersions/{v}/appStoreReviewDetail`, `/appStoreVersionSubmission`, `/v1/reviewSubmissions/{s}?include=items,appStoreVersionForReview`, `/v1/reviewSubmissions/{s}`, `/v1/reviewSubmissions/{s}/items?include=appStoreVersion,appCustomProductPageVersion,appStoreVersionExperiment,appEvent`, `/v1/appStoreVersions/{v}?include=appStoreReviewDetail,build,appStoreVersionLocalizations`, `/v1/builds/{b}/betaAppReviewSubmission`, `/buildBetaDetail`, `/v1/apps/{id}?include=appInfos`. Output truncated at 3000 chars per endpoint.
- **`asc-rejection-detail.mjs`** — similar version-centric rejection dump.
- **`asc-do.cjs` / `asc-browser-cdp.cjs` / `asc-browser-session.*`** — Playwright-over-CDP driver for ASC web UI (one op per invocation: `url|goto|snapshot|snapshot-full|click-text|click-role|click-selector|fill-selector|press|wait-text|wait-time|screenshot`), CDP at `http://localhost:9222`. NOTE: `asc-do.cjs` has a **broken Windows-machine require path** `require("C:\\Users\\levin\\node_modules\\playwright")` — dead on this Mac.

---

## 13. Persistence / stored files

| File | Shape |
|---|---|
| `.secrets/AuthKey_8XWLD2B2RQ.p8` | ASC API private key (PKCS#8 PEM), read by every local script |
| `.secrets/asc-app-id.txt` | 3 lines: `ASC_APP_ID=…`, `BUNDLE_RECORD_ID=…`, `BUNDLE_ID=co.relatably.app` (written by asc-setup.js) |
| `ios/assets/screenshots/6.9/*.png`, `ios/assets/screenshots/6.5/*.png` | screenshot sources, exact names/dims in §6 |
| `/tmp/codemagic-signing/cert_key.pem` | ephemeral CI-generated RSA-2048 signing key |

## 14. Numeric constants roll-up

| Value | Meaning | Where |
|---|---|---|
| 900 s / 1200 s | JWT expiry (mjs scripts / asc-setup.js) | §0.1 |
| 30 × 5000 ms = 150 s | cancel-poll budget | asc-wait-and-submit |
| 93 / 100 | keywords length / Apple limit | asc-fill-metadata |
| 1290×2796, 1242×2688 | screenshot dims 6.9"→APP_IPHONE_67, 6.5"→APP_IPHONE_65 | asc-upload-screenshots |
| 4 | screenshots per display set (skip threshold `existingCount >= 4`) | asc-upload-screenshots |
| 2 | Apple's active distribution-cert cap (409 trigger) | revoke scripts |
| 23 | build-number floor | codemagic.yaml |
| 2048 | RSA bits for CI cert key | codemagic.yaml |
| limits 10/20/50/200 | ASC page sizes used (versions 10, submissions 20, sets 50, pricePoints/certs/bundleIds 200) | various |
| truncation 400/600/800/1200/1500/3000 chars | error-body log slicing | various |
| exit codes 1/2/3 | see per-script sections | §2, §4 |

## 15. Red-flag summary for the 1:1 SwiftUI port

1. **Review notes are a behavioral contract**: §1.3 promises exact UI affordances and copy ("I AGREE", "DROP IT", "DELETE MY ANSWER", "YOU" tag, "..." buttons, sheet options "Hide this answer"/"Report this answer"/"Block this contributor", "Block this user"/"Report this user", ME tab gear icon far right, demo answers + demo Board on fresh install, no chat/DM anywhere, optional Sign in with Apple, in-app account deletion). The native rebuild must match or the notes must be rewritten before resubmission.
2. **Version-string gate**: submit + screenshot scripts only match `versionString === "1.0"` && `PREPARE_FOR_SUBMISSION`; fill-metadata also accepts REJECTED/METADATA_REJECTED/DEVELOPER_REJECTED. For any new version string these constants must change.
3. **Age rating**: send `ageRatingOverrideV2: "EIGHTEEN_PLUS"` only — including legacy `ageRatingOverride` in the same PATCH (even "NONE") triggers `STATE_ERROR.AGE_RATING_OVERRIDE_V1_AND_V2_NOT_ALLOWED`. Declaration id == appInfo id.
4. **Build-number continuity**: native pipeline must keep CFBundleVersion above the RN builds (≥35 by now); reuse the `get-latest-build-number` + floor pattern.
5. **CI cert dance**: any Codemagic-based native build needs the revoke-before-sign step (or a stored certificate) or it will 409.
6. **whatsNew is not settable pre-first-release**; description carries the launch copy.
7. Free pricing uses the app-scoped price-point endpoint + `"${price1}"` temp-id JSON:API pattern; top-level `/v1/appPricePoints` 404s.
8. 6.9-inch screenshots upload under `APP_IPHONE_67`.
