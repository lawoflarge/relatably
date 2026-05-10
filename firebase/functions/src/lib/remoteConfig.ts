import { getRemoteConfig, type RemoteConfigTemplate } from "firebase-admin/remote-config";
import { logger } from "firebase-functions/v2";
import { getAdminApp } from "./admin";

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
  const template = await getRemoteConfig(getAdminApp()).getTemplate();
  cache = { template, fetchedAt: now };
  return template;
}

function readRaw(template: RemoteConfigTemplate, key: string): string | undefined {
  const param = template.parameters?.[key];
  if (!param) return undefined;
  const dv = param.defaultValue as { value?: string } | undefined;
  return dv?.value;
}

export async function getKillSwitch<T extends boolean | number>(
  key: string,
  fallback: T,
): Promise<T> {
  let template: RemoteConfigTemplate;
  try {
    template = await getTemplate();
  } catch (err) {
    logger.warn("remoteConfig.getKillSwitch: fetch failed; using fallback", {
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
