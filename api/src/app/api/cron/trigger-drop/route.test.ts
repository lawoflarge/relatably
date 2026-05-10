import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  runTriggerDropMock,
  runOnceMock,
  getKillSwitchMock,
  fakeFirestore,
  fakeMessaging,
} = vi.hoisted(() => ({
  runTriggerDropMock: vi.fn(),
  runOnceMock: vi.fn(),
  getKillSwitchMock: vi.fn(),
  fakeFirestore: {} as any,
  fakeMessaging: {} as any,
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
  adminMessaging: fakeMessaging,
}));
vi.mock("@/lib/idempotency", () => ({
  runOnce: runOnceMock,
}));
vi.mock("@/lib/remoteConfig", () => ({
  getKillSwitch: getKillSwitchMock,
}));
vi.mock("@/lib/dropEngine/runTriggerDrop", () => ({
  runTriggerDrop: runTriggerDropMock,
}));

import { POST } from "./route";

function makeReq(authHeader?: string) {
  const headers: HeadersInit = {};
  if (authHeader) headers["Authorization"] = authHeader;
  return new Request("http://localhost/api/cron/trigger-drop", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/trigger-drop", () => {
  beforeEach(() => {
    runTriggerDropMock.mockReset();
    runOnceMock.mockReset();
    getKillSwitchMock.mockReset();
    process.env.CRON_SECRET = "test-secret";
  });

  it("401 when Authorization header is missing", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it("401 when bearer token does not match CRON_SECRET", async () => {
    const res = await POST(makeReq("Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("401 when CRON_SECRET env var is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeReq("Bearer anything"));
    expect(res.status).toBe(401);
  });

  it("200 with skipped:'drop_enabled=false' when kill-switch is off", async () => {
    getKillSwitchMock.mockResolvedValue(false);
    const res = await POST(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: "drop_enabled=false" });
    expect(runOnceMock).not.toHaveBeenCalled();
    expect(runTriggerDropMock).not.toHaveBeenCalled();
  });

  it("200 with skipped:'already-ran-this-bucket' when runOnce returns null", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    runOnceMock.mockResolvedValue(null);
    const res = await POST(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ skipped: "already-ran-this-bucket" });
    expect(runTriggerDropMock).not.toHaveBeenCalled();
  });

  it("200 with ok:true and counts when a drop is processed", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    runOnceMock.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    runTriggerDropMock.mockResolvedValue({
      dropped: 2,
      revealed: 1,
      fanoutSent: 234,
      fanoutFailed: 1,
    });
    const res = await POST(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      dropped: 2,
      revealed: 1,
      fanoutSent: 234,
      fanoutFailed: 1,
    });
    expect(runTriggerDropMock).toHaveBeenCalledWith(fakeFirestore, fakeMessaging, expect.any(Date));
  });

  it("uses a 5-minute bucket key for runOnce", async () => {
    getKillSwitchMock.mockResolvedValue(true);
    runOnceMock.mockResolvedValue(null);
    await POST(makeReq("Bearer test-secret"));
    const key = runOnceMock.mock.calls[0][0] as string;
    expect(key).toMatch(/^triggerDrop:\d+$/);
    const bucketNum = Number(key.split(":")[1]);
    const expected = Math.floor(Date.now() / (5 * 60 * 1000));
    expect(Math.abs(bucketNum - expected)).toBeLessThanOrEqual(1);
  });
});
