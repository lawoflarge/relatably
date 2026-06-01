import { render } from "@testing-library/react-native";
import { BannerAdSlot } from "./BannerAdSlot";

describe("BannerAdSlot", () => {
  it("renders nothing (banner placements are disabled)", () => {
    const { toJSON } = render(<BannerAdSlot slot="leaderboard_banner" />);
    expect(toJSON()).toBeNull();
  });

  it("renders nothing for the archive slot too", () => {
    const { toJSON } = render(<BannerAdSlot slot="archive_banner" />);
    expect(toJSON()).toBeNull();
  });
});
