type Slot = "leaderboard_banner" | "archive_banner" | "post_reveal_interstitial";

const TEST_BANNER = "ca-app-pub-3940256099942544/2934735716";
const TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/4411468910";
// Real AdMob unit for Relatably (app ca-app-pub-6563643868702361~4571132569).
const PROD_INTERSTITIAL = "ca-app-pub-6563643868702361/2000809540";

let cachedEnabled: boolean | undefined;
let initStarted = false;
let nonPersonalized = false;

export function __resetAdsForTest(): void {
  cachedEnabled = undefined;
  initStarted = false;
  nonPersonalized = false;
}

export function isAdsEnabled(): boolean {
  if (cachedEnabled === undefined) {
    // Ads ship enabled in release builds. In dev they stay opt-in via env so the
    // simulator and the jest suite are ad-free unless explicitly turned on.
    cachedEnabled = !__DEV__ || process.env.EXPO_PUBLIC_ADMOB_ENABLED === "true";
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
      return (
        process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ??
        (__DEV__ ? TEST_INTERSTITIAL : PROD_INTERSTITIAL)
      );
  }
}

// Requests App Tracking Transparency (falling back to non-personalized ads when
// declined) and initializes the Mobile Ads SDK exactly once. Safe to call on
// every app launch; it no-ops after the first run and when ads are disabled.
export async function initAdsAndAtt(): Promise<void> {
  if (!isAdsEnabled() || initStarted) return;
  initStarted = true;

  try {
    const tt = await import("expo-tracking-transparency");
    let status = (await tt.getTrackingPermissionsAsync()).status;
    if (status === "undetermined") {
      status = (await tt.requestTrackingPermissionsAsync()).status;
    }
    nonPersonalized = status !== "granted";
  } catch {
    // No ATT module / web: serve non-personalized ads to be safe.
    nonPersonalized = true;
  }

  try {
    const { default: mobileAds, MaxAdContentRating } = await import(
      "react-native-google-mobile-ads"
    );
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
    });
    await mobileAds().initialize();
  } catch (e) {
    console.warn("ads init failed", e);
  }
}

export interface InterstitialController {
  show: () => Promise<void>;
  dispose: () => void;
}

// Loads a single post-reveal interstitial (video-capable). Resolves to null if
// ads are disabled or nothing fills, so callers can always proceed silently.
export async function loadInterstitialOnce(): Promise<InterstitialController | null> {
  if (!isAdsEnabled()) return null;
  try {
    const { InterstitialAd, AdEventType } = await import(
      "react-native-google-mobile-ads"
    );
    const ad = InterstitialAd.createForAdRequest(
      getAdUnitId("post_reveal_interstitial"),
      { requestNonPersonalizedAdsOnly: nonPersonalized },
    );

    const loaded = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (v: boolean) => {
        if (settled) return;
        settled = true;
        unsubLoaded();
        unsubError();
        resolve(v);
      };
      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => finish(true));
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
      setTimeout(() => finish(false), 8000);
      ad.load();
    });

    if (!loaded) return null;

    return {
      show: () =>
        new Promise<void>((resolve) => {
          const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
            unsubClosed();
            resolve();
          });
          try {
            ad.show();
          } catch {
            unsubClosed();
            resolve();
          }
        }),
      dispose: () => {},
    };
  } catch (e) {
    console.warn("interstitial load failed", e);
    return null;
  }
}
