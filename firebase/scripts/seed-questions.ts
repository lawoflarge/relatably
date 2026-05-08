/**
 * Admin script to seed curated questions into Firestore as 'scheduled' status.
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_PROJECT_ID=relatably-prod \
 *     pnpm seed:questions
 *
 * Each question is created with no scheduled_drop_at; the nightly
 * prepareNextDrop function picks a random drop time on its turn.
 */
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

const QUESTIONS: string[] = [
  "what's the most overrated tourist trap?",
  "what's the worst breakup line of all time?",
  "what's a movie everyone loves that you hate?",
];

async function main(): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId });
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_PATH is required when not running against the emulator",
      );
    }
    const credentials = JSON.parse(
      fs.readFileSync(path.resolve(serviceAccountPath), "utf-8"),
    );
    initializeApp({ credential: cert(credentials), projectId });
  }

  const db = getFirestore();
  for (const text of QUESTIONS) {
    const ref = db.collection("questions").doc();
    await ref.set({
      text,
      status: "scheduled",
      source: "curated",
      created_at: FieldValue.serverTimestamp(),
      // scheduled_drop_at intentionally omitted — prepareNextDrop fills it in.
    });
    console.log(`seeded: ${ref.id} — "${text}"`);
  }
  console.log(`done. seeded ${QUESTIONS.length} scheduled questions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
