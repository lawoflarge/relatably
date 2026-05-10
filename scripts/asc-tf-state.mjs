// TestFlight state check for build 6a18304d
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";
const BUILD_ID = "6a18304d-4068-43f9-854a-2e851a245297";

function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
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
async function api(p, opts = {}) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}
function show(label, res) {
  console.log(`\n=== ${label} (HTTP ${res.status}) ===`);
  console.log(JSON.stringify(res.body, null, 2));
}

(async () => {
  show("Build betaDetail", await api(`/v1/builds/${BUILD_ID}/buildBetaDetail`));
  show("Build betaAppReviewSubmission", await api(`/v1/builds/${BUILD_ID}/betaAppReviewSubmission`));
  show("Build betaBuildLocalizations", await api(`/v1/builds/${BUILD_ID}/betaBuildLocalizations`));
  show("Build appEncryptionDeclaration", await api(`/v1/builds/${BUILD_ID}/appEncryptionDeclaration`));

  show("App betaAppReviewDetail", await api(`/v1/apps/${APP_ID}/betaAppReviewDetail`));
  show("App betaAppLocalizations", await api(`/v1/apps/${APP_ID}/betaAppLocalizations`));
  show("App betaGroups", await api(`/v1/apps/${APP_ID}/betaGroups`));
  show("App betaLicenseAgreement", await api(`/v1/apps/${APP_ID}/betaLicenseAgreement`));

  show("Beta testers (all in team)", await api(`/v1/betaTesters?limit=20`));
})().catch(e => { console.error(e); process.exit(1); });
