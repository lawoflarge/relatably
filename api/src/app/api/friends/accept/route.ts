import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

const Schema = z.object({ friendship_id: z.string().min(1) });

export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ref = adminFirestore.collection("friendships").doc(parsed.friendship_id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = snap.data() as { accepter_id: string; status: string };
  if (data.accepter_id !== decoded.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (data.status !== "pending") {
    return NextResponse.json({ id: parsed.friendship_id, status: data.status });
  }

  await ref.update({ status: "accepted", accepted_at: FieldValue.serverTimestamp() });
  return NextResponse.json({ id: parsed.friendship_id, status: "accepted" });
}
