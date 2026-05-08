import { initializeApp, getApps, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let app: App | undefined;

export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  // In Cloud Functions runtime + emulator, Application Default Credentials Just Work.
  app = initializeApp({ credential: applicationDefault() });
  return app;
}

export function db(): Firestore {
  return getFirestore(getAdminApp());
}

export function messaging(): Messaging {
  return getMessaging(getAdminApp());
}
