import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  const mockTx = {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  return {
    adminFirestore: {
      collection: vi.fn(),
      doc: vi.fn(),
      runTransaction: vi.fn((fn) => fn(mockTx)),
      __mockTx: mockTx,
    },
    adminAuth: {},
  };
});

import { POST } from "./route";
import { adminFirestore } from "@/lib/firebase";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing fields", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects dwell_ms < 3000", async () => {
    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 100,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/dwell/i);
  });

  it("rejects profane text", async () => {
    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "kys",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/that won't fly/i);
  });

  it("creates a new cluster on first submission", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue({}),
          })),
        };
      }
      if (name === "submissions") {
        return { doc: vi.fn(() => mockSubmissionRef) };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);

    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    const res = await POST(
      buildRequest({
        question_id: "q-uuid-1",
        device_token: "dev1",
        raw_text: "  Italy  ",
        dwell_ms: 5000,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.normalized_text).toBe("italy");
    expect(body.submission_count).toBe(1);

    expect(tx.set).toHaveBeenCalledWith(
      mockClusterRef,
      expect.objectContaining({
        canonical_text: "italy",
        submission_count: 1,
        question_id: "q-uuid-1",
      }),
    );
  });

  it("increments existing cluster on repeat submission", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ linked_user_id: null }) }),
            set: vi.fn().mockResolvedValue({}),
          })),
        };
      }
      if (name === "submissions") {
        return { doc: vi.fn(() => mockSubmissionRef) };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);

    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ submission_count: 137 }),
    });

    const res = await POST(
      buildRequest({
        question_id: "q-uuid-1",
        device_token: "dev2",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submission_count).toBe(138);

    expect(tx.update).toHaveBeenCalledWith(
      mockClusterRef,
      expect.objectContaining({ submission_count: expect.anything() }),
    );
  });

  it("persists hashed device_user_id and ip_hash, never raw values", async () => {
    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue({}),
          })),
        };
      }
      if (name === "submissions") {
        return { doc: vi.fn(() => mockSubmissionRef) };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);

    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    await POST(
      buildRequest({
        question_id: "q-uuid-1",
        device_token: "raw-token-1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );

    const submissionWrite = tx.set.mock.calls.find(
      (call: unknown[]) => call[0] === mockSubmissionRef,
    );
    expect(submissionWrite).toBeDefined();
    const writtenDoc = submissionWrite![1] as Record<string, unknown>;

    // Security invariants: never persist raw IP or raw device token.
    expect(writtenDoc.device_user_id).not.toBe("raw-token-1");
    expect(writtenDoc.ip_hash).not.toBe("1.2.3.4");
    // Both must be 64-char sha256 hex.
    expect(writtenDoc.device_user_id).toMatch(/^[a-f0-9]{64}$/);
    expect(writtenDoc.ip_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
