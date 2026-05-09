import { render } from "@testing-library/react-native";
import { ArchiveScreen } from "./ArchiveScreen";

describe("ArchiveScreen", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
  });

  it("shows empty-state copy when no tiles", () => {
    const { getByText } = render(<ArchiveScreen tiles={[]} />);
    expect(getByText(/coming soon/i)).toBeTruthy();
  });

  it("does not render any ad slots when 0 tiles", () => {
    const { queryAllByTestId } = render(<ArchiveScreen tiles={[]} />);
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(0);
  });

  it("injects an ad slot after every 8 tiles", () => {
    const tiles = Array.from({ length: 17 }, (_, i) => ({
      question_id: `q-${i}`,
      verdict_text: `verdict ${i}`,
      thumbnail: null,
    }));
    const { queryAllByTestId } = render(<ArchiveScreen tiles={tiles} />);
    // 17 tiles → 2 ad slots (after tile 8, after tile 16).
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(2);
  });

  it("does not inject ad slot when exactly 7 tiles", () => {
    const tiles = Array.from({ length: 7 }, (_, i) => ({
      question_id: `q-${i}`,
      verdict_text: "x",
      thumbnail: null,
    }));
    const { queryAllByTestId } = render(<ArchiveScreen tiles={tiles} />);
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(0);
  });
});
