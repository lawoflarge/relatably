import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (body: unknown, token?: string) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends/accept", {
    method: "POST", headers, body: JSON.stringify(body),
  });
};

describe("POST /api/friends/accept", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await POST(buildReq({ friendship_id: "abc" }));
    expect(res.status).toBe(401);
  });

  it("404 when friendship doc missing", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u2" });
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await POST(buildReq({ friendship_id: "abc" }, "tok"));
    expect(res.status).toBe(404);
  });

  it("403 when caller is not the accepter", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ requester_id: "u1", accepter_id: "u2", status: "pending" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await POST(buildReq({ friendship_id: "abc" }, "tok"));
    expect(res.status).toBe(403);
  });

  it("flips pending -> accepted", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u2" });
    const updateMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ requester_id: "u1", accepter_id: "u2", status: "pending" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock, update: updateMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await POST(buildReq({ friendship_id: "abc" }, "tok"));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted" }),
    );
  });
});
