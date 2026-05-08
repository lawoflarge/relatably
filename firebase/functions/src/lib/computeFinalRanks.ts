export interface ClusterRankInput {
  id: string;
  submission_count: number;
}

export interface ClusterRankOutput {
  id: string;
  final_rank: number;
  final_pct_of_total: number;
}

/**
 * Sort clusters by submission_count desc with lex-ascending id tiebreak,
 * assign final_rank starting at 1, compute final_pct_of_total.
 * Total of 0 yields 0% for every cluster.
 */
export function computeFinalRanks(input: ClusterRankInput[]): ClusterRankOutput[] {
  const total = input.reduce((sum, c) => sum + c.submission_count, 0);
  const sorted = [...input].sort((a, b) => {
    if (b.submission_count !== a.submission_count) {
      return b.submission_count - a.submission_count;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted.map((c, idx) => ({
    id: c.id,
    final_rank: idx + 1,
    final_pct_of_total: total === 0 ? 0 : c.submission_count / total,
  }));
}
