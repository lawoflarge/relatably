import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const { fakeFirestore, verifyIdToken } = vi.hoisted(() => ({
  fakeFirestore: { collection: vi.fn() },
  verifyIdToken: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken },
}));

import { POST } from "./route";

function authedReq(uid: string, body: object = {}) {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request("http://localhost/api/admin/trigger-drop", {
    method: "POST",
    headers: { Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/trigger-drop", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("401 without auth", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "{}" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("403 for non-admin", async () => {
    const req = authedReq("not-admin");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("404 when no scheduled question exists", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    };
    fakeFirestore.collection.mockReturnValue(questionsCol);

    const req = authedReq("admin-1");
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("flips oldest scheduled drop_at to now", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const docRef = {
      id: "qid-old",
      update: updateMock,
    };
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: "qid-old", ref: docRef, data: () => ({ status: "scheduled" }) }],
      }),
    };
    fakeFirestore.collection.mockReturnValue(questionsCol);

    const req = authedReq("admin-1");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.question_id).toBe("qid-old");
    expect(body.will_fire_within_seconds).toBe(60);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const arg = updateMock.mock.calls[0][0] as { scheduled_drop_at: Timestamp };
    // Timestamp should be ~now
    const diff = Math.abs(arg.scheduled_drop_at.toDate().getTime() - Date.now());
    expect(diff).toBeLessThan(2000);
  });

  it("targets specific question_id when provided", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const docRef = { id: "qid-target", update: updateMock };
    const docMock = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid-target",
        ref: docRef,
        data: () => ({ status: "scheduled" }),
      }),
      update: updateMock,
    });
    fakeFirestore.collection.mockReturnValue({ doc: docMock });

    const req = authedReq("admin-1", { question_id: "qid-target" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.question_id).toBe("qid-target");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("400 when targeted question is not 'scheduled'", async () => {
    const docMock = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid-live",
        data: () => ({ status: "live" }),
      }),
    });
    fakeFirestore.collection.mockReturnValue({ doc: docMock });

    const req = authedReq("admin-1", { question_id: "qid-live" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
