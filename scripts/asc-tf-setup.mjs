// Set up internal TestFlight: create internal beta group, add Levin as
// internal tester. Internal groups with hasAccessToAllBuilds=true
// automatically receive every uploaded build — no manual attach needed.
//
// Idempotent: safe to re-run.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.resolve(__dirname, "..", ".secrets", "AuthKey_8XWLD2B2RQ.p8");
const KEY_ID = "8XWLD2B2RQ";
const ISSUER_ID = "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const APP_ID = "6768082631";

const TESTER_EMAIL = "levin.schwab@gmx.de";
const TESTER_FIRST = "Levin";
const TESTER_LAST = "Schwab";
const GROUP_NAME = "Founders";

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
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}
function log(label, res) {
  const ok = res.status < 400;
  console.log(`${ok ? "OK " : "ERR"} ${label}: HTTP ${res.status}`);
  if (!ok) console.log(JSON.stringify(res.body, null, 2));
}

(async () => {
  // 1) Find or create internal beta group
  const groupsRes = await api(`/v1/apps/${APP_ID}/betaGroups`);
  log("List beta groups", groupsRes);
  let group = groupsRes.body?.data?.find(g => g.attributes?.name === GROUP_NAME);
  if (!group) {
    const create = await api(`/v1/betaGroups`, {
      method: "POST",
      body: {
        data: {
          type: "betaGroups",
          attributes: { name: GROUP_NAME, isInternalGroup: true, hasAccessToAllBuilds: true },
          relationships: { app: { data: { type: "apps", id: APP_ID } } },
        },
      },
    });
    log("Create internal beta group", create);
    group = create.body?.data;
  }
  if (!group) { console.error("No group, abort"); process.exit(1); }
  console.log(`   Group: ${group.id} (${group.attributes.name}, internal=${group.attributes.isInternalGroup}, allBuilds=${group.attributes.hasAccessToAllBuilds})`);

  // 2) Find or create beta tester
  const find = await api(`/v1/betaTesters?filter[email]=${encodeURIComponent(TESTER_EMAIL)}&include=betaGroups`);
  log("Lookup tester", find);
  let tester = find.body?.data?.[0];
  if (!tester) {
    const create = await api(`/v1/betaTesters`, {
      method: "POST",
      body: {
        data: {
          type: "betaTesters",
          attributes: { firstName: TESTER_FIRST, lastName: TESTER_LAST, email: TESTER_EMAIL },
          relationships: { betaGroups: { data: [{ type: "betaGroups", id: group.id }] } },
        },
      },
    });
    log("Create beta tester", create);
    tester = create.body?.data;
  } else {
    console.log(`   Tester: ${tester.id} (${tester.attributes.email})`);
    // Ensure tester is in the group
    const inGroup = (find.body?.included || []).some(inc => inc.type === "betaGroups" && inc.id === group.id);
    if (!inGroup) {
      const add = await api(`/v1/betaGroups/${group.id}/relationships/betaTesters`, {
        method: "POST",
        body: { data: [{ type: "betaTesters", id: tester.id }] },
      });
      log("Add tester to group", add);
    } else {
      console.log("   Tester already in group");
    }
  }

  // 3) Trigger invite email (re-invite)
  if (tester) {
    const invite = await api(`/v1/betaTesterInvitations`, {
      method: "POST",
      body: {
        data: {
          type: "betaTesterInvitations",
          relationships: {
            app: { data: { type: "apps", id: APP_ID } },
            betaTester: { data: { type: "betaTesters", id: tester.id } },
          },
        },
      },
    });
    log("Send TestFlight invite email", invite);
  }

  console.log("\nIf invite returned 201, Levin should get a TestFlight email at " + TESTER_EMAIL + " within ~1 min.");
  console.log("Alternative: open TestFlight app on iPhone, sign in as " + TESTER_EMAIL + ", build appears under 'Internal Testing' / 'Available Apps'.");
})().catch(e => { console.error(e); process.exit(1); });
