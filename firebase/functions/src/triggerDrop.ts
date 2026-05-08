import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { computeFinalRanks } from "./lib/computeFinalRanks";

const TOP_N_TO_RANK = 100;

export async function runTriggerDrop(firestore: Firestore, now: Date): Promise<void> {
  const dueSnap = await firestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .where("scheduled_drop_at", "<=", Timestamp.fromDate(now))
    .orderBy("scheduled_drop_at", "asc")
    .get();

  if (dueSnap.empty) return;

  for (const dueDoc of dueSnap.docs) {
    // 1. Transaction A: flip previous live → revealed. Returns the revealed
    // question's id (or null if there was no previous live question).
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

    // 2. Outside any transaction: rank top-N clusters of the just-revealed question.
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
    }

    // 3. Flip this scheduled question → live. Single-doc unconditional update;
    // a transaction would add a round-trip without changing semantics.
    await dueDoc.ref.update({ status: "live" });

    logger.info("triggerDrop: dropped", {
      newLiveQuestionId: dueDoc.id,
      revealedQuestionId,
    });
  }
}

/**
 * v2 scheduled trigger — runs every minute. 1-minute granularity is acceptable
 * since `scheduled_drop_at` is a continuous random value; users see "the world
 * is voting" with up to 60s lag from the chosen instant.
 */
export const triggerDrop = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    await runTriggerDrop(db(), new Date());
  },
);
