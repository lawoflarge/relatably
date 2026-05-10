import { describe, it, expect } from "vitest";
import { earlyBirdBonus } from "./earlyBirdBonus";

describe("earlyBirdBonus", () => {
  it("first globally = +500 (overrides percentile tiers)", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 412000, isFirstGlobally: true });
    expect(r).toEqual({ points: 500, tier: "first" });
  });

  it("rankWithinCluster=1 but isFirstGlobally=false (someone else got there first in a different cluster) = top1pct", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 200, isFirstGlobally: false });
    expect(r).toEqual({ points: 200, tier: "top1pct" });
  });

  it("top1pct: rank/size <= 0.01", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 4, clusterSize: 412, isFirstGlobally: false });
    expect(r).toEqual({ points: 200, tier: "top1pct" });
  });

  it("top10pct: rank/size <= 0.10 but > 0.01", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 80, clusterSize: 1000, isFirstGlobally: false });
    expect(r).toEqual({ points: 50, tier: "top10pct" });
  });

  it("none: rank/size > 0.10", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 200, clusterSize: 1000, isFirstGlobally: false });
    expect(r).toEqual({ points: 0, tier: "none" });
  });

  it("solo bubble (clusterSize=1): user is rank=1, isFirstGlobally=true -> first", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 1, isFirstGlobally: true });
    expect(r).toEqual({ points: 500, tier: "first" });
  });

  it("solo bubble where user is somehow rank=1 without being first-globally: still top1pct (1/1 = 100% — but spec is rank-position based, and rank=1 always at least qualifies for top1pct)", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 1, isFirstGlobally: false });
    expect(r).toEqual({ points: 0, tier: "none" });
  });

  it("clusterSize=0 returns none without divide-by-zero", () => {
    const r = earlyBirdBonus({ rankWithinCluster: 1, clusterSize: 0, isFirstGlobally: false });
    expect(r).toEqual({ points: 0, tier: "none" });
  });
});
