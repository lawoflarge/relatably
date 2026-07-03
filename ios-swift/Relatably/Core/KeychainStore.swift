import Foundation
import Security

/// Minimal string-valued persistence seam (Keychain in production, in-memory
/// in tests). `get` can throw for genuine storage failures — EulaStore's
/// fail-open semantics need to distinguish "not set" (nil) from "storage
/// broken" (throw). A missing key is `nil`, never an error.
protocol StringStore: Sendable {
    func get(_ key: String) throws -> String?
    func set(_ key: String, _ value: String) throws
}

struct KeychainError: Error, Equatable {
    let status: OSStatus
}

/// Generic-password Keychain store: service = bundle id, account = key.
/// Mirrors expo-secure-store's layout; values survive app reinstall on iOS —
/// intentional (the RN app relied on this for the device token and the
/// per-question one-shot gates).
struct KeychainStore: StringStore {

    let service: String

    init(service: String = Bundle.main.bundleIdentifier ?? "co.relatably.app") {
        self.service = service
    }

    func get(_ key: String) throws -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw KeychainError(status: status) }
        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func set(_ key: String, _ value: String) throws {
        let data = Data(value.utf8)
        let update: [String: Any] = [kSecValueData as String: data]

        let status = SecItemUpdate(baseQuery(for: key) as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var add = baseQuery(for: key)
            add[kSecValueData as String] = data
            let addStatus = SecItemAdd(add as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainError(status: addStatus) }
            return
        }
        guard status == errSecSuccess else { throw KeychainError(status: status) }
    }

    private func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}
