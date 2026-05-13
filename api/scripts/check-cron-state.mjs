// Inspect what's in function_runs for the cron + whether scheduled questions exist.
import fb from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

// Parse .env file manually so we get the raw FIREBASE_SERVICE_ACCOUNT_JSON
// (un-escaped \n + quotes intact)
const envPath = process.env.ENV_FILE || "/tmp/.relatably-env";
const txt = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of txt.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

fb.initializeApp({
  credential: fb.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  projectId: env.FIREBASE_PROJECT_ID,
});

const db = fb.firestore();
const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
console.log("today bucket:", day);

for (let i = -3; i <= 0; i++) {
  const key = `prepareNextDrop:${day + i}`;
  const doc = await db.collection("function_runs").doc(key).get();
  console.log(`  ${key}:`, doc.exists ? JSON.stringify(doc.data()) : "not-exists");
}

console.log("\n=== scheduled questions ===");
const snap = await db.collection("questions").where("status", "==", "scheduled").get();
console.log("total scheduled:", snap.size);
let withoutDrop = 0;
for (const d of snap.docs) {
  const data = d.data();
  if (!data.scheduled_drop_at) withoutDrop++;
}
console.log("without scheduled_drop_at:", withoutDrop);

for (const d of snap.docs.slice(0, 6)) {
  const data = d.data();
  console.log(
    `  ${d.id}`,
    "created:",
    data.created_at?.toDate?.()?.toISOString() ?? "n/a",
    "drop:",
    data.scheduled_drop_at?.toDate?.()?.toISOString() ?? "NONE",
    "prompt:",
    (data.prompt || "").slice(0, 50)
  );
}

console.log("\n=== live question(s) ===");
const live = await db.collection("questions").where("status", "==", "live").get();
console.log("live count:", live.size);
for (const d of live.docs) {
  const data = d.data();
  console.log(`  ${d.id}`, "live_at:", data.live_at?.toDate?.()?.toISOString() ?? "n/a", "prompt:", (data.prompt || "").slice(0, 60));
}

process.exit(0);
