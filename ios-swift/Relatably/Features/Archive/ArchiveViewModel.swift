import Foundation

// Archive state — 1:1 port of the RN archive tab container
// (ios/app/(tabs)/archive.tsx) and ArchiveDetailScreen state
// (ios/src/screens/ArchiveDetailScreen.tsx) per
// docs/superpowers/plans/rn-extraction/archive.md §3/§5.
//
// Pagination semantics (§3, verbatim): ONE `loading` flag gates both the
// initial fetch and load-more (no separate loadingMore — there is no spinner
// on this tab at all, §9.2); loadMore is a no-op without a cursor or while
// loading; pages APPEND with no dedupe; `next_cursor == null` ends
// pagination; initial-load failure alerts "couldn't load archive" while
// pagination errors are silent and retryable.

// MARK: - ArchiveAPI (the two unauthenticated GETs this feature uses)

/// Slice of APIClient the Archive feature needs — injectable for tests.
protocol ArchiveAPI {
    func fetchArchive(cursor: String?) async throws -> ArchivePage
    func fetchArchiveDetail(questionId: String) async throws -> ArchiveDetail
}

extension APIClient: ArchiveAPI {}

// MARK: - Store slice (detail screen reads hidden ids once on mount, §5.1)

protocol ArchiveHiddenReading {
    func hiddenClusterIds() -> Set<String>
}

extension HiddenContentStore: ArchiveHiddenReading {}

// MARK: - ArchiveViewModel (list)

@MainActor
final class ArchiveViewModel: ObservableObject {

    /// RN Alert.alert title on initial-load failure (title only, §3).
    static let loadErrorTitle = "couldn't load archive"

    @Published private(set) var tiles: [ArchiveTile] = []
    @Published private(set) var nextCursor: String?
    /// RN's single `loading` flag — inits false, gates pagination only
    /// (while true and tiles empty the UI shows the empty state, §9.2).
    @Published private(set) var loading = false
    /// Non-nil-equivalent of the RN failure alert; view presents
    /// `.alert(Self.loadErrorTitle)`.
    @Published var showLoadError = false

    private let api: ArchiveAPI

    /// nonisolated so `ArchiveViewModel.live()` can be a default argument of
    /// a (nonisolated) View initializer; only assigns stored properties.
    nonisolated init(api: ArchiveAPI) {
        self.api = api
    }

    // MARK: Boot (RN mount effect — the kept-alive tab mounts exactly once)

    private var hasBooted = false

    func bootIfNeeded() {
        guard !hasBooted else { return }
        hasBooted = true
        boot()
    }

    @discardableResult
    func boot() -> Task<Void, Never> {
        loading = true
        return Task { [weak self] in
            guard let self else { return }
            do {
                let page = try await self.api.fetchArchive(cursor: nil)
                self.tiles = page.tiles
                self.nextCursor = page.nextCursor
            } catch {
                self.showLoadError = true // Alert.alert("couldn't load archive")
            }
            self.loading = false
        }
    }

    // MARK: Pagination (§3 onLoadMore verbatim)

    @discardableResult
    func loadMore() -> Task<Void, Never> {
        // RN: `if (!nextCursor || loading) return;` — the loading guard is
        // what prevents a double-fetch from repeated end-reached triggers.
        guard let cursor = nextCursor, !loading else { return Task {} }
        loading = true
        return Task { [weak self] in
            guard let self else { return }
            do {
                let page = try await self.api.fetchArchive(cursor: cursor)
                self.tiles += page.tiles // append-only, no dedupe (RN spread)
                self.nextCursor = page.nextCursor
            } catch {
                // best-effort; user can scroll back up and try again (silent, §3)
            }
            self.loading = false
        }
    }

    // MARK: Long-press → share (§3)

    /// RN long-press renders ShareCardVerdict offscreen and runs the
    /// trackShare → capture → share-sheet pipeline. Task 16 (Core/ShareCard)
    /// wires that here; until then this hook is a documented no-op so the
    /// gesture (with its haptic in ArchiveView) is already in place.
    func tileLongPressed(_ tile: ArchiveTile) {
        // Task 16: shareCardImage(banner_type: "verdict",
        //          question_id: tile.questionId, share_target: "system")
    }
}

// MARK: - ArchiveDetailViewModel

@MainActor
final class ArchiveDetailViewModel: ObservableObject {

    /// RN State union (§5.1): loading | ready(detail) | error.
    enum State: Equatable {
        case loading
        case ready(ArchiveDetail)
        case error
    }

    @Published private(set) var state: State = .loading
    /// Loaded ONCE on boot (§5.1 — hides done elsewhere while this screen is
    /// alive don't propagate, §9.8); afterwards only handleHidden adds.
    @Published private(set) var hiddenIds: Set<String> = []

    let questionId: String
    private let api: ArchiveAPI
    private let store: ArchiveHiddenReading

    nonisolated init(questionId: String, api: ArchiveAPI, store: ArchiveHiddenReading) {
        self.questionId = questionId
        self.api = api
        self.store = store
    }

    private var hasBooted = false

    func bootIfNeeded() {
        guard !hasBooted else { return }
        hasBooted = true
        boot()
    }

    @discardableResult
    func boot() -> Task<Void, Never> {
        hiddenIds = store.hiddenClusterIds()
        state = .loading
        return Task { [weak self] in
            guard let self else { return }
            do {
                let detail = try await self.api.fetchArchiveDetail(questionId: self.questionId)
                self.state = .ready(detail)
            } catch {
                self.state = .error // incl. 404 — fetchArchiveDetail throws
            }
        }
    }

    /// §5.2 verbatim predicate: real clusters minus hidden; if THAT is empty
    /// (no clusters, or all hidden) → demo clusters minus hidden. Guideline
    /// 1.2 fallback — a revealed drop with no surviving answers still shows
    /// innocuous demo answers so report / hide / block is always exercisable.
    /// Do not remove.
    var visibleClusters: [ArchiveDetailCluster] {
        guard case .ready(let detail) = state else { return [] }
        let real = detail.topClusters.filter { !hiddenIds.contains($0.id) }
        if !real.isEmpty { return real }
        return DEMO_ARCHIVE_CLUSTERS.filter { !hiddenIds.contains($0.id) }
    }

    /// §5.4: the headline is DERIVED from the top visible cluster (not a
    /// server verdict field) — hiding rank 1 changes it; all-hidden → "".
    var verdict: String {
        visibleClusters.first?.canonicalText ?? ""
    }

    /// ClusterModeration.onHidden hook — instant local removal (§5.2).
    func handleHidden(id: String) {
        hiddenIds.insert(id)
    }

    // MARK: Formatting (§5.4)

    /// RN `(pct * 100).toFixed(1) + "%"` → e.g. 0.31 → "31.0%".
    static func pctLabel(_ fraction: Double) -> String {
        String(format: "%.1f%%", fraction * 100)
    }

    /// RN `new Date(iso).toLocaleDateString()` — numeric date in the device
    /// locale with the FULL year (JS default), so a localized "Mdyyyy"
    /// template rather than DateFormatter's 2-digit-year `.short` style.
    /// Unparseable input mirrors JS's Invalid Date rendering.
    static func formatDate(
        iso: String,
        locale: Locale = .current,
        timeZone: TimeZone = .current
    ) -> String {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = withFractional.date(from: iso) ?? plain.date(from: iso) else {
            return "Invalid Date"
        }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate("Mdyyyy")
        return formatter.string(from: date)
    }
}

// MARK: - Production wiring

extension ArchiveViewModel {
    /// Real dependencies. Both archive GETs are unauthenticated (§1), but the
    /// shared APIClient carries the token provider like every other feature.
    nonisolated static func live() -> ArchiveViewModel {
        ArchiveViewModel(api: APIClient(tokenProvider: { await AuthService.shared.idToken() }))
    }
}

extension ArchiveDetailViewModel {
    nonisolated static func live(questionId: String) -> ArchiveDetailViewModel {
        ArchiveDetailViewModel(
            questionId: questionId,
            api: APIClient(tokenProvider: { await AuthService.shared.idToken() }),
            store: HiddenContentStore()
        )
    }
}
