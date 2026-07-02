// Source of truth for Sticker Pop design language.
// 1:1 port of ios/src/theme/tokens.ts — values verbatim, per
// docs/superpowers/plans/rn-extraction/tokens-fonts-texture.md §1.

import SwiftUI
import UIKit

// MARK: - Hex color initializers

extension UIColor {
    /// Opaque sRGB color from a 24-bit hex value, e.g. `UIColor(hex: 0xFFF7E8)`.
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Color {
    /// Opaque sRGB color from a 24-bit hex value, e.g. `Color(hex: 0x1A1A1A)`.
    init(hex: UInt32) {
        self.init(uiColor: UIColor(hex: hex))
    }
}

// MARK: - Palette (10 colors)

enum Palette {
    /// App/screen background, card fill, navigation background.
    static let cream = Color(hex: 0xFFF7E8)
    /// Secondary/alternate cream surface.
    static let cream2 = Color(hex: 0xFBEED1)
    /// Primary text, borders, hard shadows, texture dots.
    static let ink = Color(hex: 0x1A1A1A)
    /// Secondary/muted text.
    static let inkSoft = Color(hex: 0x4A4541)
    /// Primary accent / navigation tint / notification.
    static let pink = Color(hex: 0xFF4FA3)
    /// Saturated yellow accent.
    static let lemon2 = Color(hex: 0xFFD43B)
    /// Lighter yellow accent.
    static let lemon = Color(hex: 0xFFDF6B)
    /// Mint accent.
    static let mint = Color(hex: 0x7AE6C3)
    /// Blue accent.
    static let blue = Color(hex: 0x7BC8F6)
    /// Destructive/error accent.
    static let red = Color(hex: 0xFF5A4F)
}

// MARK: - Typography (9 tokens)

/// One typography token. `lineHeight` is the ABSOLUTE line-box height in pt
/// (RN `lineHeight` semantics — NOT a multiplier, NOT extra spacing).
/// `letterSpacing` is tracking in pt (SwiftUI `.kerning`).
struct TypeStyle {
    /// PostScript font name (usable in `Font.custom` / `UIFont(name:)`).
    let family: String
    let size: CGFloat
    let lineHeight: CGFloat
    let letterSpacing: CGFloat

    init(family: String, size: CGFloat, lineHeight: CGFloat, letterSpacing: CGFloat = 0) {
        self.family = family
        self.size = size
        self.lineHeight = lineHeight
        self.letterSpacing = letterSpacing
    }

    var font: Font { .custom(family, size: size) }
}

/// BagelFatOne is a tall, heavy-ascender display face. On iOS the line box is
/// clamped to lineHeight, so a lineHeight <= fontSize clips the top of the
/// glyphs. Display tokens therefore need headroom (~1.2x size); the web
/// mockups' tighter ratios do not translate to iOS. Do NOT tighten.
enum Typography {
    static let hero  = TypeStyle(family: Fonts.bagelFatOne, size: 52, lineHeight: 62)
    static let h1    = TypeStyle(family: Fonts.bagelFatOne, size: 40, lineHeight: 48)
    static let h2    = TypeStyle(family: Fonts.bagelFatOne, size: 36, lineHeight: 44)
    static let h3    = TypeStyle(family: Fonts.bagelFatOne, size: 22, lineHeight: 28)
    static let bodyL = TypeStyle(family: Fonts.hankenGroteskBold, size: 17, lineHeight: 24)
    static let body  = TypeStyle(family: Fonts.hankenGroteskBold, size: 15, lineHeight: 20)
    static let bodyS = TypeStyle(family: Fonts.hankenGroteskBold, size: 13, lineHeight: 18)
    static let label = TypeStyle(family: Fonts.spaceGroteskSemiBold, size: 11, lineHeight: 14, letterSpacing: 1.1)
    static let micro = TypeStyle(family: Fonts.spaceGroteskBold, size: 9, lineHeight: 12, letterSpacing: 1.3)
}

/// Applies a `TypeStyle` with RN line-height semantics: the token's
/// `lineHeight` is an absolute line-box height, so the delta over the font's
/// natural line height is applied as explicit line spacing plus half-delta
/// vertical padding (headroom so BagelFatOne ascenders don't clip).
struct TypeStyleModifier: ViewModifier {
    let style: TypeStyle

    func body(content: Content) -> some View {
        let uiFont = UIFont(name: style.family, size: style.size)
            ?? UIFont.systemFont(ofSize: style.size)
        let delta = max(0, style.lineHeight - uiFont.lineHeight)
        return content
            .font(style.font)
            .kerning(style.letterSpacing)
            .lineSpacing(delta)
            .padding(.vertical, delta / 2)
    }
}

extension View {
    /// Apply a typography token (font + kerning + absolute line height).
    func typeStyle(_ style: TypeStyle) -> some View {
        modifier(TypeStyleModifier(style: style))
    }
}

// MARK: - Spacing (pt)

enum Spacing {
    static let sp1: CGFloat = 4
    static let sp2: CGFloat = 8
    static let sp3: CGFloat = 12
    static let sp4: CGFloat = 16
    static let sp5: CGFloat = 24
    static let sp6: CGFloat = 32
    static let sp7: CGFloat = 48
    static let sp8: CGFloat = 64
    /// Horizontal screen gutter.
    static let gutter: CGFloat = 22
    /// Vertical gap between sections.
    static let section: CGFloat = 24
}

// MARK: - Corner radii (pt)

enum Radii {
    static let s: CGFloat = 14
    static let m: CGFloat = 22
    static let l: CGFloat = 28
    static let xl: CGFloat = 36
    /// 999 = capsule; prefer `Capsule()` where the hit shape matters.
    static let pill: CGFloat = 999
}

// MARK: - Shadows (hard "sticker" offset shadows — ZERO blur, FULL opacity)

/// Crisp offset "cut-out sticker" shadow. Any blur is wrong.
/// (RN `elevation` is Android-only — omitted on iOS.)
struct ShadowSpec: Equatable {
    let color: Color
    let offset: CGSize
    let blurRadius: CGFloat
    let opacity: Double
}

enum Shadows {
    static let s = ShadowSpec(color: Palette.ink, offset: CGSize(width: 2, height: 2), blurRadius: 0, opacity: 1)
    static let m = ShadowSpec(color: Palette.ink, offset: CGSize(width: 4, height: 4), blurRadius: 0, opacity: 1)
    static let l = ShadowSpec(color: Palette.ink, offset: CGSize(width: 6, height: 6), blurRadius: 0, opacity: 1)
}

// MARK: - Motion (durations in MILLISECONDS, verbatim from RN tokens)

enum Motion {
    /// Press feedback.
    enum Tap {
        static let duration: Double = 120
        static let easing = "ease-out"
    }
    /// Springy settle. `damping` is a design bounce ratio from the spec,
    /// NOT SwiftUI's `dampingFraction` — match the feel (200 ms, visible
    /// overshoot), do not plug 0.5 in blindly.
    enum Spring {
        static let duration: Double = 200
        static let damping: Double = 0.5
    }
    /// Idle wobble, ±2° over a 4 s loop.
    enum Wobble {
        static let duration: Double = 4000
        static let range: Double = 2
    }
    /// Entrance pop: scale overshoots to 1.08, items staggered 25 ms apart.
    enum PopIn {
        static let duration: Double = 600
        static let overshoot: Double = 1.08
        static let stagger: Double = 25
    }
    /// Reveal animation, scale overshoot 1.15.
    enum Reveal {
        static let duration: Double = 700
        static let overshoot: Double = 1.15
    }
    /// Looping pulse up to 1.2× over 1.8 s.
    enum Pulse {
        static let duration: Double = 1800
        static let scale: Double = 1.2
    }
}
