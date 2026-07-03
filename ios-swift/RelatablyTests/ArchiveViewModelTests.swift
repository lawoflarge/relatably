import XCTest
@testable import Relatably

// Task 13 — Archive list + detail VM tests per
// docs/superpowers/plans/rn-extraction/archive.md §3 (tab container state),
// §5 (detail state machine + demo fallback), §10 (test vectors).
//
// Load-bearing semantics:
// - Pagination appends (no dedupe — RN `[...prev, ...page.tiles]`), cursor
//   replaced each page, `next_cursor == null` ends pagination.
// - ONE loading flag gates BOTH the initial fetch and load-more (RN §3);
//   loadMore while loading is a no-op → no double-fetch.
// - Initial-load failure alerts "couldn't load archive"; pagination errors
//   are SILENT and retryable.
// - Detail: visibleClusters = real minus hidden; if THAT is empty →
//   DEMO_ARCHIVE_CLUSTERS minus hidden (Guideline 1.2, §5.2 exact predicate).

// MARK: - Mock ArchiveAPI

/// Scriptable ArchiveAPI double. All access happens on the main actor (the
/// VMs are @MainActor and their Tasks inherit that context), hence
/// @unchecked Sendable — same pattern as MockBoardAPI.
final class MockArchiveAPI: ArchiveAPI, @unchecked Sendable {

    var archiveResult: Result<ArchivePage, Error> = .success(ArchivePage(tiles: [], nextCursor: nil))
    /// Optional per-call override, indexed by call order (falls back to `archiveResult`).
    var archiveResultsByCall: [Result<ArchivePage, Error>] = []
    private(set) var archiveCursors: [String?] = []

    /// When true, fetchArchive suspends until `releaseArchiveGate()` — lets
    /// tests hold a load-more in flight.
    var gateArchive = false
    private var gate: CheckedContinuation<Void, Never>?

    func fetchArchive(cursor: String?) async throws -> ArchivePage {
        let index = archiveCursors.count
        archiveCursors.append(cursor)
        if gateArchive {
            await withCheckedContinuation { gate = $0 }
        }
        let chosen = index < archiveResultsByCall.count ? archiveResultsByCall[index] : archiveResult
        return try chosen.get()
    }

    func releaseArchiveGate() {
        gate?.resume()
        gate = nil
    }

    var detailResult: Result<ArchiveDetail, Error> = .failure(APIError.http(404))
    private(set) var detailQuestionIds: [String] = []

    func fetchArchiveDetail(questionId: String) async throws -> ArchiveDetail {
        detailQuestionIds.append(questionId)
        return try detailResult.get()
    }
}

// MARK: - Mock hidden store

final class MockArchiveHiddenStore: ArchiveHiddenReading, @unchecked Sendable {
    var hiddenIds: Set<String> = []
    func hiddenClusterIds() -> Set<String> { hiddenIds }
}

// MARK: - Fixtures (archive.md §10 test vectors)

private func tile(_ i: Int, top: [String] = ["a", "b", "c"]) -> ArchiveTile {
    ArchiveTile(
        questionId: "q-\(i)",
        questionText: "question \(i)?",
        verdictText: top.first ?? "",
        topClusters: top,
        createdAt: "2026-05-0\(9 - i)T00:00:00.000Z"
    )
}

private func page(_ indices: [Int], cursor: String?) -> ArchivePage {
    ArchivePage(tiles: indices.map { tile($0) }, nextCursor: cursor)
}

private let pisaEiffelDetail = ArchiveDetail(
    id: "q1",
    text: "what's the most overrated tourist trap?",
    createdAt: "2026-05-09T00:00:00.000Z",
    topClusters: [
        ArchiveDetailCluster(id: "c1", canonicalText: "Pisa Tower", submissionCount: 412, finalRank: 1, finalPctOfTotal: 0.31),
        ArchiveDetailCluster(id: "c2", canonicalText: "Eiffel Tower", submissionCount: 80, finalRank: 2, finalPctOfTotal: 0.06),
    ]
)

// MARK: - List VM tests

@MainActor
final class ArchiveViewModelTests: XCTestCase {

    private var api: MockArchiveAPI!

    override func setUp() {
        super.setUp()
        api = MockArchiveAPI()
    }

    private func makeVM() -> ArchiveViewModel {
        ArchiveViewModel(api: api)
    }

    // MARK: Initial load (§3 mount effect)

    func testBootLoadsFirstPageAndCursor() async {
        api.archiveResult = .success(page([0, 1], cursor: "c1"))
        let vm = makeVM()
        XCTAssertFalse(vm.loading, "RN loading inits false")
        await vm.boot().value
        XCTAssertEqual(api.archiveCursors, [nil], "initial fetch has no cursor")
        XCTAssertEqual(vm.tiles.map(\.questionId), ["q-0", "q-1"])
        XCTAssertEqual(vm.nextCursor, "c1")
        XCTAssertFalse(vm.loading)
        XCTAssertFalse(vm.showLoadError)
    }

    func testBootIfNeededBootsExactlyOnce() async {
        api.archiveResult = .success(page([0], cursor: nil))
        let vm = makeVM()
        vm.bootIfNeeded()
        vm.bootIfNeeded() // kept-alive tab re-appears → must NOT refetch
        await Task.yield()
        try? await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertEqual(api.archiveCursors.count, 1)
    }

    func testBootFailureShowsAlertAndKeepsEmpty() async {
        api.archiveResult = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertTrue(vm.showLoadError, #"Alert.alert("couldn't load archive")"#)
        XCTAssertEqual(vm.tiles, [])
        XCTAssertNil(vm.nextCursor)
        XCTAssertFalse(vm.loading)
    }

    // MARK: Pagination (§3 onLoadMore verbatim)

    func testLoadMoreAppendsAndThreadsCursor() async {
        api.archiveResultsByCall = [
            .success(page([0, 1], cursor: "c1")),
            .success(page([2], cursor: "c2")),
        ]
        let vm = makeVM()
        await vm.boot().value

        await vm.loadMore().value

        XCTAssertEqual(api.archiveCursors, [nil, "c1"], "cursor threaded into the next fetch")
        XCTAssertEqual(vm.tiles.map(\.questionId), ["q-0", "q-1", "q-2"], "append-only, order preserved, no dedupe")
        XCTAssertEqual(vm.nextCursor, "c2", "cursor replaced each page")
        XCTAssertFalse(vm.loading)
    }

    func testLoadMoreWithoutCursorIsANoOp() async {
        api.archiveResult = .success(page([0], cursor: nil)) // last page
        let vm = makeVM()
        await vm.boot().value

        await vm.loadMore().value

        XCTAssertEqual(api.archiveCursors.count, 1, "next_cursor == null ends pagination")
    }

    func testLoadMoreWhileLoadingIsANoOpNoDoubleFetch() async {
        api.archiveResultsByCall = [
            .success(page([0], cursor: "c1")),
            .success(page([1], cursor: nil)),
        ]
        let vm = makeVM()
        await vm.boot().value

        api.gateArchive = true
        let inFlight = vm.loadMore()
        await Task.yield() // let the fetch start and park on the gate
        let second = vm.loadMore() // loading == true → RN guard returns
        await second.value
        XCTAssertEqual(api.archiveCursors.count, 2, "no second fetch while one is in flight")

        api.gateArchive = false
        api.releaseArchiveGate()
        await inFlight.value
        XCTAssertEqual(vm.tiles.map(\.questionId), ["q-0", "q-1"], "the gated page appended exactly once")
        XCTAssertEqual(api.archiveCursors.count, 2)
    }

    func testLoadMoreErrorIsSilentAndRetryable() async {
        api.archiveResultsByCall = [
            .success(page([0], cursor: "c1")),
            .failure(APIError.http(500)),
            .success(page([1], cursor: nil)),
        ]
        let vm = makeVM()
        await vm.boot().value

        await vm.loadMore().value

        XCTAssertFalse(vm.showLoadError, "pagination errors are silent (no alert)")
        XCTAssertEqual(vm.tiles.map(\.questionId), ["q-0"], "tiles unchanged on error")
        XCTAssertEqual(vm.nextCursor, "c1", "cursor unchanged → user can retry")
        XCTAssertFalse(vm.loading)

        await vm.loadMore().value // scroll back down → retry works
        XCTAssertEqual(api.archiveCursors, [nil, "c1", "c1"])
        XCTAssertEqual(vm.tiles.map(\.questionId), ["q-0", "q-1"])
    }

    // MARK: Copy (byte-equal, §3/§4.2)

    func testListCopyIsVerbatim() {
        XCTAssertEqual(ArchiveViewModel.loadErrorTitle, "couldn't load archive")
        XCTAssertEqual(ArchiveView.emptyHeading, "fresh archive")
        XCTAssertEqual(
            ArchiveView.emptyBody,
            "once you answer your first drop, yesterday's verdict shows up here. come back tomorrow."
        )
        // §9.1: the server never sends date_label → every tile's date tab
        // renders the em-dash fallback.
        XCTAssertEqual(ArchiveView.dateTabFallback, "\u{2014}")
    }
}

// MARK: - Detail VM tests

@MainActor
final class ArchiveDetailViewModelTests: XCTestCase {

    private var api: MockArchiveAPI!
    private var store: MockArchiveHiddenStore!

    override func setUp() {
        super.setUp()
        api = MockArchiveAPI()
        store = MockArchiveHiddenStore()
    }

    private func makeVM(questionId: String = "q1") -> ArchiveDetailViewModel {
        ArchiveDetailViewModel(questionId: questionId, api: api, store: store)
    }

    // MARK: State machine (§5.1/§5.3)

    func testBootFetchesDetailAndReachesReady() async {
        api.detailResult = .success(pisaEiffelDetail)
        let vm = makeVM()
        XCTAssertEqual(vm.state, .loading)
        await vm.boot().value
        XCTAssertEqual(api.detailQuestionIds, ["q1"])
        XCTAssertEqual(vm.state, .ready(pisaEiffelDetail))
        XCTAssertEqual(vm.visibleClusters.map(\.canonicalText), ["Pisa Tower", "Eiffel Tower"])
        XCTAssertEqual(vm.verdict, "Pisa Tower", "headline = top VISIBLE cluster, not a server field")
    }

    func testFetchErrorReachesErrorState() async {
        api.detailResult = .failure(APIError.http(404)) // fetchArchiveDetail 404 THROWS
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.state, .error)
        XCTAssertEqual(vm.visibleClusters, [], "no demo fallback on ERROR — only on ready-but-empty")
    }

    // MARK: Demo fallback (§5.2 exact predicate — Guideline 1.2)

    func testEmptyClustersFallBackToDemo() async {
        api.detailResult = .success(ArchiveDetail(id: "q1", text: "q?", createdAt: "2026-05-09T00:00:00.000Z", topClusters: []))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.visibleClusters, DEMO_ARCHIVE_CLUSTERS)
        XCTAssertEqual(vm.verdict, "pumpkin spice latte")
    }

    func testAllRealHiddenFallsBackToDemoFilteredByHidden() async {
        // §9.4/§9.5: hiding ALL real clusters swaps in the demo list, which
        // ALSO respects hiddenIds.
        store.hiddenIds = ["c1", "c2", "demo-cl-1"]
        api.detailResult = .success(pisaEiffelDetail)
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.visibleClusters, DEMO_ARCHIVE_CLUSTERS.filter { $0.id != "demo-cl-1" })
        XCTAssertEqual(vm.verdict, "caramel macchiato")
    }

    // MARK: Hidden filtering (§5.1 — loaded once on boot; §5.2 handleHidden)

    func testHiddenIdsFromStoreFilterRealClusters() async {
        store.hiddenIds = ["c2"]
        api.detailResult = .success(pisaEiffelDetail)
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.visibleClusters.map(\.id), ["c1"])
    }

    func testHandleHiddenRemovesRowImmediatelyAndRederivesVerdict() async {
        api.detailResult = .success(pisaEiffelDetail)
        let vm = makeVM()
        await vm.boot().value

        vm.handleHidden(id: "c1") // ClusterModeration.onHidden hook

        XCTAssertEqual(vm.visibleClusters.map(\.id), ["c2"])
        XCTAssertEqual(vm.verdict, "Eiffel Tower", "hiding rank 1 changes the headline (§9.4)")
    }

    // MARK: Formatting (§5.4 — pct `toFixed(1)`, date `toLocaleDateString`)

    func testPctLabelFormatsToOneDecimal() {
        XCTAssertEqual(ArchiveDetailViewModel.pctLabel(0.31), "31.0%")
        XCTAssertEqual(ArchiveDetailViewModel.pctLabel(0.06), "6.0%")
        XCTAssertEqual(ArchiveDetailViewModel.pctLabel(DEMO_ARCHIVE_CLUSTERS[0].finalPctOfTotal), "22.6%") // 47/208
    }

    func testFormatDateUsesNumericFullYearInDeviceLocale() {
        // JS toLocaleDateString renders the FULL year ("5/9/2026"), unlike
        // DateFormatter .short ("5/9/26") — localized Mdyyyy template.
        let us = Locale(identifier: "en_US")
        let utc = TimeZone(identifier: "UTC")!
        XCTAssertEqual(ArchiveDetailViewModel.formatDate(iso: "2026-05-09T00:00:00.000Z", locale: us, timeZone: utc), "5/9/2026")
        // Non-fractional ISO also parses.
        XCTAssertEqual(ArchiveDetailViewModel.formatDate(iso: "2026-05-09T00:00:00Z", locale: us, timeZone: utc), "5/9/2026")
        // JS `new Date(garbage).toLocaleDateString()` → "Invalid Date".
        XCTAssertEqual(ArchiveDetailViewModel.formatDate(iso: "garbage", locale: us, timeZone: utc), "Invalid Date")
    }

    // MARK: Copy (byte-equal, §5.3/§5.4 — ⋯ is U+22EF, … is U+2026)

    func testDetailCopyIsVerbatim() {
        XCTAssertEqual(ArchiveDetailView.loadingLabel, "loading\u{2026}")
        XCTAssertEqual(ArchiveDetailView.errorText, "couldn't load this archive entry.")
        XCTAssertEqual(ArchiveDetailView.modHint, "Tap \u{22EF} on any answer to hide or report it")
        XCTAssertEqual(ArchiveDetailView.modDots, "\u{22EF}")
        XCTAssertEqual(ArchiveDetailView.shareLabel, "SHARE")
    }
}
