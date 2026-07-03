import Foundation
import UIKit

/// Port of `src/lib/deviceId.ts` (core-libs.md §3):
/// 1. cached Keychain value under `relatably.device_token` wins (stable
///    forever once written — survives reinstall via the Keychain),
/// 2. else `UIDevice.current.identifierForVendor`,
/// 3. else `"anon-" + UUID().uuidString.lowercased()` (the RN fallback was a
///    non-crypto base36 random string; UUID is the sanctioned Swift equivalent),
/// then persist and return.
struct DeviceTokenProvider {

    static let key = "relatably.device_token"

    let store: StringStore
    let ifvProvider: @Sendable () -> String?

    init(
        store: StringStore = KeychainStore(),
        ifvProvider: @escaping @Sendable () -> String? = {
            UIDevice.current.identifierForVendor?.uuidString
        }
    ) {
        self.store = store
        self.ifvProvider = ifvProvider
    }

    func deviceToken() -> String {
        if let cached = try? store.get(Self.key) {
            return cached
        }
        let token = ifvProvider() ?? "anon-" + UUID().uuidString.lowercased()
        // Best-effort persist: even if the Keychain write fails we still hand
        // back a usable token for this session.
        try? store.set(Self.key, token)
        return token
    }
}
