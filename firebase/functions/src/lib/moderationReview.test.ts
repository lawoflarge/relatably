import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./perspective", () => ({
  evaluateToxicity: vi.fn(),
}));

import { reviewSubmission } from "./moderationReview";
import { evaluateToxicity } from "./perspective";

describe("reviewSubmission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the perspective verdict directly when block", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "block",
      score: 0.93,
      skipped: false,
    });
    const r = await reviewSubmission({ raw_text: "you idiot" });
    expect(r).toEqual({ verdict: "block", score: 0.93, skipped: false });
  });

  it("returns pass when verdict is pass", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "pass",
      score: 0.10,
      skipped: false,
    });
    const r = await reviewSubmission({ raw_text: "italy" });
    expect(r.verdict).toBe("pass");
  });

  it("returns skipped when perspective is skipped (no API key)", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "pass",
      score: 0,
      skipped: true,
    });
    const r = await reviewSubmission({ raw_text: "italy" });
    expect(r.skipped).toBe(true);
    expect(r.verdict).toBe("pass");
  });

  it("forwards raw_text to evaluateToxicity verbatim", async () => {
    (evaluateToxicity as any).mockResolvedValue({
      verdict: "pass",
      score: 0,
      skipped: false,
    });
    await reviewSubmission({ raw_text: "  Italy  " });
    expect(evaluateToxicity).toHaveBeenCalledWith("  Italy  ");
  });
});
