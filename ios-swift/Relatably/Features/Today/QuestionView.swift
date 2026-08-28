import SwiftUI

// Question phase, 1:1 port of the RN layout (home-flow.md §3 "question").
//
// IMPORTANT: the stack has ZERO spacing and children carry no vertical
// margins (except the replay hint's marginBottom 12): elements sit flush
// under each other, top-aligned. The visual breathing room comes from
// BagelFatOne's 62pt line box, the input's internal padding, and the
// button's padding. Do not add spacing.

struct QuestionView: View {

    @ObservedObject var vm: HomeViewModel
    let question: TodayQuestion

    @Environment(\.appSafeAreaInsets) private var insets

    var body: some View {
        // BagelFatOne 52/62 is a custom face and grows with the text size, so at
        // the largest step the hero alone filled an iPhone SE and pushed the
        // submit button off screen. Scrolling keeps it reachable; spacing and
        // order are untouched.
        ScrollView {
        VStack(spacing: 0) {
            if vm.exploringPast {
                Text("Today's drop hasn't unlocked yet. Here's the most recent one, answer it to explore the live wordcloud.")
                    .typeStyle(Typography.bodyS)
                    .foregroundColor(Palette.inkSoft)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, Spacing.sp3) // marginBottom 12
            }

            QuestionText(text: question.text)

            AnswerInput(text: $vm.text)

            LiveCounter(count: vm.liveCount)

            if let errorMsg = vm.errorMsg {
                Text(errorMsg)
                    .font(Fonts.hankenBold(Typography.bodyS.size)) // 13, no lineHeight in RN
                    .foregroundColor(Palette.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }

            SubmitButton(
                hasText: !vm.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                startedAt: vm.renderedAt
            ) {
                Task { await vm.submit(answer: vm.text) }
            }
            .frame(maxWidth: .infinity) // wrap { alignItems: center }

            Spacer(minLength: 0) // container flex:1, content top-aligned
        }
        .padding(.horizontal, Spacing.gutter)          // 22
        .padding(.top, insets.top + Spacing.sp5)       // safe-area top + 24
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
    }
}

/// RN QuestionText: force-lowercased hero display text (BagelFatOne 52/62, ink).
struct QuestionText: View {
    let text: String

    var body: some View {
        Text(text.lowercased())
            .typeStyle(Typography.hero)
            .foregroundColor(Palette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
