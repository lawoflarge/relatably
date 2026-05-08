import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";

const KEY = "relatably.device_token";

export async function getDeviceToken(): Promise<string> {
  let token = await SecureStore.getItemAsync(KEY);
  if (token) return token;

  const ifv = await Application.getIosIdForVendorAsync().catch(() => null);
  token = ifv ?? `anon-${cryptoRandom()}`;
  await SecureStore.setItemAsync(KEY, token);
  return token;
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
