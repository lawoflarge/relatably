import Foundation

// Permanent reviewer / demo content for App Store Review Guideline 1.2 (client copy).
//
// Ported verbatim from ios/src/lib/demoContent.ts (mirrors api/src/lib/demoContent.ts).
// Used as an OFFLINE / EMPTY fallback so the Board and the wordcloud are never blank
// for App Review — even if the backend is unreachable, or a brand-new daily drop has
// no answers yet. Without this, the reviewer can have nothing to hide / report /
// block, which is the exact reason Relatably kept getting rejected under Guideline 1.2.
//
// All entries are deliberately innocuous (coffee orders) so a reviewer can
// immediately exercise the moderation controls on real-looking, clearly
// non-objectionable content.

let DEMO_QUESTION = TodayQuestion(
    id: "demo-reviewer-drop",
    text: "what's the most overrated coffee order?"
)

// 8 demo users for the Board. Stable user_ids so block/report can target them.
let DEMO_LEADERBOARD: [LeaderboardEntry] = [
    LeaderboardEntry(userId: "demo-maya", handle: "maya", score: 1840, dailyRank: 1, locale: "en"),
    LeaderboardEntry(userId: "demo-leo", handle: "leo", score: 1620, dailyRank: 2, locale: "en"),
    LeaderboardEntry(userId: "demo-aisha", handle: "aisha", score: 1475, dailyRank: 3, locale: "en"),
    LeaderboardEntry(userId: "demo-theo", handle: "theo", score: 1290, dailyRank: 4, locale: "en"),
    LeaderboardEntry(userId: "demo-nina", handle: "nina", score: 1130, dailyRank: 5, locale: "en"),
    LeaderboardEntry(userId: "demo-omar", handle: "omar", score: 980, dailyRank: 6, locale: "en"),
    LeaderboardEntry(userId: "demo-ruby", handle: "ruby", score: 845, dailyRank: 7, locale: "en"),
    LeaderboardEntry(userId: "demo-kai", handle: "kai", score: 710, dailyRank: 8, locale: "en"),
]

/// Wordcloud cluster shape (RN `Cluster` from WordcloudScreen: id / canonical_text /
/// submission_count). The live wordcloud type doesn't exist yet (Task 10); this small
/// struct matches what it consumes.
struct DemoCluster: Identifiable, Equatable {
    let id: String
    let canonicalText: String
    let submissionCount: Int
}

private let DEMO_CLUSTER_SEED: [DemoCluster] = [
    DemoCluster(id: "demo-cl-1", canonicalText: "pumpkin spice latte", submissionCount: 47),
    DemoCluster(id: "demo-cl-2", canonicalText: "caramel macchiato", submissionCount: 39),
    DemoCluster(id: "demo-cl-3", canonicalText: "frappuccino", submissionCount: 31),
    DemoCluster(id: "demo-cl-4", canonicalText: "flat white", submissionCount: 24),
    DemoCluster(id: "demo-cl-5", canonicalText: "matcha latte", submissionCount: 19),
    DemoCluster(id: "demo-cl-6", canonicalText: "cold brew", submissionCount: 15),
    DemoCluster(id: "demo-cl-7", canonicalText: "oat milk latte", submissionCount: 12),
    DemoCluster(id: "demo-cl-8", canonicalText: "espresso martini", submissionCount: 9),
    DemoCluster(id: "demo-cl-9", canonicalText: "chai latte", submissionCount: 7),
    DemoCluster(id: "demo-cl-10", canonicalText: "americano", submissionCount: 5),
]

private let DEMO_TOTAL = DEMO_CLUSTER_SEED.reduce(0) { $0 + $1.submissionCount } // = 208

// Wordcloud shape (Home).
let DEMO_CLUSTERS: [DemoCluster] = DEMO_CLUSTER_SEED

// Archive-detail shape (ranked list with percentages). Percentages stay computed
// fractions of DEMO_TOTAL, not rounded literals. The RN objects omit
// submission_count (the screen never uses it); Swift's ArchiveDetailCluster
// requires it, so it carries the true seed count.
let DEMO_ARCHIVE_CLUSTERS: [ArchiveDetailCluster] = DEMO_CLUSTER_SEED.enumerated().map { i, c in
    ArchiveDetailCluster(
        id: c.id,
        canonicalText: c.canonicalText,
        submissionCount: c.submissionCount,
        finalRank: i + 1,
        finalPctOfTotal: Double(c.submissionCount) / Double(DEMO_TOTAL)
    )
}
