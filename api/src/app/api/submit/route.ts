import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { normalize, clusterId } from "@/lib/normalize";
import { containsProfanity } from "@/lib/profanity";
import { hashIp, hashDeviceToken } from "@/lib/hash";

const SubmitSchema = z.object({
  question_id: z.string().min(1),
  device_token: z.string().min(1),
  raw_text: z.string().min(1).max(280),
  dwell_ms: z.number().int().nonnegative(),
});

const MIN_DWELL_MS = 3000;

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = SubmitSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (parsed.dwell_ms < MIN_DWELL_MS) {
    return NextResponse.json({ error: "dwell too short" }, { status: 400 });
  }

  if (containsProfanity(parsed.raw_text)) {
    return NextResponse.json(
      { error: "that won't fly. try again." },
      { status: 400 },
    );
  }

  const normalizedText = normalize(parsed.raw_text);
  if (!normalizedText) {
    return NextResponse.json(
      { error: "empty after normalization" },
      { status: 400 },
    );
  }

  const cId = clusterId(parsed.question_id, normalizedText);
  const ipHash = hashIp(req);
  const deviceTokenHash = hashDeviceToken(parsed.device_token);

  // Idempotent device upsert with merge: true preserves any linked_user_id
  // that may be set by Phase 3's Sign-in-with-Apple flow between the read and
  // the write. created_at is only stamped on first creation thanks to the
  // create-vs-merge guard below.
  const deviceRef = adminFirestore
    .collection("device_users")
    .doc(deviceTokenHash);
  const deviceSnap = await deviceRef.get();
  let linkedUserId: string | null = null;
  if (!deviceSnap.exists) {
    await deviceRef.set(
      {
        device_token: parsed.device_token,
        linked_user_id: null,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    linkedUserId = (deviceSnap.data() as { linked_user_id: string | null } | undefined)?.linked_user_id ?? null;
  }

  const clusterRef = adminFirestore.doc(`answer_clusters/${cId}`);
  const submissionRef = adminFirestore.collection("submissions").doc();

  let newCount = 1;
  await adminFirestore.runTransaction(async (tx) => {
    const clusterSnap = await tx.get(clusterRef);
    const now = FieldValue.serverTimestamp();

    if (!clusterSnap.exists) {
      tx.set(clusterRef, {
        question_id: parsed.question_id,
        canonical_text: normalizedText,
        submission_count: 1,
        first_submission_at: now,
      });
      newCount = 1;
    } else {
      const prevCount = (clusterSnap.data() as any)?.submission_count ?? 0;
      newCount = prevCount + 1;
      tx.update(clusterRef, {
        submission_count: FieldValue.increment(1),
      });
    }

    tx.set(submissionRef, {
      question_id: parsed.question_id,
      user_id: null,
      device_user_id: deviceTokenHash,
      raw_text: parsed.raw_text,
      normalized_cluster_id: cId,
      submitted_at: now,
      ip_hash: ipHash,
      dwell_ms: parsed.dwell_ms,
      moderation_status: "passed",
    });
  });

  return NextResponse.json({
    cluster_id: cId,
    submission_count: newCount,
    normalized_text: normalizedText,
  });
}
