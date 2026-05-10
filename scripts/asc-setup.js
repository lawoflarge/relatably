/**
 * One-shot App Store Connect API setup for Relatably.
 * No deps — pure node:crypto.
 *
 * Steps:
 *   1. Sign a JWT with the ASC API key (ES256).
 *   2. Verify auth (GET /v1/apps).
 *   3. Register bundle id `co.relatably.app` (skip if exists).
 *   4. Enable Sign in with Apple capability.
 *   5. Create the ASC app record (skip if exists).
 *   6. Print + save the ASC App ID.
 */
const fs = require("fs");
const crypto = require("crypto");

const KEY_PATH = process.env.ASC_KEY_PATH || ".secrets/AuthKey_8XWLD2B2RQ.p8";
const KEY_ID = process.env.ASC_KEY_ID || "8XWLD2B2RQ";
const ISSUER_ID = process.env.ASC_ISSUER_ID || "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";

const BUNDLE_ID = "co.relatably.app";
const APP_NAME = "Relatably";
const APP_SKU = "relatably-v1";
const PRIMARY_LOCALE = "en-US";

const API = "https://api.appstoreconnect.apple.com";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

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

function signToken() {
  const privateKey = fs.readFileSync(KEY_PATH, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 20 * 60,
    aud: "appstoreconnect-v1",
  };
  const headerB = b64url(JSON.stringify(header));
  const payloadB = b64url(JSON.stringify(payload));
  const signingInput = `${headerB}.${payloadB}`;

  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  const derSig = signer.sign(privateKey);
  const joseSig = derToJose(derSig);
  return `${signingInput}.${b64url(joseSig)}`;
}

async function call(method, urlPath, token, body) {
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`[FATAL] .p8 not found at ${KEY_PATH}`);
    process.exit(1);
  }
  console.log("[1/6] Signing JWT (ES256, native crypto)...");
  const token = signToken();
  console.log("      JWT len:", token.length);

  console.log("[2/6] GET /v1/apps?limit=1 (auth check)...");
  const ping = await call("GET", "/v1/apps?limit=1", token);
  if (!ping.ok) {
    console.error("      AUTH FAILED:", ping.status);
    console.error("      ", JSON.stringify(ping.data, null, 2));
    process.exit(1);
  }
  console.log(`      OK (${ping.data.data?.length ?? 0} app visible)`);

  console.log(`[3/6] Looking up bundle ${BUNDLE_ID}...`);
  const lookup = await call(
    "GET",
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=200`,
    token
  );
  if (!lookup.ok) {
    console.error("      Lookup FAILED:", lookup.status, JSON.stringify(lookup.data));
    process.exit(1);
  }
  let bundle = (lookup.data.data || []).find(
    (b) => b.attributes?.identifier === BUNDLE_ID
  );
  if (bundle) {
    console.log(`      Exists: ${bundle.id}`);
  } else {
    console.log("      Creating...");
    const created = await call("POST", "/v1/bundleIds", token, {
      data: {
        type: "bundleIds",
        attributes: {
          identifier: BUNDLE_ID,
          name: "Relatably",
          platform: "IOS",
        },
      },
    });
    if (!created.ok) {
      console.error("      Bundle CREATE FAILED:", created.status, JSON.stringify(created.data, null, 2));
      process.exit(1);
    }
    bundle = created.data.data;
    console.log(`      Created: ${bundle.id}`);
  }

  console.log("[4/6] Sign in with Apple capability...");
  const cap = await call("POST", "/v1/bundleIdCapabilities", token, {
    data: {
      type: "bundleIdCapabilities",
      attributes: { capabilityType: "APPLE_ID_AUTH" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id: bundle.id } },
      },
    },
  });
  if (cap.ok) {
    console.log("      Enabled.");
  } else if (cap.status === 409 || JSON.stringify(cap.data).match(/already|exist|conflict/i)) {
    console.log("      Already enabled.");
  } else {
    console.warn("      WARN:", cap.status, JSON.stringify(cap.data));
    console.warn("      Continuing — verify manually if Apple later complains.");
  }

  console.log("[5/6] Looking up ASC app record...");
  const appLookup = await call(
    "GET",
    `/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}&limit=10`,
    token
  );
  if (!appLookup.ok) {
    console.error("      App lookup FAILED:", appLookup.status, JSON.stringify(appLookup.data));
    process.exit(1);
  }
  let app = (appLookup.data.data || []).find(
    (a) => a.attributes?.bundleId === BUNDLE_ID
  );
  if (app) {
    console.log(`      Exists: id=${app.id} name="${app.attributes.name}"`);
  } else {
    console.log("      Creating ASC app record...");
    const createApp = await call("POST", "/v1/apps", token, {
      data: {
        type: "apps",
        attributes: {
          bundleId: BUNDLE_ID,
          name: APP_NAME,
          primaryLocale: PRIMARY_LOCALE,
          sku: APP_SKU,
        },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundle.id } },
        },
      },
    });
    if (!createApp.ok) {
      console.error("      App CREATE FAILED:", createApp.status, JSON.stringify(createApp.data, null, 2));
      process.exit(1);
    }
    app = createApp.data.data;
    console.log(`      Created: id=${app.id}`);
  }

  console.log("[6/6] DONE.");
  console.log("");
  console.log("=========================");
  console.log("ASC App ID:", app.id);
  console.log("Bundle ID :", BUNDLE_ID);
  console.log("=========================");

  fs.writeFileSync(
    ".secrets/asc-app-id.txt",
    `ASC_APP_ID=${app.id}\nBUNDLE_RECORD_ID=${bundle.id}\nBUNDLE_ID=${BUNDLE_ID}\n`
  );
  console.log("(Saved to .secrets/asc-app-id.txt)");
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
