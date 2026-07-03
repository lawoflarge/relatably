// Root tree (tokens-fonts-texture.md §2c): cream background everywhere,
// PaperTexture dot grid behind the screens, TosGate wrapping the ENTIRE
// tab shell — while blocking, no tab UI exists at all. Dark status-bar
// content comes from UIUserInterfaceStyle=Light in Info.plist.

import SwiftUI

struct RootView: View {
    var body: some View {
        ZStack {
            Palette.cream.ignoresSafeArea()
            PaperTexture()
            TosGate {
                RootTabs()
            }
        }
    }
}
