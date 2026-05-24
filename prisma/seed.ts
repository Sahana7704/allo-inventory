const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({
  host: "db.shjznmcgaywyxbavnuyp.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Harish@77200",
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.warehouse.create({ data: { name: "Mumbai Hub", location: "Mumbai, Maharashtra" } }),
    prisma.warehouse.create({ data: { name: "Delhi Central", location: "New Delhi, Delhi" } }),
    prisma.warehouse.create({ data: { name: "Bangalore South", location: "Bengaluru, Karnataka" } }),
  ]);

  console.log("✅ Created 3 warehouses");

  const products = await Promise.all([
    prisma.product.create({ data: { name: "Premium Wireless Headphones", sku: "AUDIO-WH-001", description: "Studio-quality sound with 40-hour battery life.", price: 8999, imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400" } }),
    prisma.product.create({ data: { name: "Mechanical Keyboard TKL", sku: "PERIPH-KB-002", description: "Compact tenkeyless layout with Cherry MX switches.", price: 6499, imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400" } }),
    prisma.product.create({ data: { name: "4K Ultrawide Monitor", sku: "DISPLAY-UM-003", description: "34-inch curved IPS display with 144Hz refresh rate.", price: 42999, imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400" } }),
    prisma.product.create({ data: { name: "Ergonomic Office Chair", sku: "FURN-CH-004", description: "Lumbar support mesh chair with adjustable armrests.", price: 18500, imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400" } }),
    prisma.product.create({ data: { name: "USB-C Hub 12-in-1", sku: "PERIPH-HUB-005", description: "Dual 4K HDMI, 100W PD, Gigabit Ethernet.", price: 3299, imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400" } }),
    prisma.product.create({ data: { name: "Webcam 4K Pro", sku: "CAMERA-WC-006", description: "4K 30fps with auto-focus and built-in microphone.", price: 11999, imageUrl: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400" } }),
  ]);

  console.log("✅ Created 6 products");

  await Promise.all([
    prisma.stockLevel.create({ data: { productId: products[0].id, warehouseId: mumbai.id, total: 50, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[0].id, warehouseId: delhi.id, total: 3, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[1].id, warehouseId: mumbai.id, total: 1, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[1].id, warehouseId: delhi.id, total: 20, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[1].id, warehouseId: bangalore.id, total: 8, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[2].id, warehouseId: mumbai.id, total: 4, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[2].id, warehouseId: bangalore.id, total: 2, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[3].id, warehouseId: mumbai.id, total: 15, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[3].id, warehouseId: delhi.id, total: 12, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[3].id, warehouseId: bangalore.id, total: 9, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[4].id, warehouseId: mumbai.id, total: 100, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[4].id, warehouseId: delhi.id, total: 80, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[4].id, warehouseId: bangalore.id, total: 60, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[5].id, warehouseId: mumbai.id, total: 6, reserved: 0 } }),
    prisma.stockLevel.create({ data: { productId: products[5].id, warehouseId: delhi.id, total: 4, reserved: 0 } }),
  ]);

  console.log("✅ Created 15 stock level entries");
  console.log("🎉 Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());