import Foundation

// Port of `src/lib/revealStore.ts` + `src/lib/interstitialGate.ts`
// (core-libs.md §5): Keychain-backed per-question one-shot flags.
// Key format `reveal_seen_<questionId>` / `interstitial_seen_<questionId>`,
// value literally the string "1" — anything else (including nil and read
// errors) reads as false. Keychain persistence across reinstalls matches
// expo-secure-store behavior and is intentional.

/// Reveal animation played at most once per question.
struct RevealStore {

    static let prefix = "reveal_seen_"

    let store: StringStore

    init(store: StringStore = KeychainStore()) {
        self.store = store
    }

    func hasSeenReveal(_ questionId: String) -> Bool {
        (try? store.get(Self.prefix + questionId)) == "1"
    }

    func markRevealSeen(_ questionId: String) {
        try? store.set(Self.prefix + questionId, "1")
    }
}

/// Interstitial ad shown at most once per question.
struct InterstitialGate {

    static let prefix = "interstitial_seen_"

    let store: StringStore

    init(store: StringStore = KeychainStore()) {
        self.store = store
    }

    func hasShownInterstitialFor(_ questionId: String) -> Bool {
        (try? store.get(Self.prefix + questionId)) == "1"
    }

    func markInterstitialShownFor(_ questionId: String) {
        try? store.set(Self.prefix + questionId, "1")
    }
}
