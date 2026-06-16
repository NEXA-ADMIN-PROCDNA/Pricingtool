// ─────────────────────────────────────────────────────────────────────────────
// supabase.ts — file storage layer (SOW & PO documents).
//
// Big picture: NEXA stores uploaded SOW/PO files in Supabase Storage buckets and
// serves them via short-lived signed URLs. The service-role key is used because
// auth is NextAuth, not Supabase Auth — so Supabase RLS is bypassed and access
// control is OUR responsibility in the API routes.
//
// Two halves:
//   • getSupabase()  — lazy singleton client (never built at module load, so a
//     missing env var doesn't crash the whole bundle just by importing this file).
//   • getSignedUrl() — wraps Supabase's 1-hour signed URLs with a 55-min in-memory
//     cache so repeated list calls don't re-sign the same path every time.
//
// NOTE (AWS migration): this whole file is what gets rewritten for S3 —
// getSupabase → S3 client, getSignedUrl → @aws-sdk/s3-request-presigner. Keep the
// bucket PRIVATE and use an EC2 instance role (no static keys). (See audit A3.)
// RISK (AWS): the urlCache Map below never evicts expired entries — on a
// long-lived EC2 process it grows unbounded (slow memory leak). Self-cleans on
// Vercel because instances recycle. (See audit A5.)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const SOW_BUCKET = 'SoW_bucket'
export const PO_BUCKET  = 'PO_bucket'

// ── Singleton client ─────────────────────────────────────────────
const g = globalThis as unknown as { _supabase?: SupabaseClient }

function makeSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

export function getSupabase(): SupabaseClient {
  if (!g._supabase) g._supabase = makeSupabase()
  return g._supabase
}

// ── Signed URL cache ─────────────────────────────────────────────
// Supabase signed URLs are valid for 3600s. We cache for 55 min so
// cached URLs always have at least 5 min left when served.
const CACHE_TTL_MS = 55 * 60 * 1000

type CacheEntry = { url: string; expiresAt: number }
const urlCache = new Map<string, CacheEntry>()

export async function getSignedUrl(bucket: string, storagePath: string): Promise<string | null> {
  const key = `${bucket}::${storagePath}`
  const hit = urlCache.get(key)

  if (hit && hit.expiresAt > Date.now()) return hit.url

  const { data } = await getSupabase().storage.from(bucket).createSignedUrl(storagePath, 3600)
  if (!data?.signedUrl) return null

  urlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + CACHE_TTL_MS })
  return data.signedUrl
}
