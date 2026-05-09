import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { reviewSubmission } from "./lib/moderationReview";

interface SubmissionDoc {
  question_id: string;
  raw_text: string;
  normalized_cluster_id?: string;
  moderation_status: "passed" | "blocked";
  tier2_reviewed_at?: unknown;
}

/**
 * Re-evaluates a submission with Perspective API tier-2 toxicity check.
 * Idempotent via the `tier2_reviewed_at` guard.
 */
export async function runModerationReview(
  firestore: Firestore,
  submissionId: string,
): Promise<void> {
  const subRef = firestore.doc(`submissions/${submissionId}`);
  const subSnap = await subRef.get();
  if (!subSnap.exists) return;

  const sub = subSnap.data() as SubmissionDoc;
  if (sub.moderation_status !== "passed") return;
  if (sub.tier2_reviewed_at) return;
  if (!sub.normalized_cluster_id) return;

  const verdict = await reviewSubmission({ raw_text: sub.raw_text });

  if (verdict.verdict === "pass") {
    await subRef.update({
      tier2_reviewed_at: FieldValue.serverTimestamp(),
      tier2_score: verdict.score,
    });
    return;
  }

  const clusterRef = firestore.doc(`answer_clusters/${sub.normalized_cluster_id}`);
  await firestore.runTransaction(async (tx) => {
    const clusterSnap = await tx.get(clusterRef);
    const subRecheck = await tx.get(subRef);
    if ((subRecheck.data() as SubmissionDoc | undefined)?.tier2_reviewed_at) {
      return;
    }
    tx.update(subRef, {
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

  logger.info("moderationReview: blocked submission", {
    submissionId,
    score: verdict.score,
  });
}

/**
 * v2 Firestore trigger — fires on submission create. Async tier-2 review.
 */
export const moderationReview = onDocumentCreated(
  {
    document: "submissions/{submissionId}",
    region: "us-central1",
  },
  async (event) => {
    const submissionId = event.params.submissionId;
    await runModerationReview(db(), submissionId);
  },
);
