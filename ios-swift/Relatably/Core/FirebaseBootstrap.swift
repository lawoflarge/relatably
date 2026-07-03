import FirebaseCore
import Foundation
import os

/// One-time Firebase configuration, guarded so app boot can NEVER block or crash
/// on Firebase (2.1(a) rejection history: module-load Firebase init crashed the RN
/// bundle — see friends-auth.md §4.5). Deliberately NO emulator wiring: the RN
/// `EXPO_PUBLIC_USE_FIREBASE_EMULATOR` gate is a dev-only footgun the port omits.
///
/// Call site: App init (Task 8). Fire-and-forget — callers must not depend on the
/// result to render.
enum FirebaseBootstrap {

    private static let logger = Logger(subsystem: "co.relatably.app", category: "FirebaseBootstrap")

    /// True once the default FirebaseApp exists. All Firebase touchpoints
    /// (AuthService, FirestoreClusterSource) gate on this instead of crashing.
    static var isConfigured: Bool { FirebaseApp.app() != nil }

    static func configureIfNeeded() {
        guard FirebaseApp.app() == nil else { return }

        // FirebaseApp.configure() raises NSException when the plist is missing —
        // check resolvability first so a broken bundle logs and continues.
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            logger.error("GoogleService-Info.plist not found in bundle — Firebase disabled for this launch")
            return
        }

        FirebaseApp.configure()
        logger.info("Firebase configured")
    }
}
