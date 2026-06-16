// ─────────────────────────────────────────────────────────────────────────────
// prisma.js — ⚠️ DEAD DUPLICATE of lib/prisma.ts. DO NOT USE.
//
// This is a bare PrismaClient with NO pg adapter and NO `schema: 'procdna_database'`
// binding. Every `@/lib/prisma` import currently resolves to the .ts version
// (TS/the bundler picks .ts before .js), so this file is never loaded today.
//
// RISK: if extension-resolution order ever flips, queries would silently target
// the default `public` schema and the whole DB layer would break with "table does
// not exist". Safe to delete. (See audit C2 / R3.)
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client"

export const prisma =
  globalThis.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma
}