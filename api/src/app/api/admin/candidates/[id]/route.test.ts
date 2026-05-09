import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const { fakeFirestore, verifyIdToken } = vi.hoisted(() => ({
  fakeFirestore: { collection: vi.fn(), batch: vi.fn() },
  verifyIdToken: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken },
}));

import { PATCH } from "./route";

function authedReq(uid: string, body: object, id = "cid") {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request(`http://localhost/api/admin/candidates/${id}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/candidates/[id]", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    fakeFirestore.batch.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/candidates/cid", {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    const req = authedReq("not-admin", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid action", async () => {
    const req = authedReq("admin-1", { action: "ignore" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when candidate doesn't exist", async () => {
    const candidateRef = {
      get: vi.fn().mockResolvedValue({ exists: false }),
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(candidateRef) });

    const req = authedReq("admin-1", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("on reject: flips status to rejected (no question created)", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const candidateRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "cid",
        data: () => ({ candidate_text: "x?", status: "pending", created_at: Timestamp.now() }),
      }),
      update: updateMock,
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(candidateRef) });

    const req = authedReq("admin-1", { action: "reject" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "cid", status: "rejected" });
    expect(updateMock).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("on approve: atomic batch flips status + creates scheduled question", async () => {
    const candidateRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "cid",
        data: () => ({ candidate_text: "is pizza overrated?", status: "pending", created_at: Timestamp.now() }),
      }),
    };
    const newQuestionRef = { id: "qid-new" };
    const collectionMock = vi.fn((name: string) => {
      if (name === "question_candidates") return { doc: vi.fn().mockReturnValue(candidateRef) };
      if (name === "questions") return { doc: vi.fn().mockReturnValue(newQuestionRef) };
      throw new Error("unexpected collection " + name);
    });
    fakeFirestore.collection.mockImplementation(collectionMock);

    const batchUpdate = vi.fn();
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    fakeFirestore.batch.mockReturnValue({ update: batchUpdate, set: batchSet, commit: batchCommit });

    const req = authedReq("admin-1", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "cid", status: "approved", question_id: "qid-new" });
    expect(batchUpdate).toHaveBeenCalledWith(candidateRef, { status: "approved" });
    expect(batchSet).toHaveBeenCalledWith(newQuestionRef, {
      text: "is pizza overrated?",
      status: "scheduled",
      source: "ai_assisted",
      created_at: FieldValue.serverTimestamp(),
    });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("rejects approving an already-approved candidate", async () => {
    const candidateRef = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "cid",
        data: () => ({ candidate_text: "x?", status: "approved", created_at: Timestamp.now() }),
      }),
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(candidateRef) });

    const req = authedReq("admin-1", { action: "approve" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cid" }) });
    expect(res.status).toBe(409);
  });
});
