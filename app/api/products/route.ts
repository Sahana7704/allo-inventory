import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  // Lazy expiry: clean up before returning stock so callers see fresh numbers
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stockLevels: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = products.map((p: typeof products[number]) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    stock: p.stockLevels.map((s: typeof p.stockLevels[number]) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  }));

  return NextResponse.json(result);
}
