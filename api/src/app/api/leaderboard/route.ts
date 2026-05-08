import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

interface LeaderboardEntryDoc {
  user_id: string;
  score: number;
  daily_rank?: number;
  submitted_at?: { toMillis(): number };
}

interface UserDoc {
  handle: string | null;
  is_public: boolean;
  shadowbanned: boolean;
  locale: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

async function findLatestRevealedId(): Promise<string | null> {
  const snap = await adminFirestore
    .collection("questions")
    .where("status", "==", "revealed")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function fetchAcceptedFriendUids(uid: string): Promise<string[]> {
  const friendsRef = adminFirestore.collection("friendships");
  const [outgoing, incoming] = await Promise.all([
    friendsRef.where("requester_id", "==", uid).where("status", "==", "accepted").get(),
    friendsRef.where("accepter_id", "==", uid).where("status", "==", "accepted").get(),
  ]);
  const out: string[] = [uid];
  outgoing.docs.forEach((d: any) => out.push((d.data() as { accepter_id: string }).accepter_id));
  incoming.docs.forEach((d: any) => out.push((d.data() as { requester_id: string }).requester_id));
  return Array.from(new Set(out));
}

interface JoinedEntry {
  user_id: string;
  handle: string | null;
  score: number;
  daily_rank?: number;
  locale: string;
}

async function joinUsersAndFilterShadowbanned(
  rows: { user_id: string; score: number; daily_rank?: number }[],
): Promise<JoinedEntry[]> {
  const out: JoinedEntry[] = [];
  for (const row of rows) {
    const userSnap = await adminFirestore.collection("users").doc(row.user_id).get();
    if (!userSnap.exists) continue;
    const u = userSnap.data() as UserDoc;
    if (u.shadowbanned) continue;
    if (!u.is_public) continue;
    out.push({
      user_id: row.user_id,
      handle: u.handle,
      score: row.score,
      daily_rank: row.daily_rank,
      locale: u.locale,
    });
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "daily") as "daily" | "weekly" | "alltime";
  const scope = (url.searchParams.get("scope") ?? "global") as "global" | "friends";
  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  let friendUids: string[] | null = null;
  if (scope === "friends") {
    const decoded = await requireAuth(req);
    if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    friendUids = await fetchAcceptedFriendUids(decoded.uid);
    if (friendUids.length === 0) return NextResponse.json({ entries: [] });
  }

  let rows: { user_id: string; score: number; daily_rank?: number }[] = [];

  if (period === "daily") {
    const qid = await findLatestRevealedId();
    if (!qid) return NextResponse.json({ entries: [] });

    let q: FirebaseFirestore.Query = adminFirestore
      .collection("leaderboard_entries")
      .where("question_id", "==", qid);
    if (friendUids) q = q.where("user_id", "in", friendUids.slice(0, 30));
    q = q.orderBy("score", "desc").orderBy("submitted_at", "asc").limit(limit);

    const snap = await q.get();
    rows = snap.docs.map((d: any) => {
      const data = d.data() as LeaderboardEntryDoc;
      return { user_id: data.user_id, score: data.score, daily_rank: data.daily_rank };
    });
  } else {
    const field = period === "weekly" ? "weekly_score" : "alltime_score";
    let q: FirebaseFirestore.Query = adminFirestore.collection("user_aggregates");
    if (friendUids) {
      q = adminFirestore
        .collection("user_aggregates")
        .where("__name__", "in", friendUids.slice(0, 30));
    }
    q = q.orderBy(field, "desc").limit(limit);

    const snap = await q.get();
    rows = snap.docs.map((d: any) => {
      const data = d.data() as Record<string, number>;
      return { user_id: d.id, score: data[field] ?? 0 };
    });
  }

  const entries = await joinUsersAndFilterShadowbanned(rows);
  return NextResponse.json({ entries });
}
