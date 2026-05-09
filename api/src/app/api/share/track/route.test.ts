import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
  },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { POST } from "./route";
import { adminFirestore, adminAuth } from "@/lib/firebase";

const buildRequest = (body: unknown, auth?: string) =>
  new Request("http://localhost/api/share/track", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });

describe("POST /api/share/track", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
  });

  it("rejects malformed body", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects unsupported banner_type", async () => {
    const res = await POST(
      buildRequest({ banner_type: "billboard", question_id: "q1", share_target: "ig_story" }),
    );
    expect(res.status).toBe(400);
  });

  it("anonymous: writes share_event with user_id null + returns referral_code", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockReturnValue({
      doc: vi.fn(() => ({ id: "share-1", set: setMock })),
    });

    const res = await POST(
      buildRequest({ banner_type: "todays_take", question_id: "q1", share_target: "ig_story" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.referral_code).toBe("string");
    expect(body.referral_code.length).toBeGreaterThan(0);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        question_id: "q1",
        banner_type: "todays_take",
        share_target: "ig_story",
        referral_code: body.referral_code,
      }),
    );
  });

  it("authed: writes share_event with user_id from token", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "u-99" });
    const setMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockReturnValue({
      doc: vi.fn(() => ({ id: "share-2", set: setMock })),
    });

    await POST(
      buildRequest(
        { banner_type: "verdict", question_id: "q2", share_target: "tiktok" },
        "good-token",
      ),
    );
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u-99", banner_type: "verdict" }),
    );
  });

  it("never persists raw IP — only ip_hash sha256 hex", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    (adminFirestore.collection as any).mockReturnValue({
      doc: vi.fn(() => ({ id: "share-3", set: setMock })),
    });

    await POST(
      buildRequest({ banner_type: "called_it", question_id: "q3", share_target: "imessage" }),
    );
    const writtenDoc = setMock.mock.calls[0][0];
    expect(writtenDoc.ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(writtenDoc.ip_hash).not.toBe("1.2.3.4");
  });
});
