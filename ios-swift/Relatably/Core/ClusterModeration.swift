import Foundation
import SwiftUI
import UIKit

// Cluster moderation — 1:1 port of ios/src/lib/clusterModeration.ts per
// docs/superpowers/plans/rn-extraction/core-libs.md §7.
//
// THE Guideline-1.2 contract (5 App Store rejections): every answer surface
// offers a VISIBLE tappable control to hide / report / block. Semantics that
// must never change (§7.3):
//   1. All actions remove the answer locally FIRST and fire `onHidden`
//      immediately — instant removal, works offline and on demo content.
//   2. Server reports are best-effort: failures are swallowed and the success
//      alert shows REGARDLESS (optimistic — the reviewer always sees success).
//   3. Plain Hide makes NO server call at all.
//   4. Block records a synthetic local blocked user
//      `contributor:<clusterId>` with handle = cluster text (rendered and
//      reversible under the ME tab).

// MARK: - Store slice

/// The two HiddenContentStore mutations moderation needs — injectable so the
/// error paths ("Couldn't hide") are testable. The real store never throws.
protocol ClusterModerationStoring {
    func hideCluster(id: String, text: String) throws
    func addBlockedUser(userId: String, handle: String?) throws
}

extension HiddenContentStore: ClusterModerationStoring {}

// MARK: - ClusterModeration

/// Presentation model for the moderation confirmationDialog + its follow-up
/// alerts. Pure state + actions — no UI — so the §7.3 semantics are unit
/// testable; WordcloudView (and later Archive detail) binds the published
/// state to SwiftUI presentation modifiers.
@MainActor
final class ClusterModeration: ObservableObject {

    /// The cluster the sheet is open for. Non-nil = dialog presented.
    struct Target: Identifiable, Equatable {
        let id: String
        let text: String
    }

    /// One of the three RN `Alert.alert(title, message)` follow-ups.
    struct ModerationAlert: Equatable {
        let title: String
        let message: String
    }

    // Sheet strings, verbatim from ActionSheetIOS options (§7.1) — order in
    // the UI must be Cancel / Hide / Report / Block(destructive).
    static let cancelLabel = "Cancel"
    static let hideLabel = "Hide this answer"
    static let reportLabel = "Report this answer"
    static let blockLabel = "Block this contributor"

    /// Sheet title: the cluster text wrapped in literal double quotes.
    static func sheetTitle(for text: String) -> String {
        "\"\(text)\""
    }

    @Published var target: Target?
    @Published var alert: ModerationAlert?

    /// Fired after every successful local hide so the parent view drops the
    /// bubble from the feed immediately (real-time removal, Guideline 1.2).
    var onHidden: ((String, String) -> Void)?

    private let store: ClusterModerationStoring
    private let deviceTokenProvider: DeviceTokenProvider
    private let report: (ReportPayload) async throws -> Void

    /// nonisolated so `ClusterModeration.live()` can be a default argument of
    /// a (nonisolated) View initializer; only assigns stored properties.
    nonisolated init(
        store: ClusterModerationStoring,
        deviceTokenProvider: DeviceTokenProvider,
        report: @escaping (ReportPayload) async throws -> Void
    ) {
        self.store = store
        self.deviceTokenProvider = deviceTokenProvider
        self.report = report
    }

    /// Entry point from a bubble tap / long-press (RN openClusterModerationSheet).
    func openSheet(id: String, text: String) {
        target = Target(id: id, text: text)
    }

    // MARK: - Actions (§7.3, order of operations is load-bearing)

    /// doHide — LOCAL ONLY, no server call. The only action with an error alert.
    func hide(id: String, text: String) {
        do {
            try store.hideCluster(id: id, text: text)
            onHidden?(id, text)
        } catch {
            alert = ModerationAlert(title: "Couldn't hide", message: Self.message(for: error))
        }
    }

    /// doReport — hide local FIRST, then best-effort server report, then the
    /// success alert ALWAYS (even if the report failed).
    func reportAnswer(id: String, text: String) async {
        // RN: `await hideCluster` outside try/catch — a throw aborts silently
        // (unhandled rejection; no alert, no report). Real store never throws.
        guard (try? store.hideCluster(id: id, text: text)) != nil else { return }
        onHidden?(id, text)
        do {
            let deviceToken = deviceTokenProvider.deviceToken()
            try await report(ReportPayload(
                targetType: .cluster,
                targetId: id,
                reason: nil,
                deviceToken: deviceToken
            ))
        } catch {
            // anonymous / offline / demo content — local removal already applied
        }
        alert = ModerationAlert(
            title: "Thanks for reporting",
            message: "We removed it from your feed and will review within 24 hours."
        )
    }

    /// doBlock — hide + synthetic local blocked user + best-effort report with
    /// reason "blocked contributor", then the success alert ALWAYS.
    func block(id: String, text: String) async {
        guard (try? store.hideCluster(id: id, text: text)) != nil else { return }
        guard (try? store.addBlockedUser(userId: "contributor:\(id)", handle: text)) != nil else { return }
        onHidden?(id, text)
        do {
            let deviceToken = deviceTokenProvider.deviceToken()
            try await report(ReportPayload(
                targetType: .cluster,
                targetId: id,
                reason: "blocked contributor",
                deviceToken: deviceToken
            ))
        } catch {
            // local block already applied
        }
        alert = ModerationAlert(
            title: "Blocked",
            message: "We won't show this contributor's answers again."
        )
    }

    /// RN `err instanceof Error ? err.message : String(err)`.
    private static func message(for error: Error) -> String {
        error.localizedDescription
    }
}

// MARK: - Action-sheet host (RN ActionSheetIOS = UIAlertController .actionSheet)

/// Presents the moderation sheet as a real UIAlertController action sheet.
/// SwiftUI's confirmationDialog was tried first, but on iOS 26 it renders as
/// an anchored card WITHOUT a visible Cancel button — the App Review notes
/// promise the options "Cancel / Hide this answer / Report this answer /
/// Block this contributor" verbatim, and RN's ActionSheetIOS is exactly
/// UIAlertController, so this is the 1:1 port. Embed zero-sized via
/// `.background(ModerationSheetHost(moderation: moderation))`.
struct ModerationSheetHost: UIViewControllerRepresentable {

    @ObservedObject var moderation: ClusterModeration

    final class Coordinator {
        /// Target id a sheet is currently presented for (nil = none).
        var presentedFor: String?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ host: UIViewController, context: Context) {
        guard let target = moderation.target else { return }
        guard context.coordinator.presentedFor != target.id,
              host.presentedViewController == nil else { return }
        context.coordinator.presentedFor = target.id

        let moderation = moderation
        let coordinator = context.coordinator
        let close = {
            coordinator.presentedFor = nil
            moderation.target = nil
        }

        // Order/styles verbatim from ActionSheetIOS (§7.1): cancelButtonIndex
        // 0, destructiveButtonIndex 3.
        let sheet = UIAlertController(
            title: ClusterModeration.sheetTitle(for: target.text),
            message: nil,
            preferredStyle: .actionSheet
        )
        sheet.addAction(UIAlertAction(title: ClusterModeration.cancelLabel, style: .cancel) { _ in
            close()
        })
        sheet.addAction(UIAlertAction(title: ClusterModeration.hideLabel, style: .default) { _ in
            close()
            moderation.hide(id: target.id, text: target.text)
        })
        sheet.addAction(UIAlertAction(title: ClusterModeration.reportLabel, style: .default) { _ in
            close()
            Task { await moderation.reportAnswer(id: target.id, text: target.text) }
        })
        sheet.addAction(UIAlertAction(title: ClusterModeration.blockLabel, style: .destructive) { _ in
            close()
            Task { await moderation.block(id: target.id, text: target.text) }
        })
        host.present(sheet, animated: true)
    }
}

// MARK: - Production wiring

extension ClusterModeration {
    /// Real dependencies: UserDefaults-backed hidden/blocked lists, Keychain
    /// device token, APIClient report with the Firebase ID-token provider.
    nonisolated static func live() -> ClusterModeration {
        ClusterModeration(
            store: HiddenContentStore(),
            deviceTokenProvider: DeviceTokenProvider(),
            report: { payload in
                try await APIClient(tokenProvider: { await AuthService.shared.idToken() })
                    .reportContent(payload)
            }
        )
    }
}
