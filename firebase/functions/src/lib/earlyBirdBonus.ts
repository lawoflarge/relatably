export type EarlyBirdTier = "first" | "top1pct" | "top10pct" | "none";

export interface EarlyBirdInput {
  rankWithinCluster: number;   // 1-indexed; user's position among cluster's submissions ordered by submitted_at asc
  clusterSize: number;         // total submissions in this cluster
  isFirstGlobally: boolean;    // user.submitted_at === cluster.first_submission_at
}

export interface EarlyBirdResult {
  points: number;
  tier: EarlyBirdTier;
}

/**
 * Per spec Section 5. "First globally" overrides all percentile tiers.
 * Threshold: rank/size <= 0.01 = top1pct, <= 0.10 = top10pct, else none.
 */
export function earlyBirdBonus(input: EarlyBirdInput): EarlyBirdResult {
  if (input.isFirstGlobally) return { points: 500, tier: "first" };
  if (input.clusterSize <= 0) return { points: 0, tier: "none" };

  const ratio = input.rankWithinCluster / input.clusterSize;
  if (ratio <= 0.01) return { points: 200, tier: "top1pct" };
  if (ratio <= 0.10) return { points: 50, tier: "top10pct" };
  return { points: 0, tier: "none" };
}
