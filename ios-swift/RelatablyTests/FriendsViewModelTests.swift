import XCTest
@testable import Relatably

// Task 14 — Friends VM tests per
// docs/superpowers/plans/rn-extraction/friends-auth.md §4 (state machine),
// §7 (edge cases), §8 (test vectors). The RN screen is ONE flat list (no
// incoming/outgoing/accepted sections); accept affordance + tag are derived
// per row from direction/status.

// MARK: - Mock FriendsAPI

/// Scriptable FriendsAPI double — same @unchecked Sendable pattern as
/// MockBoardAPI (all access happens on the main actor).
final class MockFriendsAPI: FriendsAPI, @unchecked Sendable {

    /// Default scripted fetch result.
    var fetchResult: Result<FriendsResponse, Error> = .success(FriendsResponse(friendships: []))
    /// Optional per-call override, indexed by call order (falls back to `fetchResult`).
    var fetchResultsByCall: [Result<FriendsResponse, Error>] = []
    private(set) var fetchCalls = 0

    var acceptResult: Result<FriendMutationResponse, Error> =
        .success(FriendMutationResponse(id: "x", status: "accepted"))
    private(set) var acceptedIds: [String] = []

    var removeError: Error?
    private(set) var removedIds: [String] = []

    var blockError: Error?
    private(set) var blockedUserIds: [String] = []

    func fetchFriends() async throws -> FriendsResponse {
        let index = fetchCalls
        fetchCalls += 1
        let chosen = index < fetchResultsByCall.count ? fetchResultsByCall[index] : fetchResult
        return try chosen.get()
    }

    func acceptFriend(friendshipId: String) async throws -> FriendMutationResponse {
        acceptedIds.append(friendshipId)
        return try acceptResult.get()
    }

    func removeFriend(friendshipId: String) async throws {
        removedIds.append(friendshipId)
        if let removeError { throw removeError }
    }

    func blockUser(targetUserId: String) async throws {
        blockedUserIds.append(targetUserId)
        if let blockError { throw blockError }
    }
}

// MARK: - Mock store

final class MockFriendsStore: FriendsBlockStoring, @unchecked Sendable {
    var addError: Error?
    private(set) var added: [(userId: String, handle: String?)] = []

    func addBlockedUser(userId: String, handle: String?) throws {
        if let addError { throw addError }
        added.append((userId, handle))
    }
}

// MARK: - Fixtures (friends-auth.md §8)

private func friendship(
    id: String = "f1",
    userId: String = "u-2",
    handle: String? = "alice",
    locale: String = "en",
    status: Friendship.Status = .accepted,
    direction: Friendship.Direction = .outgoing
) -> Friendship {
    Friendship(
        id: id,
        friendUserId: userId,
        handle: handle,
        locale: locale,
        status: status,
        direction: direction
    )
}

private struct TestError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

// MARK: - Tests

@MainActor
final class FriendsViewModelTests: XCTestCase {

    private var api: MockFriendsAPI!
    private var store: MockFriendsStore!

    override func setUp() {
        super.setUp()
        api = MockFriendsAPI()
        store = MockFriendsStore()
    }

    private func makeVM() -> FriendsViewModel {
        FriendsViewModel(api: api, store: store)
    }

    /// Boot the VM and await the mount auth-effect (if it fetched).
    private func boot(_ vm: FriendsViewModel) async {
        vm.bootIfNeeded()
        await vm.effectTask?.value
    }

    // MARK: Signed-out boot (§4.1 — effect immediately clears loading, no fetch)

    func testBootSignedOutDoesNotFetchAndEndsLoading() async {
        let vm = makeVM()
        XCTAssertTrue(vm.loading, "loading starts true")
        await boot(vm)
        XCTAssertEqual(api.fetchCalls, 0, "no friends fetch while signed out")
        XCTAssertFalse(vm.loading, "signed-out effect clears the spinner immediately")
        XCTAssertEqual(vm.friendships, [])
    }

    // MARK: Signed-in boot (§8 vector 2)

    func testBootSignedInFetchesFriendships() async {
        api.fetchResult = .success(FriendsResponse(friendships: [friendship()]))
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)
        XCTAssertEqual(api.fetchCalls, 1)
        XCTAssertEqual(vm.friendships, [friendship()])
        XCTAssertFalse(vm.loading)
    }

    func testFetchFailureIsSilentEmptyList() async {
        // §7.3 — fetch errors are swallowed: [] + empty-state copy, NO alert.
        api.fetchResult = .failure(APIError.http(500))
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)
        XCTAssertEqual(vm.friendships, [])
        XCTAssertNil(vm.alert)
        XCTAssertFalse(vm.loading)
    }

    // MARK: Auth-state reactivity (effect deps [effectiveSignedIn])

    func testSignInTransitionTriggersFetch() async {
        api.fetchResult = .success(FriendsResponse(friendships: [friendship()]))
        let vm = makeVM()
        await boot(vm)
        XCTAssertEqual(api.fetchCalls, 0)

        vm.isSignedIn = true
        await vm.effectTask?.value

        XCTAssertEqual(api.fetchCalls, 1)
        XCTAssertEqual(vm.friendships, [friendship()])
    }

    func testRepeatedSignedInWritesDoNotRefetch() async {
        // React bails out when the effect dep is unchanged.
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)
        vm.isSignedIn = true
        await vm.effectTask?.value
        XCTAssertEqual(api.fetchCalls, 1)
    }

    func testSignOutClearsFriendshipsWithoutFetching() async {
        api.fetchResult = .success(FriendsResponse(friendships: [friendship()]))
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)
        XCTAssertEqual(vm.friendships, [friendship()])

        vm.isSignedIn = false
        await vm.effectTask?.value

        XCTAssertEqual(api.fetchCalls, 1, "sign-out never fetches")
        XCTAssertEqual(vm.friendships, [], "state resets on sign-out")
        XCTAssertFalse(vm.loading)
    }

    func testAuthBumpFromInlineSignInTriggersFetchWithoutSpinner() async {
        // §7.1 — after a bump from the signed-out gate, loading is already
        // false: the list renders (briefly empty) while the fetch runs.
        api.fetchResult = .success(FriendsResponse(friendships: [friendship()]))
        let vm = makeVM()
        await boot(vm)

        vm.signedIn()

        XCTAssertTrue(vm.effectiveSignedIn)
        XCTAssertFalse(vm.loading, "no spinner after the gate flips")
        await vm.effectTask?.value
        XCTAssertEqual(api.fetchCalls, 1)
        XCTAssertEqual(vm.friendships, [friendship()])
    }

    func testAuthBumpKeepsScreenSignedInWhenPropStaysFalse() async {
        // §7.1 — once authBump > 0 the screen stays signed in even if the
        // Firebase listener still reports signed-out (no reset, no refetch).
        let vm = makeVM()
        await boot(vm)
        vm.signedIn()
        await vm.effectTask?.value
        XCTAssertEqual(api.fetchCalls, 1)

        vm.isSignedIn = false // effectiveSignedIn unchanged (bump wins)
        await vm.effectTask?.value

        XCTAssertTrue(vm.effectiveSignedIn)
        XCTAssertEqual(api.fetchCalls, 1, "effect dep unchanged → no re-run")
    }

    // MARK: Accept (§4.1 onAccept — accept then FULL refetch, §8 vector 3)

    func testAcceptCallsAPIThenRefetchesWholeList() async {
        let pending = friendship(id: "f2", userId: "u-3", handle: "bob", locale: "de", status: .pending, direction: .incoming)
        api.fetchResultsByCall = [
            .success(FriendsResponse(friendships: [pending])),
            .success(FriendsResponse(friendships: [])),
        ]
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.accept(friendshipId: "f2")

        XCTAssertEqual(api.acceptedIds, ["f2"])
        XCTAssertEqual(api.fetchCalls, 2, "accept refetches rather than patching the row")
        XCTAssertEqual(vm.friendships, [], "list reflects the refetch result")
        XCTAssertNil(vm.alert)
    }

    func testAcceptFailureShowsCouldntAcceptAlert() async {
        let pending = friendship(id: "f2", status: .pending, direction: .incoming)
        api.fetchResult = .success(FriendsResponse(friendships: [pending]))
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)
        api.acceptResult = .failure(TestError(message: "acceptFriend: 401"))

        await vm.accept(friendshipId: "f2")

        XCTAssertEqual(vm.alert, FriendsViewModel.FriendsAlert(
            title: "couldn't accept",
            message: "acceptFriend: 401"
        ))
        XCTAssertEqual(vm.friendships, [pending], "list untouched on failure")
        XCTAssertEqual(api.fetchCalls, 1, "no refetch after a failed accept")
    }

    func testAcceptSucceedingButRefetchFailingAlsoAlerts() async {
        // RN wraps accept AND the refetch in one try — a refetch error
        // surfaces as "couldn't accept" too.
        api.fetchResultsByCall = [
            .success(FriendsResponse(friendships: [friendship(id: "f2", status: .pending, direction: .incoming)])),
            .failure(TestError(message: "fetchFriends: 500")),
        ]
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.accept(friendshipId: "f2")

        XCTAssertEqual(vm.alert?.title, "couldn't accept")
        XCTAssertEqual(vm.alert?.message, "fetchFriends: 500")
    }

    // MARK: Remove (§4.2 doRemove — DELETE, no success alert, row STAYS)

    func testRemoveDeletesServerSideAndKeepsRowVisible() async {
        // §7.5 — FriendsScreen never wires onBlocked, so the row is NOT
        // removed from the visible list until the next fetch.
        let f = friendship()
        api.fetchResult = .success(FriendsResponse(friendships: [f]))
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.remove(f)

        XCTAssertEqual(api.removedIds, ["f1"])
        XCTAssertEqual(vm.friendships, [f], "row stays until next screen load (RN parity)")
        XCTAssertNil(vm.alert, "no success alert on remove")
    }

    func testRemoveFailureShowsCouldntRemove() async {
        api.removeError = TestError(message: "removeFriend: 500")
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.remove(friendship())

        XCTAssertEqual(vm.alert, FriendsViewModel.FriendsAlert(
            title: "Couldn't remove",
            message: "removeFriend: 500"
        ))
    }

    // MARK: Block (§4.2 doBlock — remote FIRST, then local persist, alert)

    func testBlockCallsRemoteThenStoreAndAlerts() async {
        let f = friendship()
        api.fetchResult = .success(FriendsResponse(friendships: [f]))
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.block(f)

        XCTAssertEqual(api.blockedUserIds, ["u-2"], "server block targets friend_user_id")
        XCTAssertEqual(store.added.map(\.userId), ["u-2"])
        XCTAssertEqual(store.added[0].handle, "alice")
        XCTAssertEqual(vm.alert, FriendsViewModel.FriendsAlert(
            title: "Blocked",
            message: "We won't show their content again."
        ))
        XCTAssertEqual(vm.friendships, [f], "row stays (onBlocked not wired)")
    }

    func testBlockRemoteFailureSkipsStoreAndShowsCouldntBlock() async {
        // Unlike the Board's doBlock, the Friends row blocks remote-FIRST:
        // a server failure means no local persistence either.
        api.blockError = TestError(message: "blockUser failed: 500")
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.block(friendship())

        XCTAssertTrue(store.added.isEmpty, "local add only after a successful server block")
        XCTAssertEqual(vm.alert, FriendsViewModel.FriendsAlert(
            title: "Couldn't block",
            message: "blockUser failed: 500"
        ))
    }

    func testBlockLocalStoreFailureShowsCouldntBlock() async {
        store.addError = TestError(message: "disk full")
        let vm = makeVM()
        vm.isSignedIn = true
        await boot(vm)

        await vm.block(friendship())

        XCTAssertEqual(api.blockedUserIds, ["u-2"], "remote call happened first")
        XCTAssertEqual(vm.alert?.title, "Couldn't block")
        XCTAssertEqual(vm.alert?.message, "disk full")
    }

    // MARK: Sheet target (long-press → ActionSheet titled with the display name)

    func testOpenSheetSetsTarget() {
        let vm = makeVM()
        let f = friendship()
        vm.openSheet(f)
        XCTAssertEqual(vm.sheetTarget, f)
    }

    func testSheetStringsAreVerbatim() {
        XCTAssertEqual(FriendsViewModel.cancelLabel, "Cancel")
        XCTAssertEqual(FriendsViewModel.removeLabel, "Remove from friends")
        XCTAssertEqual(FriendsViewModel.blockLabel, "Block this user")
    }

    // MARK: Header derivation (§7.16 — "(0)" is never shown)

    func testHeaderTitleOmitsZeroCount() async {
        let vm = makeVM()
        XCTAssertEqual(vm.headerTitle, "your friends")

        api.fetchResult = .success(FriendsResponse(friendships: [
            friendship(id: "f1"), friendship(id: "f2"), friendship(id: "f3"),
        ]))
        vm.isSignedIn = true
        await boot(vm)
        XCTAssertEqual(vm.headerTitle, "your friends (3)")
    }

    // MARK: Row derivations (§8 derived fixtures — display / initial / tag / accept)

    func testRowDerivationWithHandle() {
        let f = friendship(userId: "u-2", handle: "alice", status: .accepted, direction: .outgoing)
        XCTAssertEqual(f.displayName, "alice")
        XCTAssertEqual(f.avatarInitial, "A")
        XCTAssertEqual(f.statusTag, "OUTGOING")
        XCTAssertFalse(f.showsAccept)
    }

    func testRowDerivationWithoutHandleUsesUserIdPrefix() {
        let f = friendship(userId: "abcdef1234", handle: nil, status: .pending, direction: .incoming)
        XCTAssertEqual(f.displayName, "@abcdef", "@ + first 6 chars of friend_user_id")
        XCTAssertEqual(f.avatarInitial, "A", "initial from the RAW first char, never the @")
        XCTAssertEqual(f.statusTag, "PENDING")
        XCTAssertTrue(f.showsAccept, "ACCEPT pill only for incoming+pending")
    }

    func testRowDerivationOutgoingPendingHidesAccept() {
        let f = friendship(handle: "bob", status: .pending, direction: .outgoing)
        XCTAssertEqual(f.displayName, "bob")
        XCTAssertEqual(f.avatarInitial, "B")
        XCTAssertEqual(f.statusTag, "PENDING")
        XCTAssertFalse(f.showsAccept, "outgoing pending shows the tag, no button")
    }

    func testRowDerivationEmptyIdsFallBackToQuestionMark() {
        let f = friendship(userId: "", handle: nil)
        XCTAssertEqual(f.avatarInitial, "?")
        XCTAssertEqual(f.displayName, "@")
    }
}
