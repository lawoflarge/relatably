import XCTest
@testable import Relatably

// Task 10 — moderation sheet semantics (core-libs.md §7.3, verbatim):
// local-first hide, best-effort server report, optimistic success alerts.
// This is the Guideline-1.2 contract promised to App Review — order of
// operations and every string are load-bearing.

// MARK: - Recorder (shared ordered event log across store / report / onHidden)

@MainActor
private final class Recorder {
    private(set) var events: [String] = []
    func record(_ event: String) { events.append(event) }
}

// MARK: - Mock store

@MainActor
private final class MockModerationStore: ClusterModerationStoring {
    let recorder: Recorder
    var hideError: Error?
    var blockError: Error?

    private(set) var hidden: [(id: String, text: String)] = []
    private(set) var blocked: [(userId: String, handle: String?)] = []

    init(recorder: Recorder) {
        self.recorder = recorder
    }

    nonisolated func hideCluster(id: String, text: String) throws {
        try MainActor.assumeIsolated {
            if let hideError { throw hideError }
            hidden.append((id: id, text: text))
            recorder.record("hide:\(id)")
        }
    }

    nonisolated func addBlockedUser(userId: String, handle: String?) throws {
        try MainActor.assumeIsolated {
            if let blockError { throw blockError }
            blocked.append((userId: userId, handle: handle))
            recorder.record("block:\(userId)")
        }
    }
}

// MARK: - Tests

@MainActor
final class ClusterModerationTests: XCTestCase {

    private var recorder: Recorder!
    private var store: MockModerationStore!
    private var reportPayloads: [ReportPayload] = []
    private var reportError: Error?

    override func setUp() {
        super.setUp()
        recorder = Recorder()
        store = MockModerationStore(recorder: recorder)
        reportPayloads = []
        reportError = nil
    }

    private func makeModeration() -> ClusterModeration {
        let moderation = ClusterModeration(
            store: store,
            deviceTokenProvider: DeviceTokenProvider(
                store: InMemoryStringStore(),
                ifvProvider: { "TEST-IFV" }
            ),
            report: { [weak self] payload in
                await MainActor.run {
                    self?.recorder.record("report:\(payload.targetId)")
                    self?.reportPayloads.append(payload)
                }
                if let error = self?.reportError { throw error }
            }
        )
        moderation.onHidden = { [weak self] id, _ in
            self?.recorder.record("onHidden:\(id)")
        }
        return moderation
    }

    private func testError(_ message: String) -> NSError {
        NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    // MARK: - Sheet presentation

    func testOpenSheetPublishesTarget() {
        let moderation = makeModeration()
        XCTAssertNil(moderation.target)

        moderation.openSheet(id: "c1", text: "pumpkin spice latte")

        XCTAssertEqual(moderation.target?.id, "c1")
        XCTAssertEqual(moderation.target?.text, "pumpkin spice latte")
    }

    func testSheetTitleWrapsClusterTextInDoubleQuotes() {
        XCTAssertEqual(ClusterModeration.sheetTitle(for: "Bitcoin"), "\"Bitcoin\"")
        XCTAssertEqual(
            ClusterModeration.sheetTitle(for: "pumpkin spice latte"),
            "\"pumpkin spice latte\""
        )
    }

    func testOptionLabelsExact() {
        // Order and wording promised in the App Review notes (core-libs §7.1).
        XCTAssertEqual(ClusterModeration.cancelLabel, "Cancel")
        XCTAssertEqual(ClusterModeration.hideLabel, "Hide this answer")
        XCTAssertEqual(ClusterModeration.reportLabel, "Report this answer")
        XCTAssertEqual(ClusterModeration.blockLabel, "Block this contributor")
    }

    // MARK: - Hide (§7.3 doHide: local only, NO server call)

    func testHideUpdatesStoreFiresOnHiddenAndMakesNoReportCall() {
        let moderation = makeModeration()

        moderation.hide(id: "c1", text: "AI")

        XCTAssertEqual(store.hidden.count, 1)
        XCTAssertEqual(store.hidden.first?.id, "c1")
        XCTAssertEqual(store.hidden.first?.text, "AI")
        XCTAssertEqual(recorder.events, ["hide:c1", "onHidden:c1"])
        XCTAssertTrue(reportPayloads.isEmpty, "plain Hide must make NO server call")
        XCTAssertNil(moderation.alert)
    }

    func testHideFailureShowsCouldntHideAlertAndDoesNotFireOnHidden() {
        store.hideError = testError("disk full")
        let moderation = makeModeration()

        moderation.hide(id: "c1", text: "AI")

        XCTAssertEqual(moderation.alert?.title, "Couldn't hide")
        XCTAssertEqual(moderation.alert?.message, "disk full")
        XCTAssertTrue(recorder.events.isEmpty)
        XCTAssertTrue(reportPayloads.isEmpty)
    }

    // MARK: - Report (§7.3 doReport: hide FIRST, best-effort report, alert ALWAYS)

    func testReportHidesLocallyFirstThenReportsThenAlerts() async {
        let moderation = makeModeration()

        await moderation.reportAnswer(id: "c2", text: "Bitcoin")

        // Order is load-bearing: local removal precedes the network call.
        XCTAssertEqual(recorder.events, ["hide:c2", "onHidden:c2", "report:c2"])
        XCTAssertEqual(reportPayloads, [
            ReportPayload(
                targetType: .cluster,
                targetId: "c2",
                reason: nil,
                deviceToken: "TEST-IFV"
            ),
        ])
        XCTAssertEqual(moderation.alert?.title, "Thanks for reporting")
        XCTAssertEqual(
            moderation.alert?.message,
            "We removed it from your feed and will review within 24 hours."
        )
    }

    func testReportShowsSuccessAlertEvenWhenServerReportThrows() async {
        reportError = testError("offline")
        let moderation = makeModeration()

        await moderation.reportAnswer(id: "c2", text: "Bitcoin")

        XCTAssertEqual(store.hidden.first?.id, "c2")
        XCTAssertEqual(recorder.events, ["hide:c2", "onHidden:c2", "report:c2"])
        // Optimistic alert regardless of server failure (§7.3 semantics 2).
        XCTAssertEqual(moderation.alert?.title, "Thanks for reporting")
        XCTAssertEqual(
            moderation.alert?.message,
            "We removed it from your feed and will review within 24 hours."
        )
    }

    // MARK: - Block (§7.3 doBlock: hide + synthetic blocked user + report + alert)

    func testBlockHidesAddsSyntheticBlockedUserReportsAndAlerts() async {
        let moderation = makeModeration()

        await moderation.block(id: "c3", text: "frappuccino")

        XCTAssertEqual(
            recorder.events,
            ["hide:c3", "block:contributor:c3", "onHidden:c3", "report:c3"]
        )
        XCTAssertEqual(store.blocked.count, 1)
        XCTAssertEqual(store.blocked.first?.userId, "contributor:c3")
        XCTAssertEqual(store.blocked.first?.handle, "frappuccino")
        XCTAssertEqual(reportPayloads, [
            ReportPayload(
                targetType: .cluster,
                targetId: "c3",
                reason: "blocked contributor",
                deviceToken: "TEST-IFV"
            ),
        ])
        XCTAssertEqual(moderation.alert?.title, "Blocked")
        XCTAssertEqual(
            moderation.alert?.message,
            "We won't show this contributor's answers again."
        )
    }

    func testBlockShowsSuccessAlertEvenWhenServerReportThrows() async {
        reportError = testError("offline")
        let moderation = makeModeration()

        await moderation.block(id: "c3", text: "frappuccino")

        XCTAssertEqual(store.hidden.first?.id, "c3")
        XCTAssertEqual(store.blocked.first?.userId, "contributor:c3")
        XCTAssertEqual(moderation.alert?.title, "Blocked")
        XCTAssertEqual(
            moderation.alert?.message,
            "We won't show this contributor's answers again."
        )
    }
}
