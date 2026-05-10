/**
 * Adds one or more domains to Firebase Authentication's authorized-domains
 * list (the gate for popup/redirect sign-in flows like Google).
 *
 * Required env:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_SERVICE_ACCOUNT_PATH
 *
 * Args (variadic): each positional argument is a domain to add.
 *   Example: pnpm tsx add-authorized-domain.ts relatably.vercel.app
 *
 * Idempotent: domains already present are silently kept.
 */
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { GoogleAuth } from "google-auth-library";
import * as fs from "node:fs";
import * as path from "node:path";

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");

  const newDomains = process.argv.slice(2).filter((s) => s.length > 0);
  if (newDomains.length === 0) {
    throw new Error("Pass at least one domain as an argument");
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is required");
  }
  const credentials = JSON.parse(
    fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"),
  );
  initializeApp({ credential: cert(credentials), projectId });

  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const accessToken = (await auth.getAccessToken()) as string;
  const baseUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const getResp = await fetch(baseUrl, { headers });
  if (!getResp.ok) {
    throw new Error(`GET config failed: ${getResp.status} ${await getResp.text()}`);
  }
  const config = (await getResp.json()) as { authorizedDomains?: string[] };
  const current = new Set(config.authorizedDomains ?? []);
  console.log(`current authorizedDomains: ${[...current].join(", ")}`);

  let added = 0;
  for (const d of newDomains) {
    if (!current.has(d)) {
      current.add(d);
      added += 1;
      console.log(`+ ${d}`);
    } else {
      console.log(`= ${d} (already present)`);
    }
  }
  if (added === 0) {
    console.log("nothing to do");
    return;
  }

  const patchUrl = `${baseUrl}?updateMask=authorizedDomains`;
  const patchResp = await fetch(patchUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ authorizedDomains: [...current] }),
  });
  if (!patchResp.ok) {
    throw new Error(`PATCH config failed: ${patchResp.status} ${await patchResp.text()}`);
  }
  console.log(`updated authorizedDomains (${added} added)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
