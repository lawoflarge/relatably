import { describe, it, expect, vi, beforeEach } from "vitest";
import { runPrepareNextDrop } from "./runPrepareNextDrop";

interface FakeDoc {
  id: string;
  data: () => Record<string, unknown>;
  ref: { update: ReturnType<typeof vi.fn> };
}

function makeFirestore(docs: FakeDoc[]): {
  firestore: { collection: ReturnType<typeof vi.fn> };
  updates: Record<string, ReturnType<typeof vi.fn>>;
} {
  const updates: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const d of docs) updates[d.id] = d.ref.update;
  const get = vi.fn(async () => ({ docs }));
  const orderBy = vi.fn(() => ({ get }));
  const where = vi.fn(() => ({ orderBy }));
  const collection = vi.fn(() => ({ where }));
  return { firestore: { collection }, updates };
}

function fakeDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return {
    id,
    data: () => data,
    ref: { update: vi.fn(async () => undefined) },
  };
}

describe("runPrepareNextDrop", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("assigns scheduled_drop_at to the first scheduled question without one", async () => {
    const older = fakeDoc("older", { status: "scheduled" });
    const newer = fakeDoc("newer", { status: "scheduled" });
    const { firestore } = makeFirestore([older, newer]);

    const now = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    const result = await runPrepareNextDrop(firestore as never, now);

    expect(older.ref.update).toHaveBeenCalledTimes(1);
    expect(newer.ref.update).not.toHaveBeenCalled();
    expect(result.scheduled?.questionId).toBe("older");
    expect(result.scheduled?.dropAt).toMatch(/^2026-05-09T/);
  });

  it("skips scheduled questions that already have a drop_at", async () => {
    const already = fakeDoc("already", {
      status: "scheduled",
      scheduled_drop_at: { toDate: () => new Date() },
    });
    const fresh = fakeDoc("fresh", { status: "scheduled" });
    const { firestore } = makeFirestore([already, fresh]);

    const now = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    const result = await runPrepareNextDrop(firestore as never, now);

    expect(already.ref.update).not.toHaveBeenCalled();
    expect(fresh.ref.update).toHaveBeenCalledTimes(1);
    expect(result.scheduled?.questionId).toBe("fresh");
  });

  it("returns scheduled:null when every scheduled question already has a drop_at", async () => {
    const a = fakeDoc("a", { status: "scheduled", scheduled_drop_at: { toDate: () => new Date() } });
    const b = fakeDoc("b", { status: "scheduled", scheduled_drop_at: { toDate: () => new Date() } });
    const { firestore } = makeFirestore([a, b]);

    const result = await runPrepareNextDrop(firestore as never, new Date());

    expect(result.scheduled).toBeNull();
    expect(a.ref.update).not.toHaveBeenCalled();
    expect(b.ref.update).not.toHaveBeenCalled();
  });

  it("returns scheduled:null when no scheduled questions exist", async () => {
    const { firestore } = makeFirestore([]);
    const result = await runPrepareNextDrop(firestore as never, new Date());
    expect(result.scheduled).toBeNull();
  });

  it("writes a Timestamp value (not a raw Date) to Firestore", async () => {
    const q = fakeDoc("q", { status: "scheduled" });
    const { firestore } = makeFirestore([q]);
    await runPrepareNextDrop(firestore as never, new Date(Date.UTC(2026, 4, 8)));
    const arg = q.ref.update.mock.calls[0][0] as { scheduled_drop_at: unknown };
    expect(arg.scheduled_drop_at).toMatchObject({
      _seconds: expect.any(Number),
    });
  });
});
