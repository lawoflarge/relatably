import XCTest
@testable import Relatably

// MARK: - Test doubles

/// In-memory StringStore: records every key passed to `get` so tests can
/// assert byte-exact key usage (core-libs.md §9.3 "reads key interstitial_seen_q-1").
final class InMemoryStringStore: StringStore, @unchecked Sendable {
    private(set) var storage: [String: String] = [:]
    private(set) var getKeys: [String] = []

    func get(_ key: String) throws -> String? {
        getKeys.append(key)
        return storage[key]
    }

    func set(_ key: String, _ value: String) {
        storage[key] = value
    }

    func preload(_ key: String, _ value: String) {
        storage[key] = value
    }
}

/// StringStore whose reads/writes always throw — drives the EulaStore
/// fail-open vector (tosgate-eula.md §6 "storage read throws → accepted").
struct ThrowingStringStore: StringStore {
    struct StoreError: Error {}
    func get(_ key: String) throws -> String? { throw StoreError() }
    func set(_ key: String, _ value: String) throws { throw StoreError() }
}

final class StoresTests: XCTestCase {

    // MARK: - Isolated UserDefaults per test

    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "StoresTests-" + UUID().uuidString
        defaults = UserDefaults(suiteName: suiteName)
        defaults.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    // MARK: - Byte-exact keys / constants

    func testConstantsAreByteExact() {
        XCTAssertEqual(DeviceTokenProvider.key, "relatably.device_token")
        XCTAssertEqual(RevealStore.prefix, "reveal_seen_")
        XCTAssertEqual(InterstitialGate.prefix, "interstitial_seen_")
        XCTAssertEqual(EulaStore.key, "tos_accepted_version")
        XCTAssertEqual(EulaStore.currentTosVersion, "2026-06-07")
        XCTAssertEqual(HiddenContentStore.hiddenKey, "ugc_hidden_clusters_v1")
        XCTAssertEqual(HiddenContentStore.blockedKey, "ugc_blocked_users_v1")
    }

    // MARK: - InterstitialGate (§9.3)

    func testInterstitialEmptyStoreReadsFalseViaExactKey() {
        let store = InMemoryStringStore()
        let gate = InterstitialGate(store: store)
        XCTAssertFalse(gate.hasShownInterstitialFor("q-1"))
        XCTAssertEqual(store.getKeys, ["interstitial_seen_q-1"])
    }

    func testInterstitialStoredOneReadsTrue() {
        let store = InMemoryStringStore()
        store.preload("interstitial_seen_q-1", "1")
        XCTAssertTrue(InterstitialGate(store: store).hasShownInterstitialFor("q-1"))
    }

    func testMarkInterstitialWritesExactKeyAndValue() {
        let store = InMemoryStringStore()
        InterstitialGate(store: store).markInterstitialShownFor("q-1")
        XCTAssertEqual(store.storage, ["interstitial_seen_q-1": "1"])
    }

    func testInterstitialValueMustBeLiterallyOne() {
        for bad in ["true", "0", "", "1 ", "yes"] {
            let store = InMemoryStringStore()
            store.preload("interstitial_seen_q-1", bad)
            XCTAssertFalse(
                InterstitialGate(store: store).hasShownInterstitialFor("q-1"),
                "value \(String(reflecting: bad)) must read false"
            )
        }
    }

    // MARK: - RevealStore (§9.3)

    func testRevealNeverMarkedIsFalse() {
        let store = InMemoryStringStore()
        XCTAssertFalse(RevealStore(store: store).hasSeenReveal("q-1"))
        XCTAssertEqual(store.getKeys, ["reveal_seen_q-1"])
    }

    func testRevealMarkedIsTrueAndWritesExactKeyAndValue() {
        let store = InMemoryStringStore()
        let reveal = RevealStore(store: store)
        reveal.markRevealSeen("q-1")
        XCTAssertEqual(store.storage, ["reveal_seen_q-1": "1"])
        XCTAssertTrue(reveal.hasSeenReveal("q-1"))
    }

    func testRevealPerQuestionIsolation() {
        let store = InMemoryStringStore()
        let reveal = RevealStore(store: store)
        reveal.markRevealSeen("q-1")
        XCTAssertFalse(reveal.hasSeenReveal("q-2"))
    }

    // MARK: - DeviceToken (core-libs.md §3)

    func testCachedTokenWinsAndIFVNotConsulted() {
        let store = InMemoryStringStore()
        store.preload("relatably.device_token", "cached-token")
        let provider = DeviceTokenProvider(store: store, ifvProvider: {
            XCTFail("IFV must not be consulted when a cached token exists")
            return "IFV-SHOULD-NOT-BE-USED"
        })
        XCTAssertEqual(provider.deviceToken(), "cached-token")
    }

    func testIFVUsedWhenStoreEmptyAndPersisted() {
        let store = InMemoryStringStore()
        let provider = DeviceTokenProvider(store: store, ifvProvider: { "ABCD-1234-IFV" })
        XCTAssertEqual(provider.deviceToken(), "ABCD-1234-IFV")
        XCTAssertEqual(store.storage["relatably.device_token"], "ABCD-1234-IFV")
    }

    func testAnonFallbackWhenIFVNilAndPersisted() {
        let store = InMemoryStringStore()
        let provider = DeviceTokenProvider(store: store, ifvProvider: { nil })
        let token = provider.deviceToken()
        XCTAssertTrue(token.hasPrefix("anon-"), "fallback token must be anon-prefixed, got \(token)")
        let suffix = String(token.dropFirst("anon-".count))
        XCTAssertEqual(suffix, suffix.lowercased(), "anon suffix must be lowercased")
        XCTAssertNotNil(UUID(uuidString: suffix), "anon suffix must be a UUID")
        XCTAssertEqual(store.storage["relatably.device_token"], token)
    }

    func testTokenStableAfterFirstPersist() {
        let store = InMemoryStringStore()
        let first = DeviceTokenProvider(store: store, ifvProvider: { nil }).deviceToken()
        // Second call, even with an IFV now available, must return the persisted token.
        let second = DeviceTokenProvider(store: store, ifvProvider: { "LATE-IFV" }).deviceToken()
        XCTAssertEqual(second, first)
    }

    // MARK: - EulaStore (tosgate-eula.md §6)

    func testEulaNeverSetIsNotAccepted() {
        XCTAssertFalse(EulaStore(store: InMemoryStringStore()).hasAcceptedTos())
    }

    func testEulaExactVersionIsAccepted() {
        let store = InMemoryStringStore()
        store.preload("tos_accepted_version", "2026-06-07")
        XCTAssertTrue(EulaStore(store: store).hasAcceptedTos())
    }

    func testEulaOldVersionIsNotAccepted() {
        let store = InMemoryStringStore()
        store.preload("tos_accepted_version", "2026-06-06")
        XCTAssertFalse(EulaStore(store: store).hasAcceptedTos())
    }

    func testEulaEmptyStringIsNotAccepted() {
        let store = InMemoryStringStore()
        store.preload("tos_accepted_version", "")
        XCTAssertFalse(EulaStore(store: store).hasAcceptedTos())
    }

    func testEulaReadErrorFailsOpen() {
        // Fail-open per tosgate-eula.md §5.1/§6: a throwing storage read means
        // the gate treats the terms as ACCEPTED and shows the app.
        XCTAssertTrue(EulaStore(store: ThrowingStringStore()).hasAcceptedTos())
    }

    func testRecordAcceptanceWritesExactKeyAndValue() throws {
        let store = InMemoryStringStore()
        let eula = EulaStore(store: store)
        try eula.recordAcceptance()
        XCTAssertEqual(store.storage, ["tos_accepted_version": "2026-06-07"])
        XCTAssertTrue(eula.hasAcceptedTos())
    }

    // MARK: - HiddenContentStore (§9.4)

    func testFreshStoreIsEmpty() {
        let store = HiddenContentStore(defaults: defaults)
        XCTAssertEqual(store.hiddenClusters(), [])
        XCTAssertEqual(store.hiddenClusterIds(), [])
        XCTAssertEqual(store.blockedUsers(), [])
        XCTAssertEqual(store.blockedUserIds(), [])
    }

    func testHideClusterStoresFieldsWithMsEpochNumber() throws {
        let store = HiddenContentStore(defaults: defaults)
        let before = Int(Date().timeIntervalSince1970 * 1000)
        store.hideCluster(id: "c1", text: "AI")
        let after = Int(Date().timeIntervalSince1970 * 1000)

        let list = store.hiddenClusters()
        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(list[0].id, "c1")
        XCTAssertEqual(list[0].text, "AI")
        XCTAssertGreaterThanOrEqual(list[0].hidden_at, before)
        XCTAssertLessThanOrEqual(list[0].hidden_at, after)

        // hidden_at must be a JSON NUMBER (ms epoch), never a string.
        let raw = try XCTUnwrap(defaults.string(forKey: "ugc_hidden_clusters_v1"))
        let parsed = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]]
        )
        XCTAssertEqual(parsed.count, 1)
        XCTAssertEqual(parsed[0]["id"] as? String, "c1")
        XCTAssertEqual(parsed[0]["text"] as? String, "AI")
        let hiddenAt = try XCTUnwrap(parsed[0]["hidden_at"] as? NSNumber)
        XCTAssertGreaterThan(hiddenAt.int64Value, 1_700_000_000_000, "hidden_at must be ms epoch")
    }

    func testHideClusterIsIdempotent() {
        let store = HiddenContentStore(defaults: defaults)
        store.hideCluster(id: "c1", text: "AI")
        store.hideCluster(id: "c1", text: "AI again")
        let list = store.hiddenClusters()
        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(list[0].text, "AI", "first write wins")
    }

    func testHiddenClusterIdsSet() {
        let store = HiddenContentStore(defaults: defaults)
        store.hideCluster(id: "c1", text: "AI")
        store.hideCluster(id: "c2", text: "Bitcoin")
        let ids = store.hiddenClusterIds()
        XCTAssertTrue(ids.contains("c1"))
        XCTAssertTrue(ids.contains("c2"))
        XCTAssertFalse(ids.contains("c3"))
    }

    func testUnhideCluster() {
        let store = HiddenContentStore(defaults: defaults)
        store.hideCluster(id: "c1", text: "AI")
        store.hideCluster(id: "c2", text: "Bitcoin")
        store.unhideCluster(id: "c1")
        XCTAssertEqual(store.hiddenClusterIds(), ["c2"])
    }

    func testNewestFirstInsertOrder() {
        let store = HiddenContentStore(defaults: defaults)
        store.hideCluster(id: "c1", text: "AI")
        store.hideCluster(id: "c2", text: "Bitcoin")
        XCTAssertEqual(store.hiddenClusters().map(\.id), ["c2", "c1"], "unshift: newest first")

        store.addBlockedUser(userId: "u1", handle: "alice")
        store.addBlockedUser(userId: "u2", handle: "bob")
        XCTAssertEqual(store.blockedUsers().map(\.user_id), ["u2", "u1"], "unshift: newest first")
    }

    func testAddBlockedUserStoresFields() {
        let store = HiddenContentStore(defaults: defaults)
        store.addBlockedUser(userId: "u1", handle: "alice")
        let list = store.blockedUsers()
        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(list[0].user_id, "u1")
        XCTAssertEqual(list[0].handle, "alice")
        XCTAssertGreaterThan(list[0].blocked_at, 1_700_000_000_000, "blocked_at must be ms epoch number")
    }

    func testNullHandleStoredAsJSONNull() throws {
        let store = HiddenContentStore(defaults: defaults)
        store.addBlockedUser(userId: "u1", handle: nil)
        XCTAssertEqual(store.blockedUsers()[0].handle, nil)

        // The RN app wrote an explicit JSON null; the ME tab renders the field.
        let raw = try XCTUnwrap(defaults.string(forKey: "ugc_blocked_users_v1"))
        let parsed = try XCTUnwrap(
            JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [[String: Any]]
        )
        XCTAssertTrue(parsed[0].keys.contains("handle"), "handle key must be present")
        XCTAssertTrue(parsed[0]["handle"] is NSNull, "handle must be JSON null, not omitted")
    }

    func testAddBlockedUserIsIdempotent() {
        let store = HiddenContentStore(defaults: defaults)
        store.addBlockedUser(userId: "u1", handle: "alice")
        store.addBlockedUser(userId: "u1", handle: "impostor")
        let list = store.blockedUsers()
        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(list[0].handle, "alice", "first write wins")
    }

    func testRemoveBlockedUser() {
        let store = HiddenContentStore(defaults: defaults)
        store.addBlockedUser(userId: "u1", handle: "alice")
        store.addBlockedUser(userId: "u2", handle: nil)
        store.removeBlockedUser(userId: "u1")
        XCTAssertEqual(store.blockedUserIds(), ["u2"])
    }

    func testCorruptJSONReadsAsEmpty() {
        let store = HiddenContentStore(defaults: defaults)

        defaults.set("{not json at all", forKey: "ugc_hidden_clusters_v1")
        defaults.set("{not json at all", forKey: "ugc_blocked_users_v1")
        XCTAssertEqual(store.hiddenClusters(), [])
        XCTAssertEqual(store.blockedUsers(), [])

        // Valid JSON but not an array must also degrade to empty.
        defaults.set(#"{"a":1}"#, forKey: "ugc_hidden_clusters_v1")
        defaults.set(#"{"a":1}"#, forKey: "ugc_blocked_users_v1")
        XCTAssertEqual(store.hiddenClusters(), [])
        XCTAssertEqual(store.hiddenClusterIds(), [])
        XCTAssertEqual(store.blockedUsers(), [])
        XCTAssertEqual(store.blockedUserIds(), [])
    }

    func testStoreRecoversAfterCorruptJSON() {
        let store = HiddenContentStore(defaults: defaults)
        defaults.set("garbage", forKey: "ugc_hidden_clusters_v1")
        store.hideCluster(id: "c1", text: "AI")
        XCTAssertEqual(store.hiddenClusters().map(\.id), ["c1"])
    }
}
