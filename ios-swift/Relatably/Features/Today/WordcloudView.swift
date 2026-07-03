import SwiftUI

// Wordcloud phase — 1:1 port of ios/src/screens/WordcloudScreen.tsx per
// docs/superpowers/plans/rn-extraction/wordcloud.md.
//
// Guideline-1.2 load-bearing behaviors (§7.1/§7.5 — do NOT "optimize" away):
// - Demo fallback: whenever no OTHER-authored cluster is visible (empty drop,
//   backend down, or the user hid them all), the 10 innocuous demo coffee
//   clusters render as real bubbles so a reviewer can always hide/report/block.
// - Hide/report/block remove the bubble from the feed INSTANTLY (local-first).
// - Delete-own-answer is server-side and one-way for today's drop.
//
// The cream background + PaperTexture live in RootView, under every phase
// (RN renders its own PaperTexture here; RootView already provides it).
// SHARE button + offscreen ShareCardTodaysTake land with Task 16.

struct WordcloudView: View {

    @ObservedObject var vm: HomeViewModel
    @StateObject private var moderation: ClusterModeration

    /// Local hidden-ids mirror (RN useState) — loaded from the store on
    /// appear, extended synchronously on every hide for instant removal.
    @State private var hiddenIds: Set<String> = []
    @State private var deleting = false
    @State private var deleted = false
    @State private var showDeleteConfirm = false
    @State private var deleteErrorMessage: String?

    @Environment(\.appSafeAreaInsets) private var insets

    private let hiddenStore: HiddenContentStore
    private let deviceTokenProvider: DeviceTokenProvider
    private let deleteSubmission: (_ submissionId: String, _ deviceToken: String) async throws -> Void

    init(
        vm: HomeViewModel,
        moderation: @autoclosure @escaping () -> ClusterModeration = ClusterModeration.live(),
        hiddenStore: HiddenContentStore = HiddenContentStore(),
        deviceTokenProvider: DeviceTokenProvider = DeviceTokenProvider(),
        deleteSubmission: @escaping (String, String) async throws -> Void = { submissionId, deviceToken in
            try await APIClient(tokenProvider: { await AuthService.shared.idToken() })
                .deleteOwnSubmission(submissionId: submissionId, deviceToken: deviceToken)
        }
    ) {
        self.vm = vm
        _moderation = StateObject(wrappedValue: moderation())
        self.hiddenStore = hiddenStore
        self.deviceTokenProvider = deviceTokenProvider
        self.deleteSubmission = deleteSubmission
    }

    // MARK: - Derived state (§4.4)

    /// Demo-fallback gate, verbatim: real clusters minus hidden; if none of
    /// them is other-authored, append the demo clusters (also hidden-filtered).
    /// Real clusters come first, demos appended.
    private var visibleClusters: [WordcloudCluster] {
        let real = vm.clusters.filter { !hiddenIds.contains($0.id) }
        let hasOther = real.contains { $0.id != vm.selfClusterId }
        if hasOther { return real }
        let demo = DEMO_CLUSTERS
            .map { WordcloudCluster(id: $0.id, text: $0.canonicalText, count: $0.submissionCount) }
            .filter { !hiddenIds.contains($0.id) }
        return real + demo
    }

    var body: some View {
        GeometryReader { geo in
            // RN useWindowDimensions — the tab shell draws full-window
            // (.ignoresSafeArea), so geo here IS the window.
            let cloudWidth = geo.size.width - Spacing.gutter * 2
            let cloudHeight = min(560, geo.size.height - insets.top - insets.bottom - 220)
            let visible = visibleClusters
            let maxCount = visible.map(\.count).max() ?? 0 // Math.max(0, ...)
            let placements = Dictionary(
                uniqueKeysWithValues: wordcloudLayout(
                    clusters: visible,
                    width: cloudWidth,
                    height: cloudHeight
                ).map { ($0.id, $0) }
            )

            VStack(spacing: 0) {
                header
                    .padding(.bottom, Spacing.sp4) // marginBottom 16

                if visible.contains(where: { $0.id != vm.selfClusterId }) {
                    Text("Tap any answer to hide or report it")
                        .font(Fonts.hankenBold(13))
                        .foregroundColor(Palette.inkSoft)
                        .frame(maxWidth: .infinity) // centered
                        .padding(.bottom, Spacing.sp3) // marginBottom 12
                }

                // The cloud: absolutely positioned bubbles, anchor offset
                // (−60, −20) from the phyllotaxis point (§2). NOT clipped —
                // bubbles may overflow the frame; overlap is the shipped look.
                ZStack(alignment: .topLeading) {
                    ForEach(Array(visible.enumerated()), id: \.element.id) { i, cluster in
                        if let p = placements[cluster.id] {
                            ClusterBubble(
                                id: cluster.id,
                                text: cluster.text,
                                count: cluster.count,
                                maxCount: maxCount,
                                isSelf: cluster.id == vm.selfClusterId,
                                colorIndex: i,
                                moderation: moderation
                            )
                            .offset(x: p.x - 60, y: p.y - 20)
                        }
                    }
                }
                .frame(width: cloudWidth, height: cloudHeight, alignment: .topLeading)

                if vm.selfSubmissionId != nil && !deleted {
                    deleteRow
                        .padding(.top, Spacing.sp3) // marginTop 12
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.gutter)              // 22
            .padding(.top, insets.top + Spacing.sp5)           // safeTop + 24
            .padding(.bottom, insets.bottom + 96)              // clears tab pill
        }
        .task {
            // §7.8: always filter by the stored set; moderation persists the
            // hide BEFORE onHidden, so the local mirror + store stay in sync.
            hiddenIds = hiddenStore.hiddenClusterIds()
            moderation.onHidden = { id, _ in hiddenIds.insert(id) }
        }
        // RN ActionSheetIOS 1:1 — UIAlertController with the exact promised
        // options (SwiftUI confirmationDialog drops the visible Cancel button
        // on iOS 26; see ModerationSheetHost).
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
    }

    // MARK: - Header (§6)

    private var header: some View {
        HStack(alignment: .center) {
            // toLocaleString → locale-grouped number; separator is · (U+00B7).
            Text("\(vm.liveCount.formatted()) VOTES · THE WORLD IS VOTING")
                .font(Fonts.spaceSemiBold(11))
                .kerning(1.4)
                .foregroundColor(Palette.inkSoft)
            Spacer(minLength: 0)
            // SHARE button (shareEnabled gate) arrives with Task 16.
        }
    }

    // MARK: - Delete row (§4.4 delete flow)

    private var deleteRow: some View {
        let shape = ClampedRoundedRectangle(cornerRadius: Radii.s)
        return Button {
            showDeleteConfirm = true
        } label: {
            Text(deleting ? "DELETING…" : "DELETE MY ANSWER")
                .font(Fonts.spaceBold(10))
                .kerning(1.4)
                .foregroundColor(Palette.red)
                // RN paddings (16 / 8) sit INSIDE the 2pt border box.
                .padding(.horizontal, Spacing.sp4 + 2)
                .padding(.vertical, Spacing.sp2 + 2)
                .frame(minHeight: 44)
                .background(shape.fill(Color.white.opacity(0.7)))
                .overlay(shape.strokeBorder(Palette.ink, lineWidth: 2))
                .hardShadow(Shadows.s, shape: shape)
        }
        .buttonStyle(.plain)
        .disabled(deleting)
        .accessibilityLabel("Delete my answer")
        .frame(maxWidth: .infinity) // deleteRow { alignItems: center }
        .alert("Delete your answer?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await performDelete() }
            }
        } message: {
            Text("Your answer will be removed from the wordcloud right away. You can't re-submit for today's drop.")
        }
        .alert(
            "Couldn't delete",
            isPresented: Binding(
                get: { deleteErrorMessage != nil },
                set: { if !$0 { deleteErrorMessage = nil } }
            )
        ) {
            Button("OK") {}
        } message: {
            Text(deleteErrorMessage ?? "")
        }
    }

    private func performDelete() async {
        guard let submissionId = vm.selfSubmissionId else { return }
        deleting = true
        do {
            let deviceToken = deviceTokenProvider.deviceToken()
            try await deleteSubmission(submissionId, deviceToken)
            deleted = true
            vm.answerDeleted()
        } catch {
            deleteErrorMessage = Self.deleteErrorMessage(error)
        }
        deleting = false
    }

    /// RN shows the thrown message verbatim ("deleteOwnSubmission: <status>").
    private static func deleteErrorMessage(_ error: Error) -> String {
        if case APIError.http(let status) = error {
            return "deleteOwnSubmission: \(status)"
        }
        return error.localizedDescription
    }
}
