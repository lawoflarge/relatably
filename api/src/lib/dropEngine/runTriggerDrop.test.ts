import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

// ---- Mocked-in-isolation tests (always run) -----------------------------
// These cover the new behaviors introduced by the api/ port:
//   * fanout_enabled kill-switch gating
//   * per-iteration error isolation (one failure doesn't skip next due q)

const { getKillSwitchMock, runScoreRevealMock, runFanoutPushMock } = vi.hoisted(() => ({
  getKillSwitchMock: vi.fn(),
  runScoreRevealMock: vi.fn(),
  runFanoutPushMock: vi.fn(),
}));

vi.mock("../remoteConfig", () => ({
  getKillSwitch: getKillSwitchMock,
}));
vi.mock("./runScoreReveal", () => ({
  runScoreReveal: runScoreRevealMock,
}));
vi.mock("./runFanoutPush", () => ({
  runFanoutPush: runFanoutPushMock,
}));

import { runTriggerDrop } from "./runTriggerDrop";

function makeDueDoc(id: string, text: string) {
  return {
    id,
    ref: { update: vi.fn().mockResolvedValue(undefined) },
    data: () => ({ text }),
  };
}

function makeFirestoreWithDue(dueDocs: ReturnType<typeof makeDueDoc>[], opts?: {
  liveDocId?: string;
  clusterDocs?: { id: string; submission_count: number }[];
}) {
  const liveDocs = opts?.liveDocId
    ? [{ id: opts.liveDocId, ref: { update: vi.fn().mockResolvedValue(undefined) } }]
    : [];
  const clusterDocs = (opts?.clusterDocs ?? []).map((c) => ({
    id: c.id,
    data: () => ({ submission_count: c.submission_count }),
  }));

  const firestore: any = {
    collection: vi.fn((name: string) => {
      if (name === "questions") {
        return {
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: dueDocs.length === 0, docs: dueDocs }),
        };
      }
      if (name === "answer_clusters") {
        return {
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs: clusterDocs }),
          doc: vi.fn().mockReturnValue({ id: "any" }),
        };
      }
      return {} as any;
    }),
    runTransaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = {
        get: vi.fn().mockResolvedValue({
          empty: liveDocs.length === 0,
          docs: liveDocs,
        }),
        update: vi.fn(),
      };
      return await cb(tx);
    }),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  };

  return firestore;
}

describe("runTriggerDrop (mocked)", () => {
  beforeEach(() => {
    getKillSwitchMock.mockReset();
    runScoreRevealMock.mockReset();
    runFanoutPushMock.mockReset();
    runFanoutPushMock.mockResolvedValue({ sent: 0, failed: 0, batches: 0 });
    runScoreRevealMock.mockResolvedValue(undefined);
  });

  it("returns zero counts when no due questions", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    const fs = makeFirestoreWithDue([]);
    const messaging = { sendEachForMulticast: vi.fn() } as any;

    const r = await runTriggerDrop(fs, messaging, new Date());
    expect(r).toEqual({ dropped: 0, revealed: 0, fanoutSent: 0, fanoutFailed: 0 });
    expect(runFanoutPushMock).not.toHaveBeenCalled();
  });

  it("calls runFanoutPush after status flip when fanout_enabled is true", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    runFanoutPushMock.mockResolvedValue({ sent: 42, failed: 1, batches: 1 });
    const due = makeDueDoc("q-new", "the question text");
    const fs = makeFirestoreWithDue([due]);
    const messaging = { sendEachForMulticast: vi.fn() } as any;

    const r = await runTriggerDrop(fs, messaging, new Date());

    expect(runFanoutPushMock).toHaveBeenCalledTimes(1);
    expect(runFanoutPushMock.mock.calls[0][2]).toEqual({
      questionId: "q-new",
      before: { status: "scheduled", text: "the question text" },
      after: { status: "live", text: "the question text" },
    });
    expect(r.dropped).toBe(1);
    expect(r.fanoutSent).toBe(42);
    expect(r.fanoutFailed).toBe(1);
  });

  it("does NOT call runFanoutPush when fanout_enabled kill-switch is false", async () => {
    getKillSwitchMock.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === "fanout_enabled") return false;
      return fallback;
    });
    const due = makeDueDoc("q-new", "the question text");
    const fs = makeFirestoreWithDue([due]);
    const messaging = { sendEachForMulticast: vi.fn() } as any;

    const r = await runTriggerDrop(fs, messaging, new Date());

    expect(runFanoutPushMock).not.toHaveBeenCalled();
    expect(r.dropped).toBe(1);
    expect(r.fanoutSent).toBe(0);
    expect(r.fanoutFailed).toBe(0);
  });

  it("isolates per-iteration failures: one runFanoutPush throw doesn't skip the next due question", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    // First call throws, second succeeds.
    runFanoutPushMock
      .mockRejectedValueOnce(new Error("FCM API down"))
      .mockResolvedValueOnce({ sent: 5, failed: 0, batches: 1 });

    const due1 = makeDueDoc("q-1", "first");
    const due2 = makeDueDoc("q-2", "second");
    const fs = makeFirestoreWithDue([due1, due2]);
    const messaging = { sendEachForMulticast: vi.fn() } as any;

    const r = await runTriggerDrop(fs, messaging, new Date());

    expect(runFanoutPushMock).toHaveBeenCalledTimes(2);
    // Both due docs got their status flip attempt
    expect(due1.ref.update).toHaveBeenCalledWith({ status: "live" });
    expect(due2.ref.update).toHaveBeenCalledWith({ status: "live" });
    // First iteration aborted at the fanout step (after dropped++), second
    // succeeded fully. Order: dropped++ then fanout, so dropped count = 2.
    expect(r.dropped).toBe(2);
    expect(r.fanoutSent).toBe(5);
  });

  it("calls runScoreReveal when there is a previous live question", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    const due = makeDueDoc("q-new", "next");
    const fs = makeFirestoreWithDue([due], {
      liveDocId: "q-prev",
      clusterDocs: [
        { id: "c1", submission_count: 100 },
        { id: "c2", submission_count: 50 },
      ],
    });
    const messaging = { sendEachForMulticast: vi.fn() } as any;

    const r = await runTriggerDrop(fs, messaging, new Date());

    expect(runScoreRevealMock).toHaveBeenCalledTimes(1);
    expect(runScoreRevealMock.mock.calls[0][1]).toBe("q-prev");
    expect(r.revealed).toBe(1);
    expect(r.dropped).toBe(1);
  });

  it("skips runScoreReveal on first-ever drop (no previous live)", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    const due = makeDueDoc("q-first", "first ever");
    const fs = makeFirestoreWithDue([due]); // no liveDocId
    const messaging = { sendEachForMulticast: vi.fn() } as any;

    const r = await runTriggerDrop(fs, messaging, new Date());

    expect(runScoreRevealMock).not.toHaveBeenCalled();
    expect(r.revealed).toBe(0);
    expect(r.dropped).toBe(1);
  });
});

// ---- Emulator-backed tests (skipped when emulator is not running) -------
// Direct port of firebase/functions/src/triggerDrop.test.ts. Run by setting
// FIRESTORE_EMULATOR_HOST=localhost:8080 and starting the emulator.

const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;

let emuApp: App;
let emuDb: Firestore;

beforeAll(() => {
  if (!EMULATOR) return;
  emuApp = initializeApp({ projectId: "relatably-test" }, "triggerDropTest");
  emuDb = getFirestore(emuApp);
});

afterAll(async () => {
  if (!EMULATOR) return;
  await deleteApp(emuApp);
});

describe.skipIf(!EMULATOR)("runTriggerDrop (emulator-backed)", () => {
  const fakeMessaging = { sendEachForMulticast: vi.fn() } as any;

  beforeEach(async () => {
    for (const col of ["questions", "answer_clusters"]) {
      const snap = await emuDb.collection(col).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    // Suppress fanout for emulator tests — we're verifying drop algo, not push.
    getKillSwitchMock.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === "fanout_enabled") return false;
      return fallback;
    });
    runScoreRevealMock.mockResolvedValue(undefined);
  });

  it("flips previous live → revealed and scheduled → live", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await emuDb.collection("questions").doc("q-prev").set({
      text: "yesterday",
      status: "live",
      source: "curated",
      created_at: new Date("2026-05-07T00:00:00Z"),
    });
    await emuDb.collection("questions").doc("q-next").set({
      text: "today",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    await runTriggerDrop(emuDb, fakeMessaging, now);

    const prev = (await emuDb.collection("questions").doc("q-prev").get()).data();
    const next = (await emuDb.collection("questions").doc("q-next").get()).data();
    expect(prev?.status).toBe("revealed");
    expect(next?.status).toBe("live");
  });

  it("skips questions whose scheduled_drop_at is still in the future", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await emuDb.collection("questions").doc("q-future").set({
      text: "future",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() + 60 * 60 * 1000)),
    });

    await runTriggerDrop(emuDb, fakeMessaging, now);

    const after = (await emuDb.collection("questions").doc("q-future").get()).data();
    expect(after?.status).toBe("scheduled");
  });

  it("computes final_rank and final_pct_of_total for top-100 clusters of revealed question", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await emuDb.collection("questions").doc("q-prev").set({
      text: "yesterday",
      status: "live",
      source: "curated",
      created_at: new Date("2026-05-07T00:00:00Z"),
    });
    await emuDb.collection("questions").doc("q-next").set({
      text: "today",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    const clusters: { id: string; count: number }[] = [
      { id: "c-200", count: 200 },
      { id: "c-150", count: 150 },
      { id: "c-100", count: 100 },
    ];
    for (const c of clusters) {
      await emuDb.collection("answer_clusters").doc(c.id).set({
        question_id: "q-prev",
        canonical_text: c.id,
        submission_count: c.count,
        first_submission_at: new Date("2026-05-07T01:00:00Z"),
      });
    }

    await runTriggerDrop(emuDb, fakeMessaging, now);

    const c200 = (await emuDb.collection("answer_clusters").doc("c-200").get()).data();
    const c150 = (await emuDb.collection("answer_clusters").doc("c-150").get()).data();
    const c100 = (await emuDb.collection("answer_clusters").doc("c-100").get()).data();
    expect(c200?.final_rank).toBe(1);
    expect(c150?.final_rank).toBe(2);
    expect(c100?.final_rank).toBe(3);
    expect(c200?.final_pct_of_total).toBeCloseTo(200 / 450, 5);
  });

  it("succeeds when there is no previous live question (first-ever drop)", async () => {
    const now = new Date(Date.UTC(2026, 4, 8, 14, 0, 0));

    await emuDb.collection("questions").doc("q-first").set({
      text: "first ever",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-05-08T00:00:00Z"),
      scheduled_drop_at: Timestamp.fromDate(new Date(now.getTime() - 60 * 1000)),
    });

    await runTriggerDrop(emuDb, fakeMessaging, now);

    const first = (await emuDb.collection("questions").doc("q-first").get()).data();
    expect(first?.status).toBe("live");
  });
});
