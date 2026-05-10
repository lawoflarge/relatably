import { NextResponse } from "next/server";
import type { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";
import { gateResponse } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  const snap = await adminFirestore
    .collection("questions")
    .where("status", "in", ["scheduled", "live"])
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  const questions = snap.docs.map((d) => {
    const data = d.data() as {
      text: string;
      status: "scheduled" | "live";
      scheduled_drop_at?: Timestamp;
      created_at: Timestamp;
    };
    return {
      id: d.id,
      text: data.text,
      status: data.status,
      scheduled_drop_at: data.scheduled_drop_at ? data.scheduled_drop_at.toDate().toISOString() : null,
      created_at: data.created_at.toDate().toISOString(),
    };
  });

  return NextResponse.json({ questions });
}
