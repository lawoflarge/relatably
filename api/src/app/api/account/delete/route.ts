import { NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Account deletion endpoint required by App Review Guideline 5.1.1(v).
 *
 * Removes:
 * - the user's Firebase Auth record (revokes Sign in with Apple)
 * - users/{uid} profile
 * - leaderboard_entries owned by the user
 * - share_events owned by the user
 * - friendships where the user is requester OR accepter
 * - submissions/* fields are anonymised in-place (raw_text -> "[deleted]",
 *   user_id -> null) so historical wordclouds remain accurate but contain
 *   no PII attributable to the deleted user.
 */
export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const uid = decoded.uid;

  await anonymiseSubmissions(uid);
  await deleteCollectionWhere("leaderboard_entries", "user_id", uid);
  await deleteCollectionWhere("share_events", "user_id", uid);
  await deleteFriendships(uid);
  await adminFirestore.collection("users").doc(uid).delete();

  try {
    await adminAuth.deleteUser(uid);
  } catch (err) {
    console.error("account delete: auth.deleteUser failed", {
      uid,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ ok: true });
}

async function anonymiseSubmissions(uid: string): Promise<void> {
  const snap = await adminFirestore
    .collection("submissions")
    .where("user_id", "==", uid)
    .get();
  if (snap.empty) return;
  const batches = chunk(snap.docs, 400);
  for (const batchDocs of batches) {
    const batch = adminFirestore.batch();
    for (const doc of batchDocs) {
      batch.update(doc.ref, {
        user_id: null,
        raw_text: "[deleted]",
        deleted_by_user_at: new Date(),
      });
    }
    await batch.commit();
  }
}

async function deleteCollectionWhere(
  collection: string,
  field: string,
  value: string,
): Promise<void> {
  const snap = await adminFirestore
    .collection(collection)
    .where(field, "==", value)
    .get();
  if (snap.empty) return;
  const batches = chunk(snap.docs, 400);
  for (const batchDocs of batches) {
    const batch = adminFirestore.batch();
    for (const doc of batchDocs) batch.delete(doc.ref);
    await batch.commit();
  }
}

async function deleteFriendships(uid: string): Promise<void> {
  const reqSnap = await adminFirestore
    .collection("friendships")
    .where("requester_id", "==", uid)
    .get();
  const accSnap = await adminFirestore
    .collection("friendships")
    .where("accepter_id", "==", uid)
    .get();
  const all = [...reqSnap.docs, ...accSnap.docs];
  if (all.length === 0) return;
  const batches = chunk(all, 400);
  for (const batchDocs of batches) {
    const batch = adminFirestore.batch();
    for (const doc of batchDocs) batch.delete(doc.ref);
    await batch.commit();
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
