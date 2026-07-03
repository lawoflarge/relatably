// 1:1 port of ios/components/StickerTabBar.tsx
// (docs/superpowers/plans/rn-extraction/settings-tabbar.md §2).
//
// Floating cream pill with 5 tab items. Unicode glyphs instead of icon
// assets (the RN app kept these after an svg-package crash — zero deps).
// Active tab = ink fill + cream text; selection haptic ONLY when switching
// to a non-active tab; pressing the active tab does nothing.

import SwiftUI
import UIKit

/// The five app tabs, in RN tab order (app/(tabs)/_layout.tsx). The RN
/// settings route displays label ME (not "SETTINGS") — preserved.
enum AppTab: CaseIterable, Hashable {
    case today
    case friends
    case board
    case archive
    case me

    var glyph: String {
        switch self {
        case .today: return "■"    // filled square — "drop"
        case .friends: return "♥"
        case .board: return "★"
        case .archive: return "▦"  // grid
        // U+FE0E forces TEXT presentation: bare U+2699 renders as the
        // color EMOJI gear in SwiftUI (ignores foregroundColor); RN drew
        // it monochrome. Same visible glyph, monochrome, tintable.
        case .me: return "⚙\u{FE0E}" // gear
        }
    }

    var label: String {
        switch self {
        case .today: return "TODAY"
        case .friends: return "FRIENDS"
        case .board: return "BOARD"
        case .archive: return "ARCHIVE"
        case .me: return "ME"
        }
    }
}

struct StickerTabBar: View {

    @Binding var selection: AppTab
    /// Called when the ALREADY-ACTIVE tab is tapped. RN parity nuance: on
    /// archive/[id] the ARCHIVE pill still targets the list route, so a
    /// re-tap must pop the archive stack to root (StickerTabBar.tsx:60-78);
    /// every other tab's re-tap stays a no-op.
    var onReselect: ((AppTab) -> Void)? = nil

    var body: some View {
        HStack(spacing: Spacing.sp1) { // 4pt gap between tabs
            ForEach(AppTab.allCases, id: \.self) { tab in
                tabItem(tab)
            }
        }
        // RN inner padding 4 sits INSIDE the 3pt border box.
        .padding(Spacing.sp1 + 3)
        .background(Capsule().fill(Palette.cream))
        .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 3))
        .hardShadow(Shadows.m, shape: Capsule()) // ink, offset (4,4), no blur
    }

    private func tabItem(_ tab: AppTab) -> some View {
        let isActive = selection == tab
        return Button {
            // Active-tab tap: no re-navigate, no scroll-to-top, no haptic
            // (settings-tabbar.md §2) — but the shell may pop nested stacks
            // to root via onReselect (RN: navigate() to the tab's own route).
            guard !isActive else {
                onReselect?(tab)
                return
            }
            UISelectionFeedbackGenerator().selectionChanged()
            selection = tab
        } label: {
            VStack(spacing: 2) {
                Text(tab.glyph)
                    .font(.system(size: 18)) // RN sets no family → system font
                Text(tab.label)
                    .font(Fonts.spaceBold(Typography.micro.size)) // 9pt
                    .kerning(1.3)
            }
            .foregroundColor(isActive ? Palette.cream : Palette.ink)
            .padding(.horizontal, Spacing.sp3) // 12
            .padding(.vertical, Spacing.sp2)   // 8
            .frame(minWidth: 64)
            .background(Capsule().fill(isActive ? Palette.ink : Color.clear))
        }
        .buttonStyle(.plain)
    }
}
