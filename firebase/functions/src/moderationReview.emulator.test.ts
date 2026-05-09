import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

vi.mock("./lib/moderationReview", () => ({
  reviewSubmission: vi.fn(),
}));

import { runModerationReview } from "./moderationReview";
import { reviewSubmission } from "./lib/moderationReview";

let firestore: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT = "demo-relatably";
  if (getApps().length === 0) initializeApp({ projectId: "demo-relatably" });
  firestore = getFirestore();
});

async function clear(coll: string) {
  const snap = await firestore.collection(coll).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await clear("submissions");
  await clear("answer_clusters");
});

describe("runModerationReview (emulator)", () => {
  it("on toxic verdict: flips submission to blocked + decrements cluster count", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "block",
      score: 0.92,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 5,
      first_submission_at: FieldValue.serverTimestamp(),
    });
    await firestore.doc("submissions/sub-1").set({
      question_id: "q1",
      raw_text: "you idiot",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
      submitted_at: FieldValue.serverTimestamp(),
    });

    await runModerationReview(firestore, "sub-1");

    const sub = await firestore.doc("submissions/sub-1").get();
    expect(sub.data()?.moderation_status).toBe("blocked");
    expect(sub.data()?.tier2_score).toBeCloseTo(0.92, 2);
    expect(sub.data()?.tier2_reviewed_at).toBeDefined();

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    expect(cluster.data()?.submission_count).toBe(4);
  });

  it("on pass verdict: only stamps tier2_reviewed_at, leaves cluster + status alone", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "pass",
      score: 0.10,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 5,
    });
    await firestore.doc("submissions/sub-2").set({
      question_id: "q1",
      raw_text: "italy",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
    });

    await runModerationReview(firestore, "sub-2");

    const sub = await firestore.doc("submissions/sub-2").get();
    expect(sub.data()?.moderation_status).toBe("passed");
    expect(sub.data()?.tier2_reviewed_at).toBeDefined();
    expect(sub.data()?.tier2_score).toBeCloseTo(0.10, 2);

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    expect(cluster.data()?.submission_count).toBe(5);
  });

  it("idempotent: a second invocation on already-reviewed submission is a no-op", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "block",
      score: 0.92,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 5,
    });
    await firestore.doc("submissions/sub-3").set({
      question_id: "q1",
      raw_text: "you idiot",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
    });

    await runModerationReview(firestore, "sub-3");
    await runModerationReview(firestore, "sub-3");

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    // Decrement happened exactly once: 5 → 4, not 5 → 4 → 3.
    expect(cluster.data()?.submission_count).toBe(4);
    // reviewSubmission only called once (second invocation hit the guard).
    expect((reviewSubmission as any).mock.calls.length).toBe(1);
  });

  it("never lets cluster count go below 0", async () => {
    (reviewSubmission as any).mockResolvedValue({
      verdict: "block",
      score: 0.92,
      skipped: false,
    });

    await firestore.doc("answer_clusters/cluster-A").set({
      question_id: "q1",
      canonical_text: "italy",
      submission_count: 0,
    });
    await firestore.doc("submissions/sub-4").set({
      question_id: "q1",
      raw_text: "you idiot",
      normalized_cluster_id: "cluster-A",
      moderation_status: "passed",
    });

    await runModerationReview(firestore, "sub-4");

    const cluster = await firestore.doc("answer_clusters/cluster-A").get();
    expect(cluster.data()?.submission_count).toBe(0);
  });

  it("skips when submission has moderation_status != 'passed' (already blocked elsewhere)", async () => {
    await firestore.doc("submissions/sub-5").set({
      question_id: "q1",
      raw_text: "x",
      normalized_cluster_id: "cluster-A",
      moderation_status: "blocked",
    });

    await runModerationReview(firestore, "sub-5");

    expect((reviewSubmission as any).mock.calls.length).toBe(0);
  });
});
