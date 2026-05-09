import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateToxicity, __resetPerspectiveForTest } from "./perspective";

const ORIGINAL_FETCH = globalThis.fetch;

describe("evaluateToxicity (functions)", () => {
  beforeEach(() => {
    __resetPerspectiveForTest();
    process.env.PERSPECTIVE_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.PERSPECTIVE_API_KEY;
  });

  it("returns skipped when key unset", async () => {
    delete process.env.PERSPECTIVE_API_KEY;
    __resetPerspectiveForTest();
    const r = await evaluateToxicity("anything");
    expect(r.skipped).toBe(true);
    expect(r.verdict).toBe("pass");
  });

  it("blocks on high TOXICITY", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.91 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.10 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("you are an idiot");
    expect(r.verdict).toBe("block");
  });

  it("passes on low scores", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.10 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
  });

  it("fails open on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("net down")) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.skipped).toBe(true);
  });
});
