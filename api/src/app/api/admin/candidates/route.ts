import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

const CreateSchema = z.object({
  candidate_text: z.string().min(1).max(280),
});

const StatusSchema = z.enum(["pending", "approved", "rejected"]);

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  let query: FirebaseFirestore.Query = adminFirestore.collection("question_candidates");

  if (statusParam) {
    const parsedStatus = StatusSchema.safeParse(statusParam);
    if (!parsedStatus.success) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    query = query.where("status", "==", parsedStatus.data);
  }
  query = query.orderBy("created_at", "desc").limit(200);

  const snap = await query.get();
  const candidates = snap.docs.map((d) => {
    const data = d.data() as { candidate_text: string; status: string; created_at: Timestamp };
    return {
      id: d.id,
      candidate_text: data.candidate_text,
      status: data.status,
      created_at: data.created_at.toDate().toISOString(),
    };
  });

  return NextResponse.json({ candidates });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body;
  try {
    body = CreateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ref = adminFirestore.collection("question_candidates").doc();
  await ref.set({
    candidate_text: body.candidate_text,
    status: "pending",
    created_at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { id: ref.id, candidate_text: body.candidate_text, status: "pending" },
    { status: 201 },
  );
}
