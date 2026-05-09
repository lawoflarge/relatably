import React from "react";
import { render, act } from "@testing-library/react-native";

jest.mock("@/src/lib/shareCard", () => ({
  shareCardImage: jest.fn(),
}));

import { RevealAnimation } from "./RevealAnimation";
import type { YesterdayCluster } from "../types/api";

const clusters: YesterdayCluster[] = Array.from({ length: 10 }, (_, i) => ({
  id: `c-${i + 1}`,
  canonical_text: `answer-${i + 1}`,
  submission_count: 1000 - i * 100,
  final_rank: i + 1,
  final_pct_of_total: (1000 - i * 100) / 5500,
}));

describe("RevealAnimation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the question text", () => {
    const { getByText } = render(
      <RevealAnimation
        questionText="what's overrated?"
        clusters={clusters}
        selfClusterId={null}
        onComplete={() => {}}
        intervalMs={1}
      />,
    );
    expect(getByText("what's overrated?")).toBeTruthy();
  });

  it("calls onComplete after all 10 bubbles + final hold", async () => {
    const onComplete = jest.fn();
    render(
      <RevealAnimation
        questionText="q"
        clusters={clusters}
        selfClusterId={null}
        onComplete={onComplete}
        intervalMs={1}
      />,
    );

    // 10 bubbles × 1ms + 2ms final hold = 12ms; advance generously.
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders the verdict text (rank-1 canonical_text) eventually", () => {
    const { getByText } = render(
      <RevealAnimation
        questionText="q"
        clusters={clusters}
        selfClusterId={null}
        onComplete={() => {}}
        intervalMs={1}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(50);
    });
    // The rank-1 cluster's canonical_text should now be visible somewhere.
    expect(getByText(/answer-1/i)).toBeTruthy();
  });
});
