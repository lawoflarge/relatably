import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  runPrepareNextDropMock,
  runOnceMock,
  fakeFirestore,
} = vi.hoisted(() => ({
  runPrepareNextDropMock: vi.fn(),
  runOnceMock: vi.fn(),
  fakeFirestore: {} as unknown,
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
}));
vi.mock("@/lib/idempotency", () => ({
  runOnce: runOnceMock,
}));
vi.mock("@/lib/dropEngine/runPrepareNextDrop", () => ({
  runPrepareNextDrop: runPrepareNextDropMock,
}));

import { POST } from "./route";

function makeReq(authHeader?: string): Request {
  const headers: HeadersInit = {};
  if (authHeader) headers["Authorization"] = authHeader;
  return new Request("http://localhost/api/cron/prepare-next-drop", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/prepare-next-drop", () => {
  beforeEach(() => {
    runPrepareNextDropMock.mockReset();
    runOnceMock.mockReset();
    process.env.CRON_SECRET = "test-secret";
  });

  it("401 when Authorization header is missing", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("401 when bearer does not match CRON_SECRET", async () => {
    const res = await POST(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("401 when CRON_SECRET env var is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeReq("Bearer anything"));
    expect(res.status).toBe(401);
  });

  it("200 with skipped:'already-ran-today' when runOnce returns null", async () => {
    runOnceMock.mockResolvedValue(null);
    const res = await POST(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: "already-ran-today" });
    expect(runPrepareNextDropMock).not.toHaveBeenCalled();
  });

  it("200 with ok:true and scheduled details on success", async () => {
    runOnceMock.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    runPrepareNextDropMock.mockResolvedValue({
      scheduled: { questionId: "q42", dropAt: "2026-05-11T13:42:01.000Z" },
    });
    const res = await POST(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      scheduled: { questionId: "q42", dropAt: "2026-05-11T13:42:01.000Z" },
    });
    expect(runPrepareNextDropMock).toHaveBeenCalledWith(fakeFirestore, expect.any(Date));
  });

  it("200 with scheduled:null when nothing eligible", async () => {
    runOnceMock.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    runPrepareNextDropMock.mockResolvedValue({ scheduled: null });
    const res = await POST(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, scheduled: null });
  });

  it("uses a 1-day bucket key for runOnce", async () => {
    runOnceMock.mockResolvedValue(null);
    await POST(makeReq("Bearer test-secret"));
    const key = runOnceMock.mock.calls[0][0] as string;
    expect(key).toMatch(/^prepareNextDrop:\d+$/);
    const bucketNum = Number(key.split(":")[1]);
    const expected = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    expect(Math.abs(bucketNum - expected)).toBeLessThanOrEqual(1);
  });
});
