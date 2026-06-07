// Idempotent seed of permanent reviewer / demo content for App Store Review
// Guideline 1.2. This is a BONUS on top of the code-level guarantees: the
// /api/leaderboard route already serves demo users when the Board is empty, and
// the iOS client falls back to demo content when a surface is empty. This script
// additionally writes the same demo data to Firestore as REAL documents so the
// Board / wordcloud are populated with genuine data, blockable users included.
//
// Keep the data below in sync with api/src/lib/demoContent.ts (single source of
// truth for the code fallbacks). Duplicated here because this .mjs script can't
// import the .ts module without a transpiler.
//
// Run against production:
//   FIREBASE_PROJECT_ID=<id> FIREBASE_SERVICE_ACCOUNT_JSON='<json>' \
//     node scripts/seed-demo-reviewer-content.mjs
//   (or FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/sa.json)
//
// Safe to re-run: every write uses { merge: true } with deterministic doc ids.

import fs from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const DEMO_USERS = [
  { uid: "demo-maya", handle: "maya", score: 1840 },
  { uid: "demo-leo", handle: "leo", score: 1620 },
  { uid: "demo-aisha", handle: "aisha", score: 1475 },
  { uid: "demo-theo", handle: "theo", score: 1290 },
  { uid: "demo-nina", handle: "nina", score: 1130 },
  { uid: "demo-omar", handle: "omar", score: 980 },
  { uid: "demo-ruby", handle: "ruby", score: 845 },
  { uid: "demo-kai", handle: "kai", score: 710 },
];

const DEMO_QUESTION_ID = "demo-reviewer-drop";
const DEMO_QUESTION_TEXT = "what's the most overrated coffee order?";

const DEMO_CLUSTERS = [
  { id: "demo-cl-1", text: "pumpkin spice latte", count: 47 },
  { id: "demo-cl-2", text: "caramel macchiato", count: 39 },
  { id: "demo-cl-3", text: "frappuccino", count: 31 },
  { id: "demo-cl-4", text: "flat white", count: 24 },
  { id: "demo-cl-5", text: "matcha latte", count: 19 },
  { id: "demo-cl-6", text: "cold brew", count: 15 },
  { id: "demo-cl-7", text: "oat milk latte", count: 12 },
  { id: "demo-cl-8", text: "espresso martini", count: 9 },
  { id: "demo-cl-9", text: "chai latte", count: 7 },
  { id: "demo-cl-10", text: "americano", count: 5 },
];

function initDb() {
  if (getApps().length) return getFirestore();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required");
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (json) {
    initializeApp({ credential: cert(JSON.parse(json)), projectId });
  } else if (path) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(path, "utf8"))), projectId });
  } else {
    throw new Error("Need FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH");
  }
  return getFirestore();
}

async function main() {
  const db = initDb();
  const now = FieldValue.serverTimestamp();
  const total = DEMO_CLUSTERS.reduce((s, c) => s + c.count, 0);
  const batch = db.batch();

  // Users (public, not shadowbanned) so they pass the leaderboard join filter.
  DEMO_USERS.forEach((u, i) => {
    batch.set(
      db.collection("users").doc(u.uid),
      { handle: u.handle, is_public: true, shadowbanned: false, locale: "en" },
      { merge: true },
    );
    batch.set(
      db.collection("user_aggregates").doc(u.uid),
      {
        alltime_score: u.score,
        weekly_score: u.score,
        num_called_it_wins: 0,
        best_daily_rank: i + 1,
        updated_at: now,
        weekly_score_calculated_at: now,
      },
      { merge: true },
    );
  });

  // A permanent revealed question so Home/Archive always have a populated wordcloud.
  batch.set(
    db.collection("questions").doc(DEMO_QUESTION_ID),
    { text: DEMO_QUESTION_TEXT, status: "revealed", source: "demo_reviewer", created_at: now },
    { merge: true },
  );

  // Clusters: appear in Home (order by submission_count) AND Archive (order by final_rank).
  DEMO_CLUSTERS.forEach((c, i) => {
    batch.set(
      db.collection("answer_clusters").doc(c.id),
      {
        question_id: DEMO_QUESTION_ID,
        canonical_text: c.text,
        submission_count: c.count,
        final_rank: i + 1,
        final_pct_of_total: c.count / total,
      },
      { merge: true },
    );
  });

  // Leaderboard entries for the demo question so the DAILY board is populated too.
  DEMO_USERS.forEach((u, i) => {
    batch.set(
      db.collection("leaderboard_entries").doc(`demo-${DEMO_QUESTION_ID}-${u.uid}`),
      {
        user_id: u.uid,
        question_id: DEMO_QUESTION_ID,
        score: u.score,
        daily_rank: i + 1,
        submitted_at: now,
        created_at: now,
      },
      { merge: true },
    );
  });

  await batch.commit();
  console.log(
    `Seeded demo reviewer content: ${DEMO_USERS.length} users + aggregates, ` +
      `1 revealed question, ${DEMO_CLUSTERS.length} clusters, ${DEMO_USERS.length} leaderboard entries.`,
  );
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
