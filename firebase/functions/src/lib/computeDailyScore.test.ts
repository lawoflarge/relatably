import { describe, it, expect } from "vitest";
import { computeDailyScore } from "./computeDailyScore";

describe("computeDailyScore", () => {
  it("worked example from spec: '4th globally to submit Pisa Tower' = 1000 + 500 = 1500", () => {
    const r = computeDailyScore({
      clusterRank: 1,
      totalClusters: 50,
      clusterCount: 412000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 4,
      isFirstGlobally: false,
    });
    expect(r.rankScore.points).toBe(1000);
    expect(r.earlyBird.points).toBe(200);
    expect(r.total).toBe(1200);
  });

  it("worked example from spec: 'Pisa Tower at T+22h, 411,995th' = 1000 + 0 = 1000", () => {
    const r = computeDailyScore({
      clusterRank: 1,
      totalClusters: 50,
      clusterCount: 412000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 411995,
      isFirstGlobally: false,
    });
    expect(r.rankScore.points).toBe(1000);
    expect(r.earlyBird.points).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("worked example from spec: 'Eiffel Tower (final #4) at T+5min as 80th' = 250 + 50 = 300", () => {
    const r1 = computeDailyScore({
      clusterRank: 4,
      totalClusters: 50,
      clusterCount: 50000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 80,
      isFirstGlobally: false,
    });
    expect(r1.total).toBe(250 + 200);

    const r2 = computeDailyScore({
      clusterRank: 4,
      totalClusters: 50,
      clusterCount: 1000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 80,
      isFirstGlobally: false,
    });
    expect(r2.total).toBe(250 + 50);
  });

  it("first-globally on the verdict cluster = max possible 1500", () => {
    const r = computeDailyScore({
      clusterRank: 1,
      totalClusters: 50,
      clusterCount: 412000,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 1,
      isFirstGlobally: true,
    });
    expect(r.total).toBe(1500);
    expect(r.rankScore.tier).toBe("verdict");
    expect(r.earlyBird.tier).toBe("first");
  });

  it("participation+none = 10 (minimum non-zero score)", () => {
    const r = computeDailyScore({
      clusterRank: 200,
      totalClusters: 5000,
      clusterCount: 100,
      totalSubmissions: 1_000_000,
      rankWithinCluster: 90,
      isFirstGlobally: false,
    });
    expect(r.total).toBe(10);
  });
});
