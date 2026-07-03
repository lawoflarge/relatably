import SwiftUI
import UIKit

// Archive detail — 1:1 port of ios/src/screens/ArchiveDetailScreen.tsx per
// docs/superpowers/plans/rn-extraction/archive.md §5.
//
// The "…" button per row opens the SAME cluster moderation sheet the
// wordcloud uses (Core/ClusterModeration + ModerationSheetHost — reused, not
// duplicated): Cancel / Hide this answer / Report this answer / Block this
// contributor, exactly as promised in the App-Review notes (Guideline 1.2).
//
// RN renders no back chrome (§2/§9.10: headerShown false, route hidden from
// the tab bar) — nav bar hidden here too; back = iOS edge-swipe
// (SwipeBackEnabler below) or re-selecting the ARCHIVE tab (pops to list,
// see ArchiveView.popToRootTrigger).

struct ArchiveDetailView: View {

    // Copy verbatim (§5.3/§5.4): … is U+2026, ⋯ is U+22EF.
    static let loadingLabel = "loading\u{2026}"
    static let errorText = "couldn't load this archive entry."
    static let modHint = "Tap \u{22EF} on any answer to hide or report it"
    static let modDots = "\u{22EF}"
    static let shareLabel = "SHARE"

    @StateObject private var vm: ArchiveDetailViewModel
    @StateObject private var moderation: ClusterModeration
    @Environment(\.dismiss) private var dismiss

    init(
        questionId: String,
        vm: (() -> ArchiveDetailViewModel)? = nil,
        moderation: @autoclosure @escaping () -> ClusterModeration = ClusterModeration.live()
    ) {
        _vm = StateObject(wrappedValue: vm?() ?? ArchiveDetailViewModel.live(questionId: questionId))
        _moderation = StateObject(wrappedValue: moderation())
    }

    var body: some View {
        ZStack {
            Palette.cream.ignoresSafeArea()
            PaperTexture()
            content
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(SwipeBackEnabler())
        // Deterministic back-swipe: RN renders no back chrome (§9.10), and
        // with the nav bar hidden the UIKit edge-pop can be unavailable —
        // a left-edge, mostly-horizontal drag always pops. simultaneous so
        // the cluster ScrollView keeps scrolling normally.
        .simultaneousGesture(
            DragGesture(minimumDistance: 20, coordinateSpace: .global)
                .onEnded { value in
                    if value.startLocation.x < 44,
                       value.translation.width > 80,
                       value.translation.width > abs(value.translation.height) {
                        dismiss()
                    }
                }
        )
        // RN ActionSheetIOS 1:1 — the shared cluster sheet host (same
        // UIAlertController as the wordcloud's "…" sheet).
        .background(ModerationSheetHost(moderation: moderation))
        .alert(
            moderation.alert?.title ?? "",
            isPresented: Binding(
                get: { moderation.alert != nil },
                set: { if !$0 { moderation.alert = nil } }
            )
        ) {
            Button("OK") {}
        } message: {
            Text(moderation.alert?.message ?? "")
        }
        .task {
            // §5.2: local hide/report/block drops the row immediately.
            moderation.onHidden = { id, _ in vm.handleHidden(id: id) }
            vm.bootIfNeeded()
        }
    }

    // MARK: - State machine (§5.1/§5.3)

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .loading:
            VStack(spacing: Spacing.sp3) { // gap 12
                ProgressView()
                    .controlSize(.large)
                    .tint(Palette.pink)
                Text(Self.loadingLabel)
                    .font(Fonts.hankenBold(15))
                    .foregroundColor(Palette.inkSoft)
            }
        case .error:
            Text(Self.errorText)
                .font(Fonts.hankenBold(15))
                .foregroundColor(Palette.red)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.sp5) // 24
        case .ready(let detail):
            ready(detail)
        }
    }

    // MARK: - Ready layout (§5.4, top → bottom)

    private func ready(_ detail: ArchiveDetail) -> some View {
        VStack(spacing: 0) {
            header(detail)
            Text(Self.modHint)
                .font(Fonts.hankenBold(13))
                .foregroundColor(Palette.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.vertical, Spacing.sp2)
                .frame(maxWidth: .infinity)
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(vm.visibleClusters, id: \.id) { cluster in
                        clusterRow(cluster)
                    }
                }
                .padding(.bottom, 120) // clears the floating tab pill
            }
        }
        // RN root: fixed paddingTop 48 (sp[7]) — NOT the safe-area inset.
        .padding(.top, Spacing.sp7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .ignoresSafeArea(edges: .top)
    }

    private func header(_ detail: ArchiveDetail) -> some View {
        HStack(alignment: .top, spacing: Spacing.sp3) { // gap 12
            VStack(alignment: .leading, spacing: 0) {
                dateTab(detail)
                    .padding(.bottom, Spacing.sp2)
                // §9.4: derived headline — top VISIBLE cluster, changes when
                // the user hides #1; demo fallback → "pumpkin spice latte".
                Text(vm.verdict)
                    .typeStyle(Typography.h2) // BagelFatOne 36/44
                    .foregroundColor(Palette.pink)
                    .padding(.bottom, Spacing.sp2)
                Text(detail.text)
                    .typeStyle(Typography.bodyL)
                    .foregroundColor(Palette.inkSoft)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            shareButton
        }
        .padding(.horizontal, Spacing.gutter) // 22
        .padding(.top, Spacing.sp3)           // 12
        .padding(.bottom, Spacing.sp4)        // 16
        .overlay(alignment: .bottom) {
            Rectangle().fill(Palette.ink).frame(height: 2)
        }
    }

    private func dateTab(_ detail: ArchiveDetail) -> some View {
        Text(ArchiveDetailViewModel.formatDate(iso: detail.createdAt).uppercased())
            .font(Fonts.spaceBold(10)) // micro family, size overridden to 10
            .kerning(1.4)
            .foregroundColor(Palette.cream)
            .padding(.horizontal, Spacing.sp2)
            .padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 6).fill(Palette.ink))
    }

    /// RN ShareButton visuals (§5.4). The share pipeline (trackShare →
    /// capture → system sheet) lands in Task 16 (Core/ShareCard) — until
    /// then the tap is a documented no-op. Icon: SF share glyph standing in
    /// for RN's IconShare (16pt, ink).
    private var shareButton: some View {
        Button {
            // Task 16: shareCardImage(banner_type: "verdict",
            //          question_id: detail.id, share_target: "system")
        } label: {
            HStack(spacing: Spacing.sp2) { // gap 8
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(Palette.ink)
                Text(Self.shareLabel)
                    .font(Fonts.hankenBold(13))
                    .kerning(0.5)
                    .foregroundColor(Palette.ink)
            }
            .padding(.horizontal, Spacing.sp4) // 16
            .padding(.vertical, Spacing.sp2)   // 8
            .frame(minHeight: 44)
            .background(Capsule().fill(Palette.mint))
            .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 2))
            .hardShadow(Shadows.s, shape: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Ranked cluster row (§5.4 item 3)

    private func clusterRow(_ cluster: ArchiveDetailCluster) -> some View {
        HStack(spacing: Spacing.sp3) { // gap 12
            Text("#\(cluster.finalRank)")
                .font(Fonts.spaceSemiBold(11)) // typography.label
                .kerning(1.1)
                .foregroundColor(Palette.ink)
                .frame(width: 36, height: 36)
                .background(RoundedRectangle(cornerRadius: Radii.s).fill(Palette.lemon))
                .overlay(RoundedRectangle(cornerRadius: Radii.s).strokeBorder(Palette.ink, lineWidth: 2))
                .hardShadow(Shadows.s, shape: RoundedRectangle(cornerRadius: Radii.s))
            Text(cluster.canonicalText)
                .font(Fonts.hankenBold(15))
                .foregroundColor(Palette.ink)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(ArchiveDetailViewModel.pctLabel(cluster.finalPctOfTotal))
                .font(Fonts.hankenBold(13))
                .foregroundColor(Palette.inkSoft)
            Button {
                moderation.openSheet(id: cluster.id, text: cluster.canonicalText)
            } label: {
                Text(Self.modDots)
                    .font(Fonts.bagel(22))
                    .foregroundColor(Palette.inkSoft)
                    .frame(minWidth: 36, minHeight: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Hide or report \"\(cluster.canonicalText)\"")
        }
        .padding(.horizontal, Spacing.gutter) // 22
        .padding(.vertical, Spacing.sp3)      // 12
        .overlay(alignment: .bottom) {
            Rectangle().fill(Palette.cream2).frame(height: 1)
        }
    }
}

// MARK: - SwipeBackEnabler

/// With the nav bar hidden, UIKit disables the interactive pop gesture; this
/// re-enables the edge swipe (only when there is something to pop) so the
/// chromeless RN layout keeps a native way back.
private struct SwipeBackEnabler: UIViewControllerRepresentable {

    func makeUIViewController(context: Context) -> Controller { Controller() }
    func updateUIViewController(_ controller: Controller, context: Context) {}

    final class Controller: UIViewController, UIGestureRecognizerDelegate {
        private weak var nav: UINavigationController?

        override func didMove(toParent parent: UIViewController?) {
            super.didMove(toParent: parent)
            attach()
        }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            attach() // the nav controller may only be reachable post-push
        }

        private func attach() {
            guard nav == nil, let found = navigationController else { return }
            nav = found
            found.interactivePopGestureRecognizer?.delegate = self
        }

        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            (nav?.viewControllers.count ?? 0) > 1
        }
    }
}
