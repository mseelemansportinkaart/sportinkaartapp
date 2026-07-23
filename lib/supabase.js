import { createClient } from '@supabase/supabase-js'

// Prefer EXPO_PUBLIC_ env vars (set in .env locally / EAS build env). Fall back
// to the project defaults so builds and CI work without extra setup. The
// publishable key is safe to ship in a client bundle.
//
// `||`, not `??`: an unset GitHub Actions secret expands to an *empty string*,
// and Expo inlines these at build time — so `??` would keep the empty value and
// createClient() throws "supabaseUrl is required" on launch. Empty is as absent
// as undefined here.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ytyljpykccckvzitwcpo.supabase.co'
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_GypXMpnAuLb9yNzZ3uhHDA_8WqPiY2i'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)