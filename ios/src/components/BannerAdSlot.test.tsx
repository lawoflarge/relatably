import { render } from "@testing-library/react-native";
import { BannerAdSlot } from "./BannerAdSlot";

describe("BannerAdSlot", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    // Force-reset cached env in ads.ts. We import here only when needed
    // because the test doesn't otherwise depend on the module.
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
  });

  it("renders disabled placeholder when ads off", () => {
    const { getByTestId } = render(<BannerAdSlot slot="leaderboard_banner" />);
    expect(getByTestId("banner-ad-slot-disabled")).toBeTruthy();
  });

  it("placeholder is fixed height (50pt) for predictable layout", () => {
    const { getByTestId } = render(<BannerAdSlot slot="archive_banner" />);
    const node = getByTestId("banner-ad-slot-disabled");
    const flat = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style)
      : node.props.style;
    expect(flat.height).toBe(50);
  });
});
