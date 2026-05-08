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
    const now = Date.now();
    const cutoff = now - this.cfg.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (arr.length >= this.cfg.limit) {
      const retryAfterMs = arr[0] + this.cfg.windowMs - now;
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
    if (count > this.cfg.limit) {
      return { ok: false, retryAfterMs: this.cfg.windowMs };
    }
    return { ok: true, retryAfterMs: 0 };
  }
}

let cached: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis");
    const redis = new Redis({ url, token });
    cached = new UpstashRateLimiter(redis, { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS });
  } else {
    cached = new MemoryRateLimiter({ limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS });
  }
  return cached;
}

/** Test-only escape hatch to reset the memoized limiter between cases. */
export function __resetRateLimiterForTest(): void {
  cached = null;
}
