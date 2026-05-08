import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildRequest = (token: string | null, accept = "en-US") => {
  const headers: Record<string, string> = { "accept-language": accept };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new Request("http://localhost/api/auth/me", { method: "POST", headers });
};

describe("POST /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 with no auth header", async () => {
    const res = await POST(buildRequest(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 on invalid token", async () => {
    (adminAuth.verifyIdToken as any).mockRejectedValueOnce(new Error("bad"));
    const res = await POST(buildRequest("bad-token"));
    expect(res.status).toBe(401);
  });

  it("creates user doc and returns profile on first sign-in", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-X" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: vi.fn(() => ({ get: getMock, set: setMock })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildRequest("good-token", "de-DE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      uid: "user-X",
      handle: null,
      is_public: true,
      locale: "de-DE",
      shadowbanned: false,
    });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: null, is_public: true, shadowbanned: false }),
      { merge: true },
    );
  });

  it("returns existing profile without overwriting on repeat call", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-X" });
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ handle: "@coolname", is_public: true, locale: "fr", shadowbanned: false }),
    });
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: vi.fn(() => ({ get: getMock, set: setMock })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(buildRequest("good-token"));
    const body = await res.json();
    expect(body).toMatchObject({ uid: "user-X", handle: "@coolname" });
    expect(setMock).not.toHaveBeenCalled();
  });
});
