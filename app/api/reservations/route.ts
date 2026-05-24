import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock, getIdempotencyEntry, setIdempotencyEntry } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";
import { ok, conflict, badRequest, serverError } from "@/lib/api";

const RESERVATION_TTL_MINUTES = parseInt(
  process.env.RESERVATION_TTL_MINUTES ?? "10",
  10
);

export async function GET() {
  const reservations = await prisma.reservation.findMany({
    include: { product: true, warehouse: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reservations);
}

export async function POST(req: NextRequest) {
  // ── Idempotency ──────────────────────────────────────────────────────────
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotencyEntry(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  // ── Validate body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const lockKey = `stock:${productId}:${warehouseId}`;

  // ── Acquire distributed lock ─────────────────────────────────────────────
  // This is the critical section. Only one request per product+warehouse can
  // run at a time, so two simultaneous requests for the last unit will be
  // serialised here: the first wins and reserves it; the second re-reads
  // the stock level, sees 0 available, and returns 409.
  const lockToken = await acquireLock(lockKey);
  if (!lockToken) {
    // Another request is mid-flight for the same SKU; ask client to retry
    return NextResponse.json(
      { error: "Another reservation is in progress, please retry" },
      { status: 429 }
    );
  }

  try {
    // ── Check stock inside the lock ────────────────────────────────────────
    const stock = await prisma.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stock) {
      const resp = badRequest("No stock record found for this product/warehouse combination");
      await maybeCacheIdempotency(idempotencyKey, 400, { error: "No stock record found for this product/warehouse combination" });
      return resp;
    }

    const available = stock.total - stock.reserved;
    if (available < quantity) {
      const body = { error: `Only ${available} unit(s) available` };
      await maybeCacheIdempotency(idempotencyKey, 409, body);
      return conflict(`Only ${available} unit(s) available`);
    }

    // ── Atomic reserve: increment reserved + create reservation row ────────
    const expiresAt = new Date(
      Date.now() + RESERVATION_TTL_MINUTES * 60 * 1_000
    );

    const [, reservation] = await prisma.$transaction([
      prisma.stockLevel.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      }),
      prisma.reservation.create({
        data: { productId, warehouseId, quantity, status: "PENDING", expiresAt },
        include: { product: true, warehouse: true },
      }),
    ]);

    const responseBody = {
      id: reservation.id,
      productId: reservation.productId,
      productName: reservation.product.name,
      warehouseId: reservation.warehouseId,
      warehouseName: reservation.warehouse.name,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
    };

    await maybeCacheIdempotency(idempotencyKey, 201, responseBody);
    return ok(responseBody, 201);
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

async function maybeCacheIdempotency(
  key: string | null,
  statusCode: number,
  body: unknown
) {
  if (key) {
    await setIdempotencyEntry(key, statusCode, body);
  }
}
