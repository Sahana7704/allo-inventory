# Allo Inventory — Take-Home Exercise

Multi-warehouse inventory reservation platform built with Next.js 15, Prisma, PostgreSQL, and Redis.

## Local Setup

### 1. Clone & install
```bash
git clone <repo>
cd allo-inventory
npm install
```

### 2. Environment variables
```bash
cp .env.example .env
# Fill in DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

### 3. Push schema + seed
```bash
npx prisma db push
npx prisma db seed
```

### 4. Run
```bash
npm run dev
```

---

## How Concurrency Is Handled

When `POST /api/reservations` is called, we acquire a Redis distributed lock using `SET lock:{productId}:{warehouseId} {token} NX PX 10000`:

- `NX` (only set if key does not exist) is an atomic test-and-set — only one caller wins the lock at a time.
- Inside the lock we re-read stock from Postgres and check availability before committing the reservation in a Prisma transaction.
- The losing request gets a 429 and should retry with backoff.

This guarantees exactly one reservation is created when two requests race for the last unit.

## Reservation Expiry

Two mechanisms work together:

1. **Lazy cleanup** — `GET /api/products` and `GET /api/reservations/:id` call `releaseExpiredReservations()` before returning data, so stock counts are always fresh on reads.
2. **Vercel Cron** — `vercel.json` schedules `GET /api/cron/expire` every minute in production to sweep expired reservations even if nobody is browsing.

## Idempotency (Bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` accept an `Idempotency-Key` header. Duplicate requests with the same key return the cached response from Redis (24-hour TTL) without repeating the side effect.

## Trade-offs

- Used `reserved` column on StockLevel (denormalized) for fast reads instead of summing PENDING reservations.
- Used Redis locking instead of `SELECT FOR UPDATE` — works across stateless serverless instances.
- `prisma db push` used for simplicity; production should use `prisma migrate deploy`.
- With more time: E2E concurrency tests, retry logic on 429, graceful Redis fallback to advisory locks.
