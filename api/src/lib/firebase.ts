import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import * as path from "node:path";
import * as fs from "node:fs";

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID env var is required");
  }

  // When the FIRESTORE_EMULATOR_HOST env var is set the Admin SDK auto-routes
  // to the emulator and does not need real credentials.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    app = initializeApp({ projectId });
    return app;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH must be set when not running against the emulator",
    );
  }

  const absolute = path.resolve(serviceAccountPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`service-account JSON not found at ${absolute}`);
  }
  const credentials = JSON.parse(fs.readFileSync(absolute, "utf-8"));
  app = initializeApp({ credential: cert(credentials), projectId });
  return app;
}

export const adminFirestore: Firestore = getFirestore(getApp());
export const adminAuth: Auth = getAuth(getApp());
