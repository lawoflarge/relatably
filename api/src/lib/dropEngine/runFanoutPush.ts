import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import { batchTokens } from "./batchTokens";

interface QuestionDoc {
  status: string;
  text: string;
}

export interface FanoutEvent {
  questionId?: string;
  before: QuestionDoc;
  after: QuestionDoc;
}

export interface FanoutResult {
  sent: number;
  failed: number;
  batches: number;
}

/**
 * Sends an FCM push to every registered device when a question flips
 * scheduled -> live. Returns aggregate success/failure counts per call.
 *
 * Ported from firebase/functions/src/fanoutPush.ts (commit pre-pivot).
 * The onDocumentUpdated Firestore trigger wrapper is dropped — runTriggerDrop
 * now calls this function inline immediately after each status flip. Logger
 * swapped from firebase-functions to console.* (firebase-functions is not
 * installed in api/). Return value extended from void -> {sent,failed,batches}
 * so the cron route can surface counts to the GitHub Actions logs.
 */
export async function runFanoutPush(
  firestore: Firestore,
  messagingClient: Messaging,
  event: FanoutEvent,
): Promise<FanoutResult> {
  if (event.before.status === "live" || event.after.status !== "live") {
    return { sent: 0, failed: 0, batches: 0 };
  }

  const snap = await firestore
    .collection("device_users")
    .where("fcm_token", "!=", null)
    .get();

  const tokens: string[] = snap.docs
    .map((d) => (d.data() as { fcm_token?: string | null }).fcm_token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  if (tokens.length === 0) {
    console.log("fanoutPush: no devices to notify", { questionId: event.questionId });
    return { sent: 0, failed: 0, batches: 0 };
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

  console.log("fanoutPush: done", {
    questionId: event.questionId,
    batches: batches.length,
    success,
    failure,
  });

  return { sent: success, failed: failure, batches: batches.length };
}
