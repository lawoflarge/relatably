import SwiftUI

// Reveal phase — 1:1 port of ios/src/components/RevealAnimation.tsx per
// docs/superpowers/plans/rn-extraction/reveal-share.md §1, as used by the
// Today tab (§1.8: questionId = yesterday.id, no dateLabel, no selfHandle,
// intervalMs = 1000).
//
// Semantics (§1.2, load-bearing):
// - One more bubble per second, worst rank first (#10 → #1).
// - On the FINAL tick ALL bubbles vanish (visible = []) — the verdict line
//   replaces the cloud; it is not additive.
// - questionId is always present on this path, so there is NO auto-advance:
//   the user leaves via "continue →".
// - The cloud keeps its flex:1 slot when empty, so verdict + CTAs render in
//   the lower part of the screen, exactly like RN.
//
// SHARE CTAs are rendered verbatim but deliberately no-op until Task 16
// wires ShareCardVerdict/ShareCardCalledIt through shareCardImage.
//
// The cream background + PaperTexture live in RootView (same convention as
// WordcloudView — RN sets its own flat cream here).

struct RevealView: View {

    let yesterday: Yesterday
    let onComplete: () -> Void

    /// RN `step` state: number of bubbles currently out.
    @State private var step = 0
    @Environment(\.appSafeAreaInsets) private var insets
    /// RN consumers of reducedMotion.ts gate decorative motion off; the
    /// countdown itself is discrete and stays (it is content, not motion).
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Derived state (§1.2/§1.3 verbatim)

    /// Reveal order #10 → #1 — descending final_rank, stable on ties
    /// (JS Array.sort is stable; Swift's sorted() is not, hence the index).
    private var reversed: [YesterdayCluster] {
        yesterday.topClusters.enumerated()
            .sorted { a, b in
                if a.element.finalRank != b.element.finalRank {
                    return a.element.finalRank > b.element.finalRank
                }
                return a.offset < b.offset
            }
            .map(\.element)
    }

    private var done: Bool { step >= reversed.count }

    /// All bubbles vanish the tick `done` flips (§7.1) — verbatim.
    private var visible: [YesterdayCluster] { done ? [] : Array(reversed.prefix(step)) }

    private var verdict: YesterdayCluster? {
        yesterday.topClusters.first { $0.finalRank == 1 }
    }

    /// Crown CTA gate (§7.13): self cluster IS the rank-1 cluster.
    private var calledIt: Bool {
        yesterday.selfClusterId != nil && verdict?.id == yesterday.selfClusterId
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            Text(yesterday.text)
                .typeStyle(Typography.h2)
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.sp5) // marginBottom 24

            // The cloud: wrapping centered row, flex:1.
            CenteredWrapLayout {
                // Identity by position: the revealed prefix only ever grows,
                // so offsets are stable — and duplicate cluster ids (see
                // wordcloud Map parity) can't trap ForEach.
                ForEach(Array(visible.enumerated()), id: \.offset) { _, cluster in
                    bubble(cluster)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if done, let verdict {
                Text("the world said — \(verdict.canonicalText)")
                    .typeStyle(Typography.h1)
                    .foregroundColor(Palette.pink)
                    .multilineTextAlignment(.center)
                    .padding(.vertical, Spacing.sp5) // marginVertical 24
            }

            if done {
                cta
            }
        }
        .padding(.top, 60)
        .padding(.horizontal, Spacing.gutter) // 22
        .task {
            // RN setInterval(1000): one tick per second; the interval clears
            // itself once every bubble is out (guard) or on disappear
            // (task cancellation = clearInterval cleanup).
            while !Task.isCancelled && step < reversed.count {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                advance()
            }
        }
    }

    /// One tick. Sticker pop per Motion.Reveal (700 ms, overshoot 1.15) —
    /// skipped entirely when Reduce Motion is on (discrete appearance,
    /// which is also the RN component's literal behavior).
    private func advance() {
        if reduceMotion {
            step += 1
        } else {
            withAnimation(.spring(duration: Motion.Reveal.duration / 1000, bounce: 0.3)) {
                step += 1
            }
        }
    }

    // MARK: - Bubble (§1.4/§1.5)

    private func bubble(_ cluster: YesterdayCluster) -> some View {
        let isSelf = cluster.id == yesterday.selfClusterId
        return Text(cluster.canonicalText)
            // fontSize = 14 + final_pct_of_total * 40 (pct is a 0..1 fraction)
            .font(Fonts.hankenBold(14 + cluster.finalPctOfTotal * 40))
            .foregroundColor(isSelf ? Palette.pink : Palette.inkSoft)
            // selfBubble: hot-pink ring shadow instead of neon glow
            // (RN textShadowColor pink, textShadowRadius 6, no offset).
            .shadow(color: isSelf ? Palette.pink : .clear, radius: isSelf ? 6 : 0)
            .padding(6) // RN margin 6 per bubble
            .transition(reduceMotion ? .identity : .scale.combined(with: .opacity))
    }

    // MARK: - CTAs (§1.5 — labels byte-equal, §8 string table)

    private var cta: some View {
        VStack(spacing: Spacing.sp3) { // gap 12
            shareButton(label: "SHARE THE VERDICT", background: Palette.pink) {
                // Task 16 wires ShareCardVerdict via shareCardImage
                // (banner_type "verdict"); deliberate no-op until then.
            }
            if calledIt {
                shareButton(label: "★ SHARE — YOU CALLED IT", background: Palette.lemon2) {
                    // Task 16 wires ShareCardCalledIt via shareCardImage
                    // (banner_type "called_it"); deliberate no-op until then.
                }
            }
            Button(action: onComplete) {
                Text("continue →")
                    .font(Fonts.hankenBold(Typography.bodyS.size)) // 13
                    .foregroundColor(Palette.inkSoft)
                    .padding(.vertical, Spacing.sp3) // paddingVertical 12
                    .frame(maxWidth: .infinity) // alignItems center
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.top, Spacing.sp4) // paddingVertical 16
        // DELIBERATE deviation from RN (which pads 16 and lets the floating
        // StickerTabBar cover "continue →" — an untappable exit is exactly
        // the 2.1(a) dead-end class this rebuild fixes): clear the pill so
        // the ONLY way out of the reveal stays reachable.
        .padding(.bottom, insets.bottom + Spacing.sp7) // 16 → safeBottom + 48
        .frame(maxWidth: .infinity)     // width "100%"
    }

    /// Full-width pink/lemon pill (§1.5 shareBtn/crownBtn + shareLabel).
    /// Label family SpaceGrotesk_600 at RN's default 14 pt — the RN
    /// fontWeight "900" can't resolve inside a single-face custom family.
    private func shareButton(
        label: String,
        background: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label)
                .font(Fonts.spaceSemiBold(14))
                .kerning(1.1)
                .foregroundColor(Palette.ink)
                // RN paddings (24 / 14) sit INSIDE the 2pt border box.
                .padding(.horizontal, Spacing.sp5 + 2)
                .padding(.vertical, 14 + 2)
                .frame(maxWidth: .infinity)
                .background(Capsule().fill(background))
                .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 2))
                .hardShadow(Shadows.s, shape: Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - CenteredWrapLayout (RN flexDirection row + flexWrap + center)

/// Wrapping row layout: rows fill left-to-right up to the proposed width,
/// each row is centered horizontally, items are centered vertically within
/// their row (RN cloud: row, wrap, justifyContent/alignItems center).
private struct CenteredWrapLayout: Layout {

    private struct Row {
        var range: Range<Int>
        var width: CGFloat
        var height: CGFloat
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let rows = computeRows(maxWidth: maxWidth, subviews: subviews)
        return CGSize(
            width: maxWidth.isFinite ? maxWidth : rows.map(\.width).max() ?? 0,
            height: rows.reduce(0) { $0 + $1.height }
        )
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = computeRows(maxWidth: bounds.width, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX + (bounds.width - row.width) / 2
            for index in row.range {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                    proposal: .unspecified
                )
                x += size.width
            }
            y += row.height
        }
    }

    private func computeRows(maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var start = 0
        var width: CGFloat = 0
        var height: CGFloat = 0
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            if index > start, width + size.width > maxWidth {
                rows.append(Row(range: start..<index, width: width, height: height))
                start = index
                width = 0
                height = 0
            }
            width += size.width
            height = max(height, size.height)
        }
        if start < subviews.count {
            rows.append(Row(range: start..<subviews.count, width: width, height: height))
        }
        return rows
    }
}
