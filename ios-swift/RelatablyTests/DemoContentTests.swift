import XCTest
@testable import Relatably

/// Fixtures ported verbatim from ios/src/lib/demoContent.ts via
/// docs/superpowers/plans/rn-extraction/board-demo.md §7 (full file quote),
/// wordcloud.md §1 (demo clusters), archive.md (DEMO_ARCHIVE_CLUSTERS).
final class DemoContentTests: XCTestCase {

    // MARK: - DEMO_QUESTION

    func testDemoQuestionVerbatim() {
        XCTAssertEqual(DEMO_QUESTION.id, "demo-reviewer-drop")
        XCTAssertEqual(DEMO_QUESTION.text, "what's the most overrated coffee order?")
    }

    // MARK: - DEMO_LEADERBOARD

    func testLeaderboardHasEightUsers() {
        XCTAssertEqual(DEMO_LEADERBOARD.count, 8)
    }

    func testLeaderboardFirstEntryIsMaya() {
        let first = DEMO_LEADERBOARD[0]
        XCTAssertEqual(first.userId, "demo-maya")
        XCTAssertEqual(first.handle, "maya")
        XCTAssertEqual(first.score, 1840)
        XCTAssertEqual(first.dailyRank, 1)
        XCTAssertEqual(first.locale, "en")
    }

    func testLeaderboardAllEntriesVerbatim() {
        let expected: [(userId: String, handle: String, score: Int, rank: Int)] = [
            ("demo-maya", "maya", 1840, 1),
            ("demo-leo", "leo", 1620, 2),
            ("demo-aisha", "aisha", 1475, 3),
            ("demo-theo", "theo", 1290, 4),
            ("demo-nina", "nina", 1130, 5),
            ("demo-omar", "omar", 980, 6),
            ("demo-ruby", "ruby", 845, 7),
            ("demo-kai", "kai", 710, 8),
        ]
        XCTAssertEqual(DEMO_LEADERBOARD.count, expected.count)
        for (i, exp) in expected.enumerated() {
            let entry = DEMO_LEADERBOARD[i]
            XCTAssertEqual(entry.userId, exp.userId, "userId at index \(i)")
            XCTAssertEqual(entry.handle, exp.handle, "handle at index \(i)")
            XCTAssertEqual(entry.score, exp.score, "score at index \(i)")
            XCTAssertEqual(entry.dailyRank, exp.rank, "dailyRank at index \(i)")
            XCTAssertEqual(entry.locale, "en", "locale at index \(i)")
        }
    }

    // MARK: - DEMO_CLUSTERS

    func testClustersHaveTenEntries() {
        XCTAssertEqual(DEMO_CLUSTERS.count, 10)
    }

    func testClustersVerbatim() {
        let expected: [(id: String, text: String, count: Int)] = [
            ("demo-cl-1", "pumpkin spice latte", 47),
            ("demo-cl-2", "caramel macchiato", 39),
            ("demo-cl-3", "frappuccino", 31),
            ("demo-cl-4", "flat white", 24),
            ("demo-cl-5", "matcha latte", 19),
            ("demo-cl-6", "cold brew", 15),
            ("demo-cl-7", "oat milk latte", 12),
            ("demo-cl-8", "espresso martini", 9),
            ("demo-cl-9", "chai latte", 7),
            ("demo-cl-10", "americano", 5),
        ]
        XCTAssertEqual(DEMO_CLUSTERS.count, expected.count)
        for (i, exp) in expected.enumerated() {
            XCTAssertEqual(DEMO_CLUSTERS[i].id, exp.id, "id at index \(i)")
            XCTAssertEqual(DEMO_CLUSTERS[i].canonicalText, exp.text, "canonicalText at index \(i)")
            XCTAssertEqual(DEMO_CLUSTERS[i].submissionCount, exp.count, "submissionCount at index \(i)")
        }
    }

    // MARK: - DEMO_ARCHIVE_CLUSTERS

    func testArchiveClustersCountAndFirstEntry() {
        XCTAssertEqual(DEMO_ARCHIVE_CLUSTERS.count, 10)
        let first = DEMO_ARCHIVE_CLUSTERS[0]
        XCTAssertEqual(first.id, "demo-cl-1")
        XCTAssertEqual(first.canonicalText, "pumpkin spice latte")
        XCTAssertEqual(first.finalRank, 1)
        XCTAssertEqual(first.finalPctOfTotal, 47.0 / 208.0, accuracy: 1e-12)
    }

    func testArchiveClustersRanksAreOneToN() {
        for (i, cluster) in DEMO_ARCHIVE_CLUSTERS.enumerated() {
            XCTAssertEqual(cluster.finalRank, i + 1, "finalRank at index \(i)")
        }
    }

    func testArchiveClustersPercentagesAreExactFractionsOf208() {
        // DEMO_TOTAL = 47+39+31+24+19+15+12+9+7+5 = 208 (board-demo.md §7).
        let counts = [47, 39, 31, 24, 19, 15, 12, 9, 7, 5]
        XCTAssertEqual(DEMO_ARCHIVE_CLUSTERS.count, counts.count)
        for (i, count) in counts.enumerated() {
            XCTAssertEqual(
                DEMO_ARCHIVE_CLUSTERS[i].finalPctOfTotal,
                Double(count) / 208.0,
                accuracy: 1e-12,
                "finalPctOfTotal at index \(i)"
            )
        }
        let pctSum = DEMO_ARCHIVE_CLUSTERS.reduce(0.0) { $0 + $1.finalPctOfTotal }
        XCTAssertEqual(pctSum, 1.0, accuracy: 1e-9)
    }

    func testArchiveClustersMirrorClusterIdsAndTexts() {
        XCTAssertEqual(DEMO_ARCHIVE_CLUSTERS.count, DEMO_CLUSTERS.count)
        for (archive, cluster) in zip(DEMO_ARCHIVE_CLUSTERS, DEMO_CLUSTERS) {
            XCTAssertEqual(archive.id, cluster.id)
            XCTAssertEqual(archive.canonicalText, cluster.canonicalText)
            XCTAssertEqual(archive.submissionCount, cluster.submissionCount)
        }
    }
}
