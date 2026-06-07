// Permanent reviewer / demo content for App Store Review Guideline 1.2.
//
// The repeated 1.2 rejections were NOT caused by missing moderation features —
// they were caused by the Board (leaderboard) and wordcloud being EMPTY at
// review time, so the reviewer had nothing to report / block / hide. Time-bound
// Firestore seeds rotated out daily and disappeared.
//
// This module is the single source of truth for guaranteed demo content. It is
// consumed by:
//   - /api/leaderboard  → global-scope fallback so the Board is NEVER empty
//   - scripts/seed-demo-reviewer-content.mjs → writes the same data to Firestore
// The iOS client carries an equivalent copy (ios/src/lib/demoContent.ts) for its
// own offline/empty fallback so content is guaranteed even if the backend is
// unreachable.
//
// All entries are deliberately innocuous (coffee orders) so a reviewer can
// immediately see there is real, moderatable user content to act on.

export interface DemoLeaderboardEntry {
  user_id: string;
  handle: string;
  score: number;
  daily_rank: number;
  locale: string;
}

// 8 demo users, descending score. Stable user_ids so block/report can target them.
export const DEMO_LEADERBOARD: DemoLeaderboardEntry[] = [
  { user_id: "demo-maya", handle: "maya", score: 1840, daily_rank: 1, locale: "en" },
  { user_id: "demo-leo", handle: "leo", score: 1620, daily_rank: 2, locale: "en" },
  { user_id: "demo-aisha", handle: "aisha", score: 1475, daily_rank: 3, locale: "en" },
  { user_id: "demo-theo", handle: "theo", score: 1290, daily_rank: 4, locale: "en" },
  { user_id: "demo-nina", handle: "nina", score: 1130, daily_rank: 5, locale: "en" },
  { user_id: "demo-omar", handle: "omar", score: 980, daily_rank: 6, locale: "en" },
  { user_id: "demo-ruby", handle: "ruby", score: 845, daily_rank: 7, locale: "en" },
  { user_id: "demo-kai", handle: "kai", score: 710, daily_rank: 8, locale: "en" },
];

// A permanent revealed question so Home/Archive always have a populated wordcloud.
export const DEMO_QUESTION = {
  id: "demo-reviewer-drop",
  text: "what's the most overrated coffee order?",
};

export interface DemoCluster {
  // Deterministic id so client hide/report and Firestore docs line up.
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
}

export const DEMO_CLUSTERS: DemoCluster[] = [
  { id: "demo-cl-1", canonical_text: "pumpkin spice latte", submission_count: 47, final_rank: 1 },
  { id: "demo-cl-2", canonical_text: "caramel macchiato", submission_count: 39, final_rank: 2 },
  { id: "demo-cl-3", canonical_text: "frappuccino", submission_count: 31, final_rank: 3 },
  { id: "demo-cl-4", canonical_text: "flat white", submission_count: 24, final_rank: 4 },
  { id: "demo-cl-5", canonical_text: "matcha latte", submission_count: 19, final_rank: 5 },
  { id: "demo-cl-6", canonical_text: "cold brew", submission_count: 15, final_rank: 6 },
  { id: "demo-cl-7", canonical_text: "oat milk latte", submission_count: 12, final_rank: 7 },
  { id: "demo-cl-8", canonical_text: "espresso martini", submission_count: 9, final_rank: 8 },
  { id: "demo-cl-9", canonical_text: "chai latte", submission_count: 7, final_rank: 9 },
  { id: "demo-cl-10", canonical_text: "americano", submission_count: 5, final_rank: 10 },
];

const DEMO_TOTAL = DEMO_CLUSTERS.reduce((s, c) => s + c.submission_count, 0);

export function demoClusterPct(count: number): number {
  return DEMO_TOTAL === 0 ? 0 : count / DEMO_TOTAL;
}
