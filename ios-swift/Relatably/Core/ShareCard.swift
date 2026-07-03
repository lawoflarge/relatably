import Foundation
import SwiftUI
import UIKit

// Share cards + share pipeline — 1:1 port of ios/src/lib/shareCard.ts,
// ios/src/components/ShareCard{Verdict,CalledIt,TodaysTake}.tsx,
// ShareButton.tsx and icons/IconShare.tsx per
// docs/superpowers/plans/rn-extraction/reveal-share.md §2–§4.
//
// Pipeline order (§2, load-bearing): trackShare POST FIRST (a failure ABORTS
// the whole share — no PNG, no sheet, silent, §7.4) → share URL construction
// (returned but never shown/embedded in v1.0, §7.6; Branch is env-gated off
// and its link builder is a stub, so the fallback URL is the only branch
// ported) → PNG capture (RN captureRef tmpfile ↔ ImageRenderer @3x + tmp
// file) → system share sheet with ONLY the PNG file (§2/§7.6).
//
// share_target is "system" at every RN call site — per-target values exist in
// the enum but are never sent in v1.0.

// MARK: - ShareCard (the three offscreen 1080×1920 story cards, §4)

/// RN topClusters element `{canonical_text, final_rank}` — final_rank is part
/// of the prop shape but never rendered (§4.1).
struct VerdictSatellite: Equatable {
    let canonicalText: String
    let finalRank: Int
}

/// One shareable card = banner type + the exact props RN feeds the matching
/// offscreen component (§1.6, §3.5).
enum ShareCard: Equatable {
    case todaysTake(questionText: String, userAnswer: String, date: String)
    case verdict(
        verdictText: String,
        satellites: [VerdictSatellite],
        userRank: Int?,
        percentile: Int?,
        date: String
    )
    case calledIt(verdictText: String, clusterCount: Int, handle: String?, date: String)

    var bannerType: BannerType {
        switch self {
        case .todaysTake: return .todaysTake
        case .verdict: return .verdict
        case .calledIt: return .calledIt
        }
    }

    /// §4: fixed 9:16 story canvas, `width: 1080, height: 1920`, padding 96.
    static let width: CGFloat = 1080
    static let height: CGFloat = 1920

    @MainActor @ViewBuilder
    var cardView: some View {
        switch self {
        case .todaysTake(let questionText, let userAnswer, let date):
            ShareCardTodaysTakeView(questionText: questionText, userAnswer: userAnswer, date: date)
        case .verdict(let verdictText, let satellites, let userRank, let percentile, let date):
            ShareCardVerdictView(
                verdictText: verdictText,
                satellites: satellites,
                userRank: userRank,
                percentile: percentile,
                date: date
            )
        case .calledIt(let verdictText, let clusterCount, let handle, let date):
            ShareCardCalledItView(
                verdictText: verdictText,
                clusterCount: clusterCount,
                handle: handle,
                date: date
            )
        }
    }
}

// MARK: - Reveal-phase card builders (§1.3 rank math + §1.6 props, verbatim)

extension ShareCard {

    /// RevealAnimation → ShareCardVerdict (§1.6). The Today caller passes no
    /// dateLabel (→ "") and no selfHandle (§1.8/§7.7).
    static func revealVerdict(yesterday: Yesterday) -> ShareCard {
        let clusters = yesterday.topClusters
        let verdict = clusters.first { $0.finalRank == 1 }

        // §1.3: userRank = findIndex in the PASSED array + 1 (NOT final_rank);
        // not found → (−1+1)||null → nil.
        var userRank: Int?
        if let selfId = yesterday.selfClusterId,
           let index = clusters.firstIndex(where: { $0.id == selfId }) {
            userRank = index + 1
        }
        var percentile: Int?
        if let rank = userRank, !clusters.isEmpty {
            let n = clusters.count
            let raw = (Double(n - rank + 1) / Double(n) * 100).rounded(.down)
            percentile = max(0, min(100, Int(raw)))
        }

        // §1.6: sort ascending by final_rank (stable, like JS sort) then
        // slice(1, 7) → the 6 satellites of ranks 2..7.
        let satellites = clusters.enumerated()
            .sorted { a, b in
                if a.element.finalRank != b.element.finalRank {
                    return a.element.finalRank < b.element.finalRank
                }
                return a.offset < b.offset
            }
            .map(\.element)
            .dropFirst()
            .prefix(6)
            .map { VerdictSatellite(canonicalText: $0.canonicalText, finalRank: $0.finalRank) }

        return .verdict(
            verdictText: verdict?.canonicalText ?? "",
            satellites: satellites,
            userRank: userRank,
            percentile: percentile,
            date: ""
        )
    }

    /// RevealAnimation → ShareCardCalledIt (§1.6): count = the verdict
    /// cluster's submission_count; handle nil → "@anonymous" (§7.7).
    static func revealCalledIt(yesterday: Yesterday) -> ShareCard {
        let verdict = yesterday.topClusters.first { $0.finalRank == 1 }
        return .calledIt(
            verdictText: verdict?.canonicalText ?? "",
            clusterCount: verdict?.submissionCount ?? 0,
            handle: nil,
            date: ""
        )
    }
}

// MARK: - ShareAPI (testable seam over APIClient.trackShare)

protocol ShareAPI {
    func trackShare(_ request: ShareTrackRequest) async throws -> ShareTrackResponse
}

extension APIClient: ShareAPI {}

// MARK: - ShareCardPresenter (shareCard.ts §2, Swift capture mechanics)

@MainActor
final class ShareCardPresenter {

    /// RN shareCardImage return value minus the tmp URI (§2): computed and
    /// returned for parity/tests, nothing user-visible depends on it (§7.6).
    struct ShareResult: Equatable {
        let referralCode: String
        let shareURL: String
    }

    /// Live pipeline: real trackShare, ImageRenderer @3x, UIActivityViewController.
    static let shared = ShareCardPresenter()

    private let api: ShareAPI
    private let renderPNG: (ShareCard) -> Data?
    private let presentSheet: (URL) -> Void

    nonisolated init(
        api: ShareAPI = APIClient(tokenProvider: { await AuthService.shared.idToken() }),
        renderPNG: @escaping (ShareCard) -> Data? = ShareCardPresenter.renderCardPNG,
        presentSheet: @escaping (URL) -> Void = ShareCardPresenter.presentActivitySheet
    ) {
        self.api = api
        self.renderPNG = renderPNG
        self.presentSheet = presentSheet
    }

    /// §2.2 fallback URL: `https://relatably.app/?r=<encodeURIComponent(code)>`.
    /// (Branch replacement is env-gated off + a null stub in v1.0 — not ported.)
    nonisolated static func shareURL(referralCode: String) -> String {
        "https://relatably.app/?r=\(APIClient.percentEncode(referralCode))"
    }

    /// The whole RN shareCardImage flow. Every failure is silent (RN callers
    /// only console.warn, §7.4) — returns nil instead of throwing. No
    /// availability check: UIActivityViewController always exists on iOS
    /// (expo-sharing's isAvailableAsync gate is a no-op there).
    @discardableResult
    func share(
        card: ShareCard,
        questionId: String,
        shareTarget: ShareTarget = .system
    ) async -> ShareResult? {
        // 1. trackShare FIRST — a failure aborts the share entirely (§2/§7.4).
        guard let tracked = try? await api.trackShare(ShareTrackRequest(
            bannerType: card.bannerType,
            questionId: questionId,
            shareTarget: shareTarget
        )) else { return nil }

        let shareURL = Self.shareURL(referralCode: tracked.referralCode)

        // 2. Capture: card view → PNG (RN captureRef {format png, quality 1}).
        guard let png = renderPNG(card) else { return nil }

        // 3. tmpfile, then the system share sheet with ONLY the PNG (§2/§7.6).
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("relatably-share-\(UUID().uuidString)")
            .appendingPathExtension("png")
        guard (try? png.write(to: fileURL)) != nil else { return nil }

        presentSheet(fileURL)
        return ShareResult(referralCode: tracked.referralCode, shareURL: shareURL)
    }

    // MARK: Default seams

    /// SwiftUI card → PNG via ImageRenderer at @3x (plan Task 16). The card
    /// view fixes its own 1080×1920 frame (§4), so the output is 3240×5760 px.
    nonisolated static func renderCardPNG(_ card: ShareCard) -> Data? {
        MainActor.assumeIsolated {
            let renderer = ImageRenderer(content: card.cardView)
            renderer.scale = 3
            return renderer.uiImage?.pngData()
        }
    }

    /// Present UIActivityViewController from the topmost presented VC (same
    /// idea as ModerationSheetHost: UIKit presentation, zero SwiftUI chrome).
    nonisolated static func presentActivitySheet(pngURL: URL) {
        MainActor.assumeIsolated {
            guard let top = topmostViewController() else { return }
            let sheet = UIActivityViewController(activityItems: [pngURL], applicationActivities: nil)
            // iPhone-only app (device family 1); anchor defensively anyway so
            // a regular-width presentation can never throw the popover crash.
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = top.view
                popover.sourceRect = CGRect(
                    x: top.view.bounds.midX, y: top.view.bounds.midY, width: 1, height: 1
                )
            }
            top.present(sheet, animated: true)
        }
    }

    @MainActor
    private static func topmostViewController() -> UIViewController? {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        let window = windows.first { $0.isKeyWindow } ?? windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}

// MARK: - Card chrome shared by verdict + today's-take (§4.1/§4.3 header)

private struct ShareCardHeader: View {
    let date: String

    var body: some View {
        HStack(alignment: .center) {
            Text("RELATABLY")
                .font(Fonts.bagel(56))
                .kerning(2)
                .foregroundColor(Palette.ink)
            Spacer(minLength: 0)
            Text(date)
                .font(Fonts.hankenBold(36))
                .foregroundColor(Palette.inkSoft)
        }
    }
}

// MARK: - ShareCardVerdict — "the world said" card (§4.1)

struct ShareCardVerdictView: View {
    let verdictText: String
    let satellites: [VerdictSatellite]
    let userRank: Int?
    let percentile: Int?
    let date: String

    var body: some View {
        // RN root: space-between over the five children.
        VStack(alignment: .leading, spacing: 0) {
            ShareCardHeader(date: date)
            Spacer(minLength: 0)
            headerStrip
            Spacer(minLength: 0)
            verdictLine
            Spacer(minLength: 0)
            satellitesRow
            Spacer(minLength: 0)
            rankLine
        }
        .padding(96)
        .frame(width: ShareCard.width, height: ShareCard.height)
        .background(Palette.cream)
    }

    private var headerStrip: some View {
        Text("YESTERDAY · THE WORLD SAID —")
            .font(Fonts.hankenBold(36))
            .kerning(2)
            .foregroundColor(Palette.cream)
            .padding(.horizontal, 32)
            .padding(.vertical, 20)
            .background(RoundedRectangle(cornerRadius: 12).fill(Palette.ink))
    }

    private var verdictLine: some View {
        Text(verdictText.uppercased())
            .font(Fonts.bagel(144))
            .kerning(4)
            .foregroundColor(Palette.pink)
            .multilineTextAlignment(.leading)
            // Hard sticker text shadow: ink, offset (6,6), zero blur.
            .shadow(color: Palette.ink, radius: 0, x: 6, y: 6)
            .rotationEffect(.degrees(-2))
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var satellitesRow: some View {
        // RN: `topClusters.slice(0, 6)` — the view itself caps at 6.
        WrapLayout(spacing: 24) {
            ForEach(Array(satellites.prefix(6).enumerated()), id: \.offset) { _, satellite in
                Text(satellite.canonicalText)
                    .font(Fonts.hankenBold(40))
                    .foregroundColor(Palette.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var rankLine: some View {
        Text(rankText)
            .font(Fonts.hankenBold(40))
            .foregroundColor(Palette.ink)
    }

    private var rankText: String {
        if let userRank, let percentile {
            return "I ranked #\(userRank). Better than \(percentile)% of the world."
        }
        return "sign in next time to claim a rank."
    }
}

// MARK: - ShareCardCalledIt — winner brag card (§4.2)

struct ShareCardCalledItView: View {
    let verdictText: String
    let clusterCount: Int
    let handle: String?
    let date: String

    /// §7.11: hard-locked en-US grouping ("412,381") regardless of locale.
    private static let countFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }()

    var body: some View {
        VStack(spacing: 0) {
            badge
                .padding(.bottom, 64)
            Text(verdictText.uppercased())
                .font(Fonts.bagel(144))
                .kerning(4)
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)
                .shadow(color: Palette.inkSoft, radius: 0, x: 4, y: 4)
                .padding(.bottom, 64)
            Text("• \(formattedCount) of you agreed •")
                .font(Fonts.hankenBold(40))
                .foregroundColor(Palette.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.vertical, 32)
            // RN fontWeight 800 can't resolve inside the single-face
            // HankenGrotesk_700 family — same note as RevealView's CTA label.
            Text(handle.map { "@\($0)" } ?? "@anonymous")
                .font(Fonts.hankenBold(56))
                .foregroundColor(Palette.ink)
                .padding(.top, 96)
            Text("RELATABLY · \(date)")
                .font(Fonts.hankenBold(32))
                .kerning(2)
                .foregroundColor(Palette.inkSoft)
                .padding(.top, 32)
        }
        .padding(96)
        .frame(width: ShareCard.width, height: ShareCard.height)
        .background(Palette.lemon2)
    }

    private var badge: some View {
        Text("★ I CALLED IT ★")
            .font(Fonts.bagel(56))
            .kerning(2)
            .foregroundColor(Palette.cream)
            .padding(.horizontal, 48)
            .padding(.vertical, 24)
            .background(Capsule().fill(Palette.ink))
            .hardShadow(Shadows.m, shape: Capsule())
    }

    private var formattedCount: String {
        Self.countFormatter.string(from: NSNumber(value: clusterCount)) ?? String(clusterCount)
    }
}

// MARK: - ShareCardTodaysTake — pre-reveal answer card (§4.3)

struct ShareCardTodaysTakeView: View {
    let questionText: String
    let userAnswer: String
    let date: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ShareCardHeader(date: date)
            Spacer(minLength: 0)
            // RN "your take —" rendered uppercase via text transform.
            Text("YOUR TAKE —")
                .font(Fonts.hankenBold(40))
                .kerning(1)
                .foregroundColor(Palette.inkSoft)
                .padding(.top, 96)
            Spacer(minLength: 0)
            Text(questionText)
                .typeStyle(TypeStyle(family: Fonts.bagelFatOne, size: 64, lineHeight: 80))
                .foregroundColor(Palette.ink)
            Spacer(minLength: 0)
            answerBox
        }
        .padding(96)
        .frame(width: ShareCard.width, height: ShareCard.height)
        .background(Palette.cream)
    }

    private var answerBox: some View {
        Text(userAnswer.uppercased())
            .font(Fonts.bagel(96))
            .kerning(2)
            .foregroundColor(Palette.pink)
            .multilineTextAlignment(.center)
            // RN padding 64 sits INSIDE the 6pt border box.
            .padding(64 + 6)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: Radii.xl).fill(Palette.cream2))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl).strokeBorder(Palette.ink, lineWidth: 6))
            .hardShadow(Shadows.l, shape: RoundedRectangle(cornerRadius: Radii.xl))
    }
}

// MARK: - IconShare (§3.3: 3-node share glyph, 24×24 viewBox, strokes only)

struct IconShare: View {
    var size: CGFloat = 16
    var color: Color = Palette.ink

    var body: some View {
        Canvas { context, canvasSize in
            let s = canvasSize.width / 24
            var circles = Path()
            for center in [CGPoint(x: 6, y: 12), CGPoint(x: 18, y: 6), CGPoint(x: 18, y: 18)] {
                circles.addEllipse(in: CGRect(
                    x: (center.x - 2.5) * s,
                    y: (center.y - 2.5) * s,
                    width: 5 * s,
                    height: 5 * s
                ))
            }
            context.stroke(circles, with: .color(color), lineWidth: 2 * s)
            var lines = Path()
            lines.move(to: CGPoint(x: 8 * s, y: 11 * s))
            lines.addLine(to: CGPoint(x: 16 * s, y: 7 * s))
            lines.move(to: CGPoint(x: 8 * s, y: 13 * s))
            lines.addLine(to: CGPoint(x: 16 * s, y: 17 * s))
            context.stroke(
                lines,
                with: .color(color),
                style: StrokeStyle(lineWidth: 2 * s, lineCap: .square)
            )
        }
        .frame(width: size, height: size)
    }
}

// MARK: - ShareButtonView (§3.1/§3.2: mint pill, icon + label)

struct ShareButtonView: View {
    var label: String = "SHARE"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sp2) { // gap 8
                IconShare(size: 16, color: Palette.ink)
                Text(label)
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
}
