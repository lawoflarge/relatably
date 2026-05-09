import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
  adminFirestore: {},
}));

import { adminAuth } from "@/lib/firebase";
import { requireAdmin } from "./admin";

const verifyIdToken = adminAuth.verifyIdToken as unknown as ReturnType<typeof vi.fn>;

describe("requireAdmin", () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    delete process.env.ADMIN_UIDS;
  });

  afterEach(() => {
    delete process.env.ADMIN_UIDS;
  });

  it("returns 'no_auth' when no Authorization header", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    const req = new Request("http://localhost/x");
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "no_auth" });
  });

  it("returns 'no_auth' when token is invalid", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer bad-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "no_auth" });
  });

  it("returns 'not_admin' when uid not in ADMIN_UIDS", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    verifyIdToken.mockResolvedValue({ uid: "uid-3" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "not_admin", decoded: { uid: "uid-3" } });
  });

  it("returns 'ok' when uid in ADMIN_UIDS", async () => {
    process.env.ADMIN_UIDS = "uid-1,uid-2";
    verifyIdToken.mockResolvedValue({ uid: "uid-2" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "ok", decoded: { uid: "uid-2" } });
  });

  it("returns 'not_admin' when ADMIN_UIDS env is unset (defensive — prevents accidental open admin)", async () => {
    // ADMIN_UIDS deliberately not set
    verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result).toEqual({ kind: "not_admin", decoded: { uid: "uid-1" } });
  });

  it("trims whitespace in ADMIN_UIDS list", async () => {
    process.env.ADMIN_UIDS = " uid-1 ,  uid-2 ";
    verifyIdToken.mockResolvedValue({ uid: "uid-2" });
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer good-token" },
    });
    const result = await requireAdmin(req);
    expect(result.kind).toBe("ok");
  });
});
