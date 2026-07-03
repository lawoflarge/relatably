import SwiftUI

// 1:1 port of ios/src/components/AnswerInput.tsx (home-flow.md §4):
// white sticker input with 3pt ink border, hard m-shadow, and the lemon
// peel-corner triangle pinned to the top-right corner (drawn natively with
// Path — no SVG dependency).
//
// RN quirks preserved: returnKeyType "send" but NO submit handler (the
// keyboard send key does not submit), maxLength 280, no autocapitalize /
// autocorrect.

struct AnswerInput: View {

    @Binding var text: String

    var body: some View {
        TextField(
            "",
            text: $text,
            prompt: Text("your take?")
                .foregroundColor(Color(hex: 0x1A1A1A).opacity(0.45))
        )
        .font(Fonts.hankenBold(Typography.bodyL.size)) // HankenGrotesk_700 17
        .foregroundColor(Palette.ink)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled(true)
        .submitLabel(.send) // key label only — no onSubmit, parity with RN
        .padding(.trailing, 28)                    // input's own paddingRight
        .padding(.horizontal, Spacing.sp5)         // wrap paddingHorizontal 24
        .padding(.vertical, Spacing.sp4 + 2)       // wrap paddingVertical 18
        .padding(3)                                // RN padding sits inside the 3pt border
        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 3))
        .hardShadow(Shadows.m, shape: RoundedRectangle(cornerRadius: Radii.m))
        .overlay(alignment: .topTrailing) { PeelCorner(size: 22) }
        .onChange(of: text) { _, newValue in
            if newValue.count > 280 {
                text = String(newValue.prefix(280)) // maxLength 280
            }
        }
    }
}

// MARK: - Peel corner (IconPeelCorner port)

/// SVG `M0 0 L24 0 L0 24 Z` — a triangle covering the top-left half of its
/// box — scaled from the 24pt viewBox to the render size.
struct PeelCornerShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

struct PeelCorner: View {
    let size: CGFloat

    var body: some View {
        PeelCornerShape()
            .fill(Palette.lemon2)
            .overlay(
                PeelCornerShape()
                    // SVG strokeWidth 2 in a 24-unit viewBox rendered at `size`.
                    .stroke(Palette.ink, style: StrokeStyle(lineWidth: 2 * size / 24, lineJoin: .round))
            )
            .frame(width: size, height: size)
    }
}
