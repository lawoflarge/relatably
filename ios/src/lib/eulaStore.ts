import * as SecureStore from "expo-secure-store";

const KEY = "tos_accepted_version";

// Bump this when you publish a material change to the terms; users will be
// re-prompted to accept the new version on next launch.
export const CURRENT_TOS_VERSION = "2026-05-13";

export async function hasAcceptedTos(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(KEY);
  return v === CURRENT_TOS_VERSION;
}

export async function recordTosAcceptance(): Promise<void> {
  await SecureStore.setItemAsync(KEY, CURRENT_TOS_VERSION);
}
