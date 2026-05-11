import { render } from "@testing-library/react-native";
import { BannerAdSlot } from "./BannerAdSlot";

describe("BannerAdSlot", () => {
  it("renders disabled placeholder when ads off", () => {
    const { getByTestId } = render(<BannerAdSlot slot="leaderboard_banner" />);
    expect(getByTestId("banner-ad-slot-disabled")).toBeTruthy();
  });

  it("renders sticker-style placeholder content", () => {
    const { getByText, getByTestId } = render(<BannerAdSlot slot="archive_banner" />);
    expect(getByTestId("banner-ad-slot-disabled")).toBeTruthy();
    expect(getByText("SPONSORED")).toBeTruthy();
  });
});
