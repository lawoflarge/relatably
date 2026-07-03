import Foundation

// ME (settings) state — 1:1 port of ios/app/(tabs)/settings.tsx per
// docs/superpowers/plans/rn-extraction/settings-tabbar.md §3.
//
// App-Review contract (Guideline 1.2): this screen is where reviewers verify
// the UNDO lists — HIDDEN ANSWERS (tap to unhide) and BLOCKED USERS (tap to
// unblock, including the synthetic `contributor:<id>` entries recorded by
// ClusterModeration.block with handle = cluster text) — plus Contact support,
// Report inappropriate content, ToS/Privacy links and in-app account deletion.

// MARK: - MeAPI (the APIClient slice this screen uses)

protocol MeAPI {
    func deleteAccount() async throws
}

extension APIClient: MeAPI {}

// MARK: - Blocked-row display (RN: handle ?? "@" + user_id.slice(0, 6))

extension BlockedUser {
    /// Synthetic `contributor:<id>` entries carry the cluster text as their
    /// handle, so they render as that text verbatim (settings-tabbar.md §3.1).
    var displayName: String {
        handle ?? "@\(user_id.prefix(6))"
    }
}

// MARK: - MeViewModel

@MainActor
final class MeViewModel: ObservableObject {

    /// One of the RN `Alert.alert(title, message)` follow-ups (single OK).
    struct MeAlert: Equatable {
        let title: String
        let message: String
    }

    // MARK: Verbatim copy (settings-tabbar.md §3.1)

    static let supportEmail = "levin.schwab@gmx.de"

    /// TosGate precedent: legal links pin the PRODUCTION base — RN's
    /// `EXPO_PUBLIC_API_URL` was never set, so the fallback is the effective
    /// value, and a debug `-apiBaseURL` override must not leak into them.
    static let tosURL = "\(APIClient.productionBaseURL)/tos"
    static let privacyURL = "\(APIClient.productionBaseURL)/privacy"

    static let contactMailtoURL =
        "mailto:\(supportEmail)?subject=\(encodeURIComponent("Relatably support"))"
    static let reportMailtoURL = "mailto:\(supportEmail)"
        + "?subject=\(encodeURIComponent("Report inappropriate content / abusive user on Relatably"))"
        + "&body=\(encodeURIComponent("Please describe what you'd like to report. We respond within 24 hours.\n\n"))"

    static let signOutConfirmTitle = "Sign out?"
    static let signOutConfirmMessage =
        "Your device will go back to anonymous mode. Your data on the server stays put."
    static let deleteConfirmTitle = "Delete your account?"
    static let deleteConfirmMessage =
        "This permanently removes your profile, leaderboard entries, and friend graph, "
        + "and revokes your Sign in with Apple link to Relatably. Past answers are "
        + "anonymised but stay in the wordcloud. This can't be undone."
    static let mailUnavailableTitle = "Mail unavailable"
    static let mailUnavailableMessage =
        "Please email \(supportEmail) from any email app. We respond within 24 hours."
    static let signedOutHint =
        "You're playing anonymously. Sign in with Apple from the Friends tab to unlock the leaderboard."
    static let footerText = "© 2026 Levin Schwab · v1.0"

    // MARK: Published state (RN useState set, §3.2)

    /// Newest-first (the store unshifts on hide/block).
    @Published private(set) var hidden: [HiddenCluster] = []
    @Published private(set) var blocked: [BlockedUser] = []
    /// RN `uid != null` gate for the ACCOUNT card — driven by the view's
    /// AuthState observation (Firebase auth listener).
    @Published var isSignedIn = false
    /// Gates the Delete-account row ("Deleting…", disabled) during the flow.
    @Published private(set) var busy = false
    @Published var alert: MeAlert?

    /// RN: `{busy ? "Deleting…" : "Delete account"}` (U+2026 ellipsis).
    var deleteRowLabel: String { busy ? "Deleting…" : "Delete account" }

    // MARK: Dependencies

    private let store: HiddenContentStore
    private let api: MeAPI
    private let performSignOut: () throws -> Void

    /// nonisolated so `MeViewModel.live()` can be a default argument of a
    /// (nonisolated) View initializer; only assigns stored properties.
    nonisolated init(store: HiddenContentStore, api: MeAPI, signOut: @escaping () throws -> Void) {
        self.store = store
        self.api = api
        self.performSignOut = signOut
    }

    // MARK: - List loading (§3.2 mount effect + keep-alive focus refresh)

    private var hasBooted = false

    /// RN loads the lists once in a mount effect. Expo-router tabs mount
    /// lazily, so the RN lists were fresh as of the FIRST focus of the ME
    /// tab; our keep-alive shell builds the tab at launch, so the shell also
    /// re-`refresh()`es on every switch INTO the tab — without that the
    /// launch-time snapshot would go stale the moment the user hides
    /// something, which is strictly worse than RN and breaks the App-Review
    /// walkthrough (hide on Today → verify under ME).
    func bootIfNeeded() {
        guard !hasBooted else { return }
        hasBooted = true
        refresh()
    }

    /// Re-read both lists from the store (synchronous UserDefaults reads).
    func refresh() {
        hidden = store.hiddenClusters()
        blocked = store.blockedUsers()
    }

    // MARK: - Undo actions (§3.2 — store write, then filter the local list)

    func unhide(id: String) {
        store.unhideCluster(id: id)
        hidden = hidden.filter { $0.id != id }
    }

    func unblock(userId: String) {
        store.removeBlockedUser(userId: userId)
        blocked = blocked.filter { $0.user_id != userId }
    }

    // MARK: - Sign out (confirm alert lives in the view; §3.1 alert 4/5)

    /// No success alert — the auth listener flips `isSignedIn` and the
    /// ACCOUNT card collapses to the anonymous hint.
    func signOutConfirmed() {
        do {
            try performSignOut()
        } catch {
            alert = MeAlert(title: "Couldn't sign out", message: error.localizedDescription)
        }
    }

    // MARK: - Delete account (§3.2 — order is load-bearing)

    /// Server delete FIRST; then signOut with failures swallowed
    /// (already-deleted → fine); success alert ALWAYS after both. An API
    /// failure alerts and performs NO sign-out. `busy` wraps the whole flow.
    /// RN's non-Error fallback message ("please try again or email …") is
    /// unreachable natively — every Swift Error has a localizedDescription.
    func deleteAccountConfirmed() async {
        busy = true
        do {
            try await api.deleteAccount()
            try? performSignOut()
            alert = MeAlert(
                title: "Account deleted",
                message: "Your account and personal data have been removed from Relatably."
            )
        } catch {
            alert = MeAlert(title: "Couldn't delete account", message: error.localizedDescription)
        }
        busy = false
    }

    // MARK: - encodeURIComponent (JS semantics, for byte-exact mailto URLs)

    /// JS `encodeURIComponent` unescaped set: A–Z a–z 0–9 - _ . ! ~ * ' ( )
    /// — notably the apostrophe stays raw and "/" becomes %2F.
    private static let encodeURIComponentAllowed = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"
    )

    static func encodeURIComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: encodeURIComponentAllowed) ?? value
    }
}

// MARK: - Production wiring

extension MeViewModel {
    /// Real dependencies: UserDefaults-backed hidden/blocked lists, APIClient
    /// with the Firebase ID-token provider, Firebase sign-out.
    nonisolated static func live() -> MeViewModel {
        MeViewModel(
            store: HiddenContentStore(),
            api: APIClient(tokenProvider: { await AuthService.shared.idToken() }),
            signOut: { try AuthService.shared.signOut() }
        )
    }
}
