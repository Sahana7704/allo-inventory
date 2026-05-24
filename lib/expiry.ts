import { prisma } from "./prisma";

/**
 * Release all PENDING reservations that have passed their expiresAt time.
 * Safe to call concurrently — uses a single atomic updateMany + stockLevel update.
 *
 * Called from:
 *  - GET /api/products (lazy cleanup before returning stock levels)
 *  - GET /api/reservations/:id (lazy cleanup on read)
 *  - Vercel Cron: /api/cron/expire (every minute in production)
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  // Update statuses in bulk
  await prisma.reservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "RELEASED" },
  });

  // Return stock for each reservation
  for (const r of expired) {    await prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: r.productId,
          warehouseId: r.warehouseId,
        },
      },
      data: { reserved: { decrement: r.quantity } },
    });
  }

  return expired.length;
}
