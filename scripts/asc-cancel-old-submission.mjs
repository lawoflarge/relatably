// One-off: cancel the old rejected reviewSubmission so v1.0 can be re-submitted.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";

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

const token = makeToken();
const OLD = "1b1cbb00-b663-4bef-a75d-739fcb59d34b"; // build-34 rejection (2.1a), canceled for the build-35 resubmit

async function call(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  console.log(`${method} ${p} -> ${r.status}`);
  console.log(t.slice(0, 1200));
  console.log("---");
  return { status: r.status, body: t };
}

// Try a series of plausible cancellation routes; ASC undocumented but the
// modern API typically uses /actions/cancel or a PATCH with cancelled=true.
await call("POST", `/v1/reviewSubmissions/${OLD}/actions/cancel`, {
  data: { type: "reviewSubmissions", id: OLD },
});

// Try PATCH with state attribute / cancelled
await call("PATCH", `/v1/reviewSubmissions/${OLD}`, {
  data: { type: "reviewSubmissions", id: OLD, attributes: { canceled: true } },
});

// Look at the appStoreVersionSubmission relationship (legacy singular form)
await call("GET", `/v1/appStoreVersions/e613956d-da8b-4fc3-8b01-c5a69ed84f15/relationships/appStoreVersionSubmission`, null);
