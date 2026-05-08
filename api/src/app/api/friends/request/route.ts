import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

const Schema = z.object({ target_user_id: z.string().min(1) });

export function friendshipId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return createHash("sha1").update(`${x}:${y}`).digest("hex");
}

export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (parsed.target_user_id === decoded.uid) {
    return NextResponse.json({ error: "cannot friend yourself" }, { status: 400 });
  }

  const id = friendshipId(decoded.uid, parsed.target_user_id);
  const ref = adminFirestore.collection("friendships").doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    return NextResponse.json({ id, status: (snap.data() as { status: string }).status });
  }

  await ref.set({
    requester_id: decoded.uid,
    accepter_id: parsed.target_user_id,
    status: "pending",
    created_at: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ id, status: "pending" });
}
