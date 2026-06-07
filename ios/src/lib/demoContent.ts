// Permanent reviewer / demo content for App Store Review Guideline 1.2 (client copy).
//
// Mirrors api/src/lib/demoContent.ts. Used as an OFFLINE / EMPTY fallback so the
// Board and the wordcloud are never blank for App Review — even if the backend is
// unreachable, or a brand-new daily drop has no answers yet. Without this, the
// reviewer can have nothing to hide / report / block, which is the exact reason
// Relatably kept getting rejected under Guideline 1.2.
//
// All entries are deliberately innocuous (coffee orders) so a reviewer can
// immediately exercise the moderation controls on real-looking, clearly
// non-objectionable content.

import type { LeaderboardEntry } from "@/src/types/api";
import type { Cluster } from "@/src/screens/WordcloudScreen";

export const DEMO_QUESTION = {
  id: "demo-reviewer-drop",
  text: "what's the most overrated coffee order?",
};

// 8 demo users for the Board. Stable user_ids so block/report can target them.
export const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { user_id: "demo-maya", handle: "maya", score: 1840, daily_rank: 1, locale: "en" },
  { user_id: "demo-leo", handle: "leo", score: 1620, daily_rank: 2, locale: "en" },
  { user_id: "demo-aisha", handle: "aisha", score: 1475, daily_rank: 3, locale: "en" },
  { user_id: "demo-theo", handle: "theo", score: 1290, daily_rank: 4, locale: "en" },
  { user_id: "demo-nina", handle: "nina", score: 1130, daily_rank: 5, locale: "en" },
  { user_id: "demo-omar", handle: "omar", score: 980, daily_rank: 6, locale: "en" },
  { user_id: "demo-ruby", handle: "ruby", score: 845, daily_rank: 7, locale: "en" },
  { user_id: "demo-kai", handle: "kai", score: 710, daily_rank: 8, locale: "en" },
];

const DEMO_CLUSTER_SEED: { id: string; canonical_text: string; submission_count: number }[] = [
  { id: "demo-cl-1", canonical_text: "pumpkin spice latte", submission_count: 47 },
  { id: "demo-cl-2", canonical_text: "caramel macchiato", submission_count: 39 },
  { id: "demo-cl-3", canonical_text: "frappuccino", submission_count: 31 },
  { id: "demo-cl-4", canonical_text: "flat white", submission_count: 24 },
  { id: "demo-cl-5", canonical_text: "matcha latte", submission_count: 19 },
  { id: "demo-cl-6", canonical_text: "cold brew", submission_count: 15 },
  { id: "demo-cl-7", canonical_text: "oat milk latte", submission_count: 12 },
  { id: "demo-cl-8", canonical_text: "espresso martini", submission_count: 9 },
  { id: "demo-cl-9", canonical_text: "chai latte", submission_count: 7 },
  { id: "demo-cl-10", canonical_text: "americano", submission_count: 5 },
];

const DEMO_TOTAL = DEMO_CLUSTER_SEED.reduce((s, c) => s + c.submission_count, 0);

// Wordcloud shape (Home).
export const DEMO_CLUSTERS: Cluster[] = DEMO_CLUSTER_SEED.map((c) => ({
  id: c.id,
  canonical_text: c.canonical_text,
  submission_count: c.submission_count,
}));

// Archive-detail shape (ranked list with percentages).
export const DEMO_ARCHIVE_CLUSTERS = DEMO_CLUSTER_SEED.map((c, i) => ({
  id: c.id,
  canonical_text: c.canonical_text,
  final_rank: i + 1,
  final_pct_of_total: c.submission_count / DEMO_TOTAL,
}));
