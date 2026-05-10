type Slot = "leaderboard_banner" | "archive_banner" | "post_reveal_interstitial";

const TEST_BANNER = "ca-app-pub-3940256099942544/2934735716";
const TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/4411468910";

let cachedEnabled: boolean | undefined;

export function __resetAdsForTest(): void {
  cachedEnabled = undefined;
}

export function isAdsEnabled(): boolean {
  if (cachedEnabled === undefined) {
    cachedEnabled = process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";
  }
  return cachedEnabled;
}

export function getAdUnitId(slot: Slot): string {
  switch (slot) {
    case "leaderboard_banner":
      return process.env.EXPO_PUBLIC_ADMOB_LEADERBOARD_BANNER_ID ?? TEST_BANNER;
    case "archive_banner":
      return process.env.EXPO_PUBLIC_ADMOB_ARCHIVE_BANNER_ID ?? TEST_BANNER;
    case "post_reveal_interstitial":
      return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? TEST_INTERSTITIAL;
  }
}

export interface InterstitialController {
  show: () => Promise<void>;
  dispose: () => void;
}

export async function loadInterstitialOnce(): Promise<InterstitialController | null> {
  if (!isAdsEnabled()) return null;
  // v1.0 ships without the AdMob native module; isAdsEnabled() is hard-
  // gated to false via env, so this code path is unreachable at runtime.
  // Reintroduce in v1.0.1 once the RNFB + useFrameworks=static clash is
  // resolved -- at which point swap this stub back to a dynamic import.
  return null;
}
