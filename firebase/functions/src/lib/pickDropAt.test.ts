import { describe, it, expect } from "vitest";
import { pickDropAt } from "./pickDropAt";

function startOfTomorrowUTC(now: Date): Date {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return t;
}

describe("pickDropAt", () => {
  it("returns a Date within [tomorrow 00:00 UTC, day-after 00:00 UTC)", () => {
    const now = new Date(Date.UTC(2026, 4, 8, 12, 30, 0));
    const start = startOfTomorrowUTC(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    for (let i = 0; i < 1000; i++) {
      const drop = pickDropAt(now);
      expect(drop.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(drop.getTime()).toBeLessThan(end.getTime());
    }
  });

  it("distribution is roughly uniform across the 24h window", () => {
    const now = new Date(Date.UTC(2026, 4, 8, 0, 0, 0));
    const buckets = new Array(24).fill(0);
    const N = 24000;
    for (let i = 0; i < N; i++) {
      const drop = pickDropAt(now);
      buckets[drop.getUTCHours()]++;
    }
    const expected = N / 24; // 1000 per bucket
    for (const count of buckets) {
      // Allow ±3-sigma slack (sqrt(1000) ≈ 31.6 → 95): generous.
      expect(count).toBeGreaterThan(expected - 200);
      expect(count).toBeLessThan(expected + 200);
    }
  });

  it("crosses month boundary correctly when 'now' is end-of-month", () => {
    const now = new Date(Date.UTC(2026, 4, 31, 23, 30, 0)); // 2026-05-31
    const drop = pickDropAt(now);
    // Tomorrow is 2026-06-01.
    expect(drop.getUTCMonth()).toBe(5); // June (0-indexed)
    expect(drop.getUTCDate()).toBe(1);
  });
});
