import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const { fakeFirestore, verifyIdToken } = vi.hoisted(() => ({
  fakeFirestore: { collection: vi.fn() },
  verifyIdToken: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminAuth: { verifyIdToken },
}));

import { GET, POST } from "./route";

function authedReq(uid: string, init?: RequestInit) {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request("http://localhost/api/admin/candidates", {
    ...init,
    headers: { Authorization: "Bearer t", ...(init?.headers ?? {}) },
  });
}

describe("GET /api/admin/candidates", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/candidates");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    const req = authedReq("not-admin");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns ordered candidates for admin", async () => {
    const candidatesCol = {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "c1", data: () => ({ candidate_text: "first?", status: "pending", created_at: Timestamp.fromDate(new Date("2026-05-09T00:00:00Z")) }) },
          { id: "c2", data: () => ({ candidate_text: "second?", status: "approved", created_at: Timestamp.fromDate(new Date("2026-05-08T00:00:00Z")) }) },
        ],
      }),
    };
    fakeFirestore.collection.mockReturnValue(candidatesCol);

    const req = authedReq("admin-1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      candidates: [
        { id: "c1", candidate_text: "first?", status: "pending", created_at: "2026-05-09T00:00:00.000Z" },
        { id: "c2", candidate_text: "second?", status: "approved", created_at: "2026-05-08T00:00:00.000Z" },
      ],
    });
    expect(candidatesCol.orderBy).toHaveBeenCalledWith("created_at", "desc");
  });

  it("applies ?status filter when present", async () => {
    const candidatesCol = {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockReturnValue(candidatesCol);

    const req = authedReq("admin-1", { method: "GET" });
    const url = new URL(req.url);
    url.searchParams.set("status", "pending");
    const filteredReq = new Request(url, req);
    await GET(filteredReq);

    expect(candidatesCol.where).toHaveBeenCalledWith("status", "==", "pending");
  });
});

describe("POST /api/admin/candidates", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/candidates", { method: "POST", body: JSON.stringify({ candidate_text: "x?" }) });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin auth", async () => {
    const req = authedReq("not-admin", { method: "POST", body: JSON.stringify({ candidate_text: "x?" }) });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    const req = authedReq("admin-1", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates candidate with status=pending", async () => {
    const setMock = vi.fn().mockResolvedValue(undefined);
    const docMock = vi.fn().mockReturnValue({ id: "new-cid", set: setMock });
    fakeFirestore.collection.mockReturnValue({ doc: docMock });

    const req = authedReq("admin-1", { method: "POST", body: JSON.stringify({ candidate_text: "is pizza overrated?" }) });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: "new-cid", candidate_text: "is pizza overrated?", status: "pending" });
    expect(setMock).toHaveBeenCalledWith({
      candidate_text: "is pizza overrated?",
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });
  });
});
