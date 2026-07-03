import Foundation

// Friends state — 1:1 port of ios/src/screens/FriendsScreen.tsx +
// ios/src/components/FriendListRow.tsx per
// docs/superpowers/plans/rn-extraction/friends-auth.md §4.
//
// The RN screen is ONE flat list (no incoming/outgoing/accepted sections):
// header "your friends (n)", per-row tag PENDING/INCOMING/OUTGOING, ACCEPT
// pill only for incoming+pending. No pull-to-refresh, no add-friend
// affordance (requestFriend exists in api.ts but the screen never calls it).

// MARK: - FriendsAPI (the APIClient slice this screen uses)

/// fetch/accept/remove come from FriendsScreen; blockUser from
/// FriendListRow.doBlock. requestFriend is deliberately absent — the RN
/// v1.0 screen never exposes it.
protocol FriendsAPI {
    func fetchFriends() async throws -> FriendsResponse
    func acceptFriend(friendshipId: String) async throws -> FriendMutationResponse
    func removeFriend(friendshipId: String) async throws
    func blockUser(targetUserId: String) async throws
}

extension APIClient: FriendsAPI {}

// MARK: - Store slice

/// The one HiddenContentStore write FriendListRow.doBlock performs —
/// throwing requirement so the "Couldn't block" path is testable (same
/// pattern as BoardModerationStoring; the real store never throws).
protocol FriendsBlockStoring {
    func addBlockedUser(userId: String, handle: String?) throws
}

extension HiddenContentStore: FriendsBlockStoring {}

// MARK: - Row derivations (RN FriendListRow, §4.2)

extension Friendship {
    /// `handle ?? "@" + first 6 chars of friend_user_id`.
    var displayName: String {
        handle ?? "@\(friendUserId.prefix(6))"
    }

    /// First char of handle-or-userid uppercased, "?" when empty. Note the
    /// RN asymmetry: `displayName` prepends "@", the initial never does.
    var avatarInitial: String {
        guard let first = (handle ?? friendUserId).first else { return "?" }
        return String(first).uppercased()
    }

    /// `status === "pending" ? "PENDING" : direction.toUpperCase()`.
    var statusTag: String {
        status == .pending ? "PENDING" : direction.rawValue.uppercased()
    }

    /// ACCEPT pill shown ONLY for incoming+pending (§4.1 render rule).
    var showsAccept: Bool {
        direction == .incoming && status == .pending
    }
}

// MARK: - FriendsViewModel

@MainActor
final class FriendsViewModel: ObservableObject {

    /// One of the RN `Alert.alert(title, message)` follow-ups.
    struct FriendsAlert: Equatable {
        let title: String
        let message: String
    }

    // Long-press ActionSheetIOS strings, verbatim (§1). RN options array is
    // ["Cancel", "Remove from friends", "Block this user"], destructive 2.
    static let cancelLabel = "Cancel"
    static let removeLabel = "Remove from friends"
    static let blockLabel = "Block this user"

    // MARK: Published state (RN useState set, §4.1)

    @Published private(set) var friendships: [Friendship] = []
    /// Starts true; every auth-effect run ends it and no later run restarts
    /// it (RN never sets loading back to true after mount).
    @Published private(set) var loading = true
    /// Driven by the view's AuthState observation (the RN tab wrapper's
    /// reactive `isSignedIn` prop). Changing it re-runs the auth effect
    /// exactly when `effectiveSignedIn` changes (React dep semantics).
    @Published var isSignedIn = false {
        didSet { runAuthEffectIfDepChanged() }
    }
    /// Incremented by the inline Sign-in-with-Apple success so the screen
    /// flips to signed-in without waiting on the auth listener (§4.1).
    @Published private(set) var authBump = 0
    /// The row a long-press action sheet is open for (nil = none).
    @Published var sheetTarget: Friendship?
    @Published var alert: FriendsAlert?

    var effectiveSignedIn: Bool { isSignedIn || authBump > 0 }

    /// §7.16 — header omits "(0)": plain "your friends" when empty.
    var headerTitle: String {
        friendships.isEmpty ? "your friends" : "your friends (\(friendships.count))"
    }

    // MARK: Dependencies

    private let api: FriendsAPI
    private let store: FriendsBlockStoring

    /// nonisolated so `FriendsViewModel.live()` can be a default argument of
    /// a (nonisolated) View initializer; only assigns stored properties.
    nonisolated init(api: FriendsAPI, store: FriendsBlockStoring) {
        self.api = api
        self.store = store
    }

    // MARK: - Auth effect (RN useEffect deps [effectiveSignedIn], §4.1)

    private var hasBooted = false
    /// The `effectiveSignedIn` value the effect last ran for (React only
    /// re-runs the effect when the dep actually changes).
    private var lastEffectDep: Bool?
    /// Superseded-fetch guard: a sign-out during an in-flight fetch must
    /// win (RN leaves this race unguarded but hides the stale write behind
    /// the gate; we clear state on sign-out, so the guard is load-bearing).
    private var fetchGeneration = 0
    /// Latest auth-effect fetch (nil when the effect didn't fetch) — awaited
    /// by tests, harmless to ignore in production.
    private(set) var effectTask: Task<Void, Never>?

    /// View entry point (`.task`) — boots exactly once per VM lifetime, so a
    /// re-appearing kept-alive tab never re-runs the mount effect.
    func bootIfNeeded() {
        guard !hasBooted else { return }
        hasBooted = true
        runAuthEffect()
    }

    /// RN `onSignedIn={() => setAuthBump(n => n + 1)}` — flips the gate and
    /// (dep change false→true) triggers the fetch. `loading` stays false, so
    /// the list renders immediately (briefly empty) while the fetch runs (§7.1).
    func signedIn() {
        authBump += 1
        runAuthEffectIfDepChanged()
    }

    private func runAuthEffectIfDepChanged() {
        guard hasBooted else { return }
        guard lastEffectDep != effectiveSignedIn else { return }
        runAuthEffect()
    }

    private func runAuthEffect() {
        lastEffectDep = effectiveSignedIn
        fetchGeneration += 1
        let generation = fetchGeneration
        guard effectiveSignedIn else {
            // RN: setLoading(false) and bail. RN keeps stale friendships in
            // state (invisible behind the gate); we clear them — conscious
            // deviation so a re-sign-in never flashes another account's list.
            loading = false
            friendships = []
            effectTask = nil
            return
        }
        effectTask = Task { [weak self] in
            guard let self else { return }
            // §7.3 — fetch errors are silent: catch → [] → empty-state copy.
            let result: [Friendship]
            do {
                result = try await self.api.fetchFriends().friendships
            } catch {
                result = []
            }
            guard self.fetchGeneration == generation else { return }
            self.friendships = result
            self.loading = false
        }
    }

    // MARK: - Accept (§4.1 onAccept — accept then FULL refetch, not a patch)

    func accept(friendshipId: String) async {
        do {
            _ = try await api.acceptFriend(friendshipId: friendshipId)
            let next = try await api.fetchFriends()
            friendships = next.friendships
        } catch {
            // RN fallback string "could not accept request" is unreachable
            // natively (everything is an Error with a description).
            alert = FriendsAlert(title: "couldn't accept", message: error.localizedDescription)
        }
    }

    // MARK: - Long-press row actions (RN FriendListRow §4.2)

    func openSheet(_ friendship: Friendship) {
        sheetTarget = friendship
    }

    /// doRemove — DELETE the friendship; NO success alert and the row stays
    /// visible (§7.5: FriendsScreen never wires onBlocked) until next load.
    func remove(_ friendship: Friendship) async {
        do {
            try await api.removeFriend(friendshipId: friendship.id)
        } catch {
            alert = FriendsAlert(title: "Couldn't remove", message: error.localizedDescription)
        }
    }

    /// doBlock — remote block FIRST, then local persistence, then alert.
    /// (Order differs from the Board's doBlock, which persists local-first;
    /// here a server failure means no local block either — RN parity.)
    /// Does NOT delete the friendship server-side and the row stays (§7.6).
    func block(_ friendship: Friendship) async {
        do {
            try await api.blockUser(targetUserId: friendship.friendUserId)
            try store.addBlockedUser(userId: friendship.friendUserId, handle: friendship.handle)
            alert = FriendsAlert(title: "Blocked", message: "We won't show their content again.")
        } catch {
            alert = FriendsAlert(title: "Couldn't block", message: error.localizedDescription)
        }
    }
}

// MARK: - Production wiring

extension FriendsViewModel {
    /// Real dependencies: APIClient with the Firebase ID-token provider,
    /// UserDefaults-backed blocked list.
    nonisolated static func live() -> FriendsViewModel {
        FriendsViewModel(
            api: APIClient(tokenProvider: { await AuthService.shared.idToken() }),
            store: HiddenContentStore()
        )
    }
}
