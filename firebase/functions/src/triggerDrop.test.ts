import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { runTriggerDrop } from "./triggerDrop";

let app: App;
let db: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: "relatably-test" }, "triggerDropTest");
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  for (const col of ["questions", "answer_clusters"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("triggerDrop (emulator-backed)", () => {
  it("flips previous live → revealed and scheduled → live", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-prev").set({
      text: "yesterday",
      status: "live",
      source: "curated",
      created_at: new Date("2026-05-07T00:00:00Z"),
    });
    await db.collection("questions").doc("q-next").set({
      text: "today",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    await runTriggerDrop(db, now);

    const prev = (await db.collection("questions").doc("q-prev").get()).data();
    const next = (await db.collection("questions").doc("q-next").get()).data();
    expect(prev?.status).toBe("revealed");
    expect(next?.status).toBe("live");
  });

  it("skips questions whose scheduled_drop_at is still in the future", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-future").set({
      text: "future",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() + 60 * 60 * 1000)),
    });

    await runTriggerDrop(db, now);

    const after = (await db.collection("questions").doc("q-future").get()).data();
    expect(after?.status).toBe("scheduled");
  });

  it("computes final_rank and final_pct_of_total for top-100 clusters of revealed question", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-prev").set({
      text: "yesterday",
      status: "live",
      source: "curated",
      created_at: new Date("2026-05-07T00:00:00Z"),
    });
    await db.collection("questions").doc("q-next").set({
      text: "today",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    // Seed clusters under q-prev with varying counts.
    const clusters: { id: string; count: number }[] = [
      { id: "c-200", count: 200 },
      { id: "c-150", count: 150 },
      { id: "c-100", count: 100 },
    ];
    for (const c of clusters) {
      await db.collection("answer_clusters").doc(c.id).set({
        question_id: "q-prev",
        canonical_text: c.id,
        submission_count: c.count,
        first_submission_at: new Date("2026-05-07T01:00:00Z"),
      });
    }

    await runTriggerDrop(db, now);

    const c200 = (await db.collection("answer_clusters").doc("c-200").get()).data();
    const c150 = (await db.collection("answer_clusters").doc("c-150").get()).data();
    const c100 = (await db.collection("answer_clusters").doc("c-100").get()).data();
    expect(c200?.final_rank).toBe(1);
    expect(c150?.final_rank).toBe(2);
    expect(c100?.final_rank).toBe(3);
    expect(c200?.final_pct_of_total).toBeCloseTo(200 / 450, 5);
  });

  it("succeeds when there is no previous live question (first-ever drop)", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await db.collection("questions").doc("q-first").set({
      text: "first ever",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    await runTriggerDrop(db, now);

    const first = (await db.collection("questions").doc("q-first").get()).data();
    expect(first?.status).toBe("live");
  });
});
