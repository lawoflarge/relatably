// Pull rejection messages from ASC Resolution Center.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";
const VERSION_ID = "e613956d-da8b-4fc3-8b01-c5a69ed84f15";
const BUILD_ID = "71cb1b69-1d4e-4504-9ddb-2b5bd571c7c2";
const SUBMISSION_ID = "245a9f1f-e626-4232-9908-81e290f7afa4";

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
const token = makeToken();

async function api(p) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : {} };
}

const endpoints = [
  `/v1/appStoreVersions/${VERSION_ID}/appStoreReviewDetail`,
  `/v1/appStoreVersions/${VERSION_ID}/appStoreVersionSubmission`,
  `/v1/reviewSubmissions/${SUBMISSION_ID}?include=items,appStoreVersionForReview`,
  `/v1/reviewSubmissions/${SUBMISSION_ID}`,
  `/v1/reviewSubmissions/${SUBMISSION_ID}/items?include=appStoreVersion,appCustomProductPageVersion,appStoreVersionExperiment,appEvent`,
  // App Store Version messages from review (newer endpoint)
  `/v1/appStoreVersions/${VERSION_ID}?include=appStoreReviewDetail,build,appStoreVersionLocalizations`,
  // Beta detail
  `/v1/builds/${BUILD_ID}/betaAppReviewSubmission`,
  `/v1/builds/${BUILD_ID}/buildBetaDetail`,
  // App-level customer reviews
  `/v1/apps/${APP_ID}?include=appInfos`,
];

for (const ep of endpoints) {
  console.log(`\n=== ${ep} ===`);
  const r = await api(ep);
  console.log("status:", r.status);
  console.log(JSON.stringify(r.body, null, 2).slice(0, 3000));
}
