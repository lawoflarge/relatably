import XCTest
@testable import Relatably

// Task 9 — Today state machine tests (docs/superpowers/plans/rn-extraction/home-flow.md
// §2 state machine, §10 test vectors, §11 edge cases + the plan's 12 s boot watchdog,
// THE fix for App Store rejection 2.1(a)).

// MARK: - Mock HomeAPI

/// Scriptable HomeAPI double. All access happens on the main actor (the VM is
/// @MainActor and every call site is a main-actor task), hence @unchecked Sendable.
final class MockHomeAPI: HomeAPI, @unchecked Sendable {

    var yesterdayResult: Result<Yesterday?, Error> = .success(nil)
    var todayResult: Result<TodayQuestion, Error> = .success(
        TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")
    )
    var archiveResult: Result<ArchivePage, Error> = .success(
        ArchivePage(tiles: [], nextCursor: nil)
    )
    var submitResult: Result<SubmitResponse, Error> = .success(
        SubmitResponse(clusterId: "c-1", submissionCount: 7, normalizedText: "tacos", submissionId: "s-1")
    )

    /// When true, fetchTodayQuestion parks on a never-resuming continuation —
    /// the plan's "STALLED API" watchdog vector.
    var stallToday = false

    private(set) var yesterdayTokens: [String?] = []
    private(set) var todayCallCount = 0
    private(set) var archiveCallCount = 0
    private(set) var submitRequests: [SubmitRequest] = []

    /// Called at the top of fetchTodayQuestion — used to record call order
    /// for the reveal-complete ordering test.
    var onFetchToday: (() -> Void)?

    func fetchYesterday(deviceToken: String?) async throws -> Yesterday? {
        yesterdayTokens.append(deviceToken)
        return try yesterdayResult.get()
    }

    func fetchTodayQuestion() async throws -> TodayQuestion {
        todayCallCount += 1
        onFetchToday?()
        if stallToday {
            await withCheckedContinuation { (_: CheckedContinuation<Void, Never>) in }
        }
        return try todayResult.get()
    }

    func fetchArchive(cursor: String?) async throws -> ArchivePage {
        archiveCallCount += 1
        return try archiveResult.get()
    }

    func submitAnswer(_ request: SubmitRequest) async throws -> SubmitResponse {
        submitRequests.append(request)
        return try submitResult.get()
    }
}

// MARK: - Fixtures

private let answeredYesterday = Yesterday(
    id: "y-1",
    text: "YESTERDAY'S QUESTION",
    topClusters: [],
    selfClusterId: "yc-1"
)

private let unansweredYesterday = Yesterday(
    id: "y-1",
    text: "YESTERDAY'S QUESTION",
    topClusters: [],
    selfClusterId: nil
)

private let archiveTile = ArchiveTile(
    questionId: "q-archived",
    questionText: "AN OLDER QUESTION",
    verdictText: "the world said — tacos",
    topClusters: ["tacos"],
    createdAt: "2026-07-01T00:00:00Z"
)

// MARK: - Tests

@MainActor
final class HomeViewModelTests: XCTestCase {

    private var api: MockHomeAPI!
    private var revealStoreBacking: InMemoryStringStore!
    private var deviceStoreBacking: InMemoryStringStore!

    override func setUp() {
        super.setUp()
        api = MockHomeAPI()
        revealStoreBacking = InMemoryStringStore()
        deviceStoreBacking = InMemoryStringStore()
    }

    private func makeVM(
        clusters: [WordcloudCluster] = [],
        watchdogInterval: TimeInterval? = nil
    ) -> HomeViewModel {
        let deviceTokenProvider = DeviceTokenProvider(
            store: deviceStoreBacking,
            ifvProvider: { "TEST-IFV" }
        )
        if let watchdogInterval {
            return HomeViewModel(
                api: api,
                deviceTokenProvider: deviceTokenProvider,
                revealStore: RevealStore(store: revealStoreBacking),
                clusterSource: StaticClusterSource(clusters: clusters),
                watchdogInterval: watchdogInterval
            )
        }
        return HomeViewModel(
            api: api,
            deviceTokenProvider: deviceTokenProvider,
            revealStore: RevealStore(store: revealStoreBacking),
            clusterSource: StaticClusterSource(clusters: clusters)
        )
    }

    /// Polls on the main actor until `condition` holds or `timeout` elapses.
    private func waitUntil(
        timeout: TimeInterval = 2,
        _ condition: @escaping () -> Bool
    ) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if condition() { return true }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        return condition()
    }

    // MARK: Boot

    func testBootWithNoYesterdayLoadsQuestion() async {
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        XCTAssertFalse(vm.exploringPast)
        // deviceToken threaded into fetchYesterday
        XCTAssertEqual(api.yesterdayTokens, ["TEST-IFV"])
    }

    func testBootWithUnseenAnsweredYesterdayShowsReveal() async {
        api.yesterdayResult = .success(answeredYesterday)
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .reveal(answeredYesterday))
        // Reveal short-circuits — today's question is NOT fetched yet.
        XCTAssertEqual(api.todayCallCount, 0)
    }

    func testBootWithSeenYesterdayLoadsQuestion() async {
        api.yesterdayResult = .success(answeredYesterday)
        revealStoreBacking.preload("reveal_seen_y-1", "1")
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
    }

    func testBootWithUnansweredYesterdaySkipsReveal() async {
        // §2.2: reveal needs self_cluster_id non-null — user never answered it.
        api.yesterdayResult = .success(unansweredYesterday)
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
    }

    func testYesterdayFetchErrorIsSwallowedAndFallsThroughToQuestion() async {
        // §2.2: any error in the yesterday step is swallowed (RN try/catch).
        api.yesterdayResult = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        XCTAssertNil(vm.errorMsg)
    }

    // MARK: loadQuestion 404 → archive fallback (§2.3, App-Review-critical)

    func testTodayFourOhFourSubstitutesNewestArchiveTile() async {
        api.todayResult = .failure(APIError.http(404))
        api.archiveResult = .success(ArchivePage(tiles: [archiveTile], nextCursor: nil))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-archived", text: "AN OLDER QUESTION")))
        XCTAssertTrue(vm.exploringPast)
        XCTAssertEqual(api.archiveCallCount, 1)
    }

    func testTodayFourOhFourWithEmptyArchiveShowsNoDrop() async {
        api.todayResult = .failure(APIError.http(404))
        api.archiveResult = .success(ArchivePage(tiles: [], nextCursor: nil))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .noDrop)
    }

    func testTodayFourOhFourWithArchiveErrorShowsNoDrop() async {
        // RN parity (§2.3 verbatim): fetchArchive().catch(() => setPhase("no_drop")).
        api.todayResult = .failure(APIError.http(404))
        api.archiveResult = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .noDrop)
    }

    func testTodayNonFourOhFourErrorShowsErrorPhaseWithMessage() async {
        api.todayResult = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .error)
        // §10: message "fetchTodayQuestion: 500" shown on the error card.
        XCTAssertEqual(vm.errorMsg, "fetchTodayQuestion: 500")
    }

    // MARK: Watchdog (the 2.1(a) fix)

    func testProductionWatchdogDefaultIsTwelveSeconds() {
        XCTAssertEqual(HomeViewModel.defaultWatchdogInterval, 12)
        XCTAssertEqual(makeVM().watchdogInterval, 12)
    }

    func testStalledBootForcesErrorWithinWatchdogDeadline() async {
        api.stallToday = true
        let vm = makeVM(watchdogInterval: 0.5)
        vm.boot()
        let reachedError = await waitUntil(timeout: 2) { vm.phase == .error }
        XCTAssertTrue(reachedError, "watchdog must force .error while boot is stalled")
    }

    func testWatchdogNeverOverwritesResolvedPhase() async {
        let vm = makeVM(watchdogInterval: 0.3)
        await vm.boot().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        // Let the (cancelled) watchdog deadline pass — phase must not flip.
        try? await Task.sleep(nanoseconds: 600_000_000)
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
    }

    // MARK: Retry

    func testRetryAfterErrorLoadsQuestion() async {
        api.todayResult = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .error)

        api.todayResult = .success(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?"))
        await vm.retry().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        XCTAssertNil(vm.errorMsg)
    }

    func testRetryAfterStalledWatchdogErrorRecovers() async {
        // The stalled first fetch never returns; retry must not be blocked by
        // the stale in-flight guard, and the stale attempt must not overwrite
        // the new phase later.
        api.stallToday = true
        let vm = makeVM(watchdogInterval: 0.3)
        vm.boot()
        let reachedError = await waitUntil(timeout: 2) { vm.phase == .error }
        XCTAssertTrue(reachedError)

        api.stallToday = false
        await vm.retry().value
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
    }

    // MARK: Submit (§2.7)

    func testSubmitSendsUntrimmedTextWithDwellAndEntersWordcloud() async {
        let vm = makeVM()
        await vm.boot().value

        await vm.submit(answer: "  spicy take  ")

        XCTAssertEqual(vm.phase, .wordcloud(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        XCTAssertEqual(api.submitRequests.count, 1)
        let request = api.submitRequests[0]
        XCTAssertEqual(request.rawText, "  spicy take  ", "raw_text is sent UNTRIMMED")
        XCTAssertEqual(request.questionId, "q-today")
        XCTAssertEqual(request.deviceToken, "TEST-IFV")
        XCTAssertGreaterThanOrEqual(request.dwellMs, 0)
        XCTAssertLessThan(request.dwellMs, 10_000)
        // SubmitResponse retained for Task 10 (wordcloud).
        XCTAssertEqual(vm.selfClusterId, "c-1")
        XCTAssertEqual(vm.selfSubmissionId, "s-1")
    }

    func testSubmitFailureStaysInQuestionAndShowsServerError() async {
        api.submitResult = .failure(APIError.server("too spicy"))
        let vm = makeVM()
        await vm.boot().value

        await vm.submit(answer: "x")

        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        XCTAssertEqual(vm.errorMsg, "too spicy")
    }

    // MARK: Reveal completion ordering (§2.6 — App-Review-relevant)

    func testRevealCompleteMarksSeenBeforeHookThenLoadsQuestion() async {
        api.yesterdayResult = .success(answeredYesterday)
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.phase, .reveal(answeredYesterday))

        var order: [String] = []
        var seenFlagAtHookTime: String?
        vm.postRevealHook = { [revealStoreBacking] in
            order.append("hook")
            seenFlagAtHookTime = revealStoreBacking?.storage["reveal_seen_y-1"]
        }
        api.onFetchToday = { order.append("fetchToday") }

        await vm.revealComplete().value

        XCTAssertEqual(order, ["hook", "fetchToday"])
        XCTAssertEqual(seenFlagAtHookTime, "1", "markRevealSeen must run BEFORE the ad hook")
        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
    }

    // MARK: Live counter (§2.5 / §10)

    func testLiveCountIsSumOfAllClusterCounts() async {
        let vm = makeVM(clusters: [
            WordcloudCluster(id: "a", text: "tacos", count: 3),
            WordcloudCluster(id: "b", text: "pizza", count: 2),
        ])
        await vm.boot().value
        let delivered = await waitUntil { vm.liveCount == 5 }
        XCTAssertTrue(delivered, "liveCount must be Σ submission_count over the snapshot")
    }

    // MARK: Delete-own-answer reset (§2.8)

    func testAnswerDeletedResetsToQuestionPhase() async {
        let vm = makeVM()
        await vm.boot().value
        await vm.submit(answer: "mine")
        guard case .wordcloud = vm.phase else {
            return XCTFail("expected wordcloud after submit")
        }
        let renderedBefore = vm.renderedAt

        try? await Task.sleep(nanoseconds: 20_000_000)
        vm.answerDeleted()

        XCTAssertEqual(vm.phase, .question(TodayQuestion(id: "q-today", text: "WOULD YOU RATHER?")))
        XCTAssertEqual(vm.text, "")
        XCTAssertNil(vm.selfClusterId)
        XCTAssertNil(vm.selfSubmissionId)
        XCTAssertGreaterThan(vm.renderedAt, renderedBefore, "dwell timer must restart")
    }
}

// MARK: - Component logic vectors (§10)

final class LiveCounterFormatTests: XCTestCase {

    func testLabelUsesEnLocaleGrouping() {
        XCTAssertEqual(LiveCounter.label(for: 1234), "1,234 VOTES AND COUNTING")
    }

    func testLabelShowsAtZero() {
        // §11.6: the counter shows even at 0 — no hiding.
        XCTAssertEqual(LiveCounter.label(for: 0), "0 VOTES AND COUNTING")
    }
}

final class SubmitButtonGateTests: XCTestCase {

    func testMinDwellIsThreeSeconds() {
        XCTAssertEqual(SubmitButton.minDwellMs, 3000)
    }

    func testDwellBoundaryIsInclusive() {
        // §10: gate uses elapsed >= 3000 — 3000 ms exactly ⇒ met.
        let start = Date(timeIntervalSince1970: 1_000)
        XCTAssertTrue(SubmitButton.dwellSatisfied(startedAt: start, now: start.addingTimeInterval(3.0)))
        XCTAssertFalse(SubmitButton.dwellSatisfied(startedAt: start, now: start.addingTimeInterval(2.999)))
    }

    func testEnabledRequiresDwellAndText() {
        // §10 vectors 1–3.
        XCTAssertFalse(SubmitButton.isEnabled(dwellMet: false, hasText: true))
        XCTAssertFalse(SubmitButton.isEnabled(dwellMet: true, hasText: false))
        XCTAssertTrue(SubmitButton.isEnabled(dwellMet: true, hasText: true))
    }
}
