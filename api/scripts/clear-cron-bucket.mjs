// One-off: clear today's stuck prepare-next-drop bucket so the cron can retry.
// Reads creds from a Vercel-style .env file pointed at by ENV_FILE.
import fb from "firebase-admin";
import fs from "node:fs";

const envPath = process.env.ENV_FILE || "C:/Users/levin/AppData/Local/Temp/.relatably-env";
const txt = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of txt.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

// .env stores the JSON without an outer wrapping quote but with the
// PEM-private-key's newlines as literal \n. Build the JSON back manually.
// Trick: the only field with `\n` literals inside its STRING VALUE is
// private_key. So we can find/replace `\n` -> actual newlines *only inside
// strings* by using a JSON parser that tolerates trailing escapes — easier
// to bail to a different path: parse field-by-field with a regex extract.
function parseInlineJson(raw) {
  // raw starts with `{\n  "type":...`. We want to recover the object.
  // Strategy: tolerate it by replacing `\n` literals everywhere; this
  // yields multi-line JSON. JSON.parse rejects raw newlines inside strings,
  // so first we convert string contents back to `\n` escapes via a
  // 2-step transform: replace literal `\n` -> ⟦NL⟧ sentinel, then back.
  // Far simpler: rebuild via the fact that the private_key is the only
  // multi-line string. Extract it, then JSON.parse the rest with the
  // private_key replaced by a placeholder, then put it back.
  const m = raw.match(/"private_key":\s*"(-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----[\\n]*)"/);
  if (!m) throw new Error("could not isolate private_key");
  const pkLiteralWithEscapes = m[1];
  const pkActualNewlines = pkLiteralWithEscapes.replace(/\\n/g, "\n");
  const placeholder = "__PK_PLACEHOLDER__";
  const withPlaceholder = raw.replace(m[0], `"private_key":"${placeholder}"`);
  // The rest of the JSON only has \n outside strings (as fake whitespace).
  // Replacing all \n -> actual newline now yields a valid JSON document
  // because no other string value has embedded newlines.
  const normalised = withPlaceholder.replace(/\\n/g, "\n");
  const obj = JSON.parse(normalised);
  obj.private_key = pkActualNewlines;
  return obj;
}

const serviceAccount = parseInlineJson(env.FIREBASE_SERVICE_ACCOUNT_JSON);

fb.initializeApp({
  credential: fb.credential.cert(serviceAccount),
  projectId: env.FIREBASE_PROJECT_ID,
});

const db = fb.firestore();
const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
const key = `prepareNextDrop:${day}`;
console.log("clearing bucket:", key);
const ref = db.collection("function_runs").doc(key);
const before = await ref.get();
console.log("before:", before.exists ? JSON.stringify(before.data()) : "not-exists");
if (before.exists) {
  await ref.delete();
  console.log("deleted.");
} else {
  console.log("nothing to delete.");
}
process.exit(0);
