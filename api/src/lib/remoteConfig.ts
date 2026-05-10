import { getRemoteConfig, type RemoteConfigTemplate } from "firebase-admin/remote-config";
import { getApps } from "firebase-admin/app";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  template: RemoteConfigTemplate;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

export function __resetRemoteConfigCacheForTest(): void {
  cache = null;
}

async function getTemplate(): Promise<RemoteConfigTemplate> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.template;
  }
  // adminFirestore from ./firebase already initialised the default app via
  // the module side-effect; use it here without re-importing the helper to
  // keep this module independent of route-handler import order.
  const app = getApps()[0];
  const template = await getRemoteConfig(app).getTemplate();
  cache = { template, fetchedAt: now };
  return template;
}

function readRaw(template: RemoteConfigTemplate, key: string): string | undefined {
  const param = template.parameters?.[key];
  if (!param) return undefined;
  const dv = param.defaultValue as { value?: string } | undefined;
  return dv?.value;
}

/**
 * Reads a Firebase Remote Config kill-switch with a 5-min cache.
 *
 * If the Remote Config fetch fails (network, transient API outage), falls back
 * to the supplied default — kill-switches must NEVER take the system down.
 *
 * Ported from firebase/functions/src/lib/remoteConfig.ts (commit bac352c)
 * for the Vercel + GitHub Actions cron architecture pivot. Uses console.warn
 * instead of firebase-functions logger (not installed in api/).
 */
export async function getKillSwitch<T extends boolean | number>(
  key: string,
  fallback: T,
): Promise<T> {
  let template: RemoteConfigTemplate;
  try {
    template = await getTemplate();
  } catch (err) {
    console.warn("remoteConfig.getKillSwitch: fetch failed; using fallback", {
      key,
      error: (err as Error).message,
    });
    return fallback;
  }
  const raw = readRaw(template, key);
  if (raw === undefined) return fallback;
  if (typeof fallback === "boolean") {
    return (raw === "true") as T;
  }
  // number
  const n = Number(raw);
  if (Number.isFinite(n)) return n as T;
  return fallback;
}
