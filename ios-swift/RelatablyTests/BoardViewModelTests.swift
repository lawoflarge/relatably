import XCTest
@testable import Relatably

// Task 12 — Board (leaderboard) VM tests per
// docs/superpowers/plans/rn-extraction/board-demo.md §4 (state logic), §8
// (edge cases). The Guideline-1.2 demo-fallback matrix is load-bearing:
// GLOBAL empty/error → DEMO_LEADERBOARD; FRIENDS scope is NEVER faked.

// MARK: - Mock BoardAPI

/// Scriptable BoardAPI double. All access happens on the main actor (the VM
/// is @MainActor and every call site is a main-actor task), hence @unchecked
/// Sendable — same pattern as MockHomeAPI.
final class MockBoardAPI: BoardAPI, @unchecked Sendable {

    /// Default scripted result for every call.
    var result: Result<LeaderboardResponse, Error> = .success(LeaderboardResponse(entries: []))
    /// Optional per-call override, indexed by call order (falls back to `result`).
    var resultsByCall: [Result<LeaderboardResponse, Error>] = []

    private(set) var calls: [(period: LeaderboardPeriod, scope: LeaderboardScope, limit: Int?)] = []

    func fetchLeaderboard(
        period: LeaderboardPeriod,
        scope: LeaderboardScope,
        limit: Int?
    ) async throws -> LeaderboardResponse {
        let index = calls.count
        calls.append((period, scope, limit))
        let chosen = index < resultsByCall.count ? resultsByCall[index] : result
        return try chosen.get()
    }
}

// MARK: - Mock store + remote

final class MockBoardStore: BoardModerationStoring, @unchecked Sendable {
    var blockedIds: Set<String> = []
    var addError: Error?
    private(set) var added: [(userId: String, handle: String?)] = []

    func blockedUserIds() -> Set<String> { blockedIds }

    func addBlockedUser(userId: String, handle: String?) throws {
        if let addError { throw addError }
        added.append((userId, handle))
        blockedIds.insert(userId)
    }
}

/// Records the best-effort server calls the moderation actions make.
final class MockBoardRemote: @unchecked Sendable {
    var blockError: Error?
    var reportError: Error?
    private(set) var blockedUserIds: [String] = []
    private(set) var reportPayloads: [ReportPayload] = []

    func blockUser(_ userId: String) async throws {
        blockedUserIds.append(userId)
        if let blockError { throw blockError }
    }

    func report(_ payload: ReportPayload) async throws {
        reportPayloads.append(payload)
        if let reportError { throw reportError }
    }
}

// MARK: - Fixtures

private func entry(
    _ id: String,
    handle: String? = nil,
    score: Int = 100,
    rank: Int? = nil
) -> LeaderboardEntry {
    LeaderboardEntry(userId: id, handle: handle, score: score, dailyRank: rank, locale: "en")
}

// MARK: - Tests

@MainActor
final class BoardViewModelTests: XCTestCase {

    private var api: MockBoardAPI!
    private var store: MockBoardStore!
    private var remote: MockBoardRemote!

    override func setUp() {
        super.setUp()
        api = MockBoardAPI()
        store = MockBoardStore()
        remote = MockBoardRemote()
    }

    private func makeVM(currentUserId: String? = nil) -> BoardViewModel {
        let remote = remote!
        return BoardViewModel(
            api: api,
            store: store,
            deviceTokenProvider: DeviceTokenProvider(
                store: InMemoryStringStore(),
                ifvProvider: { "TEST-IFV" }
            ),
            blockUserRemote: { try await remote.blockUser($0) },
            report: { try await remote.report($0) },
            currentUserId: currentUserId
        )
    }

    // MARK: Initial load (§4.2 — default period daily, scope global, no limit)

    func testBootFetchesDailyGlobalWithoutLimit() async {
        api.result = .success(LeaderboardResponse(entries: [entry("u1", handle: "@a", score: 1500, rank: 1)]))
        let vm = makeVM()
        XCTAssertTrue(vm.loading, "loading starts true")
        await vm.boot().value
        XCTAssertEqual(api.calls.count, 1)
        XCTAssertEqual(api.calls[0].period, .daily)
        XCTAssertEqual(api.calls[0].scope, .global)
        XCTAssertNil(api.calls[0].limit)
        XCTAssertEqual(vm.entries, [entry("u1", handle: "@a", score: 1500, rank: 1)])
        XCTAssertFalse(vm.loading)
    }

    // MARK: Demo fallback matrix (§8.1 — Guideline 1.2, global scope ONLY)

    func testGlobalEmptySuccessFallsBackToDemoLeaderboard() async {
        api.result = .success(LeaderboardResponse(entries: []))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.entries, DEMO_LEADERBOARD)
        XCTAssertFalse(vm.loading)
    }

    func testGlobalErrorFallsBackToDemoLeaderboard() async {
        api.result = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.entries, DEMO_LEADERBOARD)
        XCTAssertFalse(vm.loading)
    }

    func testFriendsEmptySuccessIsNeverFaked() async {
        let vm = makeVM()
        vm.isSignedIn = true
        await vm.boot().value
        api.result = .success(LeaderboardResponse(entries: []))
        await vm.setScope(.friends).value
        XCTAssertEqual(vm.entries, [], "friends scope must show 'no entries yet', not demo rows")
    }

    func testFriendsErrorIsNeverFaked() async {
        api.resultsByCall = [
            .success(LeaderboardResponse(entries: [entry("u1")])),
            .failure(APIError.http(500)),
        ]
        let vm = makeVM()
        vm.isSignedIn = true
        await vm.boot().value
        await vm.setScope(.friends).value
        XCTAssertEqual(vm.entries, [], "friends fetch error → [] (RN sets [] in catch)")
        XCTAssertFalse(vm.loading)
    }

    // MARK: Friends-scope SIWA gate (§8.6)

    func testFriendsScopeTapWhileSignedOutIsANoOp() async {
        let vm = makeVM()
        await vm.boot().value
        XCTAssertFalse(vm.effectiveSignedIn)

        await vm.setScope(.friends).value

        XCTAssertEqual(vm.scope, .global, "FRIENDS pill is disabled when signed out")
        XCTAssertEqual(api.calls.count, 1, "no friends API call may fire while signed out")
    }

    func testAuthBumpFromInlineSignInEnablesFriendsScope() async {
        let vm = makeVM()
        await vm.boot().value
        vm.signedIn() // RN onSignedIn={() => setAuthBump(n => n + 1)}
        XCTAssertTrue(vm.effectiveSignedIn)

        await vm.setScope(.friends).value

        XCTAssertEqual(vm.scope, .friends)
        XCTAssertEqual(api.calls.count, 2)
        XCTAssertEqual(api.calls[1].scope, .friends)
    }

    // MARK: Period/scope changes drive query params (§4.2 deps [period, scope])

    func testPeriodChangeRefetchesWithNewPeriod() async {
        let vm = makeVM()
        await vm.boot().value

        await vm.setPeriod(.alltime).value

        XCTAssertEqual(vm.period, .alltime)
        XCTAssertEqual(api.calls.count, 2)
        XCTAssertEqual(api.calls[1].period, .alltime)
        XCTAssertEqual(api.calls[1].scope, .global)
    }

    func testSelectingActivePeriodDoesNotRefetch() async {
        // React bails out on same-value setState → the effect never re-runs.
        let vm = makeVM()
        await vm.boot().value
        await vm.setPeriod(.daily).value
        XCTAssertEqual(api.calls.count, 1)
    }

    func testStaleFetchNeverOverwritesNewerSelection() async {
        // §4.2 cancellation flag: a superseded fetch's result is dropped.
        api.resultsByCall = [
            .success(LeaderboardResponse(entries: [entry("stale")])),
            .success(LeaderboardResponse(entries: [entry("fresh")])),
        ]
        let vm = makeVM()
        let first = vm.boot()
        let second = vm.setPeriod(.weekly)
        await first.value
        await second.value
        XCTAssertEqual(vm.entries.map(\.userId), ["fresh"])
    }

    // MARK: Blocked-user filtering (§4.3) + rank derivation (§4.4 / §8.7)

    func testBlockedIdsAreFilteredOutOfRows() async {
        store.blockedIds = ["u2"]
        api.result = .success(LeaderboardResponse(entries: [
            entry("u1", rank: 1), entry("u2", rank: 2), entry("u3", rank: 3),
        ]))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.rows.map(\.entry.userId), ["u1", "u3"])
        // Server-ranked entries keep their original numbers — a gap appears.
        XCTAssertEqual(vm.rows.map(\.rank), [1, 3])
    }

    func testRanksWithoutServerRankRenumberFromFilteredIndex() async {
        store.blockedIds = ["u2"]
        api.result = .success(LeaderboardResponse(entries: [
            entry("u1"), entry("u2"), entry("u3"),
        ]))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.rows.map(\.rank), [1, 2], "no daily_rank → contiguous index+1 of the FILTERED list")
    }

    func testBlockedDemoUserStaysHiddenOnDemoFallback() async {
        // §8.2: demo user_ids are stable, so a reviewer's block persists.
        store.blockedIds = ["demo-maya"]
        api.result = .failure(APIError.http(500))
        let vm = makeVM()
        await vm.boot().value
        XCTAssertEqual(vm.rows.count, DEMO_LEADERBOARD.count - 1)
        XCTAssertFalse(vm.rows.contains { $0.entry.userId == "demo-maya" })
    }

    // MARK: Block action (§4.7 doBlock — offline-first, server best-effort)

    func testBlockRecordsLocallyRemovesRowAndSwallowsServerError() async {
        api.result = .success(LeaderboardResponse(entries: [entry("u1", handle: "maya"), entry("u2")]))
        remote.blockError = APIError.http(401) // anonymous — expected and ignored
        let vm = makeVM()
        await vm.boot().value

        await vm.blockUser(userId: "u1", handle: "maya")

        XCTAssertEqual(store.added.map(\.userId), ["u1"], "local store records the block FIRST")
        XCTAssertEqual(store.added[0].handle, "maya")
        XCTAssertEqual(remote.blockedUserIds, ["u1"], "server endpoint hit best-effort")
        XCTAssertFalse(vm.rows.contains { $0.entry.userId == "u1" }, "row disappears immediately")
        // Success alert fires even though the server call failed (§8.3).
        XCTAssertEqual(vm.alert, BoardViewModel.BoardAlert(
            title: "Blocked",
            message: "We won't show this user's content again."
        ))
    }

    func testBlockLocalStoreFailureShowsCouldntBlock() async {
        struct StoreDown: LocalizedError { var errorDescription: String? { "disk full" } }
        api.result = .success(LeaderboardResponse(entries: [entry("u1")]))
        store.addError = StoreDown()
        let vm = makeVM()
        await vm.boot().value

        await vm.blockUser(userId: "u1", handle: nil)

        XCTAssertEqual(vm.alert?.title, "Couldn't block")
        XCTAssertEqual(vm.alert?.message, "disk full")
        XCTAssertTrue(remote.blockedUserIds.isEmpty, "server call only after a successful local block")
        XCTAssertTrue(vm.rows.contains { $0.entry.userId == "u1" }, "row stays — nothing was blocked")
    }

    // MARK: Report action (§4.7 doReport — device token, no sign-in needed)

    func testReportSendsUserPayloadWithDeviceToken() async {
        let vm = makeVM()
        await vm.boot().value

        await vm.reportUser(userId: "u9")

        XCTAssertEqual(remote.reportPayloads, [ReportPayload(
            targetType: .user,
            targetId: "u9",
            reason: nil,
            deviceToken: "TEST-IFV"
        )])
        XCTAssertEqual(vm.alert, BoardViewModel.BoardAlert(
            title: "Thanks for reporting",
            message: "We'll review this account within 24 hours."
        ))
    }

    func testReportFailureShowsCouldntReport() async {
        struct ReportDown: LocalizedError { var errorDescription: String? { "offline" } }
        remote.reportError = ReportDown()
        let vm = makeVM()
        await vm.boot().value

        await vm.reportUser(userId: "u9")

        XCTAssertEqual(vm.alert?.title, "Couldn't report")
        XCTAssertEqual(vm.alert?.message, "offline")
    }

    // MARK: Sheet target (§1 — action-sheet title is the display handle)

    func testSheetTargetDisplayHandleFallsBackToAnon() {
        let vm = makeVM()
        vm.openSheet(userId: "u1", handle: nil)
        XCTAssertEqual(vm.sheetTarget?.displayHandle, "anon")
        vm.openSheet(userId: "u2", handle: "maya")
        XCTAssertEqual(vm.sheetTarget?.displayHandle, "maya")
    }

    // MARK: Sheet strings (byte-equal; NOT the cluster sheet's strings)

    func testBoardSheetStringsAreVerbatim() {
        XCTAssertEqual(BoardViewModel.cancelLabel, "Cancel")
        XCTAssertEqual(BoardViewModel.blockLabel, "Block this user")
        XCTAssertEqual(BoardViewModel.reportLabel, "Report this user")
    }

    // MARK: streak_days decoding (§8.13 — optional untyped extra on the entry)

    func testLeaderboardEntryDecodesOptionalStreakDays() throws {
        let json = #"{"user_id":"u1","handle":"maya","score":10,"locale":"en","streak_days":12}"#
        let decoded = try JSONDecoder().decode(LeaderboardEntry.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.streakDays, 12)

        let without = #"{"user_id":"u2","handle":null,"score":5,"locale":"en"}"#
        let decodedWithout = try JSONDecoder().decode(LeaderboardEntry.self, from: Data(without.utf8))
        XCTAssertNil(decodedWithout.streakDays)
    }
}
