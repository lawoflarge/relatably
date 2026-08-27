import SwiftUI
import UIKit

// ME (settings) screen — 1:1 port of ios/app/(tabs)/settings.tsx per
// docs/superpowers/plans/rn-extraction/settings-tabbar.md §3.
//
// The cream background + PaperTexture live in RootView, under every tab
// (RN renders its own PaperTexture here; RootView already provides it).
//
// Section order (§3.3): title → links card (Contact support / Report
// inappropriate content / ToS / Privacy) → HIDDEN ANSWERS (when non-empty)
// → BLOCKED USERS (when non-empty) → ACCOUNT (signed in) or the anonymous
// hint → footer.

struct MeView: View {

    @StateObject private var vm: MeViewModel
    /// RN parity: `onAuthStateChanged` drives the `uid` gate reactively.
    @StateObject private var authState = AuthState()

    /// True while ME is the selected tab. RootTabs keeps every tab alive, so
    /// this is the focus signal: each flip to true re-reads the undo lists
    /// (see MeViewModel.bootIfNeeded for the RN-lazy-mount rationale).
    let isActive: Bool

    @State private var confirmSignOut = false
    @State private var confirmDelete = false

    @Environment(\.appSafeAreaInsets) private var insets

    init(
        isActive: Bool = true,
        vm: @autoclosure @escaping () -> MeViewModel = MeViewModel.live()
    ) {
        self.isActive = isActive
        _vm = StateObject(wrappedValue: vm())
    }

    var body: some View {
        ScrollView {
            // RN contentContainer: gap 16 between children, paddingH 22,
            // paddingTop insets.top+24, paddingBottom 120 (floating pill).
            VStack(alignment: .leading, spacing: Spacing.sp4) {
                Text("Settings")
                    .typeStyle(Typography.h1) // BagelFatOne 40/48
                    .foregroundColor(Palette.ink)
                    .padding(.bottom, Spacing.sp2) // marginBottom 8 (+ the 16 gap)

                linksCard

                if !vm.hidden.isEmpty {
                    sectionLabel("HIDDEN ANSWERS")
                    card {
                        rowList(vm.hidden) { h in
                            SettingsRow(
                                // Typographic quotes U+201C/U+201D (§7.10).
                                label: "\u{201C}\(h.text)\u{201D}",
                                hint: "Tap to unhide",
                                chevron: "×",
                                labelLineLimit: 1 // numberOfLines={1}
                            ) {
                                vm.unhide(id: h.id)
                            }
                            .accessibilityLabel("Unhide \"\(h.text)\"")
                        }
                    }
                }

                if !vm.blocked.isEmpty {
                    sectionLabel("BLOCKED USERS")
                    card {
                        rowList(vm.blocked) { b in
                            SettingsRow(
                                label: b.displayName, // handle ?? "@" + prefix(6)
                                hint: "Tap to unblock",
                                chevron: "×"
                            ) {
                                vm.unblock(userId: b.user_id)
                            }
                            .accessibilityLabel("Unblock \(b.displayName)")
                        }
                    }
                }

                if vm.isSignedIn {
                    sectionLabel("ACCOUNT")
                    accountCard
                } else {
                    // Plain text, no card (§3.3): paddingH 8 + paddingV 8.
                    Text(MeViewModel.signedOutHint)
                        .font(Fonts.hankenBold(13))
                        .foregroundColor(Palette.inkSoft)
                        .padding(.horizontal, Spacing.sp2)
                        .padding(.vertical, Spacing.sp2)
                }

                Text(MeViewModel.footerText) // © 2026 Levin Schwab · v1.0
                    .font(Fonts.hankenBold(13))
                    .foregroundColor(Palette.inkSoft)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, Spacing.sp5) // marginTop 24
            }
            .padding(.horizontal, Spacing.gutter)   // 22
            .padding(.top, insets.top + Spacing.sp5) // safe-area top + 24
            .padding(.bottom, 120)                   // clears the floating tab pill
        }
        .task { vm.bootIfNeeded() }
        .onChange(of: isActive) { _, active in
            if active { vm.refresh() } // keep-alive focus refresh
        }
        .onReceive(authState.$isSignedIn) { vm.isSignedIn = $0 }
        // Follow-up alerts (single OK) — link/mail errors, sign-out error,
        // delete success/error.
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
        // Alert 4 (§3.1): sign-out confirm.
        .alert(MeViewModel.signOutConfirmTitle, isPresented: $confirmSignOut) {
            Button("Cancel", role: .cancel) {}
            Button("Sign out", role: .destructive) { vm.signOutConfirmed() }
        } message: {
            Text(MeViewModel.signOutConfirmMessage)
        }
        // Alert 6 (§3.1): delete-account confirm.
        .alert(MeViewModel.deleteConfirmTitle, isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete account", role: .destructive) {
                Task { await vm.deleteAccountConfirmed() }
            }
        } message: {
            Text(MeViewModel.deleteConfirmMessage)
        }
    }

    // MARK: - Static links card (4 rows, §3.1 order)

    private var linksCard: some View {
        card {
            SettingsRow(label: "Contact support", hint: MeViewModel.supportEmail) {
                openMail(
                    MeViewModel.contactMailtoURL,
                    onFailure: { message in
                        vm.alert = MeViewModel.MeAlert(title: "Couldn't open mail", message: message)
                    }
                )
            }
            divider
            SettingsRow(label: "Report inappropriate content", hint: "We act within 24 hours") {
                openMail(
                    MeViewModel.reportMailtoURL,
                    onFailure: { _ in
                        // RN catch ignores the error here — fixed fallback copy.
                        vm.alert = MeViewModel.MeAlert(
                            title: MeViewModel.mailUnavailableTitle,
                            message: MeViewModel.mailUnavailableMessage
                        )
                    }
                )
            }
            divider
            SettingsRow(label: "Terms of Service") { openLink(MeViewModel.tosURL) }
            divider
            SettingsRow(label: "Privacy Policy") { openLink(MeViewModel.privacyURL) }
            if AdManager.privacyOptionsRequired {
                divider
                SettingsRow(label: "Ad privacy options", hint: "Change your consent for ads") {
                    AdManager.presentPrivacyOptions()
                }
            }
        }
    }

    // MARK: - ACCOUNT card (§3.1 rows)

    private var accountCard: some View {
        card {
            SettingsRow(label: "Sign out", hint: "Stay anonymous on this device") {
                confirmSignOut = true
            }
            divider
            SettingsRow(
                label: vm.deleteRowLabel, // "Delete account" | "Deleting…"
                hint: "Permanent. Can't be undone.",
                destructive: true
            ) {
                confirmDelete = true
            }
            .disabled(vm.busy)
            .accessibilityLabel("Delete account")
        }
    }

    // MARK: - Card / section chrome (§3.3)

    /// White card: 3pt ink border, radius 22, hard shadow s (offset 2,2).
    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) { content() }
            .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
            .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 3))
            .hardShadow(Shadows.s, shape: RoundedRectangle(cornerRadius: Radii.m))
    }

    /// Rows interleaved with dividers (RN: bottom border on all but last).
    /// Position-based identity — same as the RN map over the array.
    private func rowList<T, V: View>(
        _ items: [T],
        @ViewBuilder row: @escaping (T) -> V
    ) -> some View {
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
            row(item)
            if index < items.count - 1 { divider }
        }
    }

    private var divider: some View {
        Rectangle().fill(Palette.ink).frame(height: 2)
    }

    /// Section label: SpaceGrotesk_600 11pt, letterSpacing 1.4 (§7.9 —
    /// overrides the token's 1.1), inkSoft, marginTop 8 on top of the 16 gap.
    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(Fonts.spaceSemiBold(11))
            .kerning(1.4)
            .foregroundColor(Palette.inkSoft)
            .padding(.top, Spacing.sp2)
    }

    // MARK: - Link / mail openers (§3.2)

    /// RN `Linking.openURL(url).catch` → "Couldn't open link" with the error
    /// message; iOS's Linking failure message is "Unable to open URL: <url>".
    private func openLink(_ urlString: String) {
        open(urlString) { message in
            vm.alert = MeViewModel.MeAlert(title: "Couldn't open link", message: message)
        }
    }

    private func openMail(_ urlString: String, onFailure: @escaping (String) -> Void) {
        open(urlString, onFailure: onFailure)
    }

    private func open(_ urlString: String, onFailure: @escaping (String) -> Void) {
        guard let url = URL(string: urlString) else {
            onFailure("Unable to open URL: \(urlString)")
            return
        }
        UIApplication.shared.open(url) { success in
            // Completion arrives on the main queue.
            if !success {
                onFailure("Unable to open URL: \(urlString)")
            }
        }
    }
}

// MARK: - Row (RN Pressable row: label+hint flex-1, trailing chevron)

private struct SettingsRow: View {

    let label: String
    var hint: String? = nil
    /// "›" for actions/links, "×" for the undo rows.
    var chevron: String = "›"
    var destructive = false
    var labelLineLimit: Int? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 2) { // hint marginTop 2
                    Text(label)
                        .font(Fonts.hankenBold(17)) // bodyL family/size, no lineHeight in RN
                        .foregroundColor(destructive ? Palette.red : Palette.ink)
                        .lineLimit(labelLineLimit)
                        .multilineTextAlignment(.leading)
                    if let hint {
                        Text(hint)
                            .font(Fonts.hankenBold(13)) // bodyS family/size
                            .foregroundColor(Palette.inkSoft)
                            .multilineTextAlignment(.leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading) // flex 1
                Text(chevron)
                    .font(Fonts.bagel(24)) // h2 family, fontSize 24
                    .foregroundColor(destructive ? Palette.red : Palette.ink)
                    .padding(.leading, Spacing.sp2) // marginLeft 8
            }
            .padding(.horizontal, Spacing.sp4) // 16
            .padding(.vertical, Spacing.sp4)   // 16
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain) // RN Pressable defines no pressed-state style
    }
}
