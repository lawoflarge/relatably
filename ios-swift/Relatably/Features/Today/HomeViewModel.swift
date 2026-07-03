import Foundation

// Today-tab state machine — 1:1 port of ios/app/(tabs)/index.tsx per
// docs/superpowers/plans/rn-extraction/home-flow.md §2, plus the plan's
// 12 s boot watchdog (spec §8): THE fix for App Store rejection 2.1(a)
// ("couldn't progress past the initial loading screen"). No load path can
// leave the user stuck on .loading — the watchdog forces the .error card
// (with its RETRY button) if nothing resolved within the deadline.

// MARK: - HomeAPI (the 4 network calls this screen uses)

/// Slice of APIClient the Today feature needs — injectable for tests.
protocol HomeAPI {
    func fetchYesterday(deviceToken: String?) async throws -> Yesterday?
    func fetchTodayQuestion() async throws -> TodayQuestion
    func fetchArchive(cursor: String?) async throws -> ArchivePage
    func submitAnswer(_ request: SubmitRequest) async throws -> SubmitResponse
}

extension APIClient: HomeAPI {}

// MARK: - HomeViewModel

@MainActor
final class HomeViewModel: ObservableObject {

    enum Phase: Equatable {
        case loading
        case reveal(Yesterday)
        case question(TodayQuestion)
        case wordcloud(TodayQuestion)
        case noDrop
        case error
    }

    /// Production boot deadline (seconds). If the phase is still .loading when
    /// it fires, the VM forces .error so RETRY is always reachable (2.1a).
    static let defaultWatchdogInterval: TimeInterval = 12

    // MARK: Published state (RN useState set, §2)

    @Published private(set) var phase: Phase = .loading
    /// Two-way bound to AnswerInput.
    @Published var text = ""
    /// Live Firestore snapshot (question + wordcloud phases).
    @Published private(set) var clusters: [WordcloudCluster] = []
    /// Inline red detail line (error card + under LiveCounter after failed submit).
    @Published private(set) var errorMsg: String?
    /// True when the 404→archive fallback substituted a past question (§2.3).
    @Published private(set) var exploringPast = false
    /// Question render timestamp — dwell-gate anchor and dwell_ms base (§2.7).
    @Published private(set) var renderedAt = Date()

    /// Retained for Task 10 (wordcloud self-bubble + delete-own-answer).
    private(set) var selfClusterId: String?
    private(set) var selfSubmissionId: String?
    private(set) var submitResponse: SubmitResponse?
    private(set) var yesterday: Yesterday?
    private(set) var question: TodayQuestion?

    /// LiveCounter value: Σ submission_count over the snapshot (§2.5).
    var liveCount: Int { clusters.reduce(0) { $0 + $1.count } }

    /// Task 11 inserts the post-reveal interstitial here. Runs AFTER
    /// markRevealSeen (so an ad crash can never replay the reveal, §2.6)
    /// and BEFORE loadQuestion.
    var postRevealHook: (() async -> Void)?

    let watchdogInterval: TimeInterval

    // MARK: Dependencies

    private let api: HomeAPI
    private let deviceTokenProvider: DeviceTokenProvider
    private let revealStore: RevealStore
    private let clusterSource: ClusterLiveSource

    // MARK: Attempt bookkeeping (watchdog race safety)

    /// One boot/load attempt. `resolved` flips exactly once — whichever of
    /// {boot path, watchdog} gets there first wins; the loser is a no-op.
    /// A superseded attempt (retry started a new one) can never write phase
    /// because `currentAttempt` no longer points at it.
    private final class Attempt {
        var resolved = false
    }

    private var currentAttempt: Attempt?
    private var bootTask: Task<Void, Never>?
    private var watchdogTask: Task<Void, Never>?
    /// RN questionInFlight ref (§2.3): fast CHECK AGAIN taps must not double-fetch.
    private var questionInFlight = false
    private var listenerHandle: ClusterListenerHandle?

    /// nonisolated so `HomeViewModel.live()` can be a default argument of a
    /// (nonisolated) View initializer; only assigns stored properties.
    nonisolated init(
        api: HomeAPI,
        deviceTokenProvider: DeviceTokenProvider,
        revealStore: RevealStore,
        clusterSource: ClusterLiveSource,
        watchdogInterval: TimeInterval = HomeViewModel.defaultWatchdogInterval
    ) {
        self.api = api
        self.deviceTokenProvider = deviceTokenProvider
        self.revealStore = revealStore
        self.clusterSource = clusterSource
        self.watchdogInterval = watchdogInterval
    }

    deinit {
        bootTask?.cancel()
        watchdogTask?.cancel()
        // listenerHandle stops itself on release (ClusterListenerHandle.deinit).
    }

    // MARK: - Boot (§2.2: deviceToken → fetchYesterday → reveal gate → loadQuestion)

    private var hasBooted = false

    /// View entry point (`.task`) — boots exactly once per VM lifetime, so a
    /// re-appearing kept-alive tab never re-runs the boot sequence.
    func bootIfNeeded() {
        guard !hasBooted else { return }
        hasBooted = true
        boot()
    }

    /// Runs the boot sequence under the watchdog deadline. Re-runnable (RETRY).
    @discardableResult
    func boot() -> Task<Void, Never> {
        bootTask?.cancel()
        watchdogTask?.cancel()
        // A stalled previous fetch may never return to clear this flag —
        // a fresh boot owns it now (its stale defer is generation-guarded).
        questionInFlight = false
        errorMsg = nil
        phase = .loading

        let attempt = Attempt()
        currentAttempt = attempt
        startWatchdog(attempt)

        let task = Task { [weak self] in
            guard let self else { return }
            do {
                let deviceToken = self.deviceTokenProvider.deviceToken()
                if let y = try await self.api.fetchYesterday(deviceToken: deviceToken),
                   y.selfClusterId != nil,
                   !self.revealStore.hasSeenReveal(y.id) {
                    // Reveal only when ALL THREE hold: yesterday exists,
                    // the user answered it, and it hasn't been seen (§2.2).
                    guard self.canResolve(attempt) else { return }
                    self.yesterday = y
                    self.resolve(attempt, to: .reveal(y))
                    return
                }
            } catch {
                // RN parity: errors in the yesterday step are swallowed —
                // fall through to loadQuestion.
            }
            guard self.canResolve(attempt) else { return }
            await self.loadQuestion(attempt: attempt)
        }
        bootTask = task
        return task
    }

    /// Error-card RETRY — re-runs the full boot (per the plan's Phase contract).
    @discardableResult
    func retry() -> Task<Void, Never> {
        boot()
    }

    /// No-drop-card CHECK AGAIN — RN calls loadQuestion directly (§3).
    @discardableResult
    func checkAgain() -> Task<Void, Never> {
        startLoadAttempt()
    }

    // MARK: - loadQuestion (§2.3: 404 → archive substitute → noDrop/error)

    /// Fresh watchdog-covered attempt around loadQuestion (post-reveal and
    /// CHECK AGAIN paths). The in-flight guard runs FIRST so a double tap is
    /// a pure no-op and cannot orphan the fetch already running.
    @discardableResult
    private func startLoadAttempt() -> Task<Void, Never> {
        if questionInFlight { return Task {} }
        watchdogTask?.cancel()
        let attempt = Attempt()
        currentAttempt = attempt
        startWatchdog(attempt)
        let task = Task { [weak self] in
            guard let self else { return }
            await self.loadQuestion(attempt: attempt)
        }
        bootTask = task
        return task
    }

    private func loadQuestion(attempt: Attempt) async {
        if questionInFlight { return }
        questionInFlight = true
        defer {
            // Only the attempt that owns the flag may clear it — a stale
            // (superseded) fetch returning late must not unlock a fresh one.
            if currentAttempt === attempt { questionInFlight = false }
        }

        errorMsg = nil
        phase = .loading

        do {
            let q = try await api.fetchTodayQuestion()
            guard canResolve(attempt) else { return }
            showQuestion(q, exploringPast: false, attempt: attempt)
        } catch APIError.http(404) {
            // 404 = no live question. App-Review-critical fallback (§11.1):
            // never dead-end — the newest archive tile becomes answerable.
            do {
                let page = try await api.fetchArchive(cursor: nil)
                guard canResolve(attempt) else { return }
                if let latest = page.tiles.first {
                    let q = TodayQuestion(id: latest.questionId, text: latest.questionText)
                    showQuestion(q, exploringPast: true, attempt: attempt)
                } else {
                    resolve(attempt, to: .noDrop)
                }
            } catch {
                // RN parity (§2.3): archive fetch failure → no_drop.
                guard canResolve(attempt) else { return }
                resolve(attempt, to: .noDrop)
            }
        } catch {
            guard canResolve(attempt) else { return }
            errorMsg = Self.loadErrorMessage(error)
            resolve(attempt, to: .error)
        }
    }

    private func showQuestion(_ q: TodayQuestion, exploringPast: Bool, attempt: Attempt) {
        question = q
        self.exploringPast = exploringPast
        renderedAt = Date()
        startListener(questionId: q.id)
        resolve(attempt, to: .question(q))
    }

    /// RN shows the thrown message verbatim ("fetchTodayQuestion: 500", §10).
    private static func loadErrorMessage(_ error: Error) -> String {
        if case APIError.http(let status) = error {
            return "fetchTodayQuestion: \(status)"
        }
        return error.localizedDescription
    }

    // MARK: - Watchdog

    private func startWatchdog(_ attempt: Attempt) {
        let interval = watchdogInterval
        watchdogTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            guard !Task.isCancelled, let self else { return }
            guard self.currentAttempt === attempt, !attempt.resolved else { return }
            guard case .loading = self.phase else { return }
            // Deadline hit while still loading: force the error card so the
            // user (and App Review) always reaches RETRY. Marking the attempt
            // resolved locks out a later, slower boot result.
            attempt.resolved = true
            self.phase = .error
        }
    }

    private func canResolve(_ attempt: Attempt) -> Bool {
        currentAttempt === attempt && !attempt.resolved
    }

    /// Single-settle phase write for an attempt; cancels the watchdog.
    private func resolve(_ attempt: Attempt, to newPhase: Phase) {
        guard canResolve(attempt) else { return }
        attempt.resolved = true
        watchdogTask?.cancel()
        phase = newPhase
    }

    // MARK: - Firestore live listener (§2.4)

    /// Restarted on every question change (RN effect keyed on `question`);
    /// stays live through the wordcloud phase; stops on question swap/deinit.
    private func startListener(questionId: String) {
        listenerHandle?.stop()
        listenerHandle = clusterSource.listen(questionId: questionId) { [weak self] next in
            self?.clusters = next
        }
    }

    // MARK: - Submit (§2.7)

    /// Sends the answer UNTRIMMED (trim only gates the button) with
    /// dwell_ms = wall-clock ms since the question rendered.
    func submit(answer: String) async {
        guard let question else { return }
        text = answer
        do {
            let dwellMs = Int(Date().timeIntervalSince(renderedAt) * 1000)
            let deviceToken = deviceTokenProvider.deviceToken()
            let result = try await api.submitAnswer(SubmitRequest(
                questionId: question.id,
                deviceToken: deviceToken,
                rawText: answer,
                dwellMs: dwellMs
            ))
            submitResponse = result
            selfClusterId = result.clusterId
            selfSubmissionId = result.submissionId
            phase = .wordcloud(question)
        } catch {
            // Stay in question phase; red inline detail, no alert (§11.4).
            errorMsg = Self.submitErrorMessage(error)
        }
    }

    /// The server's `error` string verbatim (APIClient already falls back to
    /// "submit: <status>" inside APIError.server).
    private static func submitErrorMessage(_ error: Error) -> String {
        if case APIError.server(let message) = error {
            return message
        }
        return error.localizedDescription
    }

    // MARK: - Reveal completion (§2.6 — ordering is App-Review-relevant)

    /// markRevealSeen FIRST (a crash during the ad never re-shows the reveal),
    /// then the ad hook (Task 11), then today's question.
    @discardableResult
    func revealComplete() -> Task<Void, Never> {
        Task { [weak self] in
            guard let self else { return }
            if let yesterday = self.yesterday {
                self.revealStore.markRevealSeen(yesterday.id)
                await self.postRevealHook?()
            }
            await self.startLoadAttempt().value
        }
    }

    // MARK: - Delete-own-answer reset (§2.8)

    /// Wordcloud onDeleted: back to the question with a fresh dwell timer.
    func answerDeleted() {
        guard let question else { return }
        selfClusterId = nil
        selfSubmissionId = nil
        submitResponse = nil
        text = ""
        renderedAt = Date()
        phase = .question(question)
    }
}

// MARK: - Production wiring

extension HomeViewModel {
    /// Real dependencies: APIClient with the Firebase ID-token provider,
    /// Keychain-backed device token + reveal gate, Firestore live clusters,
    /// post-reveal interstitial (Task 11 — once per question, silent on any
    /// failure; revealComplete keeps the markSeen → hook → loadQuestion order).
    nonisolated static func live() -> HomeViewModel {
        let vm = HomeViewModel(
            api: APIClient(tokenProvider: { await AuthService.shared.idToken() }),
            deviceTokenProvider: DeviceTokenProvider(),
            revealStore: RevealStore(),
            clusterSource: FirestoreClusterSource()
        )
        // SwiftUI evaluates the StateObject factory on the main thread;
        // assumeIsolated lets this nonisolated factory finish the wiring.
        MainActor.assumeIsolated {
            vm.postRevealHook = { [weak vm] in
                guard let vm else { return }
                guard let questionId = await MainActor.run(body: { vm.yesterday?.id }) else { return }
                await AdManager.showPostRevealInterstitialIfNeeded(questionId: questionId)
            }
        }
        return vm
    }
}
