import XCTest
import SwiftUI
@testable import Relatably

// Task 16 — share pipeline per docs/superpowers/plans/rn-extraction/reveal-share.md:
// URL building (§2.2), trackShare payload + ordering (§2/§7.4: failure ABORTS the
// share — no PNG, no sheet, silent), card builders (§1.3/§1.6 math), and
// ImageRenderer output shape per banner type (§4: 9:16 story format).

@MainActor
final class ShareCardTests: XCTestCase {

    // MARK: - Fixtures (reveal-share.md §6 cluster fixture)

    private func makeYesterday(selfClusterId: String?) -> Yesterday {
        let clusters: [YesterdayCluster] = (0..<10).map { i -> YesterdayCluster in
            YesterdayCluster(
                id: "c-\(i + 1)",
                canonicalText: "answer-\(i + 1)",
                submissionCount: 1000 - i * 100,
                finalRank: i + 1,
                finalPctOfTotal: Double(1000 - i * 100) / 5500
            )
        }
        return Yesterday(
            id: "q1",
            text: "what's overrated?",
            topClusters: clusters,
            selfClusterId: selfClusterId
        )
    }

    private let todaysTakeCard = ShareCard.todaysTake(
        questionText: "what's the most overrated tourist trap?",
        userAnswer: "eiffel tower",
        date: "2026-07-02"
    )

    private let verdictCard = ShareCard.verdict(
        verdictText: "pisa tower",
        satellites: [VerdictSatellite(canonicalText: "eiffel tower", finalRank: 2)],
        userRank: 14,
        percentile: 87,
        date: "May 8, 2026"
    )

    private let calledItCard = ShareCard.calledIt(
        verdictText: "pisa tower",
        clusterCount: 412381,
        handle: "ick_of_the_day",
        date: "May 8, 2026"
    )

    // MARK: - Share URL (§2.2 fallback URL, encodeURIComponent semantics)

    func testShareURLFromReferralCode() {
        // Test vector 2b: referral_code "abc.def" → https://relatably.app/?r=abc.def
        XCTAssertEqual(
            ShareCardPresenter.shareURL(referralCode: "abc.def"),
            "https://relatably.app/?r=abc.def"
        )
    }

    func testShareURLPercentEncodesReferralCode() {
        XCTAssertEqual(
            ShareCardPresenter.shareURL(referralCode: "a b/c+d"),
            "https://relatably.app/?r=a%20b%2Fc%2Bd"
        )
    }

    // MARK: - Recorder seams

    private final class Recorder: ShareAPI {
        enum Event: Equatable {
            case track(ShareTrackRequest)
            case render
            case present(URL)
        }

        var events: [Event] = []
        var result: Result<ShareTrackResponse, Error> =
            .success(ShareTrackResponse(referralCode: "abc.def"))

        func trackShare(_ request: ShareTrackRequest) async throws -> ShareTrackResponse {
            events.append(.track(request))
            return try result.get()
        }
    }

    private func makePresenter(
        recorder: Recorder,
        renderData: Data? = Data([0x01, 0x02, 0x03])
    ) -> ShareCardPresenter {
        ShareCardPresenter(
            api: recorder,
            renderPNG: { _ in
                recorder.events.append(.render)
                return renderData
            },
            presentSheet: { url in
                recorder.events.append(.present(url))
            }
        )
    }

    // MARK: - trackShare payload per banner type (§2.1: exact body)

    func testTrackSharePayloadTodaysTake() async {
        let recorder = Recorder()
        _ = await makePresenter(recorder: recorder).share(card: todaysTakeCard, questionId: "q1")
        let expected = Recorder.Event.track(
            ShareTrackRequest(bannerType: .todaysTake, questionId: "q1", shareTarget: .system)
        )
        XCTAssertEqual(recorder.events.first, expected)
    }

    func testTrackSharePayloadVerdict() async {
        let recorder = Recorder()
        _ = await makePresenter(recorder: recorder).share(card: verdictCard, questionId: "q2")
        let expected = Recorder.Event.track(
            ShareTrackRequest(bannerType: .verdict, questionId: "q2", shareTarget: .system)
        )
        XCTAssertEqual(recorder.events.first, expected)
    }

    func testTrackSharePayloadCalledIt() async {
        let recorder = Recorder()
        _ = await makePresenter(recorder: recorder).share(card: calledItCard, questionId: "q3")
        let expected = Recorder.Event.track(
            ShareTrackRequest(bannerType: .calledIt, questionId: "q3", shareTarget: .system)
        )
        XCTAssertEqual(recorder.events.first, expected)
    }

    // MARK: - Order of operations (§2: track → capture → sheet) + result

    func testShareOrderIsTrackThenRenderThenPresent() async throws {
        let recorder = Recorder()
        let result = await makePresenter(recorder: recorder)
            .share(card: verdictCard, questionId: "q2")

        XCTAssertEqual(recorder.events.count, 3)
        let expectedTrack = Recorder.Event.track(
            ShareTrackRequest(bannerType: .verdict, questionId: "q2", shareTarget: .system)
        )
        XCTAssertEqual(recorder.events[0], expectedTrack)
        XCTAssertEqual(recorder.events[1], Recorder.Event.render)
        guard case .present(let url) = recorder.events[2] else {
            return XCTFail("expected present event, got \(recorder.events[2])")
        }
        XCTAssertEqual(url.pathExtension, "png")
        // The tmp file holds exactly the rendered PNG bytes (§2: tmpfile capture).
        XCTAssertEqual(try Data(contentsOf: url), Data([0x01, 0x02, 0x03]))

        let unwrapped = try XCTUnwrap(result)
        XCTAssertEqual(unwrapped.referralCode, "abc.def")
        XCTAssertEqual(unwrapped.shareURL, "https://relatably.app/?r=abc.def")
    }

    /// §7.4 verbatim: trackShare failure aborts the WHOLE share — no PNG, no
    /// share sheet, no user-visible error (callers only console.warn in RN).
    func testTrackShareFailureAbortsShareSilently() async {
        let recorder = Recorder()
        recorder.result = .failure(APIError.http(500))
        let result = await makePresenter(recorder: recorder)
            .share(card: verdictCard, questionId: "q2")

        XCTAssertNil(result)
        let expectedTrack = Recorder.Event.track(
            ShareTrackRequest(bannerType: .verdict, questionId: "q2", shareTarget: .system)
        )
        XCTAssertEqual(recorder.events, [expectedTrack])
    }

    func testRenderFailureAbortsPresentationSilently() async {
        let recorder = Recorder()
        let result = await makePresenter(recorder: recorder, renderData: nil)
            .share(card: verdictCard, questionId: "q2")

        XCTAssertNil(result)
        XCTAssertEqual(recorder.events.count, 2) // track + render attempt, no present
        XCTAssertEqual(recorder.events[1], Recorder.Event.render)
    }

    // MARK: - Reveal card builders (§1.3 rank math + §1.6 satellite slice)

    func testRevealVerdictCardBuilder() {
        let card = ShareCard.revealVerdict(yesterday: makeYesterday(selfClusterId: "c-3"))
        // slice(1, 7) of rank-ascending clusters → ranks 2..7; rank 3 of 10 →
        // percentile floor((10-3+1)/10*100) = 80; dateLabel never passed → "".
        var expectedSatellites: [VerdictSatellite] = []
        for rank in 2...7 {
            expectedSatellites.append(VerdictSatellite(canonicalText: "answer-\(rank)", finalRank: rank))
        }
        let expected = ShareCard.verdict(
            verdictText: "answer-1",
            satellites: expectedSatellites,
            userRank: 3,
            percentile: 80,
            date: ""
        )
        XCTAssertEqual(card, expected)
    }

    func testRevealVerdictCardBuilderAnonymous() {
        let card = ShareCard.revealVerdict(yesterday: makeYesterday(selfClusterId: nil))
        guard case .verdict(_, _, let userRank, let percentile, _) = card else {
            return XCTFail("expected verdict card")
        }
        XCTAssertNil(userRank)
        XCTAssertNil(percentile)
    }

    func testRevealVerdictPercentileBounds() {
        // §1.3 examples: 10 clusters, rank 1 → 100; rank 10 → 10.
        guard case .verdict(_, _, let rank1, let pct1, _) =
                ShareCard.revealVerdict(yesterday: makeYesterday(selfClusterId: "c-1")),
              case .verdict(_, _, let rank10, let pct10, _) =
                ShareCard.revealVerdict(yesterday: makeYesterday(selfClusterId: "c-10")) else {
            return XCTFail("expected verdict cards")
        }
        XCTAssertEqual(rank1, 1)
        XCTAssertEqual(pct1, 100)
        XCTAssertEqual(rank10, 10)
        XCTAssertEqual(pct10, 10)
    }

    /// §1.3: findIndex === -1 → (−1+1)||null → null (unknown self cluster id).
    func testRevealVerdictUnknownSelfClusterIsAnonymous() {
        let card = ShareCard.revealVerdict(yesterday: makeYesterday(selfClusterId: "not-there"))
        guard case .verdict(_, _, let userRank, let percentile, _) = card else {
            return XCTFail("expected verdict card")
        }
        XCTAssertNil(userRank)
        XCTAssertNil(percentile)
    }

    func testRevealCalledItCardBuilder() {
        let card = ShareCard.revealCalledIt(yesterday: makeYesterday(selfClusterId: "c-1"))
        // §1.6: clusterCount = verdict.submission_count; §7.7: no handle → nil
        // (renders "@anonymous"), no dateLabel → "".
        let expected = ShareCard.calledIt(
            verdictText: "answer-1",
            clusterCount: 1000,
            handle: nil,
            date: ""
        )
        XCTAssertEqual(card, expected)
    }

    // MARK: - Wordcloud dateLabel (wordcloud.md: toISOString().slice(0,10) = UTC)

    func testWordcloudDateLabelIsUTCCalendarDate() {
        XCTAssertEqual(WordcloudView.dateLabel(now: Date(timeIntervalSince1970: 0)), "1970-01-01")
        // 2026-07-02T23:30:00Z — UTC date regardless of device timezone.
        XCTAssertEqual(WordcloudView.dateLabel(now: Date(timeIntervalSince1970: 1_783_035_000)), "2026-07-02")
    }

    // MARK: - ImageRenderer output (§4: 1080×1920 9:16 story, rendered @3x)

    func testRendererProducesExpectedAspectPerBannerType() throws {
        for card in [todaysTakeCard, verdictCard, calledItCard] {
            let data = try XCTUnwrap(
                ShareCardPresenter.renderCardPNG(card),
                "no PNG for \(card.bannerType)"
            )
            let image = try XCTUnwrap(UIImage(data: data), "undecodable PNG for \(card.bannerType)")
            // UIImage(data:) has scale 1 → size is the pixel size: 1080×1920 pt @3x.
            XCTAssertEqual(image.size.width, 3240, accuracy: 1, "width for \(card.bannerType)")
            XCTAssertEqual(image.size.height, 5760, accuracy: 1, "height for \(card.bannerType)")
            XCTAssertEqual(image.size.width / image.size.height, 0.5625, accuracy: 0.001)
        }
    }

    // MARK: - Verification artifacts (rendered card per banner type → repo)

    /// Writes one rendered card PNG per banner type to ios-swift/verification/
    /// share-cards/ (scale 1 = 1080×1920, the RN-exact pixel size) so the card
    /// composition can be inspected against reveal-share.md §4. Skips when the
    /// repo checkout isn't reachable from the simulator (e.g. CI).
    func testWriteVerificationCardPNGs() throws {
        let dir = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // RelatablyTests/
            .deletingLastPathComponent()   // ios-swift/
            .appendingPathComponent("verification/share-cards", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            throw XCTSkip("repo checkout not writable from test host: \(error)")
        }

        let cards: [(String, ShareCard)] = [
            ("todays_take", todaysTakeCard),
            ("verdict", verdictCard),
            ("called_it", calledItCard),
        ]
        for (name, card) in cards {
            let renderer = ImageRenderer(content: card.cardView)
            renderer.scale = 1
            let data = try XCTUnwrap(renderer.uiImage?.pngData(), "no PNG for \(name)")
            try data.write(to: dir.appendingPathComponent("\(name).png"))
        }
    }
}
