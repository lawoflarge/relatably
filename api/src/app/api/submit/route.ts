import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestore } from "@/lib/firebase";
import { normalize, clusterId } from "@/lib/normalize";
import { containsProfanity } from "@/lib/profanity";
import { hashIp, hashDeviceToken } from "@/lib/hash";
import { requireAuth } from "@/lib/auth";
import { getRateLimiter } from "@/lib/ratelimit";
import { reviewSubmission } from "@/lib/moderationReview";

const SubmitSchema = z.object({
  question_id: z.string().min(1),
  device_token: z.string().min(1),
  raw_text: z.string().min(1).max(280),
  dwell_ms: z.number().int().nonnegative(),
});

const MIN_DWELL_MS = 3000;

function minuteOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

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

  const ipHash = hashIp(req);

  const rl = await getRateLimiter().check(ipHash);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit exceeded" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const decoded = await requireAuth(req);
  const userId = decoded?.uid ?? null;

  const cId = clusterId(parsed.question_id, normalizedText);
  const deviceTokenHash = hashDeviceToken(parsed.device_token);

  const deviceRef = adminFirestore
    .collection("device_users")
    .doc(deviceTokenHash);
  const deviceSnap = await deviceRef.get();
  if (!deviceSnap.exists) {
    await deviceRef.set(
      {
        device_token: parsed.device_token,
        linked_user_id: userId,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else if (userId) {
    await deviceRef.set({ linked_user_id: userId }, { merge: true });
  }

  const clusterRef = adminFirestore.doc(`answer_clusters/${cId}`);
  const submissionRef = adminFirestore.collection("submissions").doc();

  let newCount = 1;
  await adminFirestore.runTransaction(async (tx) => {
    const clusterSnap = await tx.get(clusterRef);
    const now = FieldValue.serverTimestamp();
    const minuteUtc = minuteOfDay(new Date());

    if (!clusterSnap.exists) {
      tx.set(clusterRef, {
        question_id: parsed.question_id,
        canonical_text: normalizedText,
        submission_count: 1,
        first_submission_at: now,
      });
      newCount = 1;
    } else {
      const prevCount = (clusterSnap.data() as { submission_count?: number } | undefined)?.submission_count ?? 0;
      newCount = prevCount + 1;
      tx.update(clusterRef, {
        submission_count: FieldValue.increment(1),
      });
    }

    tx.set(submissionRef, {
      question_id: parsed.question_id,
      user_id: userId,
      device_user_id: deviceTokenHash,
      raw_text: parsed.raw_text,
      normalized_cluster_id: cId,
      submitted_at: now,
      submitted_at_minute_of_day: minuteUtc,
      ip_hash: ipHash,
      dwell_ms: parsed.dwell_ms,
      moderation_status: "passed",
    });
  });

  // Tier-2 toxicity check (Perspective API). Runs synchronously after the
  // cheap-pass commit so we can either stamp tier2 fields (pass) or flip
  // moderation_status + decrement the cluster (block). Mirrors the original
  // onDocumentCreated(submissions/{id}) algorithm. Fails open: if Perspective
  // throws or is skipped, the cheap verdict stands.
  const verdict = await reviewSubmission({ raw_text: parsed.raw_text });

  if (verdict.skipped) {
    // Network error or no API key — keep cheap-pass verdict, do not stamp tier2.
  } else if (verdict.verdict === "pass") {
    await submissionRef.update({
      tier2_reviewed_at: FieldValue.serverTimestamp(),
      tier2_score: verdict.score,
    });
  } else {
    await adminFirestore.runTransaction(async (tx) => {
      const subRecheck = await tx.get(submissionRef);
      if ((subRecheck.data() as { tier2_reviewed_at?: unknown } | undefined)?.tier2_reviewed_at) {
        return;
      }
      const clusterSnap = await tx.get(clusterRef);
      tx.update(submissionRef, {
        moderation_status: "blocked",
        tier2_reviewed_at: FieldValue.serverTimestamp(),
        tier2_score: verdict.score,
      });
      const prevCount =
        (clusterSnap.data() as { submission_count?: number } | undefined)
          ?.submission_count ?? 0;
      if (prevCount > 0) {
        tx.update(clusterRef, {
          submission_count: FieldValue.increment(-1),
        });
      }
    });
  }

  return NextResponse.json({
    cluster_id: cId,
    submission_count: newCount,
    normalized_text: normalizedText,
    submission_id: submissionRef.id,
  });
}
