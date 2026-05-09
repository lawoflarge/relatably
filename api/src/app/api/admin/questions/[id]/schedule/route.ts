import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAdmin } from "@/lib/admin";
import { gateResponse } from "../../../_helpers";

const Schema = z.object({
  scheduled_drop_at: z.string(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate.kind !== "ok") return gateResponse(gate.kind);

  let body;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const date = new Date(body.scheduled_drop_at);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  if (date.getTime() <= Date.now()) {
    return NextResponse.json({ error: "scheduled_drop_at must be in the future" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const ref = adminFirestore.collection("questions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const data = snap.data() as { status: string };
  if (data.status !== "scheduled") {
    return NextResponse.json(
      { error: `question is ${data.status}, only 'scheduled' can be re-scheduled` },
      { status: 400 },
    );
  }

  await ref.update({ scheduled_drop_at: Timestamp.fromDate(date) });

  return NextResponse.json({ id, scheduled_drop_at: date.toISOString() });
}
