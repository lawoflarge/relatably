import SwiftUI

// TODAY tab — phase switch over HomeViewModel (home-flow.md §3).
// The cream background + PaperTexture live in RootView, under every phase.
// Reveal (Task 11) is a placeholder for now.

struct HomeView: View {

    @StateObject private var vm: HomeViewModel

    init(viewModel: @autoclosure @escaping () -> HomeViewModel = HomeViewModel.live()) {
        _vm = StateObject(wrappedValue: viewModel())
    }

    var body: some View {
        Group {
            switch vm.phase {
            case .loading:
                loadingView

            case .reveal(let yesterday):
                RevealView(yesterday: yesterday, onComplete: { vm.revealComplete() })

            case .question(let question):
                QuestionView(vm: vm, question: question)

            case .wordcloud:
                WordcloudView(vm: vm)

            case .noDrop:
                StatusCard(
                    heading: "no drop yet",
                    message: "today's question hasn't unlocked. one question, one global drop — once a day, at a random moment in UTC.",
                    detail: nil,
                    buttonLabel: "CHECK AGAIN",
                    rotationDegrees: -1.5,
                    action: { vm.checkAgain() }
                )

            case .error:
                StatusCard(
                    heading: "no signal",
                    message: "couldn't reach the drop. tap to retry.",
                    detail: vm.errorMsg,
                    buttonLabel: "RETRY",
                    rotationDegrees: 1.5,
                    action: { vm.retry() }
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            vm.bootIfNeeded()
        }
        .task {
            // Consent BEFORE the SDK. Requesting an ad before the EEA/UK form is
            // answered is the thing the form asks about; npa=1 alone does not
            // cover it. Its own task, so the boot path is never awaited on ads.
            await AdManager.gatherConsent()
            AdManager.initAds()
        }
    }

    // MARK: - Loading (§3: centered text, NO spinner)

    private var loadingView: some View {
        Text("preparing today's drop…")
            .font(Fonts.hankenBold(16)) // bodyL family, hardcoded 16 (RN styles.muted)
            .foregroundColor(Palette.inkSoft)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - no_drop / error card (§3 — identical card, mirrored rotation)

private struct StatusCard: View {

    let heading: String
    let message: String
    let detail: String?
    let buttonLabel: String
    let rotationDegrees: Double
    let action: () -> Void

    var body: some View {
        VStack(spacing: Spacing.sp3) { // gap 12
            Text(heading)
                .typeStyle(Typography.h2)
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)

            Text(message)
                .typeStyle(Typography.bodyL)
                .foregroundColor(Palette.inkSoft)
                .multilineTextAlignment(.center)

            if let detail {
                Text(detail)
                    .font(Fonts.hankenBold(Typography.bodyS.size)) // 13, red
                    .foregroundColor(Palette.red)
                    .multilineTextAlignment(.center)
            }

            Button(action: action) {
                Text(buttonLabel)
                    .font(Fonts.spaceSemiBold(13))
                    .kerning(1.3)
                    .foregroundColor(Palette.cream)
                    // RN paddings (24 / 12) sit INSIDE the 3pt border box.
                    .padding(.horizontal, Spacing.sp5 + 3)
                    .padding(.vertical, Spacing.sp3 + 3)
                    .background(Capsule().fill(Palette.pink))
                    .overlay(Capsule().strokeBorder(Palette.ink, lineWidth: 3))
                    .hardShadow(Shadows.s, shape: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.sp2) // marginTop 8
        }
        // RN card padding 24 sits inside the 3pt border box.
        .padding(Spacing.sp5 + 3)
        .frame(maxWidth: 360)
        .background(RoundedRectangle(cornerRadius: Radii.m).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: Radii.m).strokeBorder(Palette.ink, lineWidth: 3))
        .hardShadow(Shadows.m, shape: RoundedRectangle(cornerRadius: Radii.m))
        .rotationEffect(.degrees(rotationDegrees))
        .padding(.horizontal, Spacing.gutter) // 22
        .frame(maxWidth: .infinity, maxHeight: .infinity) // centered
    }
}
