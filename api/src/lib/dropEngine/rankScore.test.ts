import { describe, it, expect } from "vitest";
import { rankScore } from "./rankScore";

describe("rankScore", () => {
  it("verdict: cluster #1 = 1000 pts", () => {
    const r = rankScore({ clusterRank: 1, totalClusters: 50, clusterCount: 412000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 1000, tier: "verdict" });
  });

  it("top3: cluster #2 = 500 pts", () => {
    const r = rankScore({ clusterRank: 2, totalClusters: 50, clusterCount: 200000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 500, tier: "top3" });
  });

  it("top3: cluster #3 = 500 pts", () => {
    const r = rankScore({ clusterRank: 3, totalClusters: 50, clusterCount: 100000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 500, tier: "top3" });
  });

  it("top10: cluster #4 = 250 pts", () => {
    const r = rankScore({ clusterRank: 4, totalClusters: 50, clusterCount: 50000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 250, tier: "top10" });
  });

  it("top100: cluster #11 = 100 pts (most-specific tier wins over top1pct)", () => {
    const r = rankScore({ clusterRank: 11, totalClusters: 5000, clusterCount: 50000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 100, tier: "top100" });
  });

  it("top1pct by submission count when cluster rank > 100", () => {
    const r = rankScore({ clusterRank: 250, totalClusters: 5000, clusterCount: 12000, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 50, tier: "top1pct" });
  });

  it("participation: outside top 100 AND below 1% threshold = 10 pts", () => {
    const r = rankScore({ clusterRank: 250, totalClusters: 5000, clusterCount: 100, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 10, tier: "participation" });
  });

  it("participation: solo bubble (count=1) far down the tail = 10 pts", () => {
    const r = rankScore({ clusterRank: 4999, totalClusters: 5000, clusterCount: 1, totalSubmissions: 1_000_000 });
    expect(r).toEqual({ points: 10, tier: "participation" });
  });

  it("handles edge case: only 1 cluster total (everyone agreed)", () => {
    const r = rankScore({ clusterRank: 1, totalClusters: 1, clusterCount: 50, totalSubmissions: 50 });
    expect(r).toEqual({ points: 1000, tier: "verdict" });
  });

  it("handles totalSubmissions=0 without divide-by-zero", () => {
    const r = rankScore({ clusterRank: 250, totalClusters: 1, clusterCount: 0, totalSubmissions: 0 });
    expect(r).toEqual({ points: 10, tier: "participation" });
  });
});
