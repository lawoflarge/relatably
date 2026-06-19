import { getKillSwitch } from "./remoteConfig";

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;

export class MemoryRateLimiter implements RateLimiter {
  private hits: Map<string, number[]> = new Map();
  constructor(private cfg: RateLimitConfig) {}

  async check(key: string): Promise<RateLimitResult> {
    const effectiveLimit = await getKillSwitch("submit_rate_limit_per_min", this.cfg.limit);
    const now = Date.now();
    const cutoff = now - this.cfg.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (arr.length >= effectiveLimit) {
      const retryAfterMs = (arr[0] ?? now) + this.cfg.windowMs - now;
      this.hits.set(key, arr);
      return { ok: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { ok: true, retryAfterMs: 0 };
  }
}

/**
 * Upstash Redis sliding-window limiter. Lazy-imported so the package is only
 * pulled in when env vars say "use Upstash". Tests don't import this branch.
 */
class UpstashRateLimiter implements RateLimiter {
  private redis: { eval: (script: string, keys: string[], args: string[]) => Promise<number> };

  constructor(redis: any, private cfg: RateLimitConfig) {
    this.redis = redis;
  }

  async check(key: string): Promise<RateLimitResult> {
    const effectiveLimit = await getKillSwitch("submit_rate_limit_per_min", this.cfg.limit);
    const now = Date.now();
    const cutoff = now - this.cfg.windowMs;
    const script = `
      redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", ARGV[2])
      redis.call("ZADD", KEYS[1], ARGV[1], ARGV[1])
      redis.call("EXPIRE", KEYS[1], ARGV[3])
      return redis.call("ZCARD", KEYS[1])
    `;
    const count = await this.redis.eval(
      script,
      [`rl:${key}`],
      [String(now), String(cutoff), String(Math.ceil(this.cfg.windowMs / 1000))],
    );
    if (count > effectiveLimit) {
      return { ok: false, retryAfterMs: this.cfg.windowMs };
    }
    return { ok: true, retryAfterMs: 0 };
  }
}

const DAILY_LIMIT = 50;
const DAILY_WINDOW_MS = 86_400_000;

let cached: RateLimiter | null = null;
let cachedDaily: RateLimiter | null = null;

function buildLimiter(cfg: RateLimitConfig): RateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis");
    const redis = new Redis({ url, token });
    return new UpstashRateLimiter(redis, cfg);
  }
  // Fail loudly in production: an in-memory limiter is per-instance and useless
  // on serverless, so it silently leaves the endpoint unthrottled.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[ratelimit] FALLING BACK TO IN-MEMORY RATE LIMITER IN PRODUCTION — " +
        "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset. " +
        "Rate limiting is INEFFECTIVE across serverless instances. " +
        "Set both env vars in the Vercel production environment.",
    );
  }
  return new MemoryRateLimiter(cfg);
}

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  cached = buildLimiter({ limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS });
  return cached;
}

/** Per-device daily-window limiter (24h) for anonymous Firestore-write endpoints. */
export function getDailyRateLimiter(): RateLimiter {
  if (cachedDaily) return cachedDaily;
  cachedDaily = buildLimiter({ limit: DAILY_LIMIT, windowMs: DAILY_WINDOW_MS });
  return cachedDaily;
}

/** Test-only escape hatch to reset the memoized limiter between cases. */
export function __resetRateLimiterForTest(): void {
  cached = null;
  cachedDaily = null;
}
