import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  host: "db.shjznmcgaywyxbavnuyp.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Harish@77200",
  ssl: { rejectUnauthorized: false },
});

export default defineConfig({
  earlyAccess: true,
  migrate: {
    adapter: new PrismaPg(pool),
    seed: "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts",
  },
});