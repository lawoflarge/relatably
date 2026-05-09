import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const THUMBNAIL_CLUSTERS = 5;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursorRaw = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");

  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  let query = adminFirestore
    .collection("questions")
    .where("status", "==", "revealed")
    .orderBy("created_at", "desc");

  if (cursorRaw) {
    const cursorDate = new Date(cursorRaw);
    if (!Number.isNaN(cursorDate.getTime())) {
      query = query.startAfter(Timestamp.fromDate(cursorDate));
    }
  }

  const qSnap = await query.limit(limit).get();

  const tiles = await Promise.all(
    qSnap.docs.map(async (doc) => {
      const data = doc.data() as { text: string; created_at: Timestamp };
      const clusterSnap = await adminFirestore
        .collection("answer_clusters")
        .where("question_id", "==", doc.id)
        .orderBy("final_rank", "asc")
        .limit(THUMBNAIL_CLUSTERS)
        .get();
      const top_clusters = clusterSnap.docs.map(
        (c) => (c.data() as { canonical_text: string }).canonical_text,
      );
      return {
        question_id: doc.id,
        question_text: data.text,
        verdict_text: top_clusters[0] ?? "",
        top_clusters,
        created_at: data.created_at.toDate().toISOString(),
      };
    }),
  );

  const next_cursor = tiles.length === limit ? tiles[tiles.length - 1].created_at : null;
  return NextResponse.json({ tiles, next_cursor });
}
