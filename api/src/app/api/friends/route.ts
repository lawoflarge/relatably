import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

interface FriendshipRow {
  id: string;
  friend_user_id: string;
  handle: string | null;
  locale: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
}

interface UserDoc {
  handle: string | null;
  is_public: boolean;
  shadowbanned: boolean;
  locale: string;
}

async function joinUser(uid: string): Promise<UserDoc | null> {
  const snap = await adminFirestore.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return snap.data() as UserDoc;
}

export async function GET(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = decoded.uid;

  const friendsRef = adminFirestore.collection("friendships");
  const [outgoingSnap, incomingSnap] = await Promise.all([
    friendsRef
      .where("requester_id", "==", me)
      .where("status", "in", ["pending", "accepted"])
      .get(),
    friendsRef
      .where("accepter_id", "==", me)
      .where("status", "in", ["pending", "accepted"])
      .get(),
  ]);

  const out: FriendshipRow[] = [];

  for (const d of outgoingSnap.docs) {
    const data = d.data() as { requester_id: string; accepter_id: string; status: "pending" | "accepted" };
    const u = await joinUser(data.accepter_id);
    if (!u || u.shadowbanned) continue;
    out.push({
      id: d.id,
      friend_user_id: data.accepter_id,
      handle: u.handle,
      locale: u.locale,
      status: data.status,
      direction: "outgoing",
    });
  }

  for (const d of incomingSnap.docs) {
    const data = d.data() as { requester_id: string; accepter_id: string; status: "pending" | "accepted" };
    const u = await joinUser(data.requester_id);
    if (!u || u.shadowbanned) continue;
    out.push({
      id: d.id,
      friend_user_id: data.requester_id,
      handle: u.handle,
      locale: u.locale,
      status: data.status,
      direction: "incoming",
    });
  }

  return NextResponse.json({ friendships: out });
}
