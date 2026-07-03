import Combine
import XCTest
@testable import Relatably

// Task 15 — ME (settings) VM tests per
// docs/superpowers/plans/rn-extraction/settings-tabbar.md §3 (screen copy,
// state, delete-account flow) and §4 (store semantics). The undo lists are
// the App-Review contract: HIDDEN ANSWERS + BLOCKED USERS must render
// (including the synthetic `contributor:<id>` entries from ClusterModeration
// block) and be reversible with a tap.

// MARK: - Mock MeAPI + order recorder

/// Records the relative order of the delete-account steps: the RN flow is
/// server delete FIRST, then signOut (errors swallowed), then success alert.
final class MeFlowRecorder: @unchecked Sendable {
    var events: [String] = []
}

final class MockMeAPI: MeAPI, @unchecked Sendable {
    let recorder: MeFlowRecorder
    var deleteError: Error?
    private(set) var deleteCalls = 0

    init(recorder: MeFlowRecorder) {
        self.recorder = recorder
    }

    func deleteAccount() async throws {
        deleteCalls += 1
        recorder.events.append("deleteAccount")
        if let deleteError { throw deleteError }
    }
}

private struct TestError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

// MARK: - Tests

@MainActor
final class MeViewModelTests: XCTestCase {

    private var suiteName: String!
    private var defaults: UserDefaults!
    private var store: HiddenContentStore!
    private var recorder: MeFlowRecorder!
    private var api: MockMeAPI!
    /// Thrown by the injected signOut closure when set.
    private var signOutError: Error?
    private var cancellables: Set<AnyCancellable> = []

    override func setUp() {
        super.setUp()
        suiteName = "MeViewModelTests-" + UUID().uuidString
        defaults = UserDefaults(suiteName: suiteName)
        defaults.removePersistentDomain(forName: suiteName)
        store = HiddenContentStore(defaults: defaults)
        recorder = MeFlowRecorder()
        api = MockMeAPI(recorder: recorder)
        signOutError = nil
        cancellables = []
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    private func makeVM() -> MeViewModel {
        let recorder = recorder!
        let getSignOutError = { [weak self] in self?.signOutError }
        return MeViewModel(
            store: store,
            api: api,
            signOut: {
                recorder.events.append("signOut")
                if let error = getSignOutError() { throw error }
            }
        )
    }

    // MARK: Lists load on boot, newest first (store unshift order preserved)

    func testBootLoadsListsNewestFirst() {
        store.hideCluster(id: "c1", text: "AI")
        store.hideCluster(id: "c2", text: "Bitcoin")
        store.addBlockedUser(userId: "u1", handle: "alice")
        store.addBlockedUser(userId: "u2", handle: nil)

        let vm = makeVM()
        XCTAssertEqual(vm.hidden, [], "lists are empty before boot")
        XCTAssertEqual(vm.blocked, [])
        vm.bootIfNeeded()

        XCTAssertEqual(vm.hidden.map(\.id), ["c2", "c1"], "newest hidden first")
        XCTAssertEqual(vm.hidden.map(\.text), ["Bitcoin", "AI"])
        XCTAssertEqual(vm.blocked.map(\.user_id), ["u2", "u1"], "newest block first")
    }

    func testBootRunsOnlyOnce() {
        let vm = makeVM()
        vm.bootIfNeeded()
        store.hideCluster(id: "c9", text: "late")
        vm.bootIfNeeded()
        XCTAssertEqual(vm.hidden, [], "RN mount effect runs once — re-boot is a no-op")
    }

    // MARK: Focus refresh (keep-alive shell equivalent of RN's lazy first-focus mount)

    func testRefreshPicksUpChangesMadeElsewhere() {
        let vm = makeVM()
        vm.bootIfNeeded()
        XCTAssertEqual(vm.hidden, [])

        // Hide + block from another tab (Today walkthrough) while ME stays alive.
        store.hideCluster(id: "c1", text: "AI")
        store.addBlockedUser(userId: "contributor:c1", handle: "AI")

        vm.refresh()

        XCTAssertEqual(vm.hidden.map(\.id), ["c1"])
        XCTAssertEqual(vm.blocked.map(\.user_id), ["contributor:c1"])
    }

    // MARK: Unhide / unblock mutate the store AND the published lists

    func testUnhideMutatesStoreAndPublishedList() {
        store.hideCluster(id: "c1", text: "AI")
        store.hideCluster(id: "c2", text: "Bitcoin")
        let vm = makeVM()
        vm.bootIfNeeded()

        vm.unhide(id: "c1")

        XCTAssertEqual(vm.hidden.map(\.id), ["c2"], "published list drops the row")
        XCTAssertEqual(store.hiddenClusterIds(), ["c2"], "store persisted the unhide")
    }

    func testUnblockMutatesStoreAndPublishedList() {
        store.addBlockedUser(userId: "u1", handle: "alice")
        store.addBlockedUser(userId: "u2", handle: "bob")
        let vm = makeVM()
        vm.bootIfNeeded()

        vm.unblock(userId: "u2")

        XCTAssertEqual(vm.blocked.map(\.user_id), ["u1"])
        XCTAssertEqual(store.blockedUserIds(), ["u1"])
    }

    // MARK: Blocked-row display (RN: handle ?? "@" + user_id.slice(0, 6))

    func testSyntheticContributorEntryDisplaysClusterText() {
        // ClusterModeration.block records `contributor:<clusterId>` with
        // handle = cluster text — the ME tab must render that text verbatim.
        store.addBlockedUser(userId: "contributor:c42", handle: "hot take")
        let vm = makeVM()
        vm.bootIfNeeded()

        XCTAssertEqual(vm.blocked.count, 1)
        XCTAssertEqual(vm.blocked[0].displayName, "hot take")
    }

    func testBlockedRowWithoutHandleFallsBackToUserIdPrefix() {
        store.addBlockedUser(userId: "abcdef1234", handle: nil)
        let vm = makeVM()
        vm.bootIfNeeded()
        XCTAssertEqual(vm.blocked[0].displayName, "@abcdef", "@ + first 6 chars of user_id")
    }

    // MARK: Delete account (§3.2 — order is load-bearing)

    func testDeleteAccountCallsAPIThenSignsOut() async {
        let vm = makeVM()
        var busyValues: [Bool] = []
        vm.$busy.sink { busyValues.append($0) }.store(in: &cancellables)

        await vm.deleteAccountConfirmed()

        XCTAssertEqual(recorder.events, ["deleteAccount", "signOut"], "server delete FIRST, then signOut")
        XCTAssertEqual(vm.alert, MeViewModel.MeAlert(
            title: "Account deleted",
            message: "Your account and personal data have been removed from Relatably."
        ))
        XCTAssertEqual(busyValues, [false, true, false], "busy gates the row during the flow")
    }

    func testDeleteAccountAPIFailureAlertsAndSkipsSignOut() async {
        api.deleteError = TestError(message: "deleteAccount: 500")
        let vm = makeVM()

        await vm.deleteAccountConfirmed()

        XCTAssertEqual(recorder.events, ["deleteAccount"], "NO sign-out after a failed server delete")
        XCTAssertEqual(vm.alert, MeViewModel.MeAlert(
            title: "Couldn't delete account",
            message: "deleteAccount: 500"
        ))
        XCTAssertFalse(vm.busy, "busy cleared in the finally path")
    }

    func testDeleteAccountSignOutFailureIsSwallowed() async {
        // RN: signOut after a successful delete may throw (already-deleted)
        // — swallowed, and the success alert STILL shows.
        signOutError = TestError(message: "no current user")
        let vm = makeVM()

        await vm.deleteAccountConfirmed()

        XCTAssertEqual(recorder.events, ["deleteAccount", "signOut"])
        XCTAssertEqual(vm.alert?.title, "Account deleted")
        XCTAssertFalse(vm.busy)
    }

    // MARK: Sign out (confirm handled by the view; VM performs + error alert)

    func testSignOutConfirmedCallsSignOutSilentlyOnSuccess() {
        let vm = makeVM()
        vm.signOutConfirmed()
        XCTAssertEqual(recorder.events, ["signOut"])
        XCTAssertNil(vm.alert, "no success alert — the auth listener collapses the ACCOUNT card")
    }

    func testSignOutConfirmedFailureAlerts() {
        signOutError = TestError(message: "keychain locked")
        let vm = makeVM()
        vm.signOutConfirmed()
        XCTAssertEqual(vm.alert, MeViewModel.MeAlert(
            title: "Couldn't sign out",
            message: "keychain locked"
        ))
    }

    // MARK: Busy row label (RN: busy ? "Deleting…" : "Delete account")

    func testDeleteRowLabelSwapsWhileBusy() {
        let vm = makeVM()
        XCTAssertEqual(vm.deleteRowLabel, "Delete account")
    }

    // MARK: Mailto / link URLs (byte-exact, encodeURIComponent semantics)

    func testContactMailtoURLVerbatim() {
        XCTAssertEqual(
            MeViewModel.contactMailtoURL,
            "mailto:levin.schwab@gmx.de?subject=Relatably%20support"
        )
    }

    func testReportMailtoURLVerbatim() {
        // encodeURIComponent leaves the apostrophe unescaped and encodes
        // "/" as %2F and "\n" as %0A — port exactly.
        XCTAssertEqual(
            MeViewModel.reportMailtoURL,
            "mailto:levin.schwab@gmx.de"
                + "?subject=Report%20inappropriate%20content%20%2F%20abusive%20user%20on%20Relatably"
                + "&body=Please%20describe%20what%20you'd%20like%20to%20report.%20We%20respond%20within%2024%20hours.%0A%0A"
        )
        XCTAssertNotNil(URL(string: MeViewModel.reportMailtoURL), "must be a parseable URL")
    }

    func testLegalLinkURLs() {
        // TosGate precedent: legal links pin the PRODUCTION base, never a
        // debug -apiBaseURL override.
        XCTAssertEqual(MeViewModel.tosURL, "https://relatably.vercel.app/tos")
        XCTAssertEqual(MeViewModel.privacyURL, "https://relatably.vercel.app/privacy")
    }

    // MARK: Verbatim copy (settings-tabbar.md §3.1)

    func testStaticCopyVerbatim() {
        XCTAssertEqual(MeViewModel.supportEmail, "levin.schwab@gmx.de")
        XCTAssertEqual(MeViewModel.signOutConfirmTitle, "Sign out?")
        XCTAssertEqual(
            MeViewModel.signOutConfirmMessage,
            "Your device will go back to anonymous mode. Your data on the server stays put."
        )
        XCTAssertEqual(MeViewModel.deleteConfirmTitle, "Delete your account?")
        XCTAssertEqual(
            MeViewModel.deleteConfirmMessage,
            "This permanently removes your profile, leaderboard entries, and friend graph, "
                + "and revokes your Sign in with Apple link to Relatably. Past answers are "
                + "anonymised but stay in the wordcloud. This can't be undone."
        )
        XCTAssertEqual(
            MeViewModel.mailUnavailableMessage,
            "Please email levin.schwab@gmx.de from any email app. We respond within 24 hours."
        )
        XCTAssertEqual(
            MeViewModel.signedOutHint,
            "You're playing anonymously. Sign in with Apple from the Friends tab to unlock the leaderboard."
        )
        XCTAssertEqual(MeViewModel.footerText, "© 2026 Levin Schwab · v1.0")
    }
}
