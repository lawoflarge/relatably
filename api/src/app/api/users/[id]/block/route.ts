import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Mutual block between two signed-in users. Required by App Review
 * Guideline 1.2 for apps with user-to-user interaction (Relatably has a
 * friend graph + leaderboard).
 *
 * Side effects:
 * - writes `users/{me}/blocked/{them}` so the blocker's leaderboard / friend
 *   list filters out the blocked user;
 * - deletes any existing friendship doc between them in either direction.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const me = decoded.uid;
  const { id: them } = await ctx.params;
  if (me === them) {
    return NextResponse.json({ error: "cannot block self" }, { status: 400 });
  }

  await adminFirestore
    .collection("users")
    .doc(me)
    .collection("blocked")
    .doc(them)
    .set({ created_at: FieldValue.serverTimestamp() });

  const a = await adminFirestore
    .collection("friendships")
    .where("requester_id", "==", me)
    .where("accepter_id", "==", them)
    .get();
  const b = await adminFirestore
    .collection("friendships")
    .where("requester_id", "==", them)
    .where("accepter_id", "==", me)
    .get();
  const all = [...a.docs, ...b.docs];
  if (all.length > 0) {
    const batch = adminFirestore.batch();
    for (const doc of all) batch.delete(doc.ref);
    await batch.commit();
  }

  return NextResponse.json({ ok: true });
}
