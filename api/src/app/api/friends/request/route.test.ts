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
  return new Request("http://localhost/api/friends/request", {
    method: "POST", headers, body: JSON.stringify(body),
  });
};

describe("POST /api/friends/request", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await POST(buildReq({ target_user_id: "u2" }));
    expect(res.status).toBe(401);
  });

  it("400 when target == self", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const res = await POST(buildReq({ target_user_id: "u1" }, "tok"));
    expect(res.status).toBe(400);
  });

  it("creates pending friendship doc with deterministic id", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    const docMock = vi.fn(() => ({ set: setMock, get: getMock }));
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildReq({ target_user_id: "u2" }, "tok"));
    expect(res.status).toBe(200);
    const idArg = (docMock.mock.calls[0] as unknown as [string])[0];
    expect(idArg).toMatch(/^[a-f0-9]{40}$/);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requester_id: "u1",
        accepter_id: "u2",
        status: "pending",
      }),
    );
  });

  it("is idempotent: existing pending request returns 200 without re-write", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true, data: () => ({ requester_id: "u1", accepter_id: "u2", status: "pending" }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return { doc: vi.fn(() => ({ set: setMock, get: getMock })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildReq({ target_user_id: "u2" }, "tok"));
    expect(res.status).toBe(200);
    expect(setMock).not.toHaveBeenCalled();
  });
});
