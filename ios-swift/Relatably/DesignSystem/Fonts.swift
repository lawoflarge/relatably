// Bundled custom fonts — PostScript names verified with fontTools
// (see Relatably/Resources/Fonts/POSTSCRIPT-NAMES.md and
// docs/superpowers/plans/rn-extraction/tokens-fonts-texture.md §2b).
//
// RN fontFamily key → PostScript name:
//   BagelFatOne        → BagelFatOne-Regular
//   HankenGrotesk_700  → HankenGrotesk-Bold
//   HankenGrotesk_800  → HankenGrotesk-ExtraBold
//   SpaceGrotesk_600   → SpaceGrotesk-SemiBold
//   SpaceGrotesk_700   → SpaceGrotesk-Bold
// (HankenGrotesk_500 / SpaceGrotesk_500 were loaded but never rendered in RN —
// deliberately not bundled.)

import SwiftUI

enum Fonts {
    static let bagelFatOne = "BagelFatOne-Regular"
    static let hankenGroteskBold = "HankenGrotesk-Bold"
    static let hankenGroteskExtraBold = "HankenGrotesk-ExtraBold"
    static let spaceGroteskSemiBold = "SpaceGrotesk-SemiBold"
    static let spaceGroteskBold = "SpaceGrotesk-Bold"

    /// All bundled PostScript names (must match Info.plist UIAppFonts entries).
    static let all = [
        bagelFatOne,
        hankenGroteskBold,
        hankenGroteskExtraBold,
        spaceGroteskSemiBold,
        spaceGroteskBold,
    ]

    // MARK: - Font.custom helpers

    /// Bagel Fat One Regular — display face (hero/h1/h2/h3).
    static func bagel(_ size: CGFloat) -> Font { .custom(bagelFatOne, size: size) }
    /// Hanken Grotesk Bold — body copy (bodyL/body/bodyS).
    static func hankenBold(_ size: CGFloat) -> Font { .custom(hankenGroteskBold, size: size) }
    /// Hanken Grotesk ExtraBold — rare emphasis (RN HankenGrotesk_800, ×1).
    static func hankenExtraBold(_ size: CGFloat) -> Font { .custom(hankenGroteskExtraBold, size: size) }
    /// Space Grotesk SemiBold — labels (typography.label).
    static func spaceSemiBold(_ size: CGFloat) -> Font { .custom(spaceGroteskSemiBold, size: size) }
    /// Space Grotesk Bold — micro text (typography.micro).
    static func spaceBold(_ size: CGFloat) -> Font { .custom(spaceGroteskBold, size: size) }
}
