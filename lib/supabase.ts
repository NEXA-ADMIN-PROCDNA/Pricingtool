import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const SOW_BUCKET = 'SoW_bucket'
export const PO_BUCKET  = 'PO_busket'

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
