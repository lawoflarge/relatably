import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  return {
    adminFirestore: {
      collection: vi.fn(),
    },
    adminAuth: {},
  };
});

import { POST } from "./route";
import { adminFirestore } from "@/lib/firebase";

const buildRequest = (body: unknown) =>
  new Request("http://localhost/api/devices/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/devices/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing fields", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects empty fcm_token", async () => {
    const res = await POST(
      buildRequest({ device_token: "dev1", fcm_token: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts device_users with sha256-hashed device_token and stores fcm_token", async () => {
    const setMock = vi.fn().mockResolvedValue({});
    const docMock = vi.fn(() => ({ set: setMock }));

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "device_users") return { doc: docMock };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await POST(
      buildRequest({ device_token: "raw-dev-1", fcm_token: "fcm-token-xyz" }),
    );
    expect(res.status).toBe(200);

    // device_token must be hashed (64 hex chars), never raw.
    const docCallArg = (docMock.mock.calls[0] as unknown as [string])[0];
    expect(docCallArg).toMatch(/^[a-f0-9]{64}$/);
    expect(docCallArg).not.toBe("raw-dev-1");

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        device_token: "raw-dev-1",
        fcm_token: "fcm-token-xyz",
      }),
      { merge: true },
    );
  });
});
