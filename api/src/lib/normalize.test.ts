import { describe, it, expect } from "vitest";
import { normalize, clusterId } from "./normalize";

describe("normalize", () => {
  it("trims whitespace", () => {
    expect(normalize("  italy  ")).toBe("italy");
  });

  it("lowercases", () => {
    expect(normalize("ITALY")).toBe("italy");
    expect(normalize("Italy")).toBe("italy");
  });

  it("strips leading articles", () => {
    expect(normalize("the italy")).toBe("italy");
    expect(normalize("a pizza")).toBe("pizza");
    expect(normalize("an eiffel tower")).toBe("eiffel tower");
  });

  it("strips trailing punctuation", () => {
    expect(normalize("italy.")).toBe("italy");
    expect(normalize("italy!")).toBe("italy");
    expect(normalize("italy?")).toBe("italy");
    expect(normalize("italy...")).toBe("italy");
  });

  it("collapses multiple spaces", () => {
    expect(normalize("pisa  tower")).toBe("pisa tower");
    expect(normalize("pisa   tower")).toBe("pisa tower");
  });

  it("combines all rules together", () => {
    expect(normalize("  The Italy.  ")).toBe("italy");
    expect(normalize("  THE  Pisa   Tower !!! ")).toBe("pisa tower");
  });

  it("does NOT collapse semantically different text", () => {
    expect(normalize("italy")).not.toBe(normalize("italian"));
    expect(normalize("pisa tower")).not.toBe(normalize("leaning tower of pisa"));
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles emoji-only text", () => {
    expect(normalize("🇮🇹")).toBe("🇮🇹");
  });

  it("preserves emoji within words", () => {
    expect(normalize("italy 🇮🇹")).toBe("italy 🇮🇹");
  });
});

describe("clusterId", () => {
  it("returns deterministic sha256 for question_id + normalized text", () => {
    expect(clusterId("q1", "italy")).toBe(clusterId("q1", "italy"));
  });

  it("differs across questions", () => {
    expect(clusterId("q1", "italy")).not.toBe(clusterId("q2", "italy"));
  });

  it("differs across normalized texts", () => {
    expect(clusterId("q1", "italy")).not.toBe(clusterId("q1", "italian"));
  });

  it("returns a 64-char hex string", () => {
    expect(clusterId("q1", "italy")).toMatch(/^[a-f0-9]{64}$/);
  });
});
