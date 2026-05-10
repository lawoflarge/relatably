import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { LeaderboardScreen } from "./LeaderboardScreen";

jest.mock("@/src/lib/api", () => ({
  fetchLeaderboard: jest.fn(),
}));

import * as apiMod from "@/src/lib/api";

describe("LeaderboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches daily/global on mount and renders rows", async () => {
    (apiMod.fetchLeaderboard as jest.Mock).mockResolvedValueOnce({
      entries: [
        { user_id: "u1", handle: "@a", score: 1500, daily_rank: 1, locale: "en" },
        { user_id: "u2", handle: "@b", score: 1000, daily_rank: 2, locale: "en" },
      ],
    });
    const { findByText } = render(<LeaderboardScreen isSignedIn={true} />);
    await findByText("@a");
    await findByText("@b");
  });

  it("re-fetches on period change", async () => {
    (apiMod.fetchLeaderboard as jest.Mock).mockResolvedValue({ entries: [] });
    const { findByText } = render(<LeaderboardScreen isSignedIn={true} />);
    await findByText(/daily/i);
    fireEvent.press(await findByText(/all-time/i));
    await waitFor(() =>
      expect(apiMod.fetchLeaderboard).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: "alltime" }),
      ),
    );
  });

  it("blocks scope=friends when not signed in", async () => {
    (apiMod.fetchLeaderboard as jest.Mock).mockResolvedValue({ entries: [] });
    const { queryByText } = render(<LeaderboardScreen isSignedIn={false} />);
    expect(queryByText(/sign in to see friend leaderboards/i)).toBeTruthy();
  });
});

describe("LeaderboardScreen ad row injection", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
    jest.clearAllMocks();
  });

  it("injects banner ad row at index 10 when there are >=11 entries", async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      user_id: `u-${i}`,
      handle: `user${i}`,
      score: 1000 - i,
      daily_rank: i + 1,
      locale: "en",
    }));
    (require("@/src/lib/api").fetchLeaderboard as jest.Mock).mockResolvedValue({ entries });

    const { findByTestId } = render(<LeaderboardScreen isSignedIn={false} />);
    expect(await findByTestId("banner-ad-slot-disabled")).toBeTruthy();
  });

  it("does NOT inject ad row when fewer than 11 entries", async () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      user_id: `u-${i}`,
      handle: `user${i}`,
      score: 1000 - i,
      daily_rank: i + 1,
      locale: "en",
    }));
    (require("@/src/lib/api").fetchLeaderboard as jest.Mock).mockResolvedValue({ entries });

    const { queryByTestId, findByText } = render(<LeaderboardScreen isSignedIn={false} />);
    await findByText("user0");
    expect(queryByTestId("banner-ad-slot-disabled")).toBeNull();
  });
});
