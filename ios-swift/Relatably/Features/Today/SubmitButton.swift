import SwiftUI
import UIKit

// 1:1 port of ios/src/components/SubmitButton.tsx (home-flow.md §5).
//
// Dwell gate: enabled ⇔ (≥3000 ms since startedAt) AND hasText. `dwellMet`
// LATCHES true for the lifetime of this view identity — it is never reset
// when startedAt changes (RN parity §11.9); only a remount (the wordcloud
// round trip swaps the phase view) restarts the gate.
//
// Press animation: rests at −2°, straightens to 0° and shifts +2pt
// right/down over 120 ms ease-out ("pressed into the shadow"), returns
// over 200 ms. Motion tokens are MILLISECONDS → /1000 for SwiftUI.
//
// Haptic: UINotificationFeedbackGenerator success on tap, BEFORE onPress.

struct SubmitButton: View {

    /// MIN_DWELL_MS — anti-bot dwell before the button unlocks.
    static let minDwellMs: Double = 3000

    let hasText: Bool
    let startedAt: Date
    let onPress: () -> Void

    @State private var dwellMet = false

    /// Boundary is inclusive: elapsed >= 3000 ⇒ met (§10).
    static func dwellSatisfied(startedAt: Date, now: Date) -> Bool {
        now.timeIntervalSince(startedAt) * 1000 >= minDwellMs
    }

    static func isEnabled(dwellMet: Bool, hasText: Bool) -> Bool {
        dwellMet && hasText
    }

    private var enabled: Bool { Self.isEnabled(dwellMet: dwellMet, hasText: hasText) }

    var body: some View {
        Button {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onPress()
        } label: {
            Text("DROP IT")
                .font(Fonts.bagel(22)) // h3 family, fontSize 22 via style override
                .foregroundColor(enabled ? Palette.cream : Palette.inkSoft)
                // RN paddings (18 / 28) sit INSIDE the 3pt border box.
                .padding(.vertical, Spacing.sp4 + 2 + 3)
                .padding(.horizontal, Spacing.sp5 + Spacing.sp1 + 3)
                .background(
                    RoundedRectangle(cornerRadius: Radii.l)
                        .fill(enabled ? Palette.pink : Palette.cream2)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.l)
                        .strokeBorder(Palette.ink, lineWidth: 3)
                )
                .hardShadow(enabled ? Shadows.l : Shadows.s, shape: RoundedRectangle(cornerRadius: Radii.l))
                .opacity(enabled ? 1 : 0.92)
        }
        .buttonStyle(SubmitPressStyle())
        .disabled(!enabled)
        .accessibilityAddTraits(.isButton)
        .task(id: startedAt) {
            guard !dwellMet else { return } // latch — never re-locks
            if Self.dwellSatisfied(startedAt: startedAt, now: Date()) {
                dwellMet = true
                return
            }
            let remaining = Self.minDwellMs / 1000 - Date().timeIntervalSince(startedAt)
            try? await Task.sleep(nanoseconds: UInt64(max(0, remaining) * 1_000_000_000))
            if !Task.isCancelled {
                dwellMet = true
            }
        }
    }
}

/// −2° → 0° + (2, 2)pt translation on press-in over 120 ms ease-out;
/// back over 200 ms (motion.tap / motion.spring, ms → s).
private struct SubmitPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        return configuration.label
            .rotationEffect(.degrees(pressed ? 0 : -2))
            .offset(x: pressed ? 2 : 0, y: pressed ? 2 : 0)
            .animation(
                .easeOut(duration: (pressed ? Motion.Tap.duration : Motion.Spring.duration) / 1000),
                value: pressed
            )
    }
}
