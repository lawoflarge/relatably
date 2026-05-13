import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
    doc: vi.fn(),
    runTransaction: vi.fn(),
  },
  adminAuth: { verifyIdToken: vi.fn() },
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __op: "inc", value: n }) },
}));

import { DELETE } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

function setupSubmission(data: Record<string, unknown> | null) {
  const submissionRef = {
    get: vi.fn().mockResolvedValue({ exists: data !== null, data: () => data }),
    delete: vi.fn().mockResolvedValue({}),
  };
  const clusterRef = {};
  (adminFirestore.collection as any).mockImplementation((name: string) => {
    if (name === "submissions") return { doc: vi.fn(() => submissionRef) };
    throw new Error(`unexpected collection ${name}`);
  });
  (adminFirestore.doc as any).mockReturnValue(clusterRef);

  const txDelete = vi.fn();
  const txUpdate = vi.fn();
  (adminFirestore.runTransaction as any).mockImplementation(async (cb: any) => {
    return cb({
      get: vi.fn().mockImplementation(async (ref: unknown) => {
        if (ref === submissionRef) {
          return { exists: data !== null, data: () => data };
        }
        return { data: () => ({ submission_count: 5 }) };
      }),
      delete: txDelete,
      update: txUpdate,
    });
  });
  return { submissionRef, txDelete, txUpdate };
}

const buildReq = (body: unknown = {}, token?: string) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/submissions/sub_1", {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
};

describe("DELETE /api/submissions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404 when submission does not exist", async () => {
    setupSubmission(null);
    const res = await DELETE(buildReq(), { params: Promise.resolve({ id: "sub_1" }) });
    expect(res.status).toBe(404);
  });

  it("403 when caller is neither owner-by-auth nor owner-by-device", async () => {
    setupSubmission({
      user_id: "u-other",
      device_user_id: "abc",
      normalized_cluster_id: "c1",
    });
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "u-me" });
    const res = await DELETE(buildReq({}, "tok"), { params: Promise.resolve({ id: "sub_1" }) });
    expect(res.status).toBe(403);
  });

  it("200 + delete when owner by uid", async () => {
    const { txDelete, txUpdate } = setupSubmission({
      user_id: "u-me",
      device_user_id: "abc",
      normalized_cluster_id: "c1",
      moderation_status: "passed",
    });
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "u-me" });
    const res = await DELETE(buildReq({}, "tok"), { params: Promise.resolve({ id: "sub_1" }) });
    expect(res.status).toBe(200);
    expect(txDelete).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);
  });

  it("200 + delete when owner by device_token hash", async () => {
    // hash of "dev-token" — generate inline so test is deterministic
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update("dev-token").digest("hex");
    const { txDelete } = setupSubmission({
      user_id: null,
      device_user_id: hash,
      normalized_cluster_id: "c1",
      moderation_status: "passed",
    });
    const res = await DELETE(
      buildReq({ device_token: "dev-token" }),
      { params: Promise.resolve({ id: "sub_1" }) },
    );
    expect(res.status).toBe(200);
    expect(txDelete).toHaveBeenCalledTimes(1);
  });

  it("skips cluster decrement when submission was already blocked (not counted)", async () => {
    const { txDelete, txUpdate } = setupSubmission({
      user_id: "u-me",
      device_user_id: "abc",
      normalized_cluster_id: "c1",
      moderation_status: "blocked",
    });
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "u-me" });
    const res = await DELETE(buildReq({}, "tok"), { params: Promise.resolve({ id: "sub_1" }) });
    expect(res.status).toBe(200);
    expect(txDelete).toHaveBeenCalledTimes(1);
    expect(txUpdate).not.toHaveBeenCalled();
  });
});
