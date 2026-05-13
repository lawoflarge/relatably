import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  adminAuthDelete,
  adminVerify,
  batchUpdate,
  batchDelete,
  batchCommit,
  docDelete,
  submissionsSnap,
  leaderboardSnap,
  shareEventsSnap,
  friendshipsReqSnap,
  friendshipsAccSnap,
} = vi.hoisted(() => {
  function mkSnap(docs: { ref: unknown }[]) {
    return { empty: docs.length === 0, docs };
  }
  return {
    adminAuthDelete: vi.fn(),
    adminVerify: vi.fn(),
    batchUpdate: vi.fn(),
    batchDelete: vi.fn(),
    batchCommit: vi.fn(),
    docDelete: vi.fn(),
    submissionsSnap: mkSnap([{ ref: { __id: "s1" } }]),
    leaderboardSnap: mkSnap([{ ref: { __id: "l1" } }]),
    shareEventsSnap: mkSnap([]),
    friendshipsReqSnap: mkSnap([{ ref: { __id: "f1" } }]),
    friendshipsAccSnap: mkSnap([]),
  };
});

vi.mock("@/lib/firebase", () => ({
  adminAuth: { verifyIdToken: adminVerify, deleteUser: adminAuthDelete },
  adminFirestore: {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => ({ delete: docDelete })),
      where: vi.fn((_field: string, _op: string, _val: string) => {
        const innerWhere = vi.fn((field2: string) => ({
          get: vi.fn(async () => {
            if (name === "friendships" && field2 === "accepter_id") return friendshipsAccSnap;
            return friendshipsReqSnap;
          }),
        }));
        return {
          get: vi.fn(async () => {
            if (name === "submissions") return submissionsSnap;
            if (name === "leaderboard_entries") return leaderboardSnap;
            if (name === "share_events") return shareEventsSnap;
            if (name === "friendships") return friendshipsReqSnap;
            throw new Error(`unknown collection ${name}`);
          }),
          where: innerWhere,
        };
      }),
    })),
    batch: vi.fn(() => ({
      update: batchUpdate,
      delete: batchDelete,
      commit: batchCommit,
    })),
  },
}));

import { POST } from "./route";

const req = (token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/account/delete", {
    method: "POST",
    headers,
  });
};

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchCommit.mockResolvedValue({});
    adminAuthDelete.mockResolvedValue(undefined);
    docDelete.mockResolvedValue({});
  });

  it("401 without auth header", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(adminAuthDelete).not.toHaveBeenCalled();
  });

  it("anonymises submissions, deletes auxiliary docs, and revokes auth", async () => {
    adminVerify.mockResolvedValue({ uid: "u-1" });
    const res = await POST(req("tok"));
    expect(res.status).toBe(200);
    // submissions: anonymised in-place via batch.update, not delete
    expect(batchUpdate).toHaveBeenCalled();
    expect(batchUpdate.mock.calls[0][1].user_id).toBeNull();
    expect(batchUpdate.mock.calls[0][1].raw_text).toBe("[deleted]");
    // leaderboard + friendships removed
    expect(batchDelete).toHaveBeenCalled();
    // users/{uid} doc deleted
    expect(docDelete).toHaveBeenCalled();
    // auth record revoked
    expect(adminAuthDelete).toHaveBeenCalledWith("u-1");
  });

  it("still returns 200 even if auth.deleteUser throws (e.g. user was already gone)", async () => {
    adminVerify.mockResolvedValue({ uid: "u-2" });
    adminAuthDelete.mockRejectedValue(new Error("user not found"));
    const res = await POST(req("tok"));
    expect(res.status).toBe(200);
  });
});
