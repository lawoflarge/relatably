// Custom 5-tab shell: manual tab switching under a floating StickerTabBar —
// deliberately NOT native TabView chrome (settings-tabbar.md §2/§7).
//
// All five tab views stay ALIVE across switches (ZStack + opacity /
// allowsHitTesting) so their ViewModels never re-boot on tab switch —
// RN parity: expo-router keeps mounted screens mounted.

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
    /// RN parity: the ARCHIVE tab button always targets the list screen —
    /// every switch INTO the archive tab pops its NavigationStack to root
    /// (expo-router's archive/[id] is never the tab button's destination).
    @State private var archiveTabSelects = 0
    @State private var tabBarHeight: CGFloat = 120

    var body: some View {
        GeometryReader { geo in
            // RN: bottomPad = insets.bottom > 0 ? 8 : 12, measured from the
            // PHYSICAL screen bottom — the pill hugs the home indicator
            // (build-25 cream-gap fix, settings-tabbar.md §2).
            let bottomPad: CGFloat = geo.safeAreaInsets.bottom > 0 ? 8 : 12
            ZStack(alignment: .bottom) {
                ZStack {
                    // TODAY boots at launch (it IS the initial tab — same
                    // timing as RN). Every other tab gets isActive as its
                    // focus signal: RN (expo-router) mounts tab screens
                    // LAZILY on first focus, so their initial fetches fire
                    // on first selection, not at app launch. MeView also
                    // refreshes the undo lists on EVERY switch into ME (a
                    // separately justified deviation).
                    tabView(.today) { HomeView() }
                    tabView(.friends) { FriendsView(isActive: selection == .friends) }
                    tabView(.board) { BoardView(isActive: selection == .board) }
                    tabView(.archive) {
                        ArchiveView(
                            popToRootTrigger: archiveTabSelects,
                            isActive: selection == .archive
                        )
                    }
                    tabView(.me) { MeView(isActive: selection == .me, bottomObstruction: tabBarHeight + bottomPad + 4) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                StickerTabBar(selection: tabSelection, onReselect: { tab in
                    // RN parity: tapping ARCHIVE while on archive/[id] pops
                    // back to the list (the pill always targets the list).
                    if tab == .archive { archiveTabSelects += 1 }
                })
                    .background {
                        GeometryReader { bar in
                            Color.clear
                                .onAppear { tabBarHeight = bar.size.height }
                                .onChange(of: bar.size.height) { _, height in tabBarHeight = height }
                        }
                    }
                    .padding(.horizontal, Spacing.gutter) // 22
                    .padding(.bottom, bottomPad)
            }
            .environment(\.appSafeAreaInsets, geo.safeAreaInsets)
            .ignoresSafeArea()
            // RN parity: the window never moves for the keyboard.
            .ignoresSafeArea(.keyboard, edges: .bottom)
        }
    }

    /// Wraps `selection` to count switches into the archive tab (fires on tab
    /// ENTRY; re-taps of the active ARCHIVE pill bump the counter separately
    /// via StickerTabBar.onReselect).
    private var tabSelection: Binding<AppTab> {
        Binding(
            get: { selection },
            set: { newValue in
                if newValue == .archive { archiveTabSelects += 1 }
                selection = newValue
            }
        )
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
