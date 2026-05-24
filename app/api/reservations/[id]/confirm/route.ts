import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIdempotencyEntry, setIdempotencyEntry } from "@/lib/redis";
import { ok, gone, notFound, conflict } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Idempotency ──────────────────────────────────────────────────────────
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotencyEntry(`confirm:${idempotencyKey}`);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.statusCode });
    }
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) return notFound("Reservation not found");

  if (reservation.status === "CONFIRMED") {
    return conflict("Reservation is already confirmed");
  }

  if (
    reservation.status === "RELEASED" ||
    reservation.expiresAt < new Date()
  ) {
    // If it was PENDING but expired, release the stock and mark it
    if (reservation.status === "PENDING" && reservation.expiresAt < new Date()) {
      await prisma.$transaction([
        prisma.reservation.update({ where: { id }, data: { status: "RELEASED" } }),
        prisma.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: { reserved: { decrement: reservation.quantity } },
        }),
      ]);
    }

    const body = { error: "Reservation has expired" };
    if (idempotencyKey) await setIdempotencyEntry(`confirm:${idempotencyKey}`, 410, body);
    return gone("Reservation has expired");
  }

  // Confirm: stock already reserved, now permanently "sold"
  // We decrement reserved (and total) to finalise the sale
  await prisma.$transaction([
    prisma.reservation.update({ where: { id }, data: { status: "CONFIRMED" } }),
    prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        total: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    }),
  ]);

  const body = { id, status: "CONFIRMED", message: "Reservation confirmed. Payment recorded." };
  if (idempotencyKey) await setIdempotencyEntry(`confirm:${idempotencyKey}`, 200, body);
  return ok(body);
}
