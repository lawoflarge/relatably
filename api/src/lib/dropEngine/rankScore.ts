export type RankTier = "verdict" | "top3" | "top10" | "top100" | "top1pct" | "participation";

export interface RankScoreInput {
  clusterRank: number;        // 1-indexed; cluster's rank among all clusters of this question (by submission_count desc)
  totalClusters: number;      // total distinct clusters for this question
  clusterCount: number;       // submission_count of this cluster
  totalSubmissions: number;   // total submissions to this question (sum of cluster counts)
}

export interface RankScoreResult {
  points: number;
  tier: RankTier;
}

/**
 * Per spec Section 5. Most-specific tier wins. The top-1% threshold is by
 * submission count (popularity), not by cluster index.
 *
 * Ported verbatim from firebase/functions/src/lib/rankScore.ts for
 * the Vercel + GitHub Actions cron architecture pivot.
 */
export function rankScore(input: RankScoreInput): RankScoreResult {
  if (input.clusterRank === 1) return { points: 1000, tier: "verdict" };
  if (input.clusterRank <= 3) return { points: 500, tier: "top3" };
  if (input.clusterRank <= 10) return { points: 250, tier: "top10" };
  if (input.clusterRank <= 100) return { points: 100, tier: "top100" };

  // Top-1% by popularity (submission count).
  if (input.totalSubmissions > 0 && input.clusterCount / input.totalSubmissions >= 0.01) {
    return { points: 50, tier: "top1pct" };
  }

  return { points: 10, tier: "participation" };
}
