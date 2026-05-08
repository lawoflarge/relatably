import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminFirestore } from "@/lib/firebase";

const TOP_N = 10;

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceToken = url.searchParams.get("device_token");

  // Most recent revealed question — order by created_at desc.
  const qSnap = await adminFirestore
    .collection("questions")
    .where("status", "==", "revealed")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();

  if (qSnap.empty) {
    return NextResponse.json({ error: "no revealed question yet" }, { status: 404 });
  }

  const questionDoc = qSnap.docs[0];
  const questionData = questionDoc.data() as { text: string };

  const clusterSnap = await adminFirestore
    .collection("answer_clusters")
    .where("question_id", "==", questionDoc.id)
    .orderBy("final_rank", "asc")
    .limit(TOP_N)
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

  let self_cluster_id: string | null = null;
  if (deviceToken) {
    const hash = hashDeviceToken(deviceToken);
    const subSnap = await adminFirestore
      .collection("submissions")
      .where("question_id", "==", questionDoc.id)
      .where("device_user_id", "==", hash)
      .limit(1)
      .get();
    if (!subSnap.empty) {
      const sub = subSnap.docs[0].data() as { normalized_cluster_id?: string | null };
      self_cluster_id = sub.normalized_cluster_id ?? null;
    }
  }

  return NextResponse.json({
    id: questionDoc.id,
    text: questionData.text,
    top_clusters,
    self_cluster_id,
  });
}
