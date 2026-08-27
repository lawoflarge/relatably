import XCTest
@testable import Relatably

// Task 11 — AdManager pure-logic tests (docs/superpowers/plans/rn-extraction/
// core-libs.md §4). NO GoogleMobileAds network/init here: everything goes
// through injected UserDefaults, an injected loader closure and the
// InMemory-backed InterstitialGate.

// MARK: - Fakes

/// Loaded-interstitial fake — records show() and reports back into the
/// shared event log so tests can assert exact load→show→mark ordering.
private final class FakeInterstitial: InterstitialController, @unchecked Sendable {
    let onShow: () -> Void
    init(onShow: @escaping () -> Void = {}) { self.onShow = onShow }
    func show() async { onShow() }
}

/// StringStore that appends "mark" to an event log on every write —
/// lets the gate-order test see WHEN markInterstitialShownFor happened.
private final class RecordingStringStore: StringStore, @unchecked Sendable {
    private var values: [String: String] = [:]
    let onSet: (String) -> Void
    init(onSet: @escaping (String) -> Void = { _ in }) { self.onSet = onSet }
    func get(_ key: String) throws -> String? { values[key] }
    func set(_ key: String, _ value: String) throws {
        values[key] = value
        onSet(key)
    }
}

// MARK: - Tests

final class AdManagerTests: XCTestCase {

    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        suiteName = "AdManagerTests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    // MARK: Unit-ID resolution (§4.4)

    func testDebugDefaultsToGoogleTestInterstitialUnit() {
        XCTAssertEqual(
            AdManager.interstitialUnitId(isDebugBuild: true, defaults: defaults),
            "ca-app-pub-3940256099942544/4411468910"
        )
    }

    func testReleaseDefaultsToProductionInterstitialUnit() {
        XCTAssertEqual(
            AdManager.interstitialUnitId(isDebugBuild: false, defaults: defaults),
            "ca-app-pub-6563643868702361/2000809540"
        )
    }

    /// `-admobInterstitialId <unit>` launch arg (native replacement for
    /// EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID) is a Debug-only lever. Release ignores it:
    /// UserDefaults.standard is writable from outside the app, and a foreign unit id
    /// puts invalid traffic on the publisher account.
    func testOverrideKeyWinsInDebugOnly() {
        defaults.set("custom-unit-id", forKey: AdManager.unitIdOverrideKey)
        XCTAssertEqual(AdManager.interstitialUnitId(isDebugBuild: true, defaults: defaults), "custom-unit-id")
        XCTAssertEqual(
            AdManager.interstitialUnitId(isDebugBuild: false, defaults: defaults),
            "ca-app-pub-6563643868702361/2000809540"
        )
    }

    // MARK: Enable gate (§4.3 — Release always on, Debug opt-in)

    func testAdsEnabledMatrix() {
        // Release: always enabled, flag irrelevant.
        XCTAssertTrue(AdManager.isAdsEnabled(isDebugBuild: false, defaults: defaults))
        defaults.set("NO", forKey: AdManager.adsEnabledKey)
        XCTAssertTrue(AdManager.isAdsEnabled(isDebugBuild: false, defaults: defaults))

        // Debug: off by default, on only with the launch-arg flag.
        defaults.removeObject(forKey: AdManager.adsEnabledKey)
        XCTAssertFalse(AdManager.isAdsEnabled(isDebugBuild: true, defaults: defaults))
        // Launch arg `-adsEnabled YES` lands in UserDefaults as the string
        // "YES" (NSArgumentDomain) — simulate exactly that.
        defaults.set("YES", forKey: AdManager.adsEnabledKey)
        XCTAssertTrue(AdManager.isAdsEnabled(isDebugBuild: true, defaults: defaults))
        defaults.set("NO", forKey: AdManager.adsEnabledKey)
        XCTAssertFalse(AdManager.isAdsEnabled(isDebugBuild: true, defaults: defaults))
    }

    // MARK: loadInterstitialOnce (§4.6)

    func testLoadReturnsNilWithoutCallingLoaderWhenAdsDisabled() async {
        // Debug, no flag → disabled → nil and the loader must never run.
        let result = await AdManager.loadInterstitialOnce(
            isDebugBuild: true,
            defaults: defaults,
            loader: { _ in
                XCTFail("loader must not be called when ads are disabled")
                return nil
            }
        )
        XCTAssertNil(result)
    }

    func testLoadPassesResolvedUnitIdAndReturnsController() async {
        let received = expectation(description: "loader called")
        let result = await AdManager.loadInterstitialOnce(
            isDebugBuild: false, // release → enabled, prod unit
            defaults: defaults,
            loader: { unitId in
                XCTAssertEqual(unitId, AdManager.prodInterstitialUnitId)
                received.fulfill()
                return FakeInterstitial()
            }
        )
        XCTAssertNotNil(result)
        await fulfillment(of: [received], timeout: 1)
    }

    /// First-event-wins timeout: a loader that never settles must resolve nil
    /// after the (injected, short) timeout — never hang the post-reveal flow.
    func testLoadTimesOutToNilWhenLoaderNeverSettles() async {
        let start = Date()
        let result = await AdManager.loadInterstitialOnce(
            isDebugBuild: false,
            defaults: defaults,
            timeoutMs: 50,
            loader: { _ in
                // "Never" settles within the test window.
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                return FakeInterstitial()
            }
        )
        XCTAssertNil(result)
        XCTAssertLessThan(Date().timeIntervalSince(start), 5, "timeout must win, not the 30 s loader")
    }

    /// Regression: the timeout must bound the RETURN time even when the
    /// loader IGNORES task cancellation — exactly what the production GAD
    /// path does (it parks on a withCheckedContinuation around
    /// InterstitialAd.load, which never observes cancellation). The old
    /// task-group race awaited that parked child at scope exit, deferring
    /// the return until GAD eventually called back.
    func testLoadTimesOutToNilWhenLoaderIgnoresCancellation() async {
        /// Cancellation-ignoring park: hands the continuation out so the
        /// test can resume it AFTER the assertion (leak-safe teardown).
        final class ManualGate: @unchecked Sendable {
            private let lock = NSLock()
            private var continuation: CheckedContinuation<Void, Never>?
            private var released = false
            func park() async {
                await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                    lock.lock()
                    if released { lock.unlock(); cont.resume(); return }
                    continuation = cont
                    lock.unlock()
                }
            }
            func release() {
                lock.lock()
                released = true
                let cont = continuation
                continuation = nil
                lock.unlock()
                cont?.resume()
            }
        }
        let gate = ManualGate()
        let start = Date()
        let result = await AdManager.loadInterstitialOnce(
            isDebugBuild: false,
            defaults: defaults,
            timeoutMs: 100,
            loader: { _ in
                await gate.park() // ignores cancellation, like GAD's callback
                return FakeInterstitial()
            }
        )
        let elapsed = Date().timeIntervalSince(start)
        XCTAssertNil(result)
        XCTAssertLessThan(elapsed, 2, "100 ms timeout must bound the return even when the loader ignores cancellation")
        gate.release() // parked loader finishes now; its late result is dropped
    }

    func testProductionLoadTimeoutIs8000Milliseconds() {
        XCTAssertEqual(AdManager.loadTimeoutMs, 8000)
    }

    // MARK: Once-per-question gate helper (RN index.tsx handleRevealComplete)

    func testGateHelperSkipsLoadWhenAlreadyShown() async {
        let store = RecordingStringStore()
        try? store.set(InterstitialGate.prefix + "q-1", "1")
        let gate = InterstitialGate(store: store)

        await AdManager.showPostRevealInterstitialIfNeeded(
            questionId: "q-1",
            gate: gate,
            load: {
                XCTFail("already-shown question must not trigger a load")
                return nil
            }
        )
    }

    /// Not-shown → exact RN order: gate-check, load, show, THEN mark shown.
    func testGateHelperLoadsShowsThenMarksInOrder() async {
        final class EventLog: @unchecked Sendable { var events: [String] = [] }
        let log = EventLog()
        let store = RecordingStringStore(onSet: { key in
            XCTAssertEqual(key, InterstitialGate.prefix + "q-2")
            log.events.append("mark")
        })
        let gate = InterstitialGate(store: store)

        await AdManager.showPostRevealInterstitialIfNeeded(
            questionId: "q-2",
            gate: gate,
            load: {
                log.events.append("load")
                return FakeInterstitial(onShow: { log.events.append("show") })
            }
        )

        XCTAssertEqual(log.events, ["load", "show", "mark"])
        XCTAssertTrue(gate.hasShownInterstitialFor("q-2"))
    }

    /// No fill (loader nil) → NOT marked shown, so the next reveal of the
    /// same question retries (RN only marks after controller.show()).
    func testGateHelperDoesNotMarkWhenLoaderReturnsNil() async {
        let store = RecordingStringStore(onSet: { _ in
            XCTFail("nil controller must not mark the interstitial as shown")
        })
        let gate = InterstitialGate(store: store)

        await AdManager.showPostRevealInterstitialIfNeeded(
            questionId: "q-3",
            gate: gate,
            load: { nil }
        )

        XCTAssertFalse(gate.hasShownInterstitialFor("q-3"))
    }
}
