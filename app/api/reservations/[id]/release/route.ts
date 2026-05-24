import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, conflict } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) return notFound("Reservation not found");

  if (reservation.status === "CONFIRMED") {
    return conflict("Cannot release a confirmed reservation");
  }

  if (reservation.status === "RELEASED") {
    return ok({ id, status: "RELEASED", message: "Already released" });
  }

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

  return ok({ id, status: "RELEASED", message: "Reservation cancelled. Units returned to stock." });
}
