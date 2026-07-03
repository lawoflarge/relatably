import XCTest
import SwiftUI
@testable import Relatably

/// Fixtures from docs/superpowers/plans/rn-extraction/tokens-fonts-texture.md §1/§5.
/// NOTE: hero.line is 62 (tokens.ts source of truth) — the RN Jest assertion of 50 is stale.
final class TokensTests: XCTestCase {

    // MARK: - Helpers

    private func assertColor(
        _ color: Color,
        hex: UInt32,
        _ name: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        XCTAssertTrue(
            UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a),
            "\(name): could not extract RGBA components", file: file, line: line
        )
        XCTAssertEqual(r, CGFloat((hex >> 16) & 0xFF) / 255, accuracy: 0.001, "\(name) red", file: file, line: line)
        XCTAssertEqual(g, CGFloat((hex >> 8) & 0xFF) / 255, accuracy: 0.001, "\(name) green", file: file, line: line)
        XCTAssertEqual(b, CGFloat(hex & 0xFF) / 255, accuracy: 0.001, "\(name) blue", file: file, line: line)
        XCTAssertEqual(a, 1, accuracy: 0.001, "\(name) alpha", file: file, line: line)
    }

    // MARK: - Palette (10 colors)

    func testPaletteHexValues() {
        assertColor(Palette.cream, hex: 0xFFF7E8, "cream")
        assertColor(Palette.cream2, hex: 0xFBEED1, "cream2")
        assertColor(Palette.ink, hex: 0x1A1A1A, "ink")
        assertColor(Palette.inkSoft, hex: 0x4A4541, "inkSoft")
        assertColor(Palette.pink, hex: 0xFF4FA3, "pink")
        assertColor(Palette.lemon2, hex: 0xFFD43B, "lemon2")
        assertColor(Palette.lemon, hex: 0xFFDF6B, "lemon")
        assertColor(Palette.mint, hex: 0x7AE6C3, "mint")
        assertColor(Palette.blue, hex: 0x7BC8F6, "blue")
        assertColor(Palette.red, hex: 0xFF5A4F, "red")
    }

    // MARK: - Typography (9 tokens)

    func testTypographySizesAndLineHeights() {
        XCTAssertEqual(Typography.hero.size, 52)
        XCTAssertEqual(Typography.hero.lineHeight, 62) // NOT 50 — RN Jest fixture is stale
        XCTAssertEqual(Typography.h1.size, 40)
        XCTAssertEqual(Typography.h1.lineHeight, 48)
        XCTAssertEqual(Typography.h2.size, 36)
        XCTAssertEqual(Typography.h2.lineHeight, 44)
        XCTAssertEqual(Typography.h3.size, 22)
        XCTAssertEqual(Typography.h3.lineHeight, 28)
        XCTAssertEqual(Typography.bodyL.size, 17)
        XCTAssertEqual(Typography.bodyL.lineHeight, 24)
        XCTAssertEqual(Typography.body.size, 15)
        XCTAssertEqual(Typography.body.lineHeight, 20)
        XCTAssertEqual(Typography.bodyS.size, 13)
        XCTAssertEqual(Typography.bodyS.lineHeight, 18)
        XCTAssertEqual(Typography.label.size, 11)
        XCTAssertEqual(Typography.label.lineHeight, 14)
        XCTAssertEqual(Typography.micro.size, 9)
        XCTAssertEqual(Typography.micro.lineHeight, 12)
    }

    func testTypographyFamilies() {
        // RN family keys → bundled PostScript names (report §2b)
        XCTAssertEqual(Typography.hero.family, "BagelFatOne-Regular")
        XCTAssertEqual(Typography.h1.family, "BagelFatOne-Regular")
        XCTAssertEqual(Typography.h2.family, "BagelFatOne-Regular")
        XCTAssertEqual(Typography.h3.family, "BagelFatOne-Regular")
        XCTAssertEqual(Typography.bodyL.family, "HankenGrotesk-Bold")
        XCTAssertEqual(Typography.body.family, "HankenGrotesk-Bold")
        XCTAssertEqual(Typography.bodyS.family, "HankenGrotesk-Bold")
        XCTAssertEqual(Typography.label.family, "SpaceGrotesk-SemiBold")
        XCTAssertEqual(Typography.micro.family, "SpaceGrotesk-Bold")
    }

    func testTypographyLetterSpacing() {
        XCTAssertEqual(Typography.label.letterSpacing, 1.1, accuracy: 0.0001)
        XCTAssertEqual(Typography.micro.letterSpacing, 1.3, accuracy: 0.0001)
        // All other tokens carry no tracking.
        XCTAssertEqual(Typography.hero.letterSpacing, 0)
        XCTAssertEqual(Typography.bodyL.letterSpacing, 0)
        XCTAssertEqual(Typography.body.letterSpacing, 0)
    }

    // MARK: - Spacing

    func testSpacingScale() {
        XCTAssertEqual(Spacing.sp1, 4)
        XCTAssertEqual(Spacing.sp2, 8)
        XCTAssertEqual(Spacing.sp3, 12)
        XCTAssertEqual(Spacing.sp4, 16)
        XCTAssertEqual(Spacing.sp5, 24)
        XCTAssertEqual(Spacing.sp6, 32)
        XCTAssertEqual(Spacing.sp7, 48)
        XCTAssertEqual(Spacing.sp8, 64)
        XCTAssertEqual(Spacing.gutter, 22)
        XCTAssertEqual(Spacing.section, 24)
    }

    // MARK: - Radii

    func testRadii() {
        XCTAssertEqual(Radii.s, 14)
        XCTAssertEqual(Radii.m, 22)
        XCTAssertEqual(Radii.l, 28)
        XCTAssertEqual(Radii.xl, 36)
        XCTAssertEqual(Radii.pill, 999)
    }

    // MARK: - Shadows (hard sticker shadows)

    func testShadowOffsets() {
        XCTAssertEqual(Shadows.s.offset, CGSize(width: 2, height: 2))
        XCTAssertEqual(Shadows.m.offset, CGSize(width: 4, height: 4))
        XCTAssertEqual(Shadows.l.offset, CGSize(width: 6, height: 6))
    }

    func testShadowsAreHardAndInk() {
        for (name, spec) in [("s", Shadows.s), ("m", Shadows.m), ("l", Shadows.l)] {
            XCTAssertEqual(spec.blurRadius, 0, "\(name) must have ZERO blur")
            XCTAssertEqual(spec.opacity, 1, "\(name) must be fully opaque")
            assertColor(spec.color, hex: 0x1A1A1A, "shadow \(name) color")
        }
    }

    // MARK: - Motion (6 constants)

    func testMotionConstants() {
        XCTAssertEqual(Motion.Tap.duration, 120)
        XCTAssertEqual(Motion.Tap.easing, "ease-out")
        XCTAssertEqual(Motion.Spring.duration, 200)
        XCTAssertEqual(Motion.Spring.damping, 0.5, accuracy: 0.0001)
        XCTAssertEqual(Motion.Wobble.duration, 4000)
        XCTAssertEqual(Motion.Wobble.range, 2)
        XCTAssertEqual(Motion.PopIn.duration, 600)
        XCTAssertEqual(Motion.PopIn.overshoot, 1.08, accuracy: 0.0001)
        XCTAssertEqual(Motion.PopIn.stagger, 25)
        XCTAssertEqual(Motion.Reveal.duration, 700)
        XCTAssertEqual(Motion.Reveal.overshoot, 1.15, accuracy: 0.0001)
        XCTAssertEqual(Motion.Pulse.duration, 1800)
        XCTAssertEqual(Motion.Pulse.scale, 1.2, accuracy: 0.0001)
    }

    // MARK: - Bundled fonts (proves Info.plist UIAppFonts registration)

    func testBundledFontsAreRegistered() {
        let postScriptNames = [
            "BagelFatOne-Regular",
            "HankenGrotesk-Bold",
            "HankenGrotesk-ExtraBold",
            "SpaceGrotesk-SemiBold",
            "SpaceGrotesk-Bold",
        ]
        for name in postScriptNames {
            XCTAssertNotNil(
                UIFont(name: name, size: 12),
                "font \(name) not registered — check UIAppFonts / bundle resources"
            )
        }
    }

    func testFontHelperConstantsMatchPostScriptNames() {
        XCTAssertEqual(Fonts.bagelFatOne, "BagelFatOne-Regular")
        XCTAssertEqual(Fonts.hankenGroteskBold, "HankenGrotesk-Bold")
        XCTAssertEqual(Fonts.hankenGroteskExtraBold, "HankenGrotesk-ExtraBold")
        XCTAssertEqual(Fonts.spaceGroteskSemiBold, "SpaceGrotesk-SemiBold")
        XCTAssertEqual(Fonts.spaceGroteskBold, "SpaceGrotesk-Bold")
        XCTAssertEqual(Fonts.all.count, 5)
    }
}
