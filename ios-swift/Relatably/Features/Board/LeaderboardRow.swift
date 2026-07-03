import SwiftUI

// One Board row — 1:1 port of ios/src/components/LeaderboardRow.tsx per
// docs/superpowers/plans/rn-extraction/board-demo.md §2/§3/§6.
//
// Two entry points to the SAME block/report action sheet: long-press
// anywhere on the row, and tap on the ⋯ button — both gated by
// canModerate (never on your own row). The sheet itself is presented by
// BoardModerationSheetHost at the screen level.

// MARK: - IconFlame (SVG path port, viewBox 0 0 24 24, stroke only)

struct FlameShape: Shape {
    // M12 3 C12 8 17 9 17 14 C17 17 14.8 20 12 20 C9.2 20 7 17 7 14
    // C7 11 9 10 9 7 C10.5 8 12 7 12 3 Z
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 12 * s, y: 3 * s))
        p.addCurve(
            to: CGPoint(x: 17 * s, y: 14 * s),
            control1: CGPoint(x: 12 * s, y: 8 * s),
            control2: CGPoint(x: 17 * s, y: 9 * s)
        )
        p.addCurve(
            to: CGPoint(x: 12 * s, y: 20 * s),
            control1: CGPoint(x: 17 * s, y: 17 * s),
            control2: CGPoint(x: 14.8 * s, y: 20 * s)
        )
        p.addCurve(
            to: CGPoint(x: 7 * s, y: 14 * s),
            control1: CGPoint(x: 9.2 * s, y: 20 * s),
            control2: CGPoint(x: 7 * s, y: 17 * s)
        )
        p.addCurve(
            to: CGPoint(x: 9 * s, y: 7 * s),
            control1: CGPoint(x: 7 * s, y: 11 * s),
            control2: CGPoint(x: 9 * s, y: 10 * s)
        )
        p.addCurve(
            to: CGPoint(x: 12 * s, y: 3 * s),
            control1: CGPoint(x: 10.5 * s, y: 8 * s),
            control2: CGPoint(x: 12 * s, y: 7 * s)
        )
        p.closeSubpath()
        return p
    }
}

struct IconFlame: View {
    let size: CGFloat
    let color: Color

    var body: some View {
        FlameShape()
            // strokeWidth 2 is in viewBox units — scale it with the icon.
            .stroke(color, style: StrokeStyle(lineWidth: 2 * size / 24, lineJoin: .round))
            .frame(width: size, height: size)
    }
}

// MARK: - LeaderboardRow

struct LeaderboardRow: View {

    let rank: Int
    let userId: String
    let handle: String?
    let score: Int
    let streakDays: Int
    let isSelf: Bool
    let crown: Bool
    /// Opens the block/report action sheet (userId, handle).
    let onModerate: (String, String?) -> Void

    private var displayHandle: String { handle ?? "anon" }
    /// Uppercased first char; empty-string handle → "?" (§8.14).
    private var initial: String {
        displayHandle.first.map { String($0).uppercased() } ?? "?"
    }
    private var bg: Color { isSelf ? Palette.pink : crown ? Palette.lemon2 : .white }
    private var fg: Color { isSelf ? Palette.cream : Palette.ink }
    private var borderWidth: CGFloat { isSelf || crown ? 3 : 2 }
    private var shadowSpec: ShadowSpec { isSelf || crown ? Shadows.m : Shadows.s }
    private var canModerate: Bool { !userId.isEmpty && !isSelf }

    var body: some View {
        let shape = ClampedRoundedRectangle(cornerRadius: Radii.m)
        card(shape: shape)
            // Sticker tabs hang off the CARD's corners (before outer margin).
            .overlay(alignment: .topLeading) {
                if crown { crownTab }
            }
            .overlay(alignment: .topTrailing) {
                if isSelf { youTab }
            }
            .padding(.vertical, Spacing.sp2) // outer marginVertical 8
            .contentShape(Rectangle())
            .onLongPressGesture {
                guard canModerate else { return }
                onModerate(userId, handle)
            }
            .accessibilityHint(canModerate ? "Long-press to block or report this user" : "")
    }

    private func card(shape: ClampedRoundedRectangle) -> some View {
        HStack(spacing: Spacing.sp3) { // gap 12
            // Rank, always zero-padded to 2 digits (padStart(2, "0")).
            Text(String(format: "%02d", rank))
                .font(Fonts.bagel(22))
                .foregroundColor(fg)
                .frame(width: 32, alignment: .leading)

            avatar

            VStack(alignment: .leading, spacing: 0) {
                Text(displayHandle)
                    .font(Fonts.hankenExtraBold(15))
                    .foregroundColor(fg)
                    .lineLimit(1)
                if streakDays > 0 {
                    HStack(spacing: 4) {
                        IconFlame(size: 11, color: fg)
                        Text("\(streakDays)-DAY STREAK")
                            .font(Fonts.spaceBold(10))
                            .kerning(1.2)
                            .foregroundColor(fg)
                    }
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading) // mid { flex: 1 }

            // RN renders the raw JS number — no grouping.
            Text(String(score))
                .font(Fonts.bagel(20))
                .foregroundColor(fg)

            if canModerate {
                Button {
                    onModerate(userId, handle)
                } label: {
                    Text("⋯")
                        .font(Fonts.bagel(22))
                        .foregroundColor(fg)
                        .frame(minWidth: 36, minHeight: 36)
                }
                .buttonStyle(.plain)
                .contentShape(Rectangle())
                .padding(.leading, Spacing.sp1) // marginLeft 4 (on top of gap 12)
                .accessibilityLabel("Block or report \(displayHandle)")
            }
        }
        // RN paddings (12 / 14) sit INSIDE the border box.
        .padding(.vertical, Spacing.sp3 + borderWidth)
        .padding(.horizontal, Spacing.sp3 + 2 + borderWidth)
        .background(shape.fill(bg))
        .overlay(shape.strokeBorder(Palette.ink, lineWidth: borderWidth))
        .hardShadow(shadowSpec, shape: shape)
    }

    private var avatar: some View {
        ZStack {
            Circle().fill(Palette.mint)
            Circle().strokeBorder(Palette.ink, lineWidth: 2)
            Text(initial)
                .font(Fonts.bagel(14))
                .foregroundColor(Palette.ink) // always ink, not fg
        }
        .frame(width: 36, height: 36)
    }

    private var crownTab: some View {
        let tab = ClampedRoundedRectangle(cornerRadius: Radii.s)
        return Text("★ #1")
            .font(Fonts.bagel(12))
            .foregroundColor(Palette.cream)
            .padding(.horizontal, Spacing.sp2 + 2) // 8 inside 2pt border
            .padding(.vertical, 2 + 2)
            .background(tab.fill(Palette.pink))
            .overlay(tab.strokeBorder(Palette.ink, lineWidth: 2))
            .rotationEffect(.degrees(-8))
            .offset(x: -14, y: -10)
    }

    private var youTab: some View {
        let tab = ClampedRoundedRectangle(cornerRadius: Radii.s)
        return Text("YOU")
            .font(Fonts.spaceBold(10))
            .kerning(1.4)
            .foregroundColor(Palette.ink)
            .padding(.horizontal, Spacing.sp2 + 2)
            .padding(.vertical, 2 + 2)
            .background(tab.fill(Palette.lemon2))
            .overlay(tab.strokeBorder(Palette.ink, lineWidth: 2))
            .rotationEffect(.degrees(4))
            .offset(x: 10, y: -12)
    }
}
