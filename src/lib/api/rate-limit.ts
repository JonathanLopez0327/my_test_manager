// Lightweight in-memory token bucket per (key, IP). Designed for the public,
// unauthenticated endpoints (signup, beta-request, demo-request) that
// otherwise let an attacker burn the Resend quota or spam the signup_requests
// table. Not a substitute for a distributed limiter behind a load balancer —
// when the app is multi-instance, swap this for Redis/Upstash.

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const BUCKETS: Map<string, Bucket> = new Map();
const BUCKET_TTL_MS = 60 * 60 * 1000;

let lastSweepAt = 0;
function sweep(now: number) {
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  for (const [key, bucket] of BUCKETS.entries()) {
    if (now - bucket.updatedAt > BUCKET_TTL_MS) {
      BUCKETS.delete(key);
    }
  }
}

export type RateLimitConfig = {
  /** Logical name of the limiter — keeps separate buckets per route. */
  key: string;
  /** Bucket capacity (max burst). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
};

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function rateLimit(
  config: RateLimitConfig,
  identifier: string,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);

  const bucketKey = `${config.key}:${identifier}`;
  const existing = BUCKETS.get(bucketKey);

  let tokens: number;
  if (!existing) {
    tokens = config.capacity;
  } else {
    const elapsedSec = Math.max(0, (now - existing.updatedAt) / 1000);
    tokens = Math.min(
      config.capacity,
      existing.tokens + elapsedSec * config.refillPerSecond,
    );
  }

  if (tokens < 1) {
    BUCKETS.set(bucketKey, { tokens, updatedAt: now });
    const deficit = 1 - tokens;
    const retryAfter = Math.ceil(deficit / config.refillPerSecond);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  tokens -= 1;
  BUCKETS.set(bucketKey, { tokens, updatedAt: now });
  return { allowed: true, remaining: Math.floor(tokens) };
}

// Test-only helper. Exported because the in-memory map is module-scoped.
export function __resetRateLimitForTests() {
  BUCKETS.clear();
  lastSweepAt = 0;
}
