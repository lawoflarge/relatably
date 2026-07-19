#!/usr/bin/env node
/**
 * Re-add Relatably to sale: create an appAvailabilities V2 record available in all territories.
 * Self-contained (ES256 JWT via node:crypto, no deps). Mirrors the NetGuard fix (2026-06-01),
 * where an approved/READY_FOR_SALE app had NO appAvailabilities record (= removed from sale)
 * and GET /v1/apps/{id}/appAvailabilityV2 404'd with "no resource of type appAvailabilities".
 *
 * Run:  node scripts/readd-to-sale.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP = "6768082631"; // Relatably
const KEY_ID = process.env.ASC_KEY_ID || "8XWLD2B2RQ";
const ISSUER_ID = process.env.ASC_ISSUER_ID || "538cb0d4-b8c6-4bc7-8b59-75da5d2b9411";
const KEY_PATH = process.env.ASC_KEY_PATH ||
  path.join(process.env.HOME, ".appstoreconnect/private_keys", `AuthKey_${KEY_ID}.p8`);

const b64url = (i) =>
  Buffer.from(i).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function makeJWT() {
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 19 * 60, aud: "appstoreconnect-v1" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign({ key: fs.readFileSync(KEY_PATH), dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

async function asc(pathname, opts = {}) {
  const url = pathname.startsWith("http") ? pathname : `https://api.appstoreconnect.apple.com${pathname}`;
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${makeJWT()}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) { const e = new Error(`ASC ${res.status} ${opts.method || "GET"} ${pathname}`); e.status = res.status; e.body = json; throw e; }
  return json;
}

const terr = await asc(`/v1/territories?limit=200`);
const ids = terr.data.map((t) => t.id);
console.log(`Building availability for ${ids.length} territories...`);

const body = {
  data: {
    type: "appAvailabilities",
    attributes: { availableInNewTerritories: true },
    relationships: {
      app: { data: { type: "apps", id: APP } },
      territoryAvailabilities: {
        data: ids.map((id) => ({ type: "territoryAvailabilities", id: `\${${id}}` })),
      },
    },
  },
  included: ids.map((id) => ({
    type: "territoryAvailabilities",
    id: `\${${id}}`,
    attributes: { available: true },
    relationships: { territory: { data: { type: "territories", id } } },
  })),
};

const res = await asc(`/v2/appAvailabilities`, { method: "POST", body: JSON.stringify(body) });
console.log("CREATED availability id:", res.data?.id);
console.log("availableInNewTerritories:", res.data?.attributes?.availableInNewTerritories);
