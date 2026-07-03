import Foundation

// Port of `src/lib/hiddenContentStore.ts` (core-libs.md §6).
// User-managed lists of UGC the local user has chosen not to see; backs the
// Hide-cluster / Block-user mechanisms required by App Review Guideline 1.2.
// UserDefaults, NOT Keychain: the RN source deliberately used AsyncStorage
// "because Keychain has a ~2KB-per-value limit on iOS that can fail for
// power users" — these JSON arrays are unbounded.
//
// Rules preserved 1:1 (the ME tab renders these lists):
// - JSON field names/shapes are load-bearing: {id,text,hidden_at} /
//   {user_id,handle,blocked_at}; timestamps are ms-epoch JSON NUMBERS.
// - Insert at the FRONT (RN unshift) — newest first.
// - Idempotent by id/user_id — duplicate adds silently ignored (first write
//   wins for text/handle and timestamp).
// - Corrupt / missing / non-array stored JSON reads as empty, never throws.

struct HiddenCluster: Codable, Equatable, Sendable {
    let id: String
    let text: String
    /// Milliseconds since epoch (JS `Date.now()`), stored as a JSON number.
    let hidden_at: Int
}

struct BlockedUser: Codable, Equatable, Sendable {
    let user_id: String
    let handle: String?
    /// Milliseconds since epoch (JS `Date.now()`), stored as a JSON number.
    let blocked_at: Int

    enum CodingKeys: String, CodingKey {
        case user_id, handle, blocked_at
    }

    // Custom encode: the RN app wrote `handle: null` explicitly; synthesized
    // Codable would OMIT the key for nil, changing the on-disk JSON shape.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(user_id, forKey: .user_id)
        if let handle {
            try container.encode(handle, forKey: .handle)
        } else {
            try container.encodeNil(forKey: .handle)
        }
        try container.encode(blocked_at, forKey: .blocked_at)
    }
}

struct HiddenContentStore {

    static let hiddenKey = "ugc_hidden_clusters_v1"
    static let blockedKey = "ugc_blocked_users_v1"

    let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Hidden clusters

    func hiddenClusters() -> [HiddenCluster] {
        readJson(Self.hiddenKey)
    }

    func hideCluster(id: String, text: String) {
        var list = hiddenClusters()
        guard !list.contains(where: { $0.id == id }) else { return }
        list.insert(HiddenCluster(id: id, text: text, hidden_at: Self.nowMs()), at: 0)
        writeJson(Self.hiddenKey, list)
    }

    func unhideCluster(id: String) {
        writeJson(Self.hiddenKey, hiddenClusters().filter { $0.id != id })
    }

    /// Ids only, for O(1) filtering in feeds.
    func hiddenClusterIds() -> Set<String> {
        Set(hiddenClusters().map(\.id))
    }

    // MARK: - Blocked users

    func blockedUsers() -> [BlockedUser] {
        readJson(Self.blockedKey)
    }

    func addBlockedUser(userId: String, handle: String?) {
        var list = blockedUsers()
        guard !list.contains(where: { $0.user_id == userId }) else { return }
        list.insert(BlockedUser(user_id: userId, handle: handle, blocked_at: Self.nowMs()), at: 0)
        writeJson(Self.blockedKey, list)
    }

    func removeBlockedUser(userId: String) {
        writeJson(Self.blockedKey, blockedUsers().filter { $0.user_id != userId })
    }

    /// Ids only, for O(1) filtering in feeds.
    func blockedUserIds() -> Set<String> {
        Set(blockedUsers().map(\.user_id))
    }

    // MARK: - JSON plumbing

    private static func nowMs() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }

    /// Corrupt/missing/non-array JSON degrades to an empty list, never throws.
    private func readJson<T: Decodable>(_ key: String) -> [T] {
        guard let raw = defaults.string(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([T].self, from: Data(raw.utf8))) ?? []
    }

    private func writeJson<T: Encodable>(_ key: String, _ list: [T]) {
        guard let data = try? JSONEncoder().encode(list),
              let raw = String(data: data, encoding: .utf8) else { return }
        defaults.set(raw, forKey: key)
    }
}
