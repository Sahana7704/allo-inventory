let redis: any = null;

async function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function acquireLock(key: string): Promise<string | null> {
  const r = await getRedis();
  if (!r) return "no-redis-token";
  const token = crypto.randomUUID();
  const result = await r.set(`lock:${key}`, token, { nx: true, px: 10000 });
  return result === "OK" ? token : null;
}

export async function releaseLock(key: string, token: string): Promise<void> {
  const r = await getRedis();
  if (!r || token === "no-redis-token") return;
  const current = await r.get(`lock:${key}`);
  if (current === token) await r.del(`lock:${key}`);
}

export async function getIdempotencyEntry(key: string): Promise<{ statusCode: number; body: unknown } | null> {
  const r = await getRedis();
  if (!r) return null;
  const val = await r.get(`idem:${key}`);
  return val ?? null;
}

export async function setIdempotencyEntry(key: string, statusCode: number, body: unknown): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  await r.set(`idem:${key}`, { statusCode, body }, { ex: 86400 });
}
