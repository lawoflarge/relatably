import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";

export async function GET() {
  const snap = await adminFirestore
    .collection("questions")
    .where("status", "==", "live")
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "no live question" }, { status: 404 });
  }

  const doc = snap.docs[0];
  const data = doc.data() as { text: string };
  return NextResponse.json({ id: doc.id, text: data.text });
}
