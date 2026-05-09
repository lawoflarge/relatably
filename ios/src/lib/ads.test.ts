import { isAdsEnabled, getAdUnitId, loadInterstitialOnce, __resetAdsForTest } from "./ads";

describe("ads adapter", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    delete process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID;
    delete process.env.EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID;
    delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID;
    __resetAdsForTest();
  });

  it("isAdsEnabled is false by default", () => {
    expect(isAdsEnabled()).toBe(false);
  });

  it("isAdsEnabled is true only when EXPO_PUBLIC_ADMOB_ENABLED === 'true'", () => {
    process.env.EXPO_PUBLIC_ADMOB_ENABLED = "true";
    __resetAdsForTest();
    expect(isAdsEnabled()).toBe(true);

    process.env.EXPO_PUBLIC_ADMOB_ENABLED = "false";
    __resetAdsForTest();
    expect(isAdsEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_ADMOB_ENABLED = "1";
    __resetAdsForTest();
    expect(isAdsEnabled()).toBe(false);
  });

  it("getAdUnitId returns AdMob test unit when env unset", () => {
    expect(getAdUnitId("leaderboard_banner")).toBe("ca-app-pub-3940256099942544/2934735716");
    expect(getAdUnitId("archive_banner")).toBe("ca-app-pub-3940256099942544/2934735716");
    expect(getAdUnitId("post_reveal_interstitial")).toBe("ca-app-pub-3940256099942544/4411468910");
  });

  it("getAdUnitId returns env-driven id when set", () => {
    process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID = "ca-app-pub-1111/leaderboard";
    __resetAdsForTest();
    expect(getAdUnitId("leaderboard_banner")).toBe("ca-app-pub-1111/leaderboard");
  });

  it("loadInterstitialOnce returns null when ads disabled", async () => {
    const r = await loadInterstitialOnce();
    expect(r).toBeNull();
  });
});
