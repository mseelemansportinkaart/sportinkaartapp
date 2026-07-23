import { createClient } from '@supabase/supabase-js'

// Prefer EXPO_PUBLIC_ env vars (set in .env locally / EAS build env). Fall back
// to the project defaults so builds and CI work without extra setup. The
// publishable key is safe to ship in a client bundle.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ytyljpykccckvzitwcpo.supabase.co'
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_GypXMpnAuLb9yNzZ3uhHDA_8WqPiY2i'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)