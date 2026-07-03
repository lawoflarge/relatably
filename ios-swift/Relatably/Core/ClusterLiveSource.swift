import FirebaseCore
import FirebaseFirestore
import Foundation
import os

// Live answer-cluster source — port of the RN Firestore onSnapshot listener
// (ios/app/(tabs)/index.tsx via docs/superpowers/plans/rn-extraction/home-flow.md §2.4).
//
// Query, verbatim from the RN app:
//   collection "answer_clusters"
//     .where("question_id", ==, questionId)
//     .orderBy("submission_count", desc)
//     .limit(100)
// Doc fields: `canonical_text` (String), `submission_count` (Int).
// Listener errors are LOGGED ONLY — the last delivered data stays on screen
// (never crash, never deliver empty over good data).

/// Cancellation token for a live listener. Task 9/10 view models hold this and
/// call `stop()` when the question changes or the screen goes away.
final class ClusterListenerHandle {
    private var onStop: (() -> Void)?

    init(onStop: (() -> Void)? = nil) {
        self.onStop = onStop
    }

    /// Idempotent — safe to call multiple times.
    func stop() {
        let stop = onStop
        onStop = nil
        stop?()
    }

    deinit { stop() }
}

protocol ClusterLiveSource {
    /// Starts listening for clusters of `questionId`. `onChange` is delivered on
    /// the main actor with the full latest snapshot (not a diff).
    func listen(
        questionId: String,
        onChange: @escaping @MainActor ([WordcloudCluster]) -> Void
    ) -> ClusterListenerHandle
}

// MARK: - Firestore (production)

final class FirestoreClusterSource: ClusterLiveSource {

    private let logger = Logger(subsystem: "co.relatably.app", category: "FirestoreClusterSource")

    func listen(
        questionId: String,
        onChange: @escaping @MainActor ([WordcloudCluster]) -> Void
    ) -> ClusterListenerHandle {
        // Never crash when Firebase failed to configure (missing plist etc.) —
        // Firestore.firestore() would raise. The wordcloud then simply has no
        // live data, which downstream demo fallbacks (Task 10) cover.
        guard FirebaseBootstrap.isConfigured else {
            logger.error("Firebase not configured — cluster listener not started")
            return ClusterListenerHandle()
        }

        let query = Firestore.firestore()
            .collection("answer_clusters")
            .whereField("question_id", isEqualTo: questionId)
            .order(by: "submission_count", descending: true)
            .limit(to: 100)

        let registration = query.addSnapshotListener { [logger] snapshot, error in
            if let error {
                // RN parity: console.warn only; keep last delivered data.
                logger.warning("clusters listener error: \(error.localizedDescription)")
                return
            }
            guard let snapshot else { return }
            let next = snapshot.documents.map { doc in
                let data = doc.data()
                return WordcloudCluster(
                    id: doc.documentID,
                    text: data["canonical_text"] as? String ?? "",
                    count: data["submission_count"] as? Int ?? 0
                )
            }
            Task { @MainActor in onChange(next) }
        }

        return ClusterListenerHandle { registration.remove() }
    }
}

// MARK: - Static (tests / previews)

/// Delivers a fixed cluster set once, then nothing. No Firebase involved.
struct StaticClusterSource: ClusterLiveSource {
    let clusters: [WordcloudCluster]

    func listen(
        questionId: String,
        onChange: @escaping @MainActor ([WordcloudCluster]) -> Void
    ) -> ClusterListenerHandle {
        let clusters = clusters
        Task { @MainActor in onChange(clusters) }
        return ClusterListenerHandle()
    }
}
