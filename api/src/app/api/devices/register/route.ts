import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { hashDeviceToken, hashIp } from "@/lib/hash";
import { getRateLimiter, getDailyRateLimiter } from "@/lib/ratelimit";

const RegisterSchema = z.object({
  device_token: z.string().min(1),
  fcm_token: z.string().min(1),
});

function tooMany(retryAfterMs: number) {
  return NextResponse.json(
    { error: "rate limit exceeded", retryAfter: Math.ceil(retryAfterMs / 1000) },
    { status: 429, headers: { "retry-after": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = RegisterSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const deviceTokenHash = hashDeviceToken(parsed.device_token);

  const ipRl = await getRateLimiter().check(hashIp(req));
  if (!ipRl.ok) return tooMany(ipRl.retryAfterMs);
  const devRl = await getRateLimiter().check(deviceTokenHash);
  if (!devRl.ok) return tooMany(devRl.retryAfterMs);
  const dailyRl = await getDailyRateLimiter().check(deviceTokenHash);
  if (!dailyRl.ok) return tooMany(dailyRl.retryAfterMs);

  await adminFirestore
    .collection("device_users")
    .doc(deviceTokenHash)
    .set(
      {
        device_token: parsed.device_token,
        fcm_token: parsed.fcm_token,
        fcm_token_updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return NextResponse.json({ ok: true });
}
