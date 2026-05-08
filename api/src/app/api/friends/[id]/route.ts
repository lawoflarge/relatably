import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const decoded = await requireAuth(req);
  if (!decoded) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const ref = adminFirestore.collection("friendships").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = snap.data() as { requester_id: string; accepter_id: string };
  if (data.requester_id !== decoded.uid && data.accepter_id !== decoded.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
