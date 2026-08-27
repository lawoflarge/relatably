import Foundation
import GoogleMobileAds
import UserMessagingPlatform
import os

// AdMob integration — 1:1 port of ios/src/lib/ads.ts per
// docs/superpowers/plans/rn-extraction/core-libs.md §4.
//
// ATT policy (§4.2, load-bearing for App Review): Relatably does not track
// users in the App Tracking Transparency sense — it never links data with
// third-party data for advertising and NEVER calls the ATT framework. AdMob
// is therefore always requested non-personalized ("npa": "1" extras on EVERY
// request), so no IDFA-based cross-app tracking occurs. App Privacy in App
// Store Connect declares "Data Not Used to Track You" to match — there is no
// ATT prompt anywhere in this codebase.

/// Minimal surface of a loaded interstitial (RN's InterstitialController,
/// minus its no-op dispose()).
protocol InterstitialController: Sendable {
    /// Resolves when the ad is dismissed — or immediately if presenting
    /// fails, so the post-reveal flow can never hang on an ad (§4.6).
    func show() async
}

enum AdManager {

    private static let logger = Logger(subsystem: "co.relatably.app", category: "AdManager")

    // MARK: - Constants (§4.1)

    /// Real production interstitial unit (Relatably AdMob app
    /// ca-app-pub-6563643868702361~4571132569 — the GADApplicationIdentifier
    /// in Info.plist).
    static let prodInterstitialUnitId = "ca-app-pub-6563643868702361/2000809540"
    /// Google's official iOS test interstitial (video) unit — Debug fallback.
    static let testInterstitialUnitId = "ca-app-pub-3940256099942544/4411468910"
    /// First-event-wins load timeout (ms): LOADED → controller,
    /// error/timeout → nil.
    static let loadTimeoutMs = 8000
    /// Launch arg / UserDefaults override `-admobInterstitialId <unit>`,
    /// native replacement for EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID. Debug only,
    /// see interstitialUnitId(isDebugBuild:defaults:).
    static let unitIdOverrideKey = "admobInterstitialId"
    /// Launch arg `-adsEnabled YES` — native replacement for
    /// EXPO_PUBLIC_ADMOB_ENABLED (RN required the exact string "true").
    static let adsEnabledKey = "adsEnabled"

    /// Compile-time build flavor; injectable in tests (RN __DEV__).
    static var isDebugBuild: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
    }

    // MARK: - Enable gate (§4.3)

    /// Ads ship enabled in Release builds. In Debug they stay opt-in via the
    /// `-adsEnabled YES` launch arg so the simulator and the test suite are
    /// ad-free unless explicitly turned on. (RN memoized the env read; launch
    /// args are immutable per process, so a pure read is equivalent.)
    static func isAdsEnabled(
        isDebugBuild: Bool = AdManager.isDebugBuild,
        defaults: UserDefaults = .standard
    ) -> Bool {
        !isDebugBuild || defaults.bool(forKey: adsEnabledKey)
    }

    // MARK: - Unit-ID resolution (§4.4, post_reveal_interstitial slot)

    /// Release always serves the production unit. The UserDefaults override is a
    /// development lever and stays closed in Release: `.standard` is writable from
    /// outside the app (launch arguments, a managed app configuration), and traffic
    /// billed to a unit this app did not choose is invalid traffic on the publisher
    /// account. Google suspends the account, not the single app.
    /// Debug: override → else Google's test unit.
    static func interstitialUnitId(
        isDebugBuild: Bool = AdManager.isDebugBuild,
        defaults: UserDefaults = .standard
    ) -> String {
        guard isDebugBuild else { return prodInterstitialUnitId }
        return defaults.string(forKey: unitIdOverrideKey) ?? testInterstitialUnitId
    }

    // MARK: - EEA/UK consent (UMP)
    //
    // npa=1 is not consent. Relatably requests only non-personalized ads and
    // never calls ATT (§4.2), so there is no IDFA and no ATT prompt, and the
    // App Privacy answer "Data Not Used to Track You" stays true. None of that
    // removes the EEA/UK duty: a non-personalized request still stores and
    // reads information on the device, and AdMob requires a Google-certified
    // CMP for EEA/UK traffic. UMP supplies exactly that consent, and nothing
    // more; the ATT step of the usual chain is deliberately absent here.

    @MainActor private static var consentRequested = false

    /// Refreshes the consent info and presents the UMP form when the user's
    /// region requires it. Runs once per launch. Never throws and never blocks
    /// anything but the ad path: a failure leaves `canRequestAds` false, which
    /// simply means no ad is requested.
    @MainActor
    static func gatherConsent() async {
        guard isAdsEnabled(), !consentRequested else { return }
        consentRequested = true
        let parameters = RequestParameters()
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            ConsentInformation.shared.requestConsentInfoUpdate(with: parameters) { _ in
                cont.resume()
            }
        }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            ConsentForm.loadAndPresentIfRequired(from: nil) { _ in cont.resume() }
        }
    }

    /// Whether UMP allows an ad request at all. False before the form is
    /// answered in a region that requires one, and after a refusal.
    @MainActor
    static var canRequestAds: Bool { ConsentInformation.shared.canRequestAds }

    /// Whether this user is entitled to reopen the consent choice. Outside the
    /// EEA/UK there is no form, so the settings entry must stay hidden.
    @MainActor
    static var privacyOptionsRequired: Bool {
        ConsentInformation.shared.privacyOptionsRequirementStatus == .required
    }

    /// Reopens the consent form so a granted consent can be withdrawn as
    /// easily as it was given.
    @MainActor
    static func presentPrivacyOptions() {
        ConsentForm.presentPrivacyOptionsForm(from: nil) { _ in }
    }

    // MARK: - SDK init (§4.5 — once, fire-and-forget)

    private static var initStarted = false

    /// Spins up the Mobile Ads SDK exactly once. Order is load-bearing:
    /// maxAdContentRating .teen is set on the request configuration BEFORE
    /// initialize. Never throws, never blocks — the app must never crash or
    /// wait on ads (RN swallowed failures with "ads init failed"; the Swift
    /// SDK surface has no failure path, start() reports per-adapter status
    /// asynchronously and is itself fire-and-forget).
    @MainActor
    static func initAds() {
        guard isAdsEnabled(), canRequestAds, !initStarted else { return }
        initStarted = true
        MobileAds.shared.requestConfiguration.maxAdContentRating = .teen
        MobileAds.shared.start(completionHandler: nil)
    }

    // MARK: - Interstitial load (§4.6)

    /// Loads a single post-reveal interstitial. Resolves nil if ads are
    /// disabled, nothing fills, or the 8 s timeout wins the race — callers
    /// always proceed silently; an ad error is never surfaced to the user.
    static func loadInterstitialOnce(
        isDebugBuild: Bool = AdManager.isDebugBuild,
        defaults: UserDefaults = .standard,
        timeoutMs: Int = AdManager.loadTimeoutMs,
        loader: @escaping @Sendable (String) async -> InterstitialController? = AdManager.loadGADInterstitial
    ) async -> InterstitialController? {
        guard isAdsEnabled(isDebugBuild: isDebugBuild, defaults: defaults) else { return nil }
        let unitId = interstitialUnitId(isDebugBuild: isDebugBuild, defaults: defaults)
        // Race of first-event-wins outcomes (RN's idempotent finish()):
        // LOADED → controller, ERROR → nil (immediately), timeout → nil.
        // NOT a task group: a group awaits ALL its children at scope exit,
        // and the production loader parks on a GAD load callback that ignores
        // task cancellation — a group race would defer the return until GAD
        // eventually calls back (30–60 s or never), hanging the post-reveal
        // flow. A settle-once continuation returns the instant the first
        // event lands; the loser's late result is silently dropped.
        return await withCheckedContinuation { continuation in
            let settle = FirstWinsSettle(continuation)
            Task { settle.settle(returning: await loader(unitId)) }
            Task {
                try? await Task.sleep(nanoseconds: UInt64(timeoutMs) * 1_000_000)
                settle.settle(returning: nil)
            }
        }
    }

    /// Production loader: GADInterstitialAd with non-personalized extras.
    private static func loadGADInterstitial(unitId: String) async -> InterstitialController? {
        guard await canRequestAds else { return nil }
        let request = Request()
        let extras = Extras()
        // §4.2: "npa": "1" on EVERY request — non-personalized, no ATT.
        extras.additionalParameters = ["npa": "1"]
        request.register(extras)
        return await withCheckedContinuation { continuation in
            InterstitialAd.load(with: unitId, request: request) { ad, error in
                guard let ad else {
                    logger.warning("interstitial load failed \(error?.localizedDescription ?? "", privacy: .public)")
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: LoadedInterstitial(ad))
            }
        }
    }

    // MARK: - Once-per-question post-reveal gate
    // (RN app/(tabs)/index.tsx handleRevealComplete — exact order: gate-check
    // → load → show → mark shown. Mark happens only AFTER a successful show,
    // so a no-fill/timeout day retries on the next reveal of that question.)

    static func showPostRevealInterstitialIfNeeded(
        questionId: String,
        gate: InterstitialGate = InterstitialGate(),
        load: () async -> InterstitialController? = { await AdManager.loadInterstitialOnce() }
    ) async {
        guard !gate.hasShownInterstitialFor(questionId) else { return }
        guard let controller = await load() else { return }
        await controller.show()
        gate.markInterstitialShownFor(questionId)
    }
}

// MARK: - FirstWinsSettle (idempotent race settle, RN's finish())

/// Resumes a load-race continuation exactly once: the first settle wins,
/// every later settle is silently dropped. NSLock-guarded so the loader
/// completion and the timeout can land concurrently from any thread.
private final class FirstWinsSettle: @unchecked Sendable {

    private let lock = NSLock()
    private var continuation: CheckedContinuation<InterstitialController?, Never>?

    init(_ continuation: CheckedContinuation<InterstitialController?, Never>) {
        self.continuation = continuation
    }

    func settle(returning value: InterstitialController?) {
        lock.lock()
        let winner = continuation
        continuation = nil
        lock.unlock()
        winner?.resume(returning: value)
    }
}

// MARK: - LoadedInterstitial (production InterstitialController)

/// Wraps a filled GADInterstitialAd. show() presents from the key window's
/// top view controller and resolves on fullScreenContentDidDismiss — or
/// immediately if presentation fails (§4.6: never hang the post-reveal flow).
/// All access happens on the main thread (present is MainActor; GAD delegate
/// callbacks arrive on main), hence @unchecked Sendable.
private final class LoadedInterstitial: NSObject, InterstitialController, FullScreenContentDelegate, @unchecked Sendable {

    private let ad: InterstitialAd
    private var continuation: CheckedContinuation<Void, Never>?

    init(_ ad: InterstitialAd) {
        self.ad = ad
        super.init()
    }

    @MainActor
    func show() async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            continuation = cont
            ad.fullScreenContentDelegate = self
            ad.present(from: nil)
        }
    }

    /// Idempotent settle — dismiss and present-failure both land here.
    private func finish() {
        continuation?.resume()
        continuation = nil
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        finish()
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        finish()
    }
}
