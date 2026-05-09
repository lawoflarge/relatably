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

function authedReq(uid: string, body: object, id = "qid") {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request(`http://localhost/api/admin/questions/${id}/schedule`, {
    method: "POST",
    headers: { Authorization: "Bearer t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/questions/[id]/schedule", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("401 without auth", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "{}" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(401);
  });

  it("403 for non-admin", async () => {
    const req = authedReq("not-admin", { scheduled_drop_at: "2030-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(403);
  });

  it("400 for invalid date", async () => {
    const req = authedReq("admin-1", { scheduled_drop_at: "not-a-date" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(400);
  });

  it("400 for past date", async () => {
    const req = authedReq("admin-1", { scheduled_drop_at: "2000-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(400);
  });

  it("404 when question doesn't exist", async () => {
    const ref = { get: vi.fn().mockResolvedValue({ exists: false }) };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(ref) });

    const req = authedReq("admin-1", { scheduled_drop_at: "2099-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("400 when question is not 'scheduled'", async () => {
    const ref = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid",
        data: () => ({ status: "live" }),
      }),
      update: vi.fn(),
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(ref) });

    const req = authedReq("admin-1", { scheduled_drop_at: "2099-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    expect(res.status).toBe(400);
  });

  it("updates scheduled_drop_at when valid", async () => {
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const ref = {
      get: vi.fn().mockResolvedValue({
        exists: true,
        id: "qid",
        data: () => ({ status: "scheduled" }),
      }),
      update: updateMock,
    };
    fakeFirestore.collection.mockReturnValue({ doc: vi.fn().mockReturnValue(ref) });

    const req = authedReq("admin-1", { scheduled_drop_at: "2099-01-01T00:00:00Z" });
    const res = await POST(req, { params: Promise.resolve({ id: "qid" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "qid", scheduled_drop_at: "2099-01-01T00:00:00.000Z" });
    const arg = updateMock.mock.calls[0][0] as { scheduled_drop_at: Timestamp };
    expect(arg.scheduled_drop_at.toDate().toISOString()).toBe("2099-01-01T00:00:00.000Z");
  });
});
