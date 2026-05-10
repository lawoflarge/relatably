import { describe, it, expect } from "vitest";
import { computeFinalRanks } from "./computeFinalRanks";

describe("computeFinalRanks", () => {
  it("ranks clusters by submission_count descending starting at 1", () => {
    const ranks = computeFinalRanks([
      { id: "a", submission_count: 100 },
      { id: "b", submission_count: 300 },
      { id: "c", submission_count: 50 },
    ]);
    expect(ranks).toEqual([
      { id: "b", final_rank: 1, final_pct_of_total: 300 / 450 },
      { id: "a", final_rank: 2, final_pct_of_total: 100 / 450 },
      { id: "c", final_rank: 3, final_pct_of_total: 50 / 450 },
    ]);
  });

  it("breaks ties by lex-ascending id (deterministic)", () => {
    const ranks = computeFinalRanks([
      { id: "z", submission_count: 100 },
      { id: "a", submission_count: 100 },
      { id: "m", submission_count: 100 },
    ]);
    expect(ranks.map((r) => r.id)).toEqual(["a", "m", "z"]);
    expect(ranks.map((r) => r.final_rank)).toEqual([1, 2, 3]);
  });

  it("returns empty array for empty input", () => {
    expect(computeFinalRanks([])).toEqual([]);
  });

  it("handles a single cluster (rank 1, 100% of total)", () => {
    const ranks = computeFinalRanks([{ id: "solo", submission_count: 42 }]);
    expect(ranks).toEqual([
      { id: "solo", final_rank: 1, final_pct_of_total: 1 },
    ]);
  });

  it("emits final_pct_of_total = 0 when total is 0 (defensive)", () => {
    const ranks = computeFinalRanks([
      { id: "a", submission_count: 0 },
      { id: "b", submission_count: 0 },
    ]);
    expect(ranks[0].final_pct_of_total).toBe(0);
    expect(ranks[1].final_pct_of_total).toBe(0);
  });
});
