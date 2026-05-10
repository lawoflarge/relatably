import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { pickDropAt } from "./pickDropAt";

/**
 * Picks the oldest scheduled question that has no `scheduled_drop_at`,
 * and assigns a uniform-random drop time within the next-day UTC window.
 * No-op if nothing is eligible.
 *
 * Ported from firebase/functions/src/prepareNextDrop.ts (Phase 6 pivot).
 * The Cloud Function wrapper is dropped; this pure function is called
 * by /api/cron/prepare-next-drop, fired daily at 00:00 UTC by GH Actions.
 */
export async function runPrepareNextDrop(
  firestore: Firestore,
  now: Date,
): Promise<{ scheduled: { questionId: string; dropAt: string } | null }> {
  const snap = await firestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .orderBy("created_at", "asc")
    .get();

  const eligible = snap.docs.find(
    (d) => (d.data() as { scheduled_drop_at?: unknown }).scheduled_drop_at === undefined,
  );
  if (!eligible) {
    console.error("prepareNextDrop: no scheduled question without drop_at; admin must seed more");
    return { scheduled: null };
  }

  const dropAt = pickDropAt(now);
  await eligible.ref.update({
    scheduled_drop_at: Timestamp.fromDate(dropAt),
  });
  console.log("prepareNextDrop: scheduled question", {
    questionId: eligible.id,
    dropAt: dropAt.toISOString(),
  });
  return { scheduled: { questionId: eligible.id, dropAt: dropAt.toISOString() } };
}
