import { rankScore, type RankScoreResult } from "./rankScore";
import { earlyBirdBonus, type EarlyBirdResult } from "./earlyBirdBonus";

export interface DailyScoreInput {
  clusterRank: number;
  totalClusters: number;
  clusterCount: number;
  totalSubmissions: number;
  rankWithinCluster: number;
  isFirstGlobally: boolean;
}

export interface DailyScoreResult {
  rankScore: RankScoreResult;
  earlyBird: EarlyBirdResult;
  total: number;
}

/**
 * Ported verbatim from firebase/functions/src/lib/computeDailyScore.ts for
 * the Vercel + GitHub Actions cron architecture pivot.
 */
export function computeDailyScore(input: DailyScoreInput): DailyScoreResult {
  const rs = rankScore({
    clusterRank: input.clusterRank,
    totalClusters: input.totalClusters,
    clusterCount: input.clusterCount,
    totalSubmissions: input.totalSubmissions,
  });
  const eb = earlyBirdBonus({
    rankWithinCluster: input.rankWithinCluster,
    clusterSize: input.clusterCount,
    isFirstGlobally: input.isFirstGlobally,
  });
  return { rankScore: rs, earlyBird: eb, total: rs.points + eb.points };
}
