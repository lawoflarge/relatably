import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";
import { hashDeviceToken, hashIp } from "@/lib/hash";

export const dynamic = "force-dynamic";

const ReportSchema = z.object({
  target_type: z.enum(["cluster", "submission", "user"]),
  target_id: z.string().min(1).max(256),
  reason: z.string().max(500).optional(),
  device_token: z.string().min(1).max(256).optional(),
});

/**
 * Lets users flag objectionable content / abusive users, as required by App
 * Review Guideline 1.2. Reports land in `content_reports/` for triage; the
 * operator commits to acting (remove + eject) within 24h per ASC review notes.
 *
 * Accepts either an authenticated request (Bearer ID token) or anonymous with
 * a device_token so users who haven't signed in can still report.
 */
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = ReportSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const decoded = await requireAuth(req);
  const userId = decoded?.uid ?? null;
  const deviceUserId = parsed.device_token ? hashDeviceToken(parsed.device_token) : null;

  if (!userId && !deviceUserId) {
    return NextResponse.json(
      { error: "must include auth header or device_token" },
      { status: 400 },
    );
  }

  await adminFirestore.collection("content_reports").add({
    target_type: parsed.target_type,
    target_id: parsed.target_id,
    reason: parsed.reason ?? null,
    reporter_user_id: userId,
    reporter_device_user_id: deviceUserId,
    reporter_ip_hash: hashIp(req),
    status: "open",
    created_at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
