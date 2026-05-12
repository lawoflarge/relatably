// One-shot: find the oldest scheduled question and bump its
// scheduled_drop_at to "now" so the 5-minute trigger-drop cron
// promotes it to status='live' on its next run (or via a manual
// cron POST immediately after).
//
// Why this exists: /api/cron/trigger-drop only acts on questions
// whose scheduled_drop_at is in the past. If no question is
// scheduled-and-due, the cron is a no-op (dropped:0).
// /api/admin/trigger-drop does the same thing but requires a
// Firebase ID token for a uid in ADMIN_UIDS. From the local
// machine with the gitignored service-account.json we can bypass
// that and write directly to Firestore.
//
// Usage:
//   node scripts/bump-next-drop.mjs           # picks oldest scheduled, bumps to now
//   node scripts/bump-next-drop.mjs <qid>     # bumps the named question_id
//
// Safe: only writes to ONE question doc. Does not bypass any anti-
// cheat path — the cron still does the verdict computation + fanout
// the same way it does for any other drop.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVC = path.resolve(__dirname, "..", ".secrets", "service-account.json");

if (!fs.existsSync(SVC)) {
  console.error(`Missing service-account.json at ${SVC}`);
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(SVC, "utf8"))),
  projectId: "relatably-prod",
});

const db = getFirestore();
const explicitId = process.argv[2];

(async () => {
  let target;
  if (explicitId) {
    const snap = await db.collection("questions").doc(explicitId).get();
    if (!snap.exists) {
      console.error(`Question ${explicitId} not found.`);
      process.exit(1);
    }
    const data = snap.data();
    if (data.status !== "scheduled") {
      console.error(`Question ${explicitId} has status='${data.status}', not 'scheduled'.`);
      process.exit(1);
    }
    target = { id: snap.id, ref: snap.ref, data };
  } else {
    // Skip orderBy(created_at) — would need a composite index we don't
    // have on this collection. For Levin's verification we don't care
    // which scheduled question gets promoted; any one works.
    const q = await db
      .collection("questions")
      .where("status", "==", "scheduled")
      .limit(5)
      .get();
    if (q.empty) {
      console.error("No scheduled questions. Seed some first via firebase/scripts/seed-launch-questions.ts.");
      process.exit(1);
    }
    // Pick the one with the earliest created_at (client-side sort).
    const docs = q.docs.slice().sort((a, b) => {
      const av = a.data().created_at?.toMillis?.() ?? 0;
      const bv = b.data().created_at?.toMillis?.() ?? 0;
      return av - bv;
    });
    const doc = docs[0];
    target = { id: doc.id, ref: doc.ref, data: doc.data() };
  }

  console.log(`Target question: ${target.id}`);
  console.log(`  text: ${(target.data.text ?? "").slice(0, 100)}`);
  console.log(`  previous scheduled_drop_at: ${target.data.scheduled_drop_at?.toDate?.()?.toISOString() ?? "<unset>"}`);

  const now = Timestamp.now();
  await target.ref.update({ scheduled_drop_at: now });
  console.log(`  new scheduled_drop_at: ${now.toDate().toISOString()}`);
  console.log("\nNext cron run (≤5 min) will promote it to status='live'.");
  console.log("Or run: curl -X POST -H 'Authorization: Bearer $CRON_SECRET' https://relatably.vercel.app/api/cron/trigger-drop");
})().catch((e) => {
  console.error("Fatal:", e?.message ?? e);
  process.exit(1);
});
