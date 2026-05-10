import remoteConfig from "@react-native-firebase/remote-config";

const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000;

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await remoteConfig().setConfigSettings({
    minimumFetchIntervalMillis: MIN_FETCH_INTERVAL_MS,
  });
  initialized = true;
}

/** Test-only escape hatch. */
export function __resetRemoteConfigForTest(): void {
  initialized = false;
}

/**
 * Reads a Firebase Remote Config kill-switch on iOS, mirroring the
 * api/src/lib/remoteConfig.ts contract.
 *
 * - 5-min minimumFetchIntervalMillis (the SDK throttles itself).
 * - On any fetch failure (network, transient API outage), returns the
 *   caller-supplied fallback. Kill-switches must never break the client.
 * - When the key is not set in Remote Config (source=='static'), also
 *   returns fallback so unprovisioned keys behave like local defaults.
 *
 * Used to read drop_enabled, fanout_enabled, submit_rate_limit_per_min
 * (fanout_enabled is server-side; the client doesn't act on it but reading
 * it keeps a single contract).
 */
export async function getKillSwitch<T extends boolean | number>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    await ensureInit();
    await remoteConfig().fetchAndActivate();
  } catch (err) {
    console.warn("remoteConfig.getKillSwitch: fetch failed; using fallback", {
      key,
      error: (err as Error).message,
    });
    return fallback;
  }
  const value = remoteConfig().getValue(key);
  if (value.getSource() === "static") return fallback;
  const raw = value.asString();
  if (typeof fallback === "boolean") {
    return (raw === "true") as T;
  }
  // number
  const n = Number(raw);
  if (Number.isFinite(n)) return n as T;
  return fallback;
}
