import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";
import { gateResponse } from "../_helpers";

const BodySchema = z.object({
  question_id: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body: { question_id?: string } = {};
  try {
    const text = await req.text();
    if (text) body = BodySchema.parse(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const now = Timestamp.now();

  if (body.question_id) {
    const ref = adminFirestore.collection("questions").doc(body.question_id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const data = snap.data() as { status: string };
    if (data.status !== "scheduled") {
      return NextResponse.json({ error: `question is ${data.status}` }, { status: 400 });
    }
    await ref.update({ scheduled_drop_at: now });
    return NextResponse.json({ question_id: body.question_id, will_fire_within_seconds: 60 });
  }

  // no question_id: pick oldest scheduled
  const snap = await adminFirestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .orderBy("created_at", "asc")
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "no scheduled question to trigger" }, { status: 404 });
  }

  const doc = snap.docs[0];
  await doc.ref.update({ scheduled_drop_at: now });

  return NextResponse.json({ question_id: doc.id, will_fire_within_seconds: 60 });
}
