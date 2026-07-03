import Foundation

/// Port of `src/lib/eulaStore.ts` + the TosGate read semantics
/// (tosgate-eula.md §5/§6). Keychain key `tos_accepted_version` holds the
/// accepted version as a plain string (no JSON wrapper); acceptance is
/// exact-string equality against `currentTosVersion` — nil, an older
/// version, or garbage all read as NOT accepted (gate shows again).
struct EulaStore {

    static let key = "tos_accepted_version"

    /// Bump when publishing a material change to the terms; users will be
    /// re-prompted to accept the new version on next launch.
    static let currentTosVersion = "2026-06-07"

    let store: StringStore

    init(store: StringStore = KeychainStore()) {
        self.store = store
    }

    /// FAIL-OPEN on read errors: the RN TosGate wraps `hasAcceptedTos()` in
    /// try/catch and on ANY storage error sets phase "ready" — i.e. the app
    /// is shown and the gate is skipped ("SecureStore unavailable — fail
    /// open and let the user in", tosgate-eula.md §5.1/§6). We fold that
    /// gate-level catch into the store: a throwing read returns `true`
    /// (treated as accepted). Only a successful read of a non-matching /
    /// missing value returns `false`.
    func hasAcceptedTos() -> Bool {
        do {
            return try store.get(Self.key) == Self.currentTosVersion
        } catch {
            return true
        }
    }

    /// Overwrites with the current version. Parity with RN: the write is NOT
    /// error-swallowed there (awaited un-caught — a failed write keeps the
    /// gate up), so errors propagate and the caller (TosGate) decides.
    func recordAcceptance() throws {
        try store.set(Self.key, Self.currentTosVersion)
    }
}
