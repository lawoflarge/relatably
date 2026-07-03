// 1:1 port of ios/src/components/sticker/PaperTexture.tsx
// (docs/superpowers/plans/rn-extraction/tokens-fonts-texture.md §3).
//
// Full-window dot-grid overlay: repeating 12×12 pt tile, one ink circle per
// tile centered at (1, 1) with radius 1 pt, whole layer at 6% opacity,
// hit-transparent, sized to the window (ignores safe area).
// Dot centers: x = 1 + 12k, y = 1 + 12m.

import SwiftUI

struct PaperTexture: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 12
            let radius: CGFloat = 1
            var y: CGFloat = 1
            while y - radius <= size.height {
                var x: CGFloat = 1
                while x - radius <= size.width {
                    let rect = CGRect(
                        x: x - radius,
                        y: y - radius,
                        width: radius * 2,
                        height: radius * 2
                    )
                    context.fill(Path(ellipseIn: rect), with: .color(Palette.ink))
                    x += step
                }
                y += step
            }
        }
        .opacity(0.06)
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }
}
