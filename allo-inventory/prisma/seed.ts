import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  // Warehouses
  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Hub", location: "Mumbai, Maharashtra" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi Central", location: "New Delhi, Delhi" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore South", location: "Bengaluru, Karnataka" },
    }),
  ]);

  console.log("✅ Created 3 warehouses");

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Premium Wireless Headphones",
        sku: "AUDIO-WH-001",
        description: "Studio-quality sound with 40-hour battery life and active noise cancellation.",
        price: 8999,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard TKL",
        sku: "PERIPH-KB-002",
        description: "Compact tenkeyless layout with Cherry MX switches and RGB backlight.",
        price: 6499,
        imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "4K Ultrawide Monitor",
        sku: "DISPLAY-UM-003",
        description: "34-inch curved IPS display with 144Hz refresh rate and HDR400.",
        price: 42999,
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Office Chair",
        sku: "FURN-CH-004",
        description: "Lumbar support mesh chair with adjustable armrests and headrest.",
        price: 18500,
        imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Hub 12-in-1",
        sku: "PERIPH-HUB-005",
        description: "Dual 4K HDMI, 100W PD, Gigabit Ethernet, SD card reader.",
        price: 3299,
        imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Webcam 4K Pro",
        sku: "CAMERA-WC-006",
        description: "4K 30fps with auto-focus, built-in stereo microphone and privacy cover.",
        price: 11999,
        imageUrl: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // Stock levels — deliberately sparse to make the reservation race interesting
  const stockData = [
    // Headphones: plentiful in Mumbai, low in Delhi (good for demo), none in Bangalore
    { product: products[0], warehouse: mumbai, total: 50 },
    { product: products[0], warehouse: delhi, total: 3 },
    // Keyboard: only 1 unit in Mumbai (perfect for showing 409)
    { product: products[1], warehouse: mumbai, total: 1 },
    { product: products[1], warehouse: delhi, total: 20 },
    { product: products[1], warehouse: bangalore, total: 8 },
    // Monitor: low stock everywhere
    { product: products[2], warehouse: mumbai, total: 4 },
    { product: products[2], warehouse: bangalore, total: 2 },
    // Chair: good stock
    { product: products[3], warehouse: mumbai, total: 15 },
    { product: products[3], warehouse: delhi, total: 12 },
    { product: products[3], warehouse: bangalore, total: 9 },
    // USB Hub: abundant
    { product: products[4], warehouse: mumbai, total: 100 },
    { product: products[4], warehouse: delhi, total: 80 },
    { product: products[4], warehouse: bangalore, total: 60 },
    // Webcam: limited
    { product: products[5], warehouse: mumbai, total: 6 },
    { product: products[5], warehouse: delhi, total: 4 },
  ];

  await Promise.all(
    stockData.map(({ product, warehouse, total }) =>
      prisma.stockLevel.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          total,
          reserved: 0,
        },
      })
    )
  );

  console.log(`✅ Created ${stockData.length} stock level entries`);
  console.log("🎉 Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
