import { logger } from "firebase-functions/v2";
import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { computeDailyScore } from "./lib/computeDailyScore";

interface ClusterSummary {
  id: string;
  rank: number;
  submissionCount: number;
  firstSubmissionAt: Timestamp | null;
}

interface SignedSubmission {
  id: string;
  userId: string;
  clusterId: string;
  submittedAt: Timestamp;
}

/**
 * Score-writing pass for a just-revealed question.
 * Writes leaderboard_entries (one per signed-in submitter) and bumps user_aggregates.
 *
 * NOT idempotent: re-running creates duplicate entries + double-bumps aggregates.
 * Phase 6 hardening item: add a `last_scored_question_id` guard.
 */
export async function runScoreReveal(
  firestore: Firestore,
  revealedQuestionId: string,
): Promise<void> {
  const clustersSnap = await firestore
    .collection("answer_clusters")
    .where("question_id", "==", revealedQuestionId)
    .orderBy("submission_count", "desc")
    .get();

  if (clustersSnap.empty) {
    logger.info("scoreReveal: no clusters", { revealedQuestionId });
    return;
  }

  const clusters: ClusterSummary[] = clustersSnap.docs.map((d, i) => {
    const data = d.data() as { submission_count: number; first_submission_at?: Timestamp };
    return {
      id: d.id,
      rank: i + 1,
      submissionCount: data.submission_count,
      firstSubmissionAt: data.first_submission_at ?? null,
    };
  });
  const totalClusters = clusters.length;
  const totalSubmissions = clusters.reduce((s, c) => s + c.submissionCount, 0);
  const clusterById = new Map(clusters.map((c) => [c.id, c]));

  const signedSnap = await firestore
    .collection("submissions")
    .where("question_id", "==", revealedQuestionId)
    .where("user_id", "!=", null)
    .orderBy("user_id")
    .get();

  if (signedSnap.empty) {
    logger.info("scoreReveal: no signed-in submitters", { revealedQuestionId });
    return;
  }

  const signed: SignedSubmission[] = signedSnap.docs.map((d) => {
    const data = d.data() as {
      user_id: string;
      normalized_cluster_id: string;
      submitted_at: Timestamp;
    };
    return {
      id: d.id,
      userId: data.user_id,
      clusterId: data.normalized_cluster_id,
      submittedAt: data.submitted_at,
    };
  });

  const byCluster = new Map<string, SignedSubmission[]>();
  for (const s of signed) {
    const arr = byCluster.get(s.clusterId) ?? [];
    arr.push(s);
    byCluster.set(s.clusterId, arr);
  }

  const rankByClusterAndId = new Map<string, Map<string, number>>();
  for (const clusterId of byCluster.keys()) {
    const allSnap = await firestore
      .collection("submissions")
      .where("question_id", "==", revealedQuestionId)
      .where("normalized_cluster_id", "==", clusterId)
      .orderBy("submitted_at", "asc")
      .get();
    const idToRank = new Map<string, number>();
    allSnap.docs.forEach((d, i) => idToRank.set(d.id, i + 1));
    rankByClusterAndId.set(clusterId, idToRank);
  }

  const entriesByUser = new Map<string, { score: number; tier: string }>();
  const entryWriter = firestore.bulkWriter();
  const nowTs = FieldValue.serverTimestamp();

  for (const sub of signed) {
    const cluster = clusterById.get(sub.clusterId);
    if (!cluster) continue;
    const rankWithinCluster = rankByClusterAndId.get(sub.clusterId)?.get(sub.id) ?? 1;
    const isFirstGlobally =
      cluster.firstSubmissionAt !== null
      && cluster.firstSubmissionAt.toMillis() === sub.submittedAt.toMillis();

    const result = computeDailyScore({
      clusterRank: cluster.rank,
      totalClusters,
      clusterCount: cluster.submissionCount,
      totalSubmissions,
      rankWithinCluster,
      isFirstGlobally,
    });

    const entryRef = firestore.collection("leaderboard_entries").doc();
    entryWriter.set(entryRef, {
      user_id: sub.userId,
      question_id: revealedQuestionId,
      score: result.total,
      rank_score_component: result.rankScore.points,
      rank_score_tier: result.rankScore.tier,
      early_bird_component: result.earlyBird.points,
      early_bird_tier: result.earlyBird.tier,
      daily_rank: 0,
      submitted_at: sub.submittedAt,
      created_at: nowTs,
    });

    entriesByUser.set(sub.userId, {
      score: result.total,
      tier: `${result.rankScore.tier}+${result.earlyBird.tier}`,
    });
  }
  await entryWriter.flush();

  const rankSnap = await firestore
    .collection("leaderboard_entries")
    .where("question_id", "==", revealedQuestionId)
    .orderBy("score", "desc")
    .orderBy("submitted_at", "asc")
    .get();
  const rankWriter = firestore.bulkWriter();
  const userIdToDailyRank = new Map<string, number>();
  rankSnap.docs.forEach((doc, i) => {
    const rank = i + 1;
    const userId = (doc.data() as { user_id: string }).user_id;
    rankWriter.update(doc.ref, { daily_rank: rank });
    userIdToDailyRank.set(userId, rank);
  });
  await rankWriter.flush();

  const aggWriter = firestore.bulkWriter();
  for (const [userId, info] of entriesByUser) {
    const dailyRank = userIdToDailyRank.get(userId) ?? 999_999;
    const aggRef = firestore.collection("user_aggregates").doc(userId);
    const aggSnap = await aggRef.get();
    const existing = aggSnap.exists
      ? (aggSnap.data() as { alltime_score?: number; weekly_score?: number; num_called_it_wins?: number; best_daily_rank?: number })
      : {};
    const isCalledIt = info.tier === "verdict+first";

    aggWriter.set(aggRef, {
      alltime_score: (existing.alltime_score ?? 0) + info.score,
      weekly_score: (existing.weekly_score ?? 0) + info.score,
      weekly_score_calculated_at: nowTs,
      num_called_it_wins: (existing.num_called_it_wins ?? 0) + (isCalledIt ? 1 : 0),
      best_daily_rank: existing.best_daily_rank !== undefined
        ? Math.min(existing.best_daily_rank, dailyRank)
        : dailyRank,
      updated_at: nowTs,
    }, { merge: true });
  }
  await aggWriter.flush();

  logger.info("scoreReveal: done", {
    revealedQuestionId,
    scoredUsers: entriesByUser.size,
    totalSubmissions,
    totalClusters,
  });
}
