import * as SecureStore from "expo-secure-store";

const PREFIX = "interstitial_seen_";

export async function hasShownInterstitialFor(questionId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${PREFIX}${questionId}`);
  return v === "1";
}

export async function markInterstitialShownFor(questionId: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}${questionId}`, "1");
}
