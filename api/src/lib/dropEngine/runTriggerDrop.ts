import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import { computeFinalRanks } from "./computeFinalRanks";
import { runScoreReveal } from "./runScoreReveal";
import { runFanoutPush } from "./runFanoutPush";
import { getKillSwitch } from "../remoteConfig";

const TOP_N_TO_RANK = 100;

export interface TriggerDropResult {
  dropped: number;
  revealed: number;
  fanoutSent: number;
  fanoutFailed: number;
}

/**
 * Pure-function port of triggerDrop's `runTriggerDrop` from
 * firebase/functions/src/triggerDrop.ts. Differences from the original:
 *
 * - Now also takes a Messaging client and inlines runFanoutPush right after
 *   each scheduled -> live status flip. Previously a separate
 *   onDocumentUpdated Firestore trigger handled fanout asynchronously; this
 *   collapses the two into one synchronous run so a single GitHub Actions
 *   cron POST does the full drop cycle.
 * - Per-iteration try/catch around runScoreReveal + runFanoutPush so a
 *   failure on one due question doesn't skip the next. Replaces the
 *   trigger-retry semantic the original relied on.
 * - Logger swapped from firebase-functions to console.* (firebase-functions
 *   is not installed in api/).
 * - Returns aggregate counts so the cron route can surface them to GitHub
 *   Actions logs.
 */
export async function runTriggerDrop(
  firestore: Firestore,
  messagingClient: Messaging,
  now: Date,
): Promise<TriggerDropResult> {
  const result: TriggerDropResult = {
    dropped: 0,
    revealed: 0,
    fanoutSent: 0,
    fanoutFailed: 0,
  };

  const dueSnap = await firestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .where("scheduled_drop_at", "<=", Timestamp.fromDate(now))
    .orderBy("scheduled_drop_at", "asc")
    .get();

  if (dueSnap.empty) return result;

  const fanoutEnabled = await getKillSwitch("fanout_enabled", true);

  for (const dueDoc of dueSnap.docs) {
    try {
      // 1. Transaction A: flip previous live -> revealed. Returns the
      //    revealed question's id (or null if there was no previous live).
      const revealedQuestionId: string | null = await firestore.runTransaction(
        async (tx) => {
          const liveSnap = await tx.get(
            firestore
              .collection("questions")
              .where("status", "==", "live")
              .limit(1),
          );
          if (liveSnap.empty) return null;
          const live = liveSnap.docs[0];
          tx.update(live.ref, { status: "revealed" });
          return live.id;
        },
      );

      // 2. Outside any transaction: rank top-N clusters of the just-revealed.
      if (revealedQuestionId) {
        const clusterSnap = await firestore
          .collection("answer_clusters")
          .where("question_id", "==", revealedQuestionId)
          .orderBy("submission_count", "desc")
          .limit(TOP_N_TO_RANK)
          .get();

        const ranks = computeFinalRanks(
          clusterSnap.docs.map((d) => ({
            id: d.id,
            submission_count: (d.data() as { submission_count: number }).submission_count,
          })),
        );

        const writer = firestore.batch();
        for (const r of ranks) {
          writer.update(firestore.collection("answer_clusters").doc(r.id), {
            final_rank: r.final_rank,
            final_pct_of_total: r.final_pct_of_total,
          });
        }
        await writer.commit();
        await runScoreReveal(firestore, revealedQuestionId);
        result.revealed += 1;
      }

      // 3. Flip this scheduled question -> live.
      const dueData = dueDoc.data() as { text: string };
      await dueDoc.ref.update({ status: "live" });
      result.dropped += 1;

      // 4. NEW: inlined fanout. Was a separate onDocumentUpdated trigger
      //    in firebase/functions/src/fanoutPush.ts; now part of this run.
      if (fanoutEnabled) {
        const fanout = await runFanoutPush(firestore, messagingClient, {
          questionId: dueDoc.id,
          before: { status: "scheduled", text: dueData.text },
          after: { status: "live", text: dueData.text },
        });
        result.fanoutSent += fanout.sent;
        result.fanoutFailed += fanout.failed;
      }

      console.log("triggerDrop: dropped", {
        newLiveQuestionId: dueDoc.id,
        revealedQuestionId,
      });
    } catch (err) {
      // Per-iteration error isolation: log and keep going. Original Cloud
      // Function relied on retry-the-whole-trigger; with one synchronous
      // cron run we have to recover within the request.
      console.error("triggerDrop: per-iteration failure (continuing)", {
        questionId: dueDoc.id,
        error: (err as Error).message,
      });
    }
  }

  return result;
}
