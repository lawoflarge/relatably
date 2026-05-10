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
    adminAuth: { verifyIdToken: vi.fn() },
  };
});

vi.mock("@/lib/ratelimit", () => {
  const checkMock = vi.fn();
  return {
    getRateLimiter: () => ({ check: checkMock }),
    __getCheckMock: () => checkMock,
  };
});

const { evaluateToxicityMock } = vi.hoisted(() => ({
  evaluateToxicityMock: vi.fn(),
}));

vi.mock("@/lib/perspective", () => ({
  evaluateToxicity: evaluateToxicityMock,
}));

import { POST } from "./route";
import { adminFirestore, adminAuth } from "@/lib/firebase";
import * as ratelimitMod from "@/lib/ratelimit";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ratelimitMod as any).__getCheckMock().mockResolvedValue({ ok: true, retryAfterMs: 0 });
    // Default: Perspective skipped (no API key) — existing tests are unaffected.
    evaluateToxicityMock.mockResolvedValue({ verdict: "pass", score: 0, skipped: true });
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

  it("returns 429 when rate limit exceeds", async () => {
    (ratelimitMod as any).__getCheckMock().mockResolvedValueOnce({ ok: false, retryAfterMs: 30000 });
    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
  });

  it("links submission.user_id when valid Authorization header is present", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "user-X" });

    const mockClusterRef = { id: "cluster-abc" };
    const mockSubmissionRef = { id: "sub-xyz" };
    const deviceSetMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") {
        return {
          doc: vi.fn(() => ({
            id: "dev-1",
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: deviceSetMock,
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

    const req = new Request("http://localhost/api/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        authorization: "Bearer good-token",
      },
      body: JSON.stringify({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
    expect(submissionWrite![1]).toMatchObject({ user_id: "user-X" });
    expect(deviceSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ linked_user_id: "user-X" }),
      { merge: true },
    );
  });

  it("anonymous flow (no auth header): submission.user_id stays null", async () => {
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
      if (name === "submissions") return { doc: vi.fn(() => mockSubmissionRef) };
      throw new Error(`unexpected collection ${name}`);
    });
    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);
    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(200);
    const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
    expect(submissionWrite![1]).toMatchObject({ user_id: null });
  });

  it("persists submitted_at_minute_of_day classifier feature", async () => {
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
      if (name === "submissions") return { doc: vi.fn(() => mockSubmissionRef) };
      throw new Error(`unexpected collection ${name}`);
    });
    (adminFirestore.doc as any).mockReturnValue(mockClusterRef);
    const tx = (adminFirestore as any).__mockTx;
    tx.get.mockResolvedValueOnce({ exists: false });

    const res = await POST(
      buildRequest({
        question_id: "q1",
        device_token: "dev1",
        raw_text: "italy",
        dwell_ms: 5000,
      }),
    );
    expect(res.status).toBe(200);
    const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
    expect(typeof submissionWrite![1].submitted_at_minute_of_day).toBe("number");
    expect(submissionWrite![1].submitted_at_minute_of_day).toBeGreaterThanOrEqual(0);
    expect(submissionWrite![1].submitted_at_minute_of_day).toBeLessThanOrEqual(1439);
  });

  describe("tier-2 Perspective moderation (inline)", () => {
    // Helper: build refs whose .update() is observable. The route calls
    // submissionRef.update() (pass) or runs a second runTransaction (block)
    // after the cheap-pass commit.
    function setupRefs() {
      const submissionUpdate = vi.fn().mockResolvedValue({});
      const clusterUpdate = vi.fn().mockResolvedValue({});
      const mockClusterRef = { id: "cluster-abc", update: clusterUpdate };
      const mockSubmissionRef = { id: "sub-xyz", update: submissionUpdate };

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
      return { mockClusterRef, mockSubmissionRef, submissionUpdate, clusterUpdate };
    }

    const validBody = {
      question_id: "q1",
      device_token: "dev1",
      raw_text: "italy",
      dwell_ms: 5000,
    };

    it("stamps tier2_reviewed_at + tier2_score when Perspective verdict is pass", async () => {
      evaluateToxicityMock.mockResolvedValueOnce({
        verdict: "pass",
        score: 0.12,
        skipped: false,
      });
      const { mockSubmissionRef, submissionUpdate } = setupRefs();
      const tx = (adminFirestore as any).__mockTx;
      // First runTransaction (cheap-pass commit): cluster does not exist yet.
      tx.get.mockResolvedValueOnce({ exists: false });

      const res = await POST(buildRequest(validBody));
      expect(res.status).toBe(200);

      // moderation_status stays "passed" (cheap-pass write).
      const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
      expect(submissionWrite![1].moderation_status).toBe("passed");

      // tier2 fields stamped via direct submissionRef.update().
      expect(submissionUpdate).toHaveBeenCalledTimes(1);
      const tier2Patch = submissionUpdate.mock.calls[0][0];
      expect(tier2Patch.tier2_score).toBeCloseTo(0.12, 2);
      expect(tier2Patch.tier2_reviewed_at).toBeDefined();
    });

    it("flips moderation_status to blocked AND decrements cluster when Perspective verdict is block", async () => {
      evaluateToxicityMock.mockResolvedValueOnce({
        verdict: "block",
        score: 0.93,
        skipped: false,
      });
      const { mockSubmissionRef, mockClusterRef, submissionUpdate } = setupRefs();
      const tx = (adminFirestore as any).__mockTx;
      // 1st runTransaction (cheap-pass commit): cluster exists with 5 prior submissions.
      tx.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ submission_count: 5 }),
      });
      // 2nd runTransaction (tier-2 block): submission has no tier2_reviewed_at yet,
      // cluster currently has 6 submissions (after the cheap-pass increment).
      tx.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ moderation_status: "passed" }),
      });
      tx.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ submission_count: 6 }),
      });

      const res = await POST(buildRequest(validBody));
      // Same UX as today: HTTP 200 with cluster_id payload.
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.submission_count).toBe(6);

      // submissionRef.update() inside the tier-2 transaction flips status + stamps tier2.
      expect(submissionUpdate).not.toHaveBeenCalled();
      const submissionUpdateInTx = tx.update.mock.calls.find(
        (c: unknown[]) => c[0] === mockSubmissionRef,
      );
      expect(submissionUpdateInTx).toBeDefined();
      expect(submissionUpdateInTx![1]).toMatchObject({
        moderation_status: "blocked",
        tier2_score: 0.93,
      });
      expect(submissionUpdateInTx![1].tier2_reviewed_at).toBeDefined();

      // Cluster decrement.
      const clusterUpdateInTx = tx.update.mock.calls.find(
        (c: unknown[]) => c[0] === mockClusterRef,
      );
      expect(clusterUpdateInTx).toBeDefined();
      expect(clusterUpdateInTx![1].submission_count).toBeDefined();
    });

    it("does NOT block submission when Perspective API throws (graceful degradation)", async () => {
      // evaluateToxicity catches network errors internally and returns skipped:true,
      // so simulate that here.
      evaluateToxicityMock.mockResolvedValueOnce({
        verdict: "pass",
        score: 0,
        skipped: true,
      });
      const { mockSubmissionRef, submissionUpdate } = setupRefs();
      const tx = (adminFirestore as any).__mockTx;
      tx.get.mockResolvedValueOnce({ exists: false });

      const res = await POST(buildRequest(validBody));
      expect(res.status).toBe(200);

      // moderation_status stays "passed".
      const submissionWrite = tx.set.mock.calls.find((c: unknown[]) => c[0] === mockSubmissionRef);
      expect(submissionWrite![1].moderation_status).toBe("passed");

      // No tier2 stamp on skip — tier2_reviewed_at stays unset.
      expect(submissionUpdate).not.toHaveBeenCalled();
      // No second transaction (no block path).
      expect(adminFirestore.runTransaction).toHaveBeenCalledTimes(1);
    });

    it("does NOT call Perspective API when cheap moderation already blocked the submission", async () => {
      // "kys" is in the cheap profanity word-list; route returns 400 before tier-2.
      const res = await POST(
        buildRequest({
          question_id: "q1",
          device_token: "dev1",
          raw_text: "kys",
          dwell_ms: 5000,
        }),
      );
      expect(res.status).toBe(400);
      expect(evaluateToxicityMock).not.toHaveBeenCalled();
    });
  });
});
