import { describe, it, expect, vi, beforeEach } from "vitest";
import { runOnce } from "./idempotency";

const { fakeFirestore, fakeRef, txn, txnGet, txnSet, refUpdate } = vi.hoisted(() => {
  const txnGet = vi.fn();
  const txnSet = vi.fn();
  const refUpdate = vi.fn();
  const fakeRef = { update: refUpdate };
  const collectionDoc = vi.fn(() => fakeRef);
  const collection = vi.fn(() => ({ doc: collectionDoc }));
  const txn = vi.fn(async (cb: (t: { get: typeof txnGet; set: typeof txnSet }) => Promise<unknown>) => {
    return await cb({ get: txnGet, set: txnSet });
  });
  return {
    fakeFirestore: { collection, runTransaction: txn },
    fakeRef,
    txn,
    txnGet,
    txnSet,
    refUpdate,
  };
});

vi.mock("./firebase", () => ({
  adminFirestore: fakeFirestore,
}));

describe("runOnce (api/)", () => {
  beforeEach(() => {
    txnGet.mockReset();
    txnSet.mockReset();
    refUpdate.mockReset();
  });

  it("runs the inner fn when no guard doc exists yet", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const inner = vi.fn(async () => "ok");
    const result = await runOnce("test:abc", inner);
    expect(result).toBe("ok");
    expect(inner).toHaveBeenCalledTimes(1);
    expect(txnSet).toHaveBeenCalledTimes(1);
    expect(refUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips and returns null when guard doc already exists", async () => {
    txnGet.mockResolvedValue({ exists: true });
    const inner = vi.fn(async () => "should not run");
    const result = await runOnce("test:abc", inner);
    expect(result).toBeNull();
    expect(inner).not.toHaveBeenCalled();
    expect(txnSet).not.toHaveBeenCalled();
  });

  it("does NOT stamp completed_at if inner fn throws", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const inner = vi.fn(async () => { throw new Error("boom"); });
    await expect(runOnce("test:abc", inner)).rejects.toThrow("boom");
    expect(refUpdate).not.toHaveBeenCalled();
  });

  it("uses the key as the doc id under function_runs", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const collectionMock = (fakeFirestore.collection as ReturnType<typeof vi.fn>);
    await runOnce("scoreReveal:q123", async () => "v");
    expect(collectionMock).toHaveBeenCalledWith("function_runs");
  });

  it("returns the inner fn's value on success", async () => {
    txnGet.mockResolvedValue({ exists: false });
    const result = await runOnce("k", async () => ({ count: 42 }));
    expect(result).toEqual({ count: 42 });
  });
});
