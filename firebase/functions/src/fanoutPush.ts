import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import { db, messaging } from "./lib/admin";
import { batchTokens } from "./lib/batchTokens";

interface QuestionDoc {
  status: string;
  text: string;
}

interface FanoutEvent {
  questionId?: string;
  before: QuestionDoc;
  after: QuestionDoc;
}

export async function runFanoutPush(
  firestore: Firestore,
  messagingClient: Messaging,
  event: FanoutEvent,
): Promise<void> {
  if (event.before.status === "live" || event.after.status !== "live") {
    return;
  }

  const snap = await firestore
    .collection("device_users")
    .where("fcm_token", "!=", null)
    .get();

  const tokens: string[] = snap.docs
    .map((d) => (d.data() as { fcm_token?: string | null }).fcm_token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  if (tokens.length === 0) {
    logger.info("fanoutPush: no devices to notify", { questionId: event.questionId });
    return;
  }

  const batches = batchTokens(tokens, 500);
  let success = 0;
  let failure = 0;

  for (const batch of batches) {
    const res = await messagingClient.sendEachForMulticast({
      tokens: batch,
      notification: {
        title: "🚨 the world is voting NOW",
        body: event.after.text,
      },
      data: event.questionId ? { questionId: event.questionId } : {},
    });
    success += res.successCount;
    failure += res.failureCount;
  }

  logger.info("fanoutPush: done", {
    questionId: event.questionId,
    batches: batches.length,
    success,
    failure,
  });
}

export const fanoutPush = onDocumentUpdated(
  { document: "questions/{questionId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data() as QuestionDoc | undefined;
    const after = event.data?.after.data() as QuestionDoc | undefined;
    if (!before || !after) return;
    await runFanoutPush(db(), messaging(), {
      questionId: event.params.questionId,
      before,
      after,
    });
  },
);
