import { render } from "@testing-library/react-native";
import { ShareCardVerdict } from "./ShareCardVerdict";

describe("ShareCardVerdict", () => {
  const baseProps = {
    verdictText: "PISA TOWER",
    topClusters: [
      { canonical_text: "pizza", final_rank: 2 },
      { canonical_text: "louvre", final_rank: 3 },
      { canonical_text: "colosseum", final_rank: 4 },
    ],
    userRank: 14,
    percentile: 87,
    date: "May 8, 2026",
  };

  it("shows verdict + user rank + percentile", () => {
    const { getByText } = render(<ShareCardVerdict {...baseProps} />);
    expect(getByText("PISA TOWER")).toBeTruthy();
    expect(getByText(/I ranked #14/)).toBeTruthy();
    expect(getByText(/Better than 87%/)).toBeTruthy();
  });

  it("shows up to 6 satellite clusters", () => {
    const tooMany = Array.from({ length: 10 }, (_, i) => ({
      canonical_text: `c${i}`,
      final_rank: i + 2,
    }));
    const { queryAllByTestId } = render(
      <ShareCardVerdict {...baseProps} topClusters={tooMany} />,
    );
    expect(queryAllByTestId("verdict-satellite")).toHaveLength(6);
  });

  it("falls back when userRank is null (anonymous)", () => {
    const { getByText, queryByText } = render(
      <ShareCardVerdict {...baseProps} userRank={null} percentile={null} />,
    );
    expect(getByText(/sign in next time/i)).toBeTruthy();
    expect(queryByText(/I ranked/)).toBeNull();
  });
});
