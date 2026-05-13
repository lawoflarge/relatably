import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";
import { hashDeviceToken } from "@/lib/hash";

export const dynamic = "force-dynamic";

const DeleteSchema = z.object({
  device_token: z.string().min(1).max(256).optional(),
});

/**
 * Lets a user immediately remove their own submission from the live
 * wordcloud, as required by App Review Guideline 1.2.
 *
 * Ownership is proven either by a Firebase ID token (Sign in with Apple users)
 * or by a matching device_token hash (anonymous users). The submission row is
 * deleted and the parent cluster's submission_count is decremented so the
 * wordcloud reflects the removal in real time.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const ref = adminFirestore.collection("submissions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: z.infer<typeof DeleteSchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    body = DeleteSchema.parse(json);
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const decoded = await requireAuth(req);
  const userId = decoded?.uid ?? null;
  const deviceUserId = body.device_token
    ? hashDeviceToken(body.device_token)
    : null;

  const data = snap.data() as {
    user_id?: string | null;
    device_user_id?: string;
    normalized_cluster_id?: string;
    moderation_status?: string;
  };

  const ownsByUser = userId && data.user_id === userId;
  const ownsByDevice = deviceUserId && data.device_user_id === deviceUserId;
  if (!ownsByUser && !ownsByDevice) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await adminFirestore.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return;
    const freshData = fresh.data() as {
      normalized_cluster_id?: string;
      moderation_status?: string;
    };
    const clusterId = freshData.normalized_cluster_id;
    const wasCountedInCluster =
      (freshData.moderation_status ?? "passed") !== "blocked";

    tx.delete(ref);

    if (clusterId && wasCountedInCluster) {
      const clusterRef = adminFirestore.doc(`answer_clusters/${clusterId}`);
      const clusterSnap = await tx.get(clusterRef);
      const prev =
        (clusterSnap.data() as { submission_count?: number } | undefined)
          ?.submission_count ?? 0;
      if (prev > 0) {
        tx.update(clusterRef, {
          submission_count: FieldValue.increment(-1),
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
