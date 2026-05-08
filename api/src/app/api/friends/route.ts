import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

interface Friendship {
  id: string;
  requester_id: string;
  accepter_id: string;
  status: string;
}

export async function GET(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const friendsRef = adminFirestore.collection("friendships");

  const [outgoingSnap, incomingSnap] = await Promise.all([
    friendsRef
      .where("requester_id", "==", decoded.uid)
      .where("status", "in", ["pending", "accepted"])
      .get(),
    friendsRef
      .where("accepter_id", "==", decoded.uid)
      .where("status", "in", ["pending", "accepted"])
      .get(),
  ]);

  const friendships: Friendship[] = [
    ...outgoingSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) })),
    ...incomingSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Omit<Friendship, "id">) })),
  ];

  return NextResponse.json({ friendships });
}
