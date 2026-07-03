import SwiftUI
import UIKit

// Archive tab — 1:1 port of ios/src/screens/ArchiveScreen.tsx (+ the tab
// container ios/app/(tabs)/archive.tsx) per
// docs/superpowers/plans/rn-extraction/archive.md §3/§4.
//
// Navigation: RN pushes the hidden tab-level route archive/[id]
// (expo-router). Here a NavigationStack lives INSIDE the kept-alive archive
// tab, so pushing detail never re-boots any other tab's VM. RN renders no
// back chrome (§2) — the detail hides the nav bar; back = the standard iOS
// edge-swipe (SwipeBackEnabler in ArchiveDetailView) or re-entering the
// ARCHIVE tab, which pops to the list exactly like RN's tab button does
// (RootTabs bumps `popToRootTrigger` on every switch to the archive tab).
//
// Not ported: the ad interleave after every 8th tile — BannerAdSlot renders
// null in production (banner placements intentionally disabled, §4.1), and
// porting the empty rows would only reproduce the RN double-gap artifact
// (§9.3). Same decision as Board.

struct ArchiveView: View {

    // Copy verbatim (§4.2); date tab fallback per §9.1 — the server never
    // sends `date_label`, so every tile's tab renders the em dash.
    static let emptyHeading = "fresh archive"
    static let emptyBody = "once you answer your first drop, yesterday's verdict shows up here. come back tomorrow."
    static let dateTabFallback = "\u{2014}"

    @StateObject private var vm: ArchiveViewModel
    @State private var path: [String] = []

    /// Bumped by RootTabs whenever the ARCHIVE tab is (re-)selected — pops
    /// the stack to the list, mirroring RN where the tab button always
    /// targets the list screen.
    let popToRootTrigger: Int

    @Environment(\.appSafeAreaInsets) private var insets

    init(
        popToRootTrigger: Int = 0,
        vm: @autoclosure @escaping () -> ArchiveViewModel = ArchiveViewModel.live()
    ) {
        self.popToRootTrigger = popToRootTrigger
        _vm = StateObject(wrappedValue: vm())
    }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: String.self) { questionId in
                    ArchiveDetailView(questionId: questionId)
                }
        }
        .task { vm.bootIfNeeded() }
        .onChange(of: popToRootTrigger) { path.removeAll() }
        .alert(ArchiveViewModel.loadErrorTitle, isPresented: $vm.showLoadError) {
            Button("OK") {}
        }
    }

    // MARK: - Screen (empty state ⊕ list, §4.2/§4.3)

    @ViewBuilder
    private var content: some View {
        // Pushed NavigationStack destinations don't inherit RootView's
        // backdrop, so this screen draws its own cream + texture (RN does
        // the same per screen).
        ZStack {
            Palette.cream.ignoresSafeArea()
            PaperTexture()
            if vm.tiles.isEmpty {
                // Shown during the initial load too — there is no spinner on
                // this tab (§9.2, faithful).
                emptyState
            } else {
                list
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.sp3) { // gap 12
            Text(Self.emptyHeading)
                .typeStyle(Typography.h2)
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)
            Text(Self.emptyBody)
                .typeStyle(Typography.bodyL)
                .foregroundColor(Palette.inkSoft)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.sp5) // paddingH/V 24
        .frame(maxWidth: 360)
        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 3))
        .hardShadow(Shadows.m, shape: RoundedRectangle(cornerRadius: Radii.m))
        .rotationEffect(.degrees(-1.5))
        .padding(.horizontal, Spacing.gutter)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.sp4) { // gap 16
                ForEach(Array(vm.tiles.enumerated()), id: \.element.questionId) { index, tile in
                    tileCard(tile, index: index)
                        .onAppear {
                            // RN onEndReached (threshold 0.5): fetch more as
                            // the end comes into view. LazyVStack equivalent:
                            // the last tile materializing. VM re-guards.
                            if index == vm.tiles.count - 1 && vm.nextCursor != nil {
                                vm.loadMore()
                            }
                        }
                }
            }
            .padding(.top, insets.top + Spacing.sp5) // safe-area top + 24
            .padding(.horizontal, Spacing.gutter)    // 22
            .padding(.bottom, 120)                   // clears the floating tab pill
        }
        // RN FlatList measures its padding from the PHYSICAL top/bottom and
        // scrolls under the status bar; the NavigationStack would otherwise
        // re-apply the safe area ON TOP of the manual insets.top padding.
        .ignoresSafeArea()
    }

    // MARK: - Tile (§4.4)

    private func tileCard(_ tile: ArchiveTile, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(tile.questionText)
                .typeStyle(TypeStyle(family: Fonts.hankenGroteskBold, size: 11, lineHeight: 14))
                .foregroundColor(Palette.inkSoft)
                .lineLimit(3)
                .padding(.bottom, Spacing.sp2)
            Text(tile.verdictText)
                .typeStyle(TypeStyle(family: Fonts.bagelFatOne, size: 18, lineHeight: 18))
                .foregroundColor(Palette.pink)
                .lineLimit(1)
                .padding(.bottom, Spacing.sp2)
            ArchiveTileThumbnail(texts: tile.topClusters)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spacing.sp6 + 2)  // 34
        .padding(.horizontal, Spacing.sp3)
        .padding(.bottom, Spacing.sp3)
        .frame(minHeight: 130, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 2))
        .hardShadow(Shadows.s, shape: RoundedRectangle(cornerRadius: Radii.m))
        // Date tab sticker overlapping the top edge (absolute top -10 left 10).
        .overlay(alignment: .topLeading) { dateTab.offset(x: 10, y: -10) }
        // Rotation alternates by TILE index (§4.4): even → -1.5°, odd → +1.5°.
        .rotationEffect(.degrees(index % 2 == 0 ? -1.5 : 1.5))
        .contentShape(RoundedRectangle(cornerRadius: Radii.m))
        .onTapGesture { path.append(tile.questionId) }
        .onLongPressGesture {
            // Native long-press affordance; vm.tileLongPressed runs the
            // verdict-card share pipeline (Core/ShareCard).
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            vm.tileLongPressed(tile)
        }
    }

    /// §9.1: `(t.date_label ?? "—").toUpperCase()` — date_label is not on the
    /// ArchiveTile payload (verified against api/src/app/api/archive/route.ts),
    /// so this faithfully always renders "—".
    private var dateTab: some View {
        Text(Self.dateTabFallback.uppercased())
            .font(Fonts.spaceBold(10)) // micro family, size overridden to 10
            .kerning(1.4)
            .foregroundColor(Palette.cream)
            .padding(.horizontal, Spacing.sp2)
            .padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 6).fill(Palette.ink))
    }
}

// MARK: - ArchiveTileThumbnail (§4.5, entire RN component)

struct ArchiveTileThumbnail: View {

    let texts: [String]

    /// FILLS verbatim — mint, lemon, blue, #FFD7E8 (4th unreachable: max 3).
    private static let fills: [Color] = [Palette.mint, Palette.lemon, Palette.blue, Color(hex: 0xFFD7E8)]

    var body: some View {
        let visible = Array(texts.prefix(3))
        if !visible.isEmpty {
            WrapLayout(spacing: 6) { // row, gap 6, flexWrap
                ForEach(Array(visible.enumerated()), id: \.offset) { i, text in
                    bubble(text, index: i)
                }
            }
        }
    }

    private func bubble(_ text: String, index: Int) -> some View {
        Text(text)
            .font(Fonts.hankenBold(11))
            .foregroundColor(Palette.ink)
            .lineLimit(1)
            .padding(.horizontal, Spacing.sp2)
            .padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: Radii.s).fill(Self.fills[index % Self.fills.count]))
            .overlay(RoundedRectangle(cornerRadius: Radii.s).strokeBorder(Palette.ink, lineWidth: 2))
            // Scale about center, layout keeps the unscaled size (RN transform).
            .scaleEffect(1 - Double(index) * 0.12) // 1.0, 0.88, 0.76
    }
}

// MARK: - WrapLayout (RN flexDirection row + flexWrap wrap + gap)

/// Minimal wrapping HStack: rows fill left-to-right and wrap when a bubble
/// would overflow the tile width, with `spacing` between items and rows.
struct WrapLayout: Layout {

    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        frames(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placed = frames(proposal: proposal, subviews: subviews).frames
        for (index, subview) in subviews.enumerated() {
            let frame = placed[index]
            subview.place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func frames(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(
                ProposedViewSize(width: maxWidth.isFinite ? maxWidth : nil, height: nil)
            )
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            totalWidth = max(totalWidth, x - spacing)
        }
        return (CGSize(width: totalWidth, height: y + rowHeight), frames)
    }
}
