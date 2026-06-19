import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { requireAuth } from "@/lib/auth";
import { hashIp } from "@/lib/hash";
import { signReferralCode } from "@/lib/branch";
import { getRateLimiter } from "@/lib/ratelimit";

const TrackSchema = z.object({
  banner_type: z.enum(["todays_take", "verdict", "called_it"]),
  question_id: z.string().min(1),
  share_target: z.enum(["ig_story", "tiktok", "snap", "imessage", "system"]),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = TrackSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const ipHash = hashIp(req);

  const ipRl = await getRateLimiter().check(ipHash);
  if (!ipRl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded", retryAfter: Math.ceil(ipRl.retryAfterMs / 1000) },
      { status: 429, headers: { "retry-after": String(Math.ceil(ipRl.retryAfterMs / 1000)) } },
    );
  }

  const decoded = await requireAuth(req);
  const userId = decoded?.uid ?? null;

  const referralCode = signReferralCode({
    user_id: userId,
    question_id: parsed.question_id,
    banner_type: parsed.banner_type,
    ts: Date.now(),
  });

  const docRef = adminFirestore.collection("share_events").doc();
  await docRef.set({
    user_id: userId,
    question_id: parsed.question_id,
    banner_type: parsed.banner_type,
    share_target: parsed.share_target,
    referral_code: referralCode,
    created_at: FieldValue.serverTimestamp(),
    ip_hash: ipHash,
  });

  return NextResponse.json({ referral_code: referralCode });
}
