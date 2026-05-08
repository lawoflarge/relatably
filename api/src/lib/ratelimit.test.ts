import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRateLimiter, getRateLimiter, __resetRateLimiterForTest } from "./ratelimit";

describe("MemoryRateLimiter", () => {
  it("allows up to N hits in the window", async () => {
    const rl = new MemoryRateLimiter({ limit: 3, windowMs: 60000 });
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k1")).ok).toBe(true);
    const fourth = await rl.check("k1");
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates keys", async () => {
    const rl = new MemoryRateLimiter({ limit: 1, windowMs: 60000 });
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k2")).ok).toBe(true);
  });

  it("clears entries after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    const rl = new MemoryRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await rl.check("k1")).ok).toBe(true);
    expect((await rl.check("k1")).ok).toBe(false);
    vi.setSystemTime(new Date("2026-05-08T12:00:01.500Z"));
    expect((await rl.check("k1")).ok).toBe(true);
    vi.useRealTimers();
  });
});

describe("getRateLimiter()", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimiterForTest();
  });
  afterEach(() => {
    __resetRateLimiterForTest();
  });

  it("returns MemoryRateLimiter when Upstash env vars not set", () => {
    const rl = getRateLimiter();
    expect(rl).toBeInstanceOf(MemoryRateLimiter);
  });

  it("memoizes the instance", () => {
    const a = getRateLimiter();
    const b = getRateLimiter();
    expect(a).toBe(b);
  });
});
