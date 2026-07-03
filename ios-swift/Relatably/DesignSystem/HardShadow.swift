// Hard "cut-out sticker" shadow: a SOLID ink copy of the shape rendered
// BEHIND the content, offset by the token's (dx, dy) — ZERO blur.
// `.shadow(radius:)` is FORBIDDEN for sticker shadows (it blurs).
//
// Usage (layer order matters — fill the shape first, then add the shadow):
//   content
//     .background(RoundedRectangle(cornerRadius: Radii.m).fill(Palette.cream))
//     .hardShadow(Shadows.m, shape: RoundedRectangle(cornerRadius: Radii.m))
//   pill
//     .hardShadow(Shadows.s, shape: Capsule())

import SwiftUI

struct HardShadowModifier<S: Shape>: ViewModifier {
    let spec: ShadowSpec
    let shape: S

    func body(content: Content) -> some View {
        content.background(
            shape
                .fill(spec.color.opacity(spec.opacity))
                .offset(x: spec.offset.width, y: spec.offset.height)
        )
    }
}

extension View {
    /// Render a solid offset copy of `shape` behind the view — the design
    /// system's hard sticker shadow (no blur, full opacity, ink).
    func hardShadow<S: Shape>(_ spec: ShadowSpec, shape: S) -> some View {
        modifier(HardShadowModifier(spec: spec, shape: shape))
    }
}
