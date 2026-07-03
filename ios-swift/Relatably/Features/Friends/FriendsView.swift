import SwiftUI
import UIKit

// Friends screen — 1:1 port of ios/src/screens/FriendsScreen.tsx +
// ios/src/components/FriendListRow.tsx per
// docs/superpowers/plans/rn-extraction/friends-auth.md §1/§2/§3/§6.
//
// The cream background + PaperTexture live in RootView, under every tab
// (RN renders its own PaperTexture here; RootView already provides it).
//
// Three render gates, in order (§4.1): signed-out CTA card → loading
// spinner → flat list (header "your friends (n)", rows, empty copy).

struct FriendsView: View {

    @StateObject private var vm: FriendsViewModel
    /// RN tab wrapper parity (ios/app/(tabs)/friends.tsx): Firebase auth
    /// state read reactively — cold-start session restore flips isSignedIn
    /// asynchronously.
    @StateObject private var authState = AuthState()

    @State private var signInBusy = false
    /// Non-nil presents the "sign in failed" alert (§4.1 SIWA onError).
    @State private var signInFailureMessage: String?

    @Environment(\.appSafeAreaInsets) private var insets

    init(vm: @autoclosure @escaping () -> FriendsViewModel = FriendsViewModel.live()) {
        _vm = StateObject(wrappedValue: vm())
    }

    var body: some View {
        Group {
            if !vm.effectiveSignedIn {
                signedOutGate
            } else if vm.loading {
                // RN: ActivityIndicator size large, color pink, centered.
                ProgressView()
                    .controlSize(.large)
                    .tint(Palette.pink)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                list
            }
        }
        .task { vm.bootIfNeeded() }
        .onReceive(authState.$isSignedIn) { vm.isSignedIn = $0 }
        // RN ActionSheetIOS 1:1 — UIAlertController with the exact promised
        // options (same host pattern as BoardModerationSheetHost).
        .background(FriendsSheetHost(vm: vm))
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

    // MARK: - Signed-out gate (§6 state A — copy verbatim, card rotated -1.5°)

    private var signedOutGate: some View {
        VStack(spacing: Spacing.sp3) { // gap 12 between every child
            Text("your people")
                .typeStyle(Typography.h2) // BagelFatOne 36/44
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)
            Text("sign in to see friends and compare answers.")
                .typeStyle(Typography.bodyL) // HankenGrotesk_700 17/24
                .foregroundColor(Palette.inkSoft)
                .multilineTextAlignment(.center)
            // Explicit 8pt spacer — with the 12pt gaps on both sides this
            // makes 32pt between body and button (§2 note).
            Color.clear.frame(height: Spacing.sp2)
            AppleSignInButton { handleSignIn() }
                .frame(width: 240, height: 48)
        }
        .padding(Spacing.sp5) // padV 24 + padH 24
        .frame(maxWidth: 360)
        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 3))
        .hardShadow(Shadows.m, shape: RoundedRectangle(cornerRadius: Radii.m))
        // Rotation applies to the whole card INCLUDING its shadow (§7.14).
        .rotationEffect(.degrees(-1.5))
        .padding(.horizontal, Spacing.gutter) // center container padH 22
        .frame(maxWidth: .infinity, maxHeight: .infinity) // centered
    }

    private func handleSignIn() {
        guard !signInBusy else { return } // re-entrancy guard, no visual busy state (§7.13)
        signInBusy = true
        Task {
            do {
                _ = try await AuthService.shared.signInWithApple()
                vm.signedIn() // RN onSignedIn={() => setAuthBump(n => n + 1)}
            } catch {
                // RN: if (!/canceled/i.test(msg)) Alert.alert("sign in failed", msg).
                // BoardView.signInFailureMessage is the shared native port of
                // that filter (nil on user cancel).
                signInFailureMessage = BoardView.signInFailureMessage(for: error)
            }
            signInBusy = false
        }
    }

    // MARK: - List (§6 state C — FlatList: paddingTop safe-area+24, bottom 120)

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                Text(vm.headerTitle) // "your friends" | "your friends (N)"
                    .typeStyle(Typography.h2)
                    .foregroundColor(Palette.ink)
                    .padding(.horizontal, Spacing.gutter) // 22
                    .padding(.bottom, Spacing.sp3)        // 12
                if vm.friendships.isEmpty {
                    Text("no friends yet. share your link to invite someone!")
                        .typeStyle(Typography.bodyL)
                        .foregroundColor(Palette.inkSoft)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.gutter)
                        .padding(.top, Spacing.sp3)
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(vm.friendships, id: \.id) { f in
                        FriendListRow(
                            friendship: f,
                            onAccept: f.showsAccept
                                ? { Task { await vm.accept(friendshipId: f.id) } }
                                : nil,
                            onLongPress: { vm.openSheet(f) }
                        )
                    }
                }
            }
            .padding(.top, insets.top + Spacing.sp5) // safe-area top + 24
            .padding(.bottom, 120)                   // clears the floating tab pill
        }
    }
}

// MARK: - Friend row (RN FriendListRow — edge-to-edge, long-press menu)

private struct FriendListRow: View {

    let friendship: Friendship
    let onAccept: (() -> Void)?
    let onLongPress: () -> Void

    var body: some View {
        HStack(spacing: Spacing.sp3) { // gap 12
            // Avatar: 32×32 mint circle, ink 2pt border, BagelFatOne 12 initial.
            Text(friendship.avatarInitial)
                .font(Fonts.bagel(12))
                .foregroundColor(Palette.ink)
                .frame(width: 32, height: 32)
                .background(Circle().fill(Palette.mint))
                .overlay(Circle().strokeBorder(Palette.ink, lineWidth: 2))
            Text(friendship.displayName)
                .font(Fonts.hankenBold(15))
                .foregroundColor(Palette.ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading) // flex 1
            Text(friendship.statusTag) // PENDING / INCOMING / OUTGOING
                .font(Fonts.spaceSemiBold(10))
                .kerning(1.3)
                .foregroundColor(Palette.inkSoft)
            if let onAccept {
                Button(action: onAccept) {
                    Text("ACCEPT")
                        .font(Fonts.hankenBold(12))
                        .kerning(1)
                        .foregroundColor(Palette.cream)
                        .padding(.horizontal, Spacing.sp4) // 16
                        .padding(.vertical, Spacing.sp2)   // 8
                        .frame(minHeight: 44)              // Apple tap-target minimum
                        .background(Capsule().fill(Palette.pink))
                        .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 2))
                        .hardShadow(Shadows.s, shape: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.sp3) // padH 12 + padV 12
        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 2))
        .hardShadow(Shadows.s, shape: RoundedRectangle(cornerRadius: Radii.m))
        .padding(.vertical, Spacing.sp1) // marginVertical 4 (rows edge-to-edge, §6 note)
        .contentShape(RoundedRectangle(cornerRadius: Radii.m))
        // Rows are NOT tappable — only long-press (menu) and the ACCEPT pill.
        .onLongPressGesture { onLongPress() }
        .accessibilityHint("Long-press to remove or block this user")
    }
}

// MARK: - Action-sheet host (RN ActionSheetIOS = UIAlertController .actionSheet)

/// Sibling of BoardModerationSheetHost with the FriendListRow options —
/// title is the row's display name; "Remove from friends" then destructive
/// "Block this user"; Cancel pinned at the bottom (§4.2).
struct FriendsSheetHost: UIViewControllerRepresentable {

    @ObservedObject var vm: FriendsViewModel

    final class Coordinator {
        /// Friendship id a sheet is currently presented for (nil = none).
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

        let sheet = UIAlertController(
            title: target.displayName,
            message: nil,
            preferredStyle: .actionSheet
        )
        sheet.addAction(UIAlertAction(title: FriendsViewModel.removeLabel, style: .default) { _ in
            close()
            Task { await vm.remove(target) }
        })
        sheet.addAction(UIAlertAction(title: FriendsViewModel.blockLabel, style: .destructive) { _ in
            close()
            Task { await vm.block(target) }
        })
        sheet.addAction(UIAlertAction(title: FriendsViewModel.cancelLabel, style: .cancel) { _ in
            close()
        })
        host.present(sheet, animated: true)
    }
}
