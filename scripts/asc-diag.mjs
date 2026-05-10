// ASC API diagnostic — queries the app's current state to identify what's
// blocking binary acceptance. Pure read-only.
//
// Usage: node scripts/asc-diag.mjs
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

async function api(pathSuffix) {
  const url = `https://api.appstoreconnect.apple.com${pathSuffix}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

function summarize(label, res) {
  console.log(`\n=== ${label} (HTTP ${res.status}) ===`);
  if (res.status >= 400) {
    console.log(JSON.stringify(res.body, null, 2));
    return;
  }
  if (res.body && res.body.data) {
    const arr = Array.isArray(res.body.data) ? res.body.data : [res.body.data];
    for (const item of arr) {
      const { type, id, attributes, relationships } = item;
      console.log(`- ${type} ${id}`);
      if (attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          if (v == null) continue;
          if (typeof v === "string" && v.length > 200) {
            console.log(`    ${k}: ${v.slice(0, 200)}…`);
          } else {
            console.log(`    ${k}: ${JSON.stringify(v)}`);
          }
        }
      }
      if (relationships) {
        const relKeys = Object.keys(relationships).filter(k => relationships[k]?.data);
        if (relKeys.length) console.log(`    rels: ${relKeys.join(", ")}`);
      }
    }
  } else {
    console.log(JSON.stringify(res.body, null, 2));
  }
}

(async () => {
  console.log(`Token issued. App ID: ${APP_ID}`);

  summarize("App", await api(`/v1/apps/${APP_ID}`));
  summarize("App Infos", await api(`/v1/apps/${APP_ID}/appInfos`));

  // App store versions (drafts, in review, ready, etc.)
  const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  summarize("App Store Versions", versions);

  // Builds — has the .ipa actually been ingested?
  summarize("Builds", await api(`/v1/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`));

  // Pre-release versions (TestFlight tracks)
  summarize("Pre-Release Versions", await api(`/v1/preReleaseVersions?filter[app]=${APP_ID}&limit=10`));

  // Pricing
  summarize("App Price Schedule", await api(`/v1/apps/${APP_ID}/appPriceSchedule`));

  // App Availability v2 (replaces availability/v1)
  summarize("App Availability v2", await api(`/v2/appAvailabilities/${APP_ID}`));

  // Age Rating Declaration (per app info)
  if (versions.body?.data?.length) {
    for (const v of versions.body.data.slice(0, 2)) {
      summarize(`Age Rating Declaration (version ${v.id})`, await api(`/v1/appStoreVersions/${v.id}/ageRatingDeclaration`));
      summarize(`Localizations (version ${v.id})`, await api(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations`));
    }
  }

  // Drill into the app info to see localized name/subtitle/privacy URL
  const infos = await api(`/v1/apps/${APP_ID}/appInfos`);
  if (infos.body?.data?.length) {
    for (const info of infos.body.data.slice(0, 2)) {
      summarize(`AppInfo ${info.id} localizations`, await api(`/v1/appInfos/${info.id}/appInfoLocalizations`));
      summarize(`AppInfo ${info.id} categories`, await api(`/v1/appInfos/${info.id}?include=primaryCategory,secondaryCategory`));
    }
  }

  // Check submissions (failed/pending) — recent EAS submits would land here
  summarize("Build submissions (TestFlight/AppStore)", await api(`/v1/buildBetaDetails?filter[build.app]=${APP_ID}&limit=5`));
})().catch(e => { console.error("Fatal:", e); process.exit(1); });
