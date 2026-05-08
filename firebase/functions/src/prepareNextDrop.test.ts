import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { runPrepareNextDrop } from "./prepareNextDrop";

let app: App;
let db: Firestore;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  app = initializeApp({ projectId: "relatably-test" }, "prepareNextDropTest");
  db = getFirestore(app);
});

beforeEach(async () => {
  // Wipe all questions between tests via a per-doc delete loop.
  const snap = await db.collection("questions").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
});

describe("prepareNextDrop (emulator-backed)", () => {
  it("assigns scheduled_drop_at to the oldest scheduled question without one", async () => {
    // Seed two scheduled questions, oldest first.
    const older = db.collection("questions").doc("older");
    await older.set({
      text: "older question",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = db.collection("questions").doc("newer");
    await newer.set({
      text: "newer question",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-02-01T00:00:00Z"),
    });

    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    await runPrepareNextDrop(db, fakeNow);

    const olderSnap = await older.get();
    const newerSnap = await newer.get();
    const olderData = olderSnap.data() as { scheduled_drop_at?: { toDate(): Date } };
    const newerData = newerSnap.data() as { scheduled_drop_at?: { toDate(): Date } };

    expect(olderData.scheduled_drop_at).toBeDefined();
    expect(newerData.scheduled_drop_at).toBeUndefined();
  });

  it("skips scheduled questions that already have a drop_at", async () => {
    const already = db.collection("questions").doc("already");
    await already.set({
      text: "already scheduled",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-01-01T00:00:00Z"),
      scheduled_drop_at: new Date("2026-05-09T15:00:00Z"),
    });
    const fresh = db.collection("questions").doc("fresh");
    await fresh.set({
      text: "fresh",
      status: "scheduled",
      source: "curated",
      created_at: new Date("2026-02-01T00:00:00Z"),
    });

    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    await runPrepareNextDrop(db, fakeNow);

    const alreadyData = (await already.get()).data() as {
      scheduled_drop_at?: { toDate(): Date };
    };
    const freshData = (await fresh.get()).data() as {
      scheduled_drop_at?: { toDate(): Date };
    };
    // 'already' must remain unchanged.
    expect(alreadyData.scheduled_drop_at!.toDate().toISOString()).toBe(
      "2026-05-09T15:00:00.000Z",
    );
    // 'fresh' must now have a drop_at.
    expect(freshData.scheduled_drop_at).toBeDefined();
  });

  it("is a no-op when no scheduled questions are queued", async () => {
    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    // Should not throw.
    await runPrepareNextDrop(db, fakeNow);
    const snap = await db.collection("questions").get();
    expect(snap.size).toBe(0);
  });

  it("ignores questions in 'live' or 'revealed' status", async () => {
    const live = db.collection("questions").doc("live");
    await live.set({
      text: "live",
      status: "live",
      source: "curated",
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
    const revealed = db.collection("questions").doc("revealed");
    await revealed.set({
      text: "revealed",
      status: "revealed",
      source: "curated",
      created_at: new Date("2026-01-02T00:00:00Z"),
    });

    const fakeNow = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    await runPrepareNextDrop(db, fakeNow);

    expect((await live.get()).data()?.scheduled_drop_at).toBeUndefined();
    expect((await revealed.get()).data()?.scheduled_drop_at).toBeUndefined();
  });
});
