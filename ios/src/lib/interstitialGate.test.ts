import { hasShownInterstitialFor, markInterstitialShownFor } from "./interstitialGate";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";

describe("interstitialGate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns false when SecureStore has no entry", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await hasShownInterstitialFor("q-1")).toBe(false);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("interstitial_seen_q-1");
  });

  it("returns true when SecureStore has the key", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("1");
    expect(await hasShownInterstitialFor("q-1")).toBe(true);
  });

  it("marks the SecureStore key", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    await markInterstitialShownFor("q-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("interstitial_seen_q-1", "1");
  });
});
