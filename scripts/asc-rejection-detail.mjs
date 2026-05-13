// Pull the full rejection / invalid-binary detail from ASC for v1.0.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";

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

console.log("=== App Store Versions ===");
const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
if (versions.status !== 200) {
  console.error("ERR versions:", versions.status, JSON.stringify(versions.body));
  process.exit(1);
}
for (const v of versions.body.data) {
  const a = v.attributes || {};
  console.log(`  id=${v.id} v=${a.versionString} state=${a.appStoreState} platform=${a.platform} created=${a.createdDate}`);
}

const v1 = versions.body.data.find(v => v.attributes.versionString === "1.0");
if (!v1) {
  console.log("\nNo v1.0 found");
  process.exit(0);
}

console.log(`\n=== Build attached to v1.0 (${v1.id}) ===`);
const buildRel = await api(`/v1/appStoreVersions/${v1.id}/build`);
console.log(JSON.stringify(buildRel.body, null, 2));

const buildId = buildRel.body.data?.id;

console.log(`\n=== Latest builds (filterable) ===`);
const builds = await api(`/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=5`);
for (const b of builds.body.data) {
  const a = b.attributes || {};
  console.log(`  build=${a.version} state=${a.processingState} usesNonExempt=${a.usesNonExemptEncryption} expired=${a.expired} uploaded=${a.uploadedDate}`);
}

if (buildId) {
  console.log(`\n=== Build ${buildId} full attrs ===`);
  const bd = await api(`/v1/builds/${buildId}`);
  console.log(JSON.stringify(bd.body.data?.attributes, null, 2));
}

console.log(`\n=== Review Submissions ===`);
const subs = await api(`/v1/reviewSubmissions?filter[app]=${APP_ID}&limit=10`);
for (const s of subs.body.data || []) {
  console.log(`  id=${s.id} state=${s.attributes.state} platform=${s.attributes.platform} submitted=${s.attributes.submittedDate}`);
}
const latestSub = (subs.body.data || []).sort((a, b) => (b.attributes.submittedDate || "").localeCompare(a.attributes.submittedDate || ""))[0];
if (latestSub) {
  console.log(`\n=== Latest submission ${latestSub.id} items ===`);
  const items = await api(`/v1/reviewSubmissions/${latestSub.id}/items?include=appStoreVersion`);
  console.log(JSON.stringify(items.body, null, 2));
}

console.log(`\n=== App Store Review Submissions (v2 ?) — try app reviews ===`);
const ar = await api(`/v1/apps/${APP_ID}/appStoreVersionLocalizations?limit=2`);
console.log("localizations status=", ar.status);

console.log(`\n=== App Store Version submissions (rejection notes) ===`);
const asvSub = await api(`/v1/appStoreVersionSubmissions?filter[appStoreVersion]=${v1.id}`);
console.log(JSON.stringify(asvSub.body, null, 2));
