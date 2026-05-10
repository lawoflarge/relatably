import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { runScoreReveal } from "./runScoreReveal";

// Emulator-backed; skipped automatically when FIRESTORE_EMULATOR_HOST is unset
// (default for the api/ unit-test run). Run with the emulator up to exercise.
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

let app: App;
let db: Firestore;

beforeAll(() => {
  if (!EMULATOR) return;
  app = initializeApp({ projectId: "relatably-test" }, "scoreRevealTest");
  db = getFirestore(app);
});

beforeEach(async () => {
  if (!EMULATOR) return;
  for (const c of ["questions", "answer_clusters", "submissions", "leaderboard_entries", "user_aggregates"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

afterAll(async () => {
  if (!EMULATOR) return;
  await deleteApp(app);
});

describe.skipIf(!EMULATOR)("runScoreReveal (emulator-backed)", () => {
  it("writes one leaderboard_entries doc per signed-in submitter with correct score components", async () => {
    const qid = "q-revealed-1";
    await db.collection("questions").doc(qid).set({
      text: "test",
      status: "revealed",
      source: "curated",
      created_at: Timestamp.now(),
    });

    const t0 = Timestamp.fromMillis(1_700_000_000_000);
    const t1 = Timestamp.fromMillis(1_700_000_001_000);
    const t2 = Timestamp.fromMillis(1_700_000_002_000);
    const t3 = Timestamp.fromMillis(1_700_000_003_000);
    const t4 = Timestamp.fromMillis(1_700_000_004_000);

    await db.collection("answer_clusters").doc("cluster-A").set({
      question_id: qid, canonical_text: "italy", submission_count: 5, first_submission_at: t0,
    });
    await db.collection("answer_clusters").doc("cluster-B").set({
      question_id: qid, canonical_text: "france", submission_count: 2, first_submission_at: t3,
    });

    await db.collection("submissions").doc("s-a-0").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-A", submitted_at: t0,
    });
    await db.collection("submissions").doc("s-a-1").set({
      question_id: qid, user_id: "user-1", normalized_cluster_id: "cluster-A", submitted_at: t1,
    });
    await db.collection("submissions").doc("s-a-2").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-A", submitted_at: t2,
    });
    await db.collection("submissions").doc("s-a-3").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-A", submitted_at: t3,
    });
    await db.collection("submissions").doc("s-a-4").set({
      question_id: qid, user_id: "user-2", normalized_cluster_id: "cluster-A", submitted_at: t4,
    });
    await db.collection("submissions").doc("s-b-0").set({
      question_id: qid, user_id: "user-3", normalized_cluster_id: "cluster-B", submitted_at: t3,
    });
    await db.collection("submissions").doc("s-b-1").set({
      question_id: qid, user_id: null, normalized_cluster_id: "cluster-B", submitted_at: t4,
    });

    await runScoreReveal(db, qid);

    const entries = await db.collection("leaderboard_entries").where("question_id", "==", qid).get();
    expect(entries.size).toBe(3);

    const byUser = new Map(entries.docs.map((d) => [d.data().user_id as string, d.data()]));

    const u1 = byUser.get("user-1") as any;
    expect(u1.rank_score_component).toBe(1000);
    expect(u1.early_bird_component).toBe(0);
    expect(u1.score).toBe(1000);

    const u2 = byUser.get("user-2") as any;
    expect(u2.rank_score_component).toBe(1000);
    expect(u2.early_bird_component).toBe(0);
    expect(u2.score).toBe(1000);

    const u3 = byUser.get("user-3") as any;
    expect(u3.rank_score_component).toBe(500);
    expect(u3.early_bird_component).toBe(500);
    expect(u3.score).toBe(1000);
  });

  it("computes daily_rank by score desc, submitted_at asc tiebreak", async () => {
    const qid = "q-daily-rank-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 2,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("answer_clusters").doc("c2").set({
      question_id: qid, canonical_text: "b", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(2000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: "user-A", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s2").set({
      question_id: qid, user_id: "user-B", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1500),
    });
    await db.collection("submissions").doc("s3").set({
      question_id: qid, user_id: "user-C", normalized_cluster_id: "c2",
      submitted_at: Timestamp.fromMillis(2000),
    });

    await runScoreReveal(db, qid);

    const entries = await db
      .collection("leaderboard_entries")
      .where("question_id", "==", qid)
      .orderBy("daily_rank", "asc")
      .get();

    expect(entries.docs.map((d) => d.data().user_id)).toEqual(["user-A", "user-B", "user-C"]);
    expect(entries.docs[0].data().score).toBe(1500);
    expect(entries.docs[1].data().score).toBe(1000);
    expect(entries.docs[2].data().score).toBe(1000);
  });

  it("bumps user_aggregates correctly: alltime, weekly, called-it wins, best rank", async () => {
    const qid = "q-aggregates-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: "user-X", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });
    await db.collection("user_aggregates").doc("user-X").set({
      alltime_score: 42, weekly_score: 10, num_called_it_wins: 0, best_daily_rank: 99,
    });

    await runScoreReveal(db, qid);

    const agg = await db.collection("user_aggregates").doc("user-X").get();
    const data = agg.data() as any;
    expect(data.alltime_score).toBe(42 + 1500);
    expect(data.weekly_score).toBe(10 + 1500);
    expect(data.num_called_it_wins).toBe(1);
    expect(data.best_daily_rank).toBe(1);
  });

  it("creates user_aggregates doc if it does not exist (first-time scorer)", async () => {
    const qid = "q-firstscore-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: "user-Y", normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });

    await runScoreReveal(db, qid);

    const agg = await db.collection("user_aggregates").doc("user-Y").get();
    expect(agg.exists).toBe(true);
    const data = agg.data() as any;
    expect(data.alltime_score).toBe(1500);
    expect(data.weekly_score).toBe(1500);
    expect(data.num_called_it_wins).toBe(1);
    expect(data.best_daily_rank).toBe(1);
  });

  it("is a no-op when there are no signed-in submissions", async () => {
    const qid = "q-noscore-1";
    await db.collection("questions").doc(qid).set({
      text: "test", status: "revealed", source: "curated", created_at: Timestamp.now(),
    });
    await db.collection("answer_clusters").doc("c1").set({
      question_id: qid, canonical_text: "a", submission_count: 1,
      first_submission_at: Timestamp.fromMillis(1000),
    });
    await db.collection("submissions").doc("s1").set({
      question_id: qid, user_id: null, normalized_cluster_id: "c1",
      submitted_at: Timestamp.fromMillis(1000),
    });

    await runScoreReveal(db, qid);

    const entries = await db.collection("leaderboard_entries").get();
    expect(entries.size).toBe(0);
  });
});
