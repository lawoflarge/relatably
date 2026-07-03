import AuthenticationServices
import SwiftUI
import UIKit

// Board (leaderboard) screen — 1:1 port of ios/src/screens/LeaderboardScreen.tsx
// per docs/superpowers/plans/rn-extraction/board-demo.md §1/§2/§3/§6.
//
// The cream background + PaperTexture live in RootView, under every tab
// (RN renders its own PaperTexture here; RootView already provides it).

struct BoardView: View {

    @StateObject private var vm: BoardViewModel
    /// RN tab wrapper parity: Firebase auth state read reactively (cold-start
    /// session restore flips isSignedIn asynchronously).
    @StateObject private var authState = AuthState()

    @State private var signInBusy = false
    /// Non-nil presents the "sign in failed" alert (§4.6).
    @State private var signInFailureMessage: String?

    @Environment(\.appSafeAreaInsets) private var insets

    init(vm: @autoclosure @escaping () -> BoardViewModel = BoardViewModel.live()) {
        _vm = StateObject(wrappedValue: vm())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("the board ★")
                .typeStyle(Typography.h2) // BagelFatOne 36/44
                .foregroundColor(Palette.ink)
                .padding(.bottom, Spacing.sp4) // marginBottom 16

            // Period pills
            HStack(spacing: Spacing.sp2) { // gap 8
                pill("DAILY", active: vm.period == .daily) { vm.setPeriod(.daily) }
                pill("WEEKLY", active: vm.period == .weekly) { vm.setPeriod(.weekly) }
                pill("ALL-TIME", active: vm.period == .alltime) { vm.setPeriod(.alltime) }
            }
            .padding(.bottom, Spacing.sp3) // marginBottom 12

            // Scope pills
            HStack(spacing: Spacing.sp2) {
                pill("GLOBAL", active: vm.scope == .global) { vm.setScope(.global) }
                pill(
                    "FRIENDS",
                    active: vm.scope == .friends,
                    disabled: !vm.effectiveSignedIn
                ) { vm.setScope(.friends) }
            }
            .padding(.bottom, Spacing.sp3)

            if !vm.effectiveSignedIn {
                signInBlock
                    .padding(.bottom, Spacing.sp4) // marginBottom 16
            }

            if vm.loading {
                Text("loading…")
                    .font(Fonts.spaceSemiBold(14))
                    .foregroundColor(Palette.inkSoft)
                    .padding(Spacing.sp4)
                    .frame(maxWidth: .infinity) // textAlign center
            } else {
                list
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.gutter)          // 22
        .padding(.top, insets.top + Spacing.sp6)       // safe-area top + 32
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { vm.bootIfNeeded() }
        .onReceive(authState.$isSignedIn) { vm.isSignedIn = $0 }
        // RN ActionSheetIOS 1:1 — UIAlertController with the exact promised
        // options (sibling of ModerationSheetHost; see that type for why
        // confirmationDialog is unusable here).
        .background(BoardModerationSheetHost(vm: vm))
        .alert(
            vm.alert?.title ?? "",
            isPresented: Binding(
                get: { vm.alert != nil },
                set: { if !$0 { vm.alert = nil } }
            )
        ) {
            Button("OK") {}
        } message: {
            Text(vm.alert?.message ?? "")
        }
        .alert(
            "sign in failed",
            isPresented: Binding(
                get: { signInFailureMessage != nil },
                set: { if !$0 { signInFailureMessage = nil } }
            )
        ) {
            Button("OK") {}
        } message: {
            Text(signInFailureMessage ?? "")
        }
    }

    // MARK: - List (FlatList: contentPaddingBottom 120 clears the tab pill)

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if vm.rows.isEmpty {
                    Text("no entries yet")
                        .font(Fonts.spaceSemiBold(14))
                        .foregroundColor(Palette.inkSoft)
                        .padding(Spacing.sp4)
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(vm.rows) { row in
                        LeaderboardRow(
                            rank: row.rank,
                            userId: row.entry.userId,
                            handle: row.entry.handle,
                            score: row.entry.score,
                            streakDays: row.entry.streakDays ?? 0,
                            isSelf: vm.currentUserId != nil && row.entry.userId == vm.currentUserId,
                            crown: row.rank == 1,
                            onModerate: { userId, handle in
                                vm.openSheet(userId: userId, handle: handle)
                            }
                        )
                    }
                }
            }
            .padding(.bottom, 120)
        }
    }

    // MARK: - Pills (period + scope share the exact same style fn)

    private func pill(
        _ label: String,
        active: Bool,
        disabled: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label)
                .font(Fonts.hankenBold(13))
                .kerning(0.6)
                .foregroundColor(Palette.ink)
                .opacity(active ? 1 : 0.7)
                // RN paddings (12 / 8) sit INSIDE the 2pt border box.
                .padding(.horizontal, Spacing.sp3 + 2)
                .padding(.vertical, Spacing.sp2 + 2)
                .background(Capsule().fill(active ? Palette.blue : Palette.cream))
                .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 2))
                .hardShadow(Shadows.s, shape: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1) // FRIENDS pill when signed out (§8.6)
    }

    // MARK: - SIWA gate (signed-out state, §1 copy verbatim)

    private var signInBlock: some View {
        VStack(spacing: Spacing.sp3) { // gap 12
            Text("sign in to see friend leaderboards")
                .font(Fonts.spaceSemiBold(12))
                .foregroundColor(Palette.inkSoft)
            AppleSignInButton { handleSignIn() }
                .frame(width: 240, height: 48)
        }
        .frame(maxWidth: .infinity) // alignItems center
    }

    private func handleSignIn() {
        guard !signInBusy else { return }
        signInBusy = true
        Task {
            do {
                _ = try await AuthService.shared.signInWithApple()
                vm.signedIn()
            } catch {
                signInFailureMessage = Self.signInFailureMessage(for: error)
            }
            signInBusy = false
        }
    }

    /// RN: `if (!/canceled/i.test(msg)) Alert.alert("sign in failed", msg)`.
    /// Natively the user-cancel is ASAuthorizationError.canceled (whose
    /// localizedDescription does NOT contain "canceled"), so check the code
    /// first, then keep the RN message regex as a belt-and-braces filter.
    static func signInFailureMessage(for error: Error) -> String? {
        if let asError = error as? ASAuthorizationError, asError.code == .canceled {
            return nil
        }
        let message = error.localizedDescription
        return message.range(of: "canceled", options: .caseInsensitive) == nil ? message : nil
    }
}

// MARK: - Native Apple sign-in button
// RN used expo-apple-authentication's AppleAuthenticationButton — a wrapper
// around ASAuthorizationAppleIDButton (Apple HIG requires the official
// button) with a custom onPress. Same wrapper here: the tap runs
// AuthService.signInWithApple(), not the button's own flow.

struct AppleSignInButton: UIViewRepresentable {

    let action: () -> Void

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
        button.cornerRadius = 12
        button.addTarget(context.coordinator, action: #selector(Coordinator.tapped), for: .touchUpInside)
        return button
    }

    func updateUIView(_ button: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.action = action
    }

    func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    final class Coordinator: NSObject {
        var action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func tapped() { action() }
    }
}

// MARK: - Action-sheet host (RN ActionSheetIOS = UIAlertController .actionSheet)

/// Sibling of ModerationSheetHost (Core/ClusterModeration.swift) with the
/// Board-specific options — same presentation approach, different strings
/// and actions ("Block this user" destructive / "Report this user"; title is
/// the display handle, unquoted). Embed zero-sized via `.background(…)`.
struct BoardModerationSheetHost: UIViewControllerRepresentable {

    @ObservedObject var vm: BoardViewModel

    final class Coordinator {
        /// Target id a sheet is currently presented for (nil = none).
        var presentedFor: String?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ host: UIViewController, context: Context) {
        guard let target = vm.sheetTarget else { return }
        guard context.coordinator.presentedFor != target.id,
              host.presentedViewController == nil else { return }
        context.coordinator.presentedFor = target.id

        let vm = vm
        let coordinator = context.coordinator
        let close = {
            coordinator.presentedFor = nil
            vm.sheetTarget = nil
        }

        // ActionSheetIOS order: destructiveButtonIndex 1 (Block), then
        // Report; Cancel (index 0) renders pinned at the bottom on iOS.
        let sheet = UIAlertController(
            title: target.displayHandle,
            message: nil,
            preferredStyle: .actionSheet
        )
        sheet.addAction(UIAlertAction(title: BoardViewModel.blockLabel, style: .destructive) { _ in
            close()
            Task { await vm.blockUser(userId: target.id, handle: target.handle) }
        })
        sheet.addAction(UIAlertAction(title: BoardViewModel.reportLabel, style: .default) { _ in
            close()
            Task { await vm.reportUser(userId: target.id) }
        })
        sheet.addAction(UIAlertAction(title: BoardViewModel.cancelLabel, style: .cancel) { _ in
            close()
        })
        host.present(sheet, animated: true)
    }
}
