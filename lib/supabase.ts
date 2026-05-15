import { createClient } from '@supabase/supabase-js'

export const SOW_BUCKET = 'SoW_bucket'
export const PO_BUCKET  = 'PO_busket'

export function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}
