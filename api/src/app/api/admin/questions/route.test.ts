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

import { GET } from "./route";

function authedReq(uid: string) {
  verifyIdToken.mockResolvedValue({ uid });
  return new Request("http://localhost/api/admin/questions", {
    headers: { Authorization: "Bearer t" },
  });
}

describe("GET /api/admin/questions", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
    verifyIdToken.mockReset();
    process.env.ADMIN_UIDS = "admin-1";
  });

  it("returns 401 without auth", async () => {
    const req = new Request("http://localhost/api/admin/questions");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const req = authedReq("not-admin");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("lists scheduled + live questions", async () => {
    const drop = Timestamp.fromDate(new Date("2026-05-10T12:00:00Z"));
    const created = Timestamp.fromDate(new Date("2026-05-09T00:00:00Z"));
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "q1", data: () => ({ text: "a?", status: "scheduled", scheduled_drop_at: drop, created_at: created }) },
          { id: "q2", data: () => ({ text: "b?", status: "live", created_at: created }) },
        ],
      }),
    };
    fakeFirestore.collection.mockReturnValue(questionsCol);

    const req = authedReq("admin-1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      questions: [
        { id: "q1", text: "a?", status: "scheduled", scheduled_drop_at: "2026-05-10T12:00:00.000Z", created_at: "2026-05-09T00:00:00.000Z" },
        { id: "q2", text: "b?", status: "live", scheduled_drop_at: null, created_at: "2026-05-09T00:00:00.000Z" },
      ],
    });
    expect(questionsCol.where).toHaveBeenCalledWith("status", "in", ["scheduled", "live"]);
    expect(questionsCol.orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(questionsCol.limit).toHaveBeenCalledWith(100);
  });
});
