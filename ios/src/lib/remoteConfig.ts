// v1.0 ships without @react-native-firebase/remote-config because RNFB
// Remote Config + Messaging Swift modules can't find FirebaseAuth-Swift.h
// under the current Expo SDK 54 + RNFB v22 + use_modular_headers! combo.
// All callers fall back to the supplied default, which matches the
// server-side defaults (drop_enabled=true, fanout_enabled=true,
// submit_rate_limit_per_min=10). Server side `api/src/lib/remoteConfig.ts`
// still honors live Remote Config -- the client just trusts defaults.
//
// Reintroduce in v1.0.1 alongside the fix for the RNFB iOS build chain.

let _initialized = false;

export function __resetRemoteConfigForTest(): void {
  _initialized = false;
}

export async function getKillSwitch<T extends boolean | number>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _key: string,
  fallback: T,
): Promise<T> {
  if (!_initialized) _initialized = true;
  return fallback;
}
