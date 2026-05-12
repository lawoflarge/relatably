// Diagnostic: what builds are actually attached to the Founders group
// in TestFlight, and what's the latest build's beta detail.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";
const FOUNDERS_GROUP_ID = "1e278ce3-3f30-4c37-a175-c9aba7adf1a7";

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
async function api(pathSuffix) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${pathSuffix}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : {} };
}

console.log("=== Founders group info ===");
const grp = await api(`/v1/betaGroups/${FOUNDERS_GROUP_ID}`);
console.log(JSON.stringify(grp.body.data?.attributes, null, 2));

console.log("\n=== Builds attached to Founders ===");
const grpBuilds = await api(`/v1/betaGroups/${FOUNDERS_GROUP_ID}/builds?sort=-uploadedDate&limit=10`);
const attached = grpBuilds.body.data || [];
console.log(`Total attached: ${attached.length}`);
for (const b of attached) {
  console.log(`  - id=${b.id}  version=${b.attributes?.version}  state=${b.attributes?.processingState}  uploaded=${b.attributes?.uploadedDate}`);
}

console.log("\n=== Build 24 details ===");
const b24list = await api(`/v1/builds?filter[app]=${APP_ID}&filter[version]=24&include=buildBetaDetail,betaGroups`);
const b24 = b24list.body.data?.[0];
if (!b24) { console.log("Build 24 NOT found via filter[version]=24"); process.exit(0); }
console.log(`Build 24 id: ${b24.id}`);
console.log("Attributes:", JSON.stringify(b24.attributes, null, 2));

const betaGroupsRel = b24.relationships?.betaGroups?.data || [];
console.log(`\nBeta groups directly attached to build 24: ${betaGroupsRel.length}`);
for (const g of betaGroupsRel) console.log(`  - ${g.id}`);

console.log("\n=== Build 24 beta detail (via separate endpoint) ===");
const detail = await api(`/v1/builds/${b24.id}/buildBetaDetail`);
console.log(JSON.stringify(detail.body.data?.attributes, null, 2));
