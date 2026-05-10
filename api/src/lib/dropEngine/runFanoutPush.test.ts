import { describe, it, expect, vi, beforeEach } from "vitest";
import { runFanoutPush } from "./runFanoutPush";

describe("runFanoutPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing if status didn't change to 'live'", async () => {
    const sendEachForMulticast = vi.fn();
    const fakeDb = {
      collection: vi.fn(),
    } as any;
    const fakeMessaging = { sendEachForMulticast } as any;

    const r = await runFanoutPush(fakeDb, fakeMessaging, {
      before: { status: "scheduled", text: "q" },
      after: { status: "scheduled", text: "q" },
    });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(r).toEqual({ sent: 0, failed: 0, batches: 0 });
  });

  it("does nothing when status was already 'live' before", async () => {
    const sendEachForMulticast = vi.fn();
    const fakeDb = { collection: vi.fn() } as any;
    const fakeMessaging = { sendEachForMulticast } as any;

    const r = await runFanoutPush(fakeDb, fakeMessaging, {
      before: { status: "live", text: "q" },
      after: { status: "live", text: "q" },
    });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(r).toEqual({ sent: 0, failed: 0, batches: 0 });
  });

  it("fans out in 500-token batches when status flips scheduled → live", async () => {
    const tokens = Array.from({ length: 1234 }, (_, i) => `tok-${i}`);
    const docs = tokens.map((t) => ({ data: () => ({ fcm_token: t }) }));

    const fakeDb = {
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs }),
        }),
      }),
    } as any;

    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 100,
      failureCount: 0,
      responses: [],
    });
    const fakeMessaging = { sendEachForMulticast } as any;

    const r = await runFanoutPush(fakeDb, fakeMessaging, {
      questionId: "q-123",
      before: { status: "scheduled", text: "today's q" },
      after: { status: "live", text: "today's q" },
    });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(3);
    const firstCall = sendEachForMulticast.mock.calls[0][0];
    expect(firstCall.tokens).toHaveLength(500);
    expect(firstCall.notification.title).toMatch(/world is voting/i);
    expect(firstCall.notification.body).toBe("today's q");
    expect(firstCall.data).toEqual({ questionId: "q-123" });
    expect(sendEachForMulticast.mock.calls[2][0].tokens).toHaveLength(234);
    expect(r).toEqual({ sent: 300, failed: 0, batches: 3 });
  });

  it("does nothing when there are zero device tokens", async () => {
    const fakeDb = {
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        }),
      }),
    } as any;
    const sendEachForMulticast = vi.fn();
    const fakeMessaging = { sendEachForMulticast } as any;

    const r = await runFanoutPush(fakeDb, fakeMessaging, {
      questionId: "q-123",
      before: { status: "scheduled", text: "q" },
      after: { status: "live", text: "q" },
    });

    expect(sendEachForMulticast).not.toHaveBeenCalled();
    expect(r).toEqual({ sent: 0, failed: 0, batches: 0 });
  });
});
