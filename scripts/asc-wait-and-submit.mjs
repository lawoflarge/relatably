// Poll until old reviewSubmission state leaves CANCELING, then add v1.0 to the
// existing empty draft and submit it.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";
const OLD_SUB = "245a9f1f-e626-4232-9908-81e290f7afa4";
const NEW_SUB = "4679c135-9e81-49cf-8d67-01320dc67988";
const VERSION_ID = "e613956d-da8b-4fc3-8b01-c5a69ed84f15";

function b64u(b) { return Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function makeToken() {
  const n = Math.floor(Date.now() / 1000);
  const h = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const p = { iss: ISSUER, iat: n, exp: n + 900, aud: "appstoreconnect-v1" };
  const si = `${b64u(JSON.stringify(h))}.${b64u(JSON.stringify(p))}`;
  const k = crypto.createPrivateKey(fs.readFileSync(KEY_PATH));
  const s = crypto.sign("SHA256", Buffer.from(si), { key: k, dsaEncoding: "ieee-p1363" });
  return `${si}.${b64u(s)}`;
}

async function api(method, p, body) {
  const token = makeToken();
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  return { status: r.status, ok: r.ok, body: j };
}

// Step 1: poll OLD submission until state != CANCELING
console.log("Polling old submission state...");
let oldState = "CANCELING";
for (let i = 0; i < 30; i++) {
  const r = await api("GET", `/v1/reviewSubmissions/${OLD_SUB}`);
  oldState = r.body.data?.attributes?.state;
  console.log(`  ${new Date().toISOString()} state=${oldState}`);
  if (oldState !== "CANCELING") break;
  await new Promise((r) => setTimeout(r, 5000));
}
if (oldState === "CANCELING") {
  console.error("Old submission still CANCELING after 150s. Aborting.");
  process.exit(1);
}

// Step 2: try to add v1.0 item to NEW submission. If still 409, the lock is
// elsewhere — bail and report.
console.log(`\nAdding v1.0 to new submission ${NEW_SUB}...`);
const addItem = await api("POST", "/v1/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: NEW_SUB } },
      appStoreVersion: { data: { type: "appStoreVersions", id: VERSION_ID } },
    },
  },
});
console.log(`  status=${addItem.status}`);
if (!addItem.ok) {
  console.error(JSON.stringify(addItem.body, null, 2).slice(0, 1200));
  process.exit(2);
}
console.log(`  itemId=${addItem.body.data.id}`);

// Step 3: PATCH submitted=true on NEW submission
console.log(`\nSubmitting reviewSubmission ${NEW_SUB}...`);
const submit = await api("PATCH", `/v1/reviewSubmissions/${NEW_SUB}`, {
  data: { type: "reviewSubmissions", id: NEW_SUB, attributes: { submitted: true } },
});
console.log(`  status=${submit.status}`);
if (!submit.ok) {
  console.error(JSON.stringify(submit.body, null, 2).slice(0, 1500));
  process.exit(3);
}
console.log(`\n✓ SUBMITTED. state=${submit.body.data?.attributes?.state}`);
console.log(`  Apple SLA 24-48h. Decision email -> levin.schwab@gmx.de`);
