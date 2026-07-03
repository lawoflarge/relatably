import Foundation

// Board (leaderboard) state — 1:1 port of ios/src/screens/LeaderboardScreen.tsx
// + the moderation actions of ios/src/components/LeaderboardRow.tsx per
// docs/superpowers/plans/rn-extraction/board-demo.md §4.
//
// Guideline-1.2 contract (§8.1, load-bearing — 5 App Store rejections):
// the GLOBAL Board must never be empty, or a reviewer has no user to
// block/report. Fetch success with 0 entries OR fetch error on global scope
// substitutes DEMO_LEADERBOARD. FRIENDS scope is NEVER faked: empty/error →
// [] → "no entries yet".

// MARK: - BoardAPI (the one network call this screen fetches with)

/// Slice of APIClient the Board feature needs — injectable for tests.
protocol BoardAPI {
    func fetchLeaderboard(
        period: LeaderboardPeriod,
        scope: LeaderboardScope,
        limit: Int?
    ) async throws -> LeaderboardResponse
}

extension APIClient: BoardAPI {}

// MARK: - Store slice

/// The HiddenContentStore reads/writes the Board needs — throwing add so the
/// "Couldn't block" path is testable (the real store never throws), same
/// pattern as ClusterModerationStoring.
protocol BoardModerationStoring {
    func blockedUserIds() -> Set<String>
    func addBlockedUser(userId: String, handle: String?) throws
}

extension HiddenContentStore: BoardModerationStoring {}

// MARK: - BoardViewModel

@MainActor
final class BoardViewModel: ObservableObject {

    /// One rendered leaderboard row: entry + derived rank (§4.4 — server
    /// `daily_rank` if present, else index+1 of the FILTERED list).
    struct Row: Equatable, Identifiable {
        let entry: LeaderboardEntry
        let rank: Int
        var id: String { entry.userId }
    }

    /// The user the block/report action sheet is open for (non-nil = presented).
    struct SheetTarget: Equatable, Identifiable {
        /// user_id
        let id: String
        let handle: String?
        var displayHandle: String { handle ?? "anon" }
    }

    /// One of the RN `Alert.alert(title, message)` follow-ups.
    struct BoardAlert: Equatable {
        let title: String
        let message: String
    }

    // Action-sheet strings, verbatim from ActionSheetIOS (§1) — note these
    // DIFFER from the cluster sheet ("…user", not "…answer"/"…contributor").
    static let cancelLabel = "Cancel"
    static let blockLabel = "Block this user"
    static let reportLabel = "Report this user"

    // MARK: Published state (RN useState set, §4.1)

    @Published private(set) var period: LeaderboardPeriod = .daily
    @Published private(set) var scope: LeaderboardScope = .global
    /// Raw entries as fetched (or demo-substituted); blocked filtering is
    /// applied in `visibleEntries`/`rows`.
    @Published private(set) var entries: [LeaderboardEntry] = []
    @Published private(set) var loading = true
    @Published private(set) var blockedIds: Set<String> = []
    /// Driven by the view's AuthState observation (the RN tab wrapper's
    /// reactive `isSignedIn` prop).
    @Published var isSignedIn = false
    /// Incremented by the inline Sign-in-with-Apple success so the screen
    /// flips to signed-in without waiting on the auth listener (§4.1).
    @Published private(set) var authBump = 0
    @Published var sheetTarget: SheetTarget?
    @Published var alert: BoardAlert?

    /// RN screen prop — the production tab wrapper never passes it, so
    /// `isSelf` styling is dormant until the server exposes the uid here.
    let currentUserId: String?

    var effectiveSignedIn: Bool { isSignedIn || authBump > 0 }

    /// §4.3 — local filter over blocked user ids.
    var visibleEntries: [LeaderboardEntry] {
        entries.filter { !blockedIds.contains($0.userId) }
    }

    /// §4.4 rank derivation. The RN ad interleave (index 10, ≥11 entries) is
    /// NOT ported: BannerAdSlot renders null — banner placements are
    /// intentionally disabled (the app monetizes with the single post-reveal
    /// interstitial), so the ad row has zero visual effect.
    var rows: [Row] {
        visibleEntries.enumerated().map { i, entry in
            Row(entry: entry, rank: entry.dailyRank ?? i + 1)
        }
    }

    // MARK: Dependencies

    private let api: BoardAPI
    private let store: BoardModerationStoring
    private let deviceTokenProvider: DeviceTokenProvider
    private let blockUserRemote: (String) async throws -> Void
    private let report: (ReportPayload) async throws -> Void

    /// nonisolated so `BoardViewModel.live()` can be a default argument of a
    /// (nonisolated) View initializer; only assigns stored properties.
    nonisolated init(
        api: BoardAPI,
        store: BoardModerationStoring,
        deviceTokenProvider: DeviceTokenProvider,
        blockUserRemote: @escaping (String) async throws -> Void,
        report: @escaping (ReportPayload) async throws -> Void,
        currentUserId: String? = nil
    ) {
        self.api = api
        self.store = store
        self.deviceTokenProvider = deviceTokenProvider
        self.blockUserRemote = blockUserRemote
        self.report = report
        self.currentUserId = currentUserId
    }

    // MARK: - Boot (blocked ids load once on mount, §4.3 + initial fetch §4.2)

    private var hasBooted = false

    /// View entry point (`.task`) — boots exactly once per VM lifetime, so a
    /// re-appearing kept-alive tab never re-runs the mount effects.
    func bootIfNeeded() {
        guard !hasBooted else { return }
        hasBooted = true
        boot()
    }

    @discardableResult
    func boot() -> Task<Void, Never> {
        blockedIds = store.blockedUserIds()
        return reload()
    }

    // MARK: - Period / scope selection (§4.2 effect deps [period, scope])

    /// Same-value taps are no-ops (React bails out on same-value setState,
    /// so the fetch effect never re-runs).
    @discardableResult
    func setPeriod(_ newPeriod: LeaderboardPeriod) -> Task<Void, Never> {
        guard newPeriod != period else { return Task {} }
        period = newPeriod
        return reload()
    }

    /// FRIENDS is gated on the SIWA state (§8.6): the pill is disabled when
    /// signed out AND the handler guards, so no friends fetch can ever fire
    /// anonymously from this screen.
    @discardableResult
    func setScope(_ newScope: LeaderboardScope) -> Task<Void, Never> {
        if newScope == .friends && !effectiveSignedIn { return Task {} }
        guard newScope != scope else { return Task {} }
        scope = newScope
        return reload()
    }

    /// RN `onSignedIn={() => setAuthBump(n => n + 1)}` — no refetch (auth is
    /// not an effect dependency); the FRIENDS pill just becomes tappable.
    func signedIn() {
        authBump += 1
    }

    // MARK: - Fetch (§4.2 verbatim, incl. the cancellation flag)

    /// Superseded-fetch guard — RN's `cancelled` closure flag. A stale result
    /// (older generation) must neither write entries nor clear loading.
    private var fetchGeneration = 0

    @discardableResult
    private func reload() -> Task<Void, Never> {
        fetchGeneration += 1
        let generation = fetchGeneration
        loading = true
        let period = period
        let scope = scope
        return Task { [weak self] in
            guard let self else { return }
            do {
                let res = try await self.api.fetchLeaderboard(period: period, scope: scope, limit: nil)
                guard self.fetchGeneration == generation else { return }
                // Guideline 1.2 fallback: the global Board must never be
                // empty, or a reviewer has no user to block/report. (The
                // server also backstops this.)
                if res.entries.isEmpty && scope == .global {
                    self.entries = DEMO_LEADERBOARD
                } else {
                    self.entries = res.entries
                }
            } catch {
                guard self.fetchGeneration == generation else { return }
                self.entries = scope == .global ? DEMO_LEADERBOARD : []
            }
            self.loading = false
        }
    }

    // MARK: - Moderation sheet (⋯ tap and row long-press, §4.7)

    func openSheet(userId: String, handle: String?) {
        sheetTarget = SheetTarget(id: userId, handle: handle)
    }

    /// doBlock — always record locally FIRST (works signed-out), then hit the
    /// server best-effort (401 for anonymous users expected and ignored),
    /// then drop the row + success alert. Only a local-store failure shows
    /// "Couldn't block".
    func blockUser(userId: String, handle: String?) async {
        do {
            try store.addBlockedUser(userId: userId, handle: handle)
            do {
                try await blockUserRemote(userId)
            } catch {
                // anonymous / network — local block still applies
            }
            blockedIds.insert(userId) // RN onBlocked → parent filters the row
            alert = BoardAlert(title: "Blocked", message: "We won't show this user's content again.")
        } catch {
            alert = BoardAlert(title: "Couldn't block", message: error.localizedDescription)
        }
    }

    /// doReport — needs no sign-in: sends the Keychain device token instead
    /// of user auth. Does NOT hide the row (unlike block).
    func reportUser(userId: String) async {
        do {
            let deviceToken = deviceTokenProvider.deviceToken()
            try await report(ReportPayload(
                targetType: .user,
                targetId: userId,
                reason: nil,
                deviceToken: deviceToken
            ))
            alert = BoardAlert(title: "Thanks for reporting", message: "We'll review this account within 24 hours.")
        } catch {
            alert = BoardAlert(title: "Couldn't report", message: error.localizedDescription)
        }
    }
}

// MARK: - Production wiring

extension BoardViewModel {
    /// Real dependencies: APIClient with the Firebase ID-token provider,
    /// UserDefaults-backed blocked list, Keychain device token. The RN tab
    /// wrapper passes no currentUserId — isSelf stays false in production.
    nonisolated static func live() -> BoardViewModel {
        let client = APIClient(tokenProvider: { await AuthService.shared.idToken() })
        return BoardViewModel(
            api: client,
            store: HiddenContentStore(),
            deviceTokenProvider: DeviceTokenProvider(),
            blockUserRemote: { try await client.blockUser(targetUserId: $0) },
            report: { try await client.reportContent($0) }
        )
    }
}
