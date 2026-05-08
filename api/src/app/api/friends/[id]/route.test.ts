import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { DELETE } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends/abc123", { method: "DELETE", headers });
};

describe("DELETE /api/friends/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await DELETE(buildReq(), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(401);
  });

  it("404 when friendship missing", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await DELETE(buildReq("tok"), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(404);
  });

  it("403 when caller is neither party", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u3" });
    const getMock = vi.fn().mockResolvedValue({
      exists: true, data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await DELETE(buildReq("tok"), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(403);
  });

  it("deletes the doc when caller is a party", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const deleteMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true, data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ get: getMock, delete: deleteMock })) };
      throw new Error(`unexpected collection ${name}`);
    });
    const res = await DELETE(buildReq("tok"), { params: Promise.resolve({ id: "abc123" }) });
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalled();
  });
});
