import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
  },
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
}));

import { requireAuth, getOrCreateUserDoc } from "./auth";
import { adminAuth, adminFirestore } from "@/lib/firebase";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no Authorization header", async () => {
    const req = new Request("http://localhost");
    expect(await requireAuth(req)).toBeNull();
    expect(adminAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns null when header is malformed (no Bearer)", async () => {
    const req = new Request("http://localhost", {
      headers: { authorization: "token-without-bearer" },
    });
    expect(await requireAuth(req)).toBeNull();
    expect(adminAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it("returns null when verifyIdToken throws", async () => {
    (adminAuth.verifyIdToken as any).mockRejectedValueOnce(new Error("expired"));
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer bad-token" },
    });
    expect(await requireAuth(req)).toBeNull();
  });

  it("returns the decoded token on valid Bearer", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-1", email: "x@y.z" });
    const req = new Request("http://localhost", {
      headers: { authorization: "Bearer good-token" },
    });
    const decoded = await requireAuth(req);
    expect(decoded).toEqual({ uid: "user-1", email: "x@y.z" });
  });
});

describe("getOrCreateUserDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user doc with defaults when none exists", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({ exists: false });
    const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const profile = await getOrCreateUserDoc("user-1", "en-US");

    expect(docMock).toHaveBeenCalledWith("user-1");
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        handle: null,
        is_public: true,
        locale: "en-US",
        shadowbanned: false,
      }),
      { merge: true },
    );
    expect(profile).toMatchObject({ uid: "user-1", handle: null, is_public: true });
  });

  it("returns existing doc data without overwriting", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    const getMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ handle: "@coolname", is_public: false, shadowbanned: false, locale: "en-GB" }),
    });
    const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "users") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const profile = await getOrCreateUserDoc("user-1", "en-US");

    expect(setMock).not.toHaveBeenCalled();
    expect(profile).toMatchObject({
      uid: "user-1",
      handle: "@coolname",
      is_public: false,
      locale: "en-GB",
      shadowbanned: false,
    });
  });
});
