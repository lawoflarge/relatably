/**
 * Seeds Firebase Remote Config with the three Phase 6 kill-switches.
 * Idempotent: if a parameter already exists, its defaultValue is overwritten.
 *
 * Usage (production):
 *   FIREBASE_PROJECT_ID=relatably-prod \
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json \
 *     pnpm tsx firebase/scripts/seed-remote-config.ts
 *
 * Reads the current template, merges the three parameters, validates
 * (etag-protected), and publishes. The api/ reads these keys via
 * `getKillSwitch` (api/src/lib/remoteConfig.ts) with a 5-min cache.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getRemoteConfig } from "firebase-admin/remote-config";
import * as fs from "node:fs";
import * as path from "node:path";

interface KillSwitchParam {
  type: "BOOLEAN" | "NUMBER";
  defaultValue: string;
  description: string;
}

const KILL_SWITCHES: Record<string, KillSwitchParam> = {
  drop_enabled: {
    type: "BOOLEAN",
    defaultValue: "true",
    description:
      "When false, /api/cron/trigger-drop returns immediately. Use to pause all daily drops without redeploy.",
  },
  fanout_enabled: {
    type: "BOOLEAN",
    defaultValue: "true",
    description:
      "When false, FCM push fanout is skipped during drops. Use to silence pushes (e.g. during testing) without halting the drop itself.",
  },
  submit_rate_limit_per_min: {
    type: "NUMBER",
    defaultValue: "10",
    description:
      "Per-IP submit limit per minute (api/src/lib/ratelimit.ts). Set to 0 for full submit halt.",
  },
};

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH is required (production credentials needed for Remote Config publish)",
    );
  }
  const credentials = JSON.parse(
    fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"),
  );
  initializeApp({ credential: cert(credentials), projectId });

  const rc = getRemoteConfig();
  const template = await rc.getTemplate();

  if (!template.parameters) template.parameters = {};
  for (const [key, spec] of Object.entries(KILL_SWITCHES)) {
    template.parameters[key] = {
      defaultValue: { value: spec.defaultValue },
      description: spec.description,
      valueType: spec.type,
    };
    console.log(`set ${key} = ${spec.defaultValue} (${spec.type})`);
  }

  const validated = await rc.validateTemplate(template);
  const published = await rc.publishTemplate(validated);
  console.log(
    `published Remote Config template version ${published.version?.versionNumber}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
