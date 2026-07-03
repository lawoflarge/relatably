import SwiftUI

// Cluster "sticker" bubble — 1:1 port of ios/src/components/ClusterBubble.tsx
// per docs/superpowers/plans/rn-extraction/wordcloud.md §2/§3/§4.5.
//
// Tap OR long-press opens the moderation sheet so the control is easy to find
// (Guideline 1.2 — a hidden long-press is not discoverable). The user's own
// answer is excluded: it has the dedicated DELETE MY ANSWER affordance.

/// RN/CSS clamp borderRadius at half the smaller box dimension (CALayer does
/// the same); SwiftUI's RoundedRectangle does NOT and distorts when the radius
/// exceeds it (xs/s bubbles, the YOU tab). This shape reproduces the clamp.
struct ClampedRoundedRectangle: InsettableShape {
    var cornerRadius: CGFloat
    var insetAmount: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: insetAmount, dy: insetAmount)
        guard r.width > 0, r.height > 0 else { return Path() }
        let radius = min(max(0, cornerRadius - insetAmount), min(r.width, r.height) / 2)
        return Path(roundedRect: r, cornerRadius: radius)
    }

    func inset(by amount: CGFloat) -> ClampedRoundedRectangle {
        var shape = self
        shape.insetAmount += amount
        return shape
    }
}

struct ClusterBubble: View {

    let id: String
    let text: String
    let count: Int
    let maxCount: Int
    let isSelf: Bool
    /// Index into the visible cluster list (render order), rotates the fill.
    let colorIndex: Int
    let moderation: ClusterModeration

    /// FILL_ROTATION — mint, lemon, blue, literal light pink (not a token).
    private static let fillRotation: [Color] = [
        Palette.mint, Palette.lemon, Palette.blue, Color(hex: 0xFFD7E8),
    ]

    var body: some View {
        let bucket = sizeBucket(count: count, maxCount: maxCount)
        let fontSize = bucket.fontPx
        let angle = stickerRotation(id: id)

        let isLargeBucket = bucket == .xl || bucket == .l || bucket == .m
        let borderWidth: CGFloat = (bucket == .xs || bucket == .s) ? 2 : 3
        let shadowSpec = isSelf ? Shadows.l : (isLargeBucket ? Shadows.m : Shadows.s)
        let radius = (bucket == .xl || bucket == .l) ? Radii.l : Radii.m
        let fill = isSelf ? Palette.pink : Self.fillRotation[colorIndex % Self.fillRotation.count]
        let fg = isSelf ? Palette.cream : Palette.ink
        let shape = ClampedRoundedRectangle(cornerRadius: radius)

        Text(text)
            // BagelFatOne clips its top at lineHeight == fontSize; give headroom
            // (RN lineHeight = Math.round(fontSize * 1.2)).
            .typeStyle(TypeStyle(
                family: Fonts.bagelFatOne,
                size: fontSize,
                lineHeight: (fontSize * 1.2).rounded()
            ))
            .foregroundColor(fg)
            // RN paddings sit INSIDE the border box.
            .padding(.vertical, (bucket == .xl ? Spacing.sp3 : Spacing.sp2) + borderWidth)
            .padding(.horizontal, (bucket == .xl ? Spacing.sp4 : Spacing.sp3) + borderWidth)
            .background(shape.fill(fill))
            .overlay(shape.strokeBorder(Palette.ink, lineWidth: borderWidth))
            .hardShadow(shadowSpec, shape: shape)
            .overlay(alignment: .topLeading) {
                if isSelf {
                    youTab.offset(x: -10, y: -12)
                }
            }
            .rotationEffect(.degrees(angle))
            .contentShape(shape)
            .onTapGesture { openModeration() }
            .onLongPressGesture { openModeration() }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(isSelf ? text : "\(text), tap to hide or report")
            .accessibilityHint(isSelf ? "" : "Tap or long-press to hide this answer from your feed or report it")
            .accessibilityAddTraits(.isButton)
    }

    /// Self bubble is inert here — deletion is the button under the cloud.
    private func openModeration() {
        if isSelf { return }
        moderation.openSheet(id: id, text: text)
    }

    /// Small rotated "YOU" tab overlapping the bubble's top-left corner
    /// (RN absolute top −12 / left −10).
    private var youTab: some View {
        Text("YOU")
            .font(Fonts.spaceBold(10))
            .kerning(1.4)
            .foregroundColor(Palette.ink)
            // paddingH 8 / paddingV 2 inside the 2pt border box.
            .padding(.horizontal, Spacing.sp2 + 2)
            .padding(.vertical, 2 + 2)
            .background(ClampedRoundedRectangle(cornerRadius: Radii.s).fill(Palette.lemon2))
            .overlay(ClampedRoundedRectangle(cornerRadius: Radii.s).strokeBorder(Palette.ink, lineWidth: 2))
            .rotationEffect(.degrees(-12))
            .fixedSize()
    }
}
