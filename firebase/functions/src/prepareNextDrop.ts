import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { pickDropAt } from "./lib/pickDropAt";

/**
 * Pure runner — separated from the scheduled-trigger wrapper so it can be
 * driven from tests with an injected db + now.
 *
 * Picks the OLDEST scheduled question that has no scheduled_drop_at, and
 * assigns a uniform-random drop time within the next-day UTC window.
 * No-op if nothing is eligible.
 */
export async function runPrepareNextDrop(
  firestore: Firestore,
  now: Date,
): Promise<void> {
  const snap = await firestore
    .collection("questions")
    .where("status", "==", "scheduled")
    .orderBy("created_at", "asc")
    .get();

  const eligible = snap.docs.find(
    (d) => (d.data() as { scheduled_drop_at?: unknown }).scheduled_drop_at === undefined,
  );
  if (!eligible) {
    logger.error("prepareNextDrop: no scheduled question without drop_at — admin must seed more");
    return;
  }

  const dropAt = pickDropAt(now);
  await eligible.ref.update({
    scheduled_drop_at: Timestamp.fromDate(dropAt),
  });
  logger.info("prepareNextDrop: scheduled question", {
    questionId: eligible.id,
    dropAt: dropAt.toISOString(),
  });
}

/**
 * v2 scheduled trigger — runs nightly at 00:00 UTC.
 */
export const prepareNextDrop = onSchedule(
  {
    schedule: "0 0 * * *", // every day at 00:00 UTC
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    await runPrepareNextDrop(db(), new Date());
  },
);
