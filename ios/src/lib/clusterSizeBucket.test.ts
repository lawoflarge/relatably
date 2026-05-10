// ios/src/lib/clusterSizeBucket.test.ts
import { clusterSizeBucket } from "./clusterSizeBucket";

describe("clusterSizeBucket", () => {
  it("returns 'xl' at ratio ≥ 0.85", () => {
    expect(clusterSizeBucket(3204, 3204)).toBe("xl");
    expect(clusterSizeBucket(2723, 3204)).toBe("xl");
  });

  it("returns 'l' at 0.40..0.84", () => {
    expect(clusterSizeBucket(1892, 3204)).toBe("l");
  });

  it("returns 'm' at 0.20..0.39", () => {
    expect(clusterSizeBucket(987, 3204)).toBe("m");
  });

  it("returns 's' at 0.08..0.19", () => {
    expect(clusterSizeBucket(389, 3204)).toBe("s");
  });

  it("returns 'xs' below 0.08", () => {
    expect(clusterSizeBucket(18, 3204)).toBe("xs");
  });

  it("returns 'xs' when max is 0 (degenerate)", () => {
    expect(clusterSizeBucket(0, 0)).toBe("xs");
  });
});
