// Custom 5-tab shell: manual tab switching under a floating StickerTabBar —
// deliberately NOT native TabView chrome (settings-tabbar.md §2/§7).
// Tab content is a placeholder Text per tab until Tasks 9–15 land the
// real feature screens.

import SwiftUI

struct RootTabs: View {

    @State private var selection: AppTab = .today

    var body: some View {
        GeometryReader { geo in
            // RN: bottomPad = insets.bottom > 0 ? 8 : 12, measured from the
            // PHYSICAL screen bottom — the pill hugs the home indicator
            // (build-25 cream-gap fix, settings-tabbar.md §2).
            let bottomPad: CGFloat = geo.safeAreaInsets.bottom > 0 ? 8 : 12
            ZStack(alignment: .bottom) {
                placeholder(for: selection)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                StickerTabBar(selection: $selection)
                    .padding(.horizontal, Spacing.gutter) // 22
                    .padding(.bottom, bottomPad)
            }
            .ignoresSafeArea()
        }
    }

    /// Placeholders — replaced by the real feature screens in Tasks 9–15.
    @ViewBuilder
    private func placeholder(for tab: AppTab) -> some View {
        switch tab {
        case .today: Text("TODAY")
        case .friends: Text("FRIENDS")
        case .board: Text("BOARD")
        case .archive: Text("ARCHIVE")
        case .me: Text("ME")
        }
    }
}
