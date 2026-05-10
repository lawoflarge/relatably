import { NextResponse } from "next/server";
import type { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");

  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  const ref = adminFirestore.collection("questions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const qData = snap.data() as { text: string; status: string; created_at: Timestamp };
  if (qData.status !== "revealed") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const clusterSnap = await adminFirestore
    .collection("answer_clusters")
    .where("question_id", "==", id)
    .orderBy("final_rank", "asc")
    .limit(limit)
    .get();

  const top_clusters = clusterSnap.docs.map((d) => {
    const data = d.data() as {
      canonical_text: string;
      submission_count: number;
      final_rank: number;
      final_pct_of_total: number;
    };
    return {
      id: d.id,
      canonical_text: data.canonical_text,
      submission_count: data.submission_count,
      final_rank: data.final_rank,
      final_pct_of_total: data.final_pct_of_total,
    };
  });

  return NextResponse.json({
    id,
    text: qData.text,
    created_at: qData.created_at.toDate().toISOString(),
    top_clusters,
  });
}
