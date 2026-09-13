/** Sliding-window rate limiter (in-process). Fine for a single Node instance; not shared across replicas. */

type Bucket = number[];

const buckets = new Map<string, Bucket>();

function prune(timestamps: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < timestamps.length && timestamps[i]! < cutoff) i += 1;
  if (i > 0) timestamps.splice(0, i);
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function takeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let timestamps = buckets.get(key);
  if (!timestamps) {
    timestamps = [];
    buckets.set(key, timestamps);
  }
  prune(timestamps, windowMs, now);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }

  timestamps.push(now);
  return { ok: true, remaining: Math.max(0, limit - timestamps.length), retryAfterSec: 0 };
}
