import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("Missing Upstash Redis environment variables");
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

const LOCK_TTL_MS = 10_000; // 10 second max lock duration

/**
 * Acquire a distributed lock using Redis SET NX PX.
 * Returns the lock token if acquired, null if the lock is already held.
 */
export async function acquireLock(key: string): Promise<string | null> {
  const r = getRedis();
  const token = crypto.randomUUID();
  const result = await r.set(`lock:${key}`, token, {
    nx: true,
    px: LOCK_TTL_MS,
  });
  return result === "OK" ? token : null;
}

/**
 * Release a lock only if we still hold it (compare-and-delete).
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  const r = getRedis();
  const current = await r.get(`lock:${key}`);
  if (current === token) {
    await r.del(`lock:${key}`);
  }
}

/**
 * Get an idempotency cache entry.
 */
export async function getIdempotencyEntry(
  key: string
): Promise<{ statusCode: number; body: unknown } | null> {
  const r = getRedis();
  const val = await r.get<{ statusCode: number; body: unknown }>(
    `idem:${key}`
  );
  return val ?? null;
}

/**
 * Store an idempotency cache entry with 24-hour expiry.
 */
export async function setIdempotencyEntry(
  key: string,
  statusCode: number,
  body: unknown
): Promise<void> {
  const r = getRedis();
  await r.set(
    `idem:${key}`,
    { statusCode, body },
    { ex: 24 * 60 * 60 } // 24 hours
  );
}
