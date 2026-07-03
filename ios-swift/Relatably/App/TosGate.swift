// 1:1 port of ios/src/components/TosGate.tsx
// (docs/superpowers/plans/rn-extraction/tosgate-eula.md).
//
// App Review Guideline 1.2 requires UGC apps to make users agree to terms
// that prohibit objectionable content. This gate renders a full-screen
// acceptance modal the first time the app is launched (and again whenever
// `EulaStore.currentTosVersion` bumps).
//
// Acceptance is recorded in the Keychain (expo-secure-store parity) so it
// persists across launches and is per-device (not per-user — anonymous
// users also need to agree).

import SwiftUI

struct TosGate<Content: View>: View {

    private enum Phase {
        case loading
        case blocking
        case ready
    }

    /// Link base — RN `EXPO_PUBLIC_API_URL ?? "https://relatably.vercel.app"`;
    /// no env file sets the override, so the fallback is the effective value
    /// (tosgate-eula.md §2.2). Deliberately NOT `resolveBaseURL()`: legal
    /// links must never point at a debug host.
    private static var base: String { APIClient.productionBaseURL }

    private let eula: EulaStore
    private let content: Content
    @State private var phase: Phase = .loading

    init(eula: EulaStore = EulaStore(), @ViewBuilder content: () -> Content) {
        self.eula = eula
        self.content = content()
    }

    var body: some View {
        Group {
            switch phase {
            case .loading: loadingView
            case .blocking: blockingView
            case .ready: content
            }
        }
        .task {
            // RN keeps ≥1 frame of the loading screen (async SecureStore
            // read); `.task` runs after first render — same flash, kept
            // intentionally (tosgate-eula.md §8.10). Fail-open on read
            // errors is folded into EulaStore.hasAcceptedTos().
            guard phase == .loading else { return }
            phase = eula.hasAcceptedTos() ? .ready : .blocking
        }
    }

    // MARK: - Loading phase (§7.2)

    private var loadingView: some View {
        ZStack {
            Palette.cream.ignoresSafeArea()
            Text("loading…")
                // bodyS FAMILY but hardcoded 14pt (token deviation, §3.3);
                // no lineHeight set in RN → no typeStyle.
                .font(Fonts.hankenBold(14))
                .foregroundColor(Palette.inkSoft)
        }
    }

    // MARK: - Blocking phase (§7.3)

    private var blockingView: some View {
        ZStack {
            Palette.cream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.sp3) {
                    Text("Before you play")
                        .typeStyle(Typography.h1)
                        .foregroundColor(Palette.ink)
                        .padding(.bottom, Spacing.sp2)

                    paragraph("Relatably is a daily question app. Anyone can submit an answer, so we have a zero-tolerance rule about what you write:")

                    bulletRow("No hate, harassment, threats, or slurs.")
                    bulletRow("No sexual content involving minors. Ever.")
                    bulletRow("No personal info about other people.")
                    bulletRow("No spam, scams, or attempts to game the wordcloud.")

                    paragraph("Anything else? Tap any answer in the wordcloud to hide it, report it, or block whoever wrote it. We act on reports within 24 hours and eject repeat offenders.")

                    finePrint

                    agreeButton
                }
                .padding(.top, Spacing.sp8)
                .padding(.horizontal, Spacing.gutter)
                .padding(.bottom, Spacing.sp8)
            }
            // RN root is a raw (non-safe-area) View — the 64pt top padding
            // is measured from the physical screen top and covers the notch.
            .ignoresSafeArea()
        }
    }

    private func paragraph(_ text: String) -> some View {
        Text(text)
            .typeStyle(Typography.bodyL)
            .foregroundColor(Palette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func bulletRow(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.sp2) {
            Text("•")
                // bodyL family/size, deliberately NO lineHeight (§3.3).
                .font(Fonts.hankenBold(Typography.bodyL.size))
                .foregroundColor(Palette.ink)
                .frame(width: 14) // fixed centered column → hanging indent
            Text(text)
                .typeStyle(Typography.bodyL)
                .foregroundColor(Palette.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Fine print (§2.1)

    private var finePrint: some View {
        Text(Self.finePrintString)
            .typeStyle(Typography.bodyS)
            .foregroundColor(Palette.inkSoft)
            .tint(Palette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, Spacing.sp3) // +12 on top of the 12 stack gap = 24
    }

    /// One flowing bodyS paragraph with three inline spans: `I AGREE`
    /// (label family only — size/line/color inherit), and two underlined
    /// ink links that open externally in Safari (RN `Linking.openURL`).
    private static var finePrintString: AttributedString {
        var out = AttributedString("By tapping ")

        var agree = AttributedString("I AGREE")
        agree.font = Fonts.spaceSemiBold(Typography.bodyS.size)
        out += agree

        out += AttributedString(" you confirm you're 18 or older and you accept our ")

        var tos = AttributedString("Terms of Service")
        tos.link = URL(string: "\(base)/tos")
        tos.foregroundColor = Palette.ink
        tos.underlineStyle = .single
        out += tos

        out += AttributedString(" and ")

        var privacy = AttributedString("Privacy Policy")
        privacy.link = URL(string: "\(base)/privacy")
        privacy.foregroundColor = Palette.ink
        privacy.underlineStyle = .single
        out += privacy

        out += AttributedString(".")
        return out
    }

    // MARK: - I AGREE button

    private var agreeButton: some View {
        Button(action: accept) {
            Text("I AGREE")
                // label FAMILY but hardcoded 14pt / tracking 1.4
                // (token deviations, §3.3 — label token is 11 / 1.1).
                .font(Fonts.spaceSemiBold(14))
                .kerning(1.4)
                .foregroundColor(Palette.cream)
                // RN paddings (32/12) sit INSIDE the 3pt border box.
                .padding(.horizontal, Spacing.sp6 + 3)
                .padding(.vertical, Spacing.sp3 + 3)
                .background(Capsule().fill(Palette.pink))
                .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 3))
                .hardShadow(Shadows.s, shape: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("I agree to the terms")
        .padding(.top, Spacing.sp5) // +24 on top of the 12 stack gap = 36
        .frame(maxWidth: .infinity) // alignSelf: center
    }

    private func accept() {
        do {
            try eula.recordAcceptance()
            phase = .ready
        } catch {
            // RN parity (§5.1/§8.2): recordTosAcceptance() is awaited
            // un-caught — a failed Keychain write keeps the gate up
            // silently; the user can tap again.
        }
    }
}
