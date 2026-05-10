import { describe, it, expect } from "vitest";
import { batchTokens } from "./batchTokens";

describe("batchTokens", () => {
  it("returns one batch when count <= size", () => {
    const tokens = ["a", "b", "c"];
    expect(batchTokens(tokens, 500)).toEqual([["a", "b", "c"]]);
  });

  it("splits into batches of exactly size when count is a multiple", () => {
    const tokens = Array.from({ length: 1000 }, (_, i) => `t${i}`);
    const batches = batchTokens(tokens, 500);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(500);
  });

  it("last batch is smaller when count is not a multiple", () => {
    const tokens = Array.from({ length: 1234 }, (_, i) => `t${i}`);
    const batches = batchTokens(tokens, 500);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(500);
    expect(batches[2]).toHaveLength(234);
  });

  it("returns empty array for empty input", () => {
    expect(batchTokens([], 500)).toEqual([]);
  });

  it("uses default size 500 when none provided", () => {
    const tokens = Array.from({ length: 600 }, (_, i) => `t${i}`);
    const batches = batchTokens(tokens);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(500);
    expect(batches[1]).toHaveLength(100);
  });
});
