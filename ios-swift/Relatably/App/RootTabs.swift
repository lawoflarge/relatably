// Custom 5-tab shell: manual tab switching under a floating StickerTabBar —
// deliberately NOT native TabView chrome (settings-tabbar.md §2/§7).
//
// All five tab views stay ALIVE across switches (ZStack + opacity /
// allowsHitTesting) so their ViewModels never re-boot on tab switch —
// RN parity: expo-router keeps mounted screens mounted. Placeholder Text
// per remaining tab until Tasks 10–15 land the real feature screens.

import SwiftUI

// MARK: - Safe-area insets environment (feature views need the DEVICE insets
// because the tab shell draws full-screen via .ignoresSafeArea()).

private struct SafeAreaInsetsKey: EnvironmentKey {
    static let defaultValue = EdgeInsets()
}

extension EnvironmentValues {
    /// Device safe-area insets measured by the tab shell's GeometryReader.
    var appSafeAreaInsets: EdgeInsets {
        get { self[SafeAreaInsetsKey.self] }
        set { self[SafeAreaInsetsKey.self] = newValue }
    }
}

// MARK: - RootTabs

struct RootTabs: View {

    @State private var selection: AppTab = .today

    var body: some View {
        GeometryReader { geo in
            // RN: bottomPad = insets.bottom > 0 ? 8 : 12, measured from the
            // PHYSICAL screen bottom — the pill hugs the home indicator
            // (build-25 cream-gap fix, settings-tabbar.md §2).
            let bottomPad: CGFloat = geo.safeAreaInsets.bottom > 0 ? 8 : 12
            ZStack(alignment: .bottom) {
                ZStack {
                    tabView(.today) { HomeView() }
                    tabView(.friends) { Text("FRIENDS") }
                    tabView(.board) { Text("BOARD") }
                    tabView(.archive) { Text("ARCHIVE") }
                    tabView(.me) { Text("ME") }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                StickerTabBar(selection: $selection)
                    .padding(.horizontal, Spacing.gutter) // 22
                    .padding(.bottom, bottomPad)
            }
            .environment(\.appSafeAreaInsets, geo.safeAreaInsets)
            .ignoresSafeArea()
            // RN parity: the window never moves for the keyboard.
            .ignoresSafeArea(.keyboard, edges: .bottom)
        }
    }

    /// Keeps the tab's view in the hierarchy permanently; only visibility and
    /// hit testing follow the selection, so @StateObject VMs persist.
    @ViewBuilder
    private func tabView<Content: View>(
        _ tab: AppTab,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .opacity(selection == tab ? 1 : 0)
            .allowsHitTesting(selection == tab)
            .accessibilityHidden(selection != tab)
    }
}
