import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";

const RegisterSchema = z.object({
  device_token: z.string().min(1),
  fcm_token: z.string().min(1),
});

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = RegisterSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const deviceTokenHash = hashDeviceToken(parsed.device_token);
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
