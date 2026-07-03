import SwiftUI

@main
struct RelatablyApp: App {
    init() {
        // Fire-and-forget; rendering must never depend on Firebase
        // (2.1(a) history — see FirebaseBootstrap).
        FirebaseBootstrap.configureIfNeeded()
    }

    var body: some Scene {
        WindowGroup { RootView() }
    }
}
