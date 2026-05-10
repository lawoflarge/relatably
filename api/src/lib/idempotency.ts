import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "./firebase";

/**
 * Runs `fn` exactly once across cron retries for a given key.
 *
 * The first invocation atomically claims a `function_runs/{key}` guard doc
 * inside a Firestore transaction, then runs `fn` outside the transaction.
 * On success, stamps `completed_at`. On failure, the guard doc remains
 * with only `started_at` — operators can clean up.
 *
 * Returns the inner fn's value on a fresh run, or `null` if the key was
 * already claimed (i.e. this is a retry of a successful run).
 *
 * Ported from firebase/functions/src/lib/idempotency.ts (commit 2529d86)
 * for the Vercel + GitHub Actions cron architecture pivot.
 */
export async function runOnce<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const ref = adminFirestore.collection("function_runs").doc(key);
  const proceed = await adminFirestore.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (snap.exists) return false;
    txn.set(ref, { started_at: FieldValue.serverTimestamp() });
    return true;
  });
  if (!proceed) return null;
  const value = await fn();
  await ref.update({ completed_at: FieldValue.serverTimestamp() });
  return value;
}
