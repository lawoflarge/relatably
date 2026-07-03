import SwiftUI

// 1:1 port of ios/src/components/LiveCounter.tsx (home-flow.md §1):
// "{count.toLocaleString()} VOTES AND COUNTING" — SpaceGrotesk_600 11,
// letterSpacing 1.4 (NOT the label token's 1.1), inkSoft, centered.
// Shows even at 0 (§11.6). RN sets no lineHeight → natural line box.

struct LiveCounter: View {

    let count: Int

    /// Locale-grouped label; pinned to en (§10: 1234 → "1,234 VOTES AND COUNTING").
    static func label(for count: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "en_US")
        let number = formatter.string(from: NSNumber(value: count)) ?? String(count)
        return "\(number) VOTES AND COUNTING"
    }

    var body: some View {
        Text(Self.label(for: count))
            .font(Fonts.spaceSemiBold(Typography.label.size)) // 11
            .kerning(1.4)
            .foregroundColor(Palette.inkSoft)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }
}
