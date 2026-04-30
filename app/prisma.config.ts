import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "tsx prisma/seed.ts",   // 👈 ADD THIS
  },
datasource: {
  url: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,   // add this
},
});