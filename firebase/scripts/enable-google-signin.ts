/**
 * Enables Google sign-in in Firebase Authentication.
 *
 * Identity Platform Admin API supports `defaultSupportedIdpConfigs` for the
 * built-in Google provider. POST creates the config (enabled by default for
 * the project's auto-provisioned OAuth client); subsequent PATCH toggles
 * `enabled`. Idempotent: if the config already exists, this script just
 * confirms it's enabled.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=relatably-prod \
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json \
 *     pnpm tsx enable-google-signin.ts
 */
import { GoogleAuth } from "google-auth-library";
import * as fs from "node:fs";
import * as path from "node:path";

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is required");
  }
  const credentials = JSON.parse(
    fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"),
  );

  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const accessToken = (await auth.getAccessToken()) as string;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const baseUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs`;
  const configUrl = `${baseUrl}/google.com`;

  // Check if Google IDP config already exists
  const getResp = await fetch(configUrl, { headers });
  if (getResp.ok) {
    const cfg = (await getResp.json()) as { enabled?: boolean };
    if (cfg.enabled) {
      console.log("google.com IDP already enabled. Nothing to do.");
      return;
    }
    // Exists but disabled. PATCH to enable.
    const patchResp = await fetch(`${configUrl}?updateMask=enabled`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: true }),
    });
    if (!patchResp.ok) {
      throw new Error(`PATCH failed: ${patchResp.status} ${await patchResp.text()}`);
    }
    console.log("google.com IDP enabled (was previously disabled).");
    return;
  }
  if (getResp.status !== 404) {
    throw new Error(`GET failed: ${getResp.status} ${await getResp.text()}`);
  }

  // 404 means config doesn't exist yet. Create it via POST.
  const createResp = await fetch(`${baseUrl}?idpId=google.com`, {
    method: "POST",
    headers,
    body: JSON.stringify({ enabled: true }),
  });
  if (!createResp.ok) {
    throw new Error(`POST failed: ${createResp.status} ${await createResp.text()}`);
  }
  console.log("google.com IDP created and enabled.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
