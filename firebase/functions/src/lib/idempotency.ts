import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";

/**
 * Runs `fn` exactly once across Cloud Functions retries for a given key.
 *
 * The first invocation atomically claims a `function_runs/{key}` guard doc
 * inside a Firestore transaction, then runs `fn` outside the transaction
 * (Firestore txns can't span the long inner work). On success, stamps
 * `completed_at`. On failure, the guard doc remains with only `started_at`
 * — operators can clean up (or you can add a janitor — Phase 7).
 *
 * Returns the inner fn's value on a fresh run, or `null` if the key was
 * already claimed (i.e. this is a retry).
 */
export async function runOnce<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const ref = db().collection("function_runs").doc(key);
  const proceed = await db().runTransaction(async (txn) => {
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
