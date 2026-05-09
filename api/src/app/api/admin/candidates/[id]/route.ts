import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";

const PatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const candidateRef = adminFirestore.collection("question_candidates").doc(id);
  const snap = await candidateRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const candidate = snap.data() as { candidate_text: string; status: string };
  if (candidate.status !== "pending") {
    return NextResponse.json(
      { error: `candidate already ${candidate.status}` },
      { status: 409 },
    );
  }

  if (body.action === "reject") {
    await candidateRef.update({ status: "rejected" });
    return NextResponse.json({ id, status: "rejected" });
  }

  // approve: atomic batch — mark candidate approved + create scheduled question
  const newQuestionRef = adminFirestore.collection("questions").doc();
  const batch = adminFirestore.batch();
  batch.update(candidateRef, { status: "approved" });
  batch.set(newQuestionRef, {
    text: candidate.candidate_text,
    status: "scheduled",
    source: "ai_assisted",
    created_at: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return NextResponse.json({ id, status: "approved", question_id: newQuestionRef.id });
}
