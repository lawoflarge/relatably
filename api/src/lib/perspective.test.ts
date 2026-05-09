import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateToxicity, __resetPerspectiveForTest } from "./perspective";

const ORIGINAL_FETCH = globalThis.fetch;

describe("evaluateToxicity", () => {
  beforeEach(() => {
    __resetPerspectiveForTest();
    process.env.PERSPECTIVE_API_KEY = "test-key";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    delete process.env.PERSPECTIVE_API_KEY;
  });

  it("returns skipped:true when PERSPECTIVE_API_KEY is unset", async () => {
    delete process.env.PERSPECTIVE_API_KEY;
    __resetPerspectiveForTest();
    const r = await evaluateToxicity("anything");
    expect(r).toEqual({ verdict: "pass", score: 0, skipped: true });
  });

  it("returns block when TOXICITY >= 0.85", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.92 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.10 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("you are an idiot");
    expect(r.verdict).toBe("block");
    expect(r.score).toBeCloseTo(0.92, 2);
    expect(r.skipped).toBe(false);
  });

  it("returns block when SEVERE_TOXICITY >= 0.50", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.40 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.55 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("severe slur here");
    expect(r.verdict).toBe("block");
  });

  it("returns pass when both scores below threshold", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.20 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
        },
      }),
    }) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.score).toBeCloseTo(0.20, 2);
  });

  it("fails open (pass) when Perspective returns non-ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.skipped).toBe(true);
  });

  it("fails open (pass) when fetch throws", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as any;
    const r = await evaluateToxicity("italy");
    expect(r.verdict).toBe("pass");
    expect(r.skipped).toBe(true);
  });

  it("posts the comment text + requestedAttributes to the API URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY:        { summaryScore: { value: 0.10 } },
          SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
        },
      }),
    });
    globalThis.fetch = mockFetch as any;
    await evaluateToxicity("italy");
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("commentanalyzer.googleapis.com");
    expect(String(url)).toContain("key=test-key");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.comment.text).toBe("italy");
    expect(body.requestedAttributes).toEqual({ TOXICITY: {}, SEVERE_TOXICITY: {} });
  });
});
