// Submits Relatably v1.0 for App Store Review via the modern
// /v1/reviewSubmissions API. Three-step flow:
//
//   1. POST /v1/reviewSubmissions     { app, platform: IOS }
//      -> creates a "draft" submission, state = "READY_FOR_REVIEW"-ish
//   2. POST /v1/reviewSubmissionItems { reviewSubmission, appStoreVersion }
//      -> adds the v1.0 appStoreVersion as the item being reviewed
//   3. POST /v1/reviewSubmissions/{id}/actions/submit
//      -> actually submits to Apple. State -> "WAITING_FOR_REVIEW".
//
// Apple may reject step 3 with specific errors:
//   - App Privacy not set                      -> need web-UI fill
//   - Demo account required (we have anonymous flow + reviewer notes)
//   - Build still processing                   -> wait + retry
//   - Pricing not configured                   -> shouldn't happen, we set it
//
// Usage: node scripts/asc-submit-for-review.mjs
//        node scripts/asc-submit-for-review.mjs --dry-run

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";

const DRY = process.argv.includes("--dry-run");

function b64url(b) { return Buffer.from(b).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
function makeToken() {
  const h = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const n = Math.floor(Date.now() / 1000);
  const p = { iss: ISSUER_ID, iat: n, exp: n + 60 * 15, aud: "appstoreconnect-v1" };
  const si = `${b64url(JSON.stringify(h))}.${b64url(JSON.stringify(p))}`;
  const k = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const s = crypto.sign("SHA256", Buffer.from(si), { key: k, dsaEncoding: "ieee-p1363" });
  return `${si}.${b64url(s)}`;
}
const token = makeToken();

async function api(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  return { status: r.status, ok: r.ok, body: j };
}

(async () => {
  console.log(`Submit-for-Review — App ${APP_ID}${DRY ? " (DRY RUN)" : ""}\n`);

  // 0. Resolve v1.0 appStoreVersion id
  const versions = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const version = versions.body.data?.find(
    (v) => v.attributes?.versionString === "1.0" && v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION",
  );
  if (!version) {
    console.error("No editable v1.0 appStoreVersion. State may have already changed.");
    process.exit(1);
  }
  console.log(`appStoreVersion: ${version.id}  state=${version.attributes.appStoreState}`);

  // 1. Find or create a reviewSubmission for the app
  const existing = await api("GET", `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=IOS&limit=10`);
  // Look for a submission that's still "open" (not submitted yet)
  const draft = existing.body.data?.find((rs) => {
    const s = rs.attributes?.state;
    return s === "READY_FOR_REVIEW" || s === "UNRESOLVED_ISSUES" || s === "IN_REVIEW"
      ? false
      : s === undefined || s === null || s === "DRAFT" || s === "READY_FOR_SUBMISSION";
  });

  let submissionId;
  if (draft) {
    submissionId = draft.id;
    console.log(`Using existing draft reviewSubmission: ${submissionId} (state=${draft.attributes?.state})`);
  } else {
    if (DRY) {
      console.log("[dry-run] would POST /v1/reviewSubmissions");
    } else {
      const r = await api("POST", "/v1/reviewSubmissions", {
        data: {
          type: "reviewSubmissions",
          attributes: { platform: "IOS" },
          relationships: { app: { data: { type: "apps", id: APP_ID } } },
        },
      });
      if (!r.ok) {
        console.error(`POST reviewSubmissions -> ${r.status}`);
        console.error(JSON.stringify(r.body, null, 2).slice(0, 800));
        process.exit(1);
      }
      submissionId = r.body.data.id;
      console.log(`Created reviewSubmission: ${submissionId}`);
    }
  }

  if (!submissionId) {
    console.log("(dry-run) Stopping here — no submission ID to operate on.");
    return;
  }

  // 2. Find or add the appStoreVersion as an item in the submission
  const items = await api("GET", `/v1/reviewSubmissions/${submissionId}/items?limit=10`);
  const alreadyItem = (items.body.data || []).some(
    (it) => it.relationships?.appStoreVersion?.data?.id === version.id,
  );

  if (alreadyItem) {
    console.log(`appStoreVersion already attached as item`);
  } else if (DRY) {
    console.log("[dry-run] would POST /v1/reviewSubmissionItems");
  } else {
    const r = await api("POST", "/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submissionId } },
          appStoreVersion: { data: { type: "appStoreVersions", id: version.id } },
        },
      },
    });
    if (!r.ok) {
      console.error(`POST reviewSubmissionItems -> ${r.status}`);
      console.error(JSON.stringify(r.body, null, 2).slice(0, 800));
      process.exit(1);
    }
    console.log(`Added reviewSubmissionItem: ${r.body.data.id}`);
  }

  // 3. Actually submit the reviewSubmission
  if (DRY) {
    console.log("[dry-run] would PATCH /v1/reviewSubmissions/{id} { submitted: true }");
    return;
  }

  // Apple's submit semantics: PATCH the reviewSubmission with
  // attributes.submitted = true (older form) OR POST to an actions endpoint.
  // The current docs (2024+) show PATCH /v1/reviewSubmissions/{id} works.
  const submit = await api("PATCH", `/v1/reviewSubmissions/${submissionId}`, {
    data: {
      type: "reviewSubmissions",
      id: submissionId,
      attributes: { submitted: true },
    },
  });
  if (!submit.ok) {
    console.error(`\n=== SUBMIT FAILED ${submit.status} ===`);
    console.error(JSON.stringify(submit.body, null, 2).slice(0, 1500));
    console.error("\nMost common causes:");
    console.error("  - App Privacy questionnaire not filled (web-UI only)");
    console.error("  - Build still processing in Apple's pipeline (rare)");
    console.error("  - Export Compliance not answered");
    process.exit(2);
  }

  console.log("\n✓ SUBMITTED FOR REVIEW");
  console.log(`  reviewSubmission: ${submissionId}`);
  console.log(`  new state: ${submit.body.data?.attributes?.state}`);
  console.log("\nApple Review typically takes 24–48h. Status visible at:");
  console.log(`  https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/ios/version/inflight`);
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
