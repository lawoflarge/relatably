import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MemoryRateLimiter,
  getRateLimiter,
  getDailyRateLimiter,
  __resetRateLimiterForTest,
} from "./ratelimit";

const { getKillSwitch } = vi.hoisted(() => ({ getKillSwitch: vi.fn() }));

vi.mock("./remoteConfig", () => ({
  getKillSwitch,
}));

beforeEach(() => {
  // Default behavior: pass through the fallback (i.e., honor cfg.limit).
  getKillSwitch.mockImplementation(async (_key: string, fallback: number) => fallback);
});

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

  it("logs a LOUD console.error naming the missing Upstash env when falling back in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getRateLimiter();
      expect(spy).toHaveBeenCalledTimes(1);
      const msg = spy.mock.calls[0].join(" ");
      expect(msg).toMatch(/UPSTASH_REDIS_REST_URL/);
      expect(msg).toMatch(/UPSTASH_REDIS_REST_TOKEN/);
    } finally {
      spy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("does NOT log the fallback warning outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getRateLimiter();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe("getDailyRateLimiter()", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimiterForTest();
  });
  afterEach(() => {
    __resetRateLimiterForTest();
  });

  it("returns a MemoryRateLimiter when Upstash env vars not set", () => {
    expect(getDailyRateLimiter()).toBeInstanceOf(MemoryRateLimiter);
  });

  it("memoizes the daily instance separately from the per-minute one", () => {
    const daily = getDailyRateLimiter();
    expect(getDailyRateLimiter()).toBe(daily);
    expect(getRateLimiter()).not.toBe(daily);
  });
});

describe("MemoryRateLimiter — submit_rate_limit_per_min Remote Config override", () => {
  beforeEach(() => {
    getKillSwitch.mockReset();
  });

  it("uses the cfg default limit when submit_rate_limit_per_min is unset", async () => {
    // Unset → getKillSwitch returns its fallback (cfg.limit).
    getKillSwitch.mockImplementation(async (_key: string, fallback: number) => fallback);

    const rl = new MemoryRateLimiter({ limit: 10, windowMs: 60000 });
    for (let i = 0; i < 10; i++) {
      expect((await rl.check("k-default")).ok).toBe(true);
    }
    const eleventh = await rl.check("k-default");
    expect(eleventh.ok).toBe(false);
    expect(getKillSwitch).toHaveBeenCalledWith("submit_rate_limit_per_min", 10);
  });

  it("honors a Remote Config override of 3 (4th hit blocked)", async () => {
    getKillSwitch.mockResolvedValue(3);

    const rl = new MemoryRateLimiter({ limit: 10, windowMs: 60000 });
    expect((await rl.check("k-override")).ok).toBe(true);
    expect((await rl.check("k-override")).ok).toBe(true);
    expect((await rl.check("k-override")).ok).toBe(true);
    const fourth = await rl.check("k-override");
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("blocks all submissions when submit_rate_limit_per_min=0 (full kill-switch)", async () => {
    getKillSwitch.mockResolvedValue(0);

    const rl = new MemoryRateLimiter({ limit: 10, windowMs: 60000 });
    const first = await rl.check("k-zero");
    expect(first.ok).toBe(false);
  });

  it("falls back to cfg default when Remote Config fetch errors out", async () => {
    // getKillSwitch in remoteConfig.ts swallows errors and returns the fallback;
    // we simulate that contract here (the mock implementation passes through fallback).
    getKillSwitch.mockImplementation(async (_key: string, fallback: number) => fallback);

    const rl = new MemoryRateLimiter({ limit: 2, windowMs: 60000 });
    expect((await rl.check("k-fallback")).ok).toBe(true);
    expect((await rl.check("k-fallback")).ok).toBe(true);
    const third = await rl.check("k-fallback");
    expect(third.ok).toBe(false);
    expect(getKillSwitch).toHaveBeenCalledWith("submit_rate_limit_per_min", 2);
  });
});
