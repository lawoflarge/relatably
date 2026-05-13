import { describe, it, expect, vi, beforeEach } from "vitest";

const addMock = vi.fn();
vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn(() => ({ add: addMock })) },
  adminAuth: { verifyIdToken: vi.fn() },
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__ts__" },
}));

import { POST } from "./route";
import { adminAuth } from "@/lib/firebase";

const buildReq = (body: unknown, token?: string) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/report", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

describe("POST /api/report", () => {
  beforeEach(() => {
    addMock.mockReset();
    addMock.mockResolvedValue({ id: "rep_1" });
    (adminAuth.verifyIdToken as ReturnType<typeof vi.fn>).mockReset();
  });

  it("400 when body fails validation", async () => {
    const res = await POST(buildReq({ target_type: "wrong", target_id: "x" }));
    expect(res.status).toBe(400);
  });

  it("400 when neither auth header nor device_token is provided", async () => {
    const res = await POST(buildReq({ target_type: "cluster", target_id: "c1" }));
    expect(res.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("accepts anonymous reports with a device_token", async () => {
    const res = await POST(
      buildReq({ target_type: "cluster", target_id: "c1", device_token: "dev-1" }),
    );
    expect(res.status).toBe(200);
    expect(addMock).toHaveBeenCalledTimes(1);
    const doc = addMock.mock.calls[0][0];
    expect(doc.target_type).toBe("cluster");
    expect(doc.target_id).toBe("c1");
    expect(doc.reporter_user_id).toBeNull();
    expect(doc.reporter_device_user_id).toMatch(/^[a-f0-9]{64}$/);
    expect(doc.status).toBe("open");
  });

  it("accepts authenticated reports and records the uid", async () => {
    (adminAuth.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValue({ uid: "u-42" });
    const res = await POST(
      buildReq({ target_type: "submission", target_id: "s1", reason: "slur" }, "tok"),
    );
    expect(res.status).toBe(200);
    const doc = addMock.mock.calls[0][0];
    expect(doc.reporter_user_id).toBe("u-42");
    expect(doc.reason).toBe("slur");
  });
});
